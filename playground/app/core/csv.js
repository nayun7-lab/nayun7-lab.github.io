// csv.js — In-browser CSV upload pipeline.
//
// 1. Read file as ArrayBuffer.
// 2. Decode UTF-8 (BOM-tolerant) or EUC-KR (fallback).
// 3. Parse rows respecting RFC 4180 quoting.
// 4. Infer column types per cell heuristic.
// 5. Insert into a target table in chunked transactions.
//
// Exports a single async function uploadCsvToTable() and a few helpers.

const INT_RE  = /^-?\d+$/;
const REAL_RE = /^-?\d+\.\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Decode a CSV file's bytes. Returns { text, encoding, hadBom }.
 */
export async function decodeFile(file) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);

    // UTF-8 BOM (EF BB BF)
    const hadBom =
        bytes.length >= 3 &&
        bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    const start = hadBom ? 3 : 0;

    // Try UTF-8 strict first.
    try {
        const text = new TextDecoder("utf-8", { fatal: true })
            .decode(bytes.subarray(start));
        return { text, encoding: "utf-8", hadBom };
    } catch {
        // fall through to EUC-KR
    }
    try {
        const text = new TextDecoder("euc-kr").decode(bytes.subarray(start));
        return { text, encoding: "euc-kr", hadBom };
    } catch {
        // last-ditch lossy UTF-8
        const text = new TextDecoder("utf-8").decode(bytes.subarray(start));
        return { text, encoding: "utf-8 (lossy)", hadBom };
    }
}

/**
 * Parse a CSV text string. Returns { header, rows }.
 * Supports RFC 4180-style quoted fields and embedded commas/newlines.
 */
export function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                cur += c;
            }
        } else {
            if (c === '"') {
                inQuotes = true;
            } else if (c === ",") {
                row.push(cur);
                cur = "";
            } else if (c === "\r") {
                // ignore — \n handles row end
            } else if (c === "\n") {
                row.push(cur);
                rows.push(row);
                row = [];
                cur = "";
            } else {
                cur += c;
            }
        }
    }
    if (cur !== "" || row.length) {
        row.push(cur);
        rows.push(row);
    }
    // Drop trailing empty row that often appears for files ending in newline
    while (rows.length && rows[rows.length - 1].every((v) => v === "")) {
        rows.pop();
    }
    if (!rows.length) return { header: [], rows: [] };
    return { header: rows[0], rows: rows.slice(1) };
}

/**
 * Heuristic column-type inference. Returns one of: INTEGER, REAL, TEXT.
 */
export function inferType(values) {
    const nonEmpty = values.filter((v) => v !== "");
    if (!nonEmpty.length) return "TEXT";
    if (nonEmpty.every((v) => INT_RE.test(v))) return "INTEGER";
    if (nonEmpty.every((v) => INT_RE.test(v) || REAL_RE.test(v))) return "REAL";
    // DATE / TIME — store as TEXT per SQLite convention
    return "TEXT";
}

/**
 * Sanitize a candidate identifier (table or column name) for SQLite quoting safety.
 * Returns a string that can be safely wrapped in "double quotes" — i.e. the
 * input with `"` replaced by `""`. Also trims surrounding whitespace.
 */
export function sanitizeIdent(name) {
    return String(name ?? "").trim().replace(/"/g, '""');
}

/**
 * Build CREATE TABLE SQL given a table name, column names, and types map.
 */
export function buildCreate(table, header, types, opts = {}) {
    const drop = opts.drop ? `DROP TABLE IF EXISTS "${sanitizeIdent(table)}";\n` : "";
    const cols = header.map((c) => `    "${sanitizeIdent(c)}" ${types[c] || "TEXT"}`);
    return `${drop}CREATE TABLE "${sanitizeIdent(table)}" (\n${cols.join(",\n")}\n);`;
}

/**
 * Run a chunked INSERT into an existing table.
 * @param {Function} exec   engine.exec async function
 * @param {string}   table
 * @param {string[]} header
 * @param {string[][]} rows
 * @param {Object<string,string>} types
 * @param {number} [chunk=200]
 */
export async function bulkInsert(exec, table, header, rows, types, chunk = 200) {
    const cols = header.map((c) => `"${sanitizeIdent(c)}"`).join(", ");
    const tbl = `"${sanitizeIdent(table)}"`;
    await exec("BEGIN TRANSACTION;");
    try {
        for (let i = 0; i < rows.length; i += chunk) {
            const slice = rows.slice(i, i + chunk);
            const valuesSql = slice
                .map((row) => {
                    const padded = row.slice(0, header.length);
                    while (padded.length < header.length) padded.push("");
                    const lits = padded.map((v, j) => _sqlLiteral(v, types[header[j]] || "TEXT"));
                    return "(" + lits.join(", ") + ")";
                })
                .join(",\n");
            await exec(`INSERT INTO ${tbl} (${cols}) VALUES\n${valuesSql};`);
        }
        await exec("COMMIT;");
    } catch (e) {
        try { await exec("ROLLBACK;"); } catch {}
        throw e;
    }
}

function _sqlLiteral(value, type) {
    if (value === "" || value === null || value === undefined) return "NULL";
    if (type === "INTEGER") return INT_RE.test(value) ? value : `'${String(value).replace(/'/g, "''")}'`;
    if (type === "REAL")    return (INT_RE.test(value) || REAL_RE.test(value)) ? value : `'${String(value).replace(/'/g, "''")}'`;
    return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * High-level upload: decode → parse → infer types → CREATE + INSERT.
 * Returns { table, columnCount, rowCount, encoding, hadBom, types }.
 *
 * If `tableName` already exists, `opts.mode = 'replace' | 'append' | 'fail'`
 * decides behavior (default 'replace').
 */
export async function uploadCsvToTable({ engine, file, tableName, mode = "replace" }) {
    const { text, encoding, hadBom } = await decodeFile(file);
    const { header, rows } = parseCsv(text);
    if (!header.length) throw new Error("CSV에 헤더 행이 없습니다.");
    if (!rows.length)   throw new Error("CSV에 데이터 행이 없습니다.");

    const types = {};
    for (let j = 0; j < header.length; j++) {
        const sample = rows.map((r) => (j < r.length ? r[j] : ""));
        types[header[j]] = inferType(sample);
    }

    const safeTable = tableName || file.name.replace(/\.csv$/i, "").replace(/[^A-Za-z0-9가-힣_]/g, "_");

    // CREATE
    if (mode === "fail") {
        const ts = await engine.listTables();
        if (ts.includes(safeTable)) {
            throw new Error(`테이블 '${safeTable}'이 이미 존재합니다 (mode=fail).`);
        }
    }
    if (mode !== "append") {
        await engine.exec(buildCreate(safeTable, header, types, { drop: true }));
    }

    await bulkInsert(engine.exec, safeTable, header, rows, types);
    return {
        table: safeTable,
        columnCount: header.length,
        rowCount: rows.length,
        encoding, hadBom, types,
    };
}
