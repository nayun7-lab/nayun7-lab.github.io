// exporter.js — Download the current DB (sqlite or SQL) and current results (CSV).
//
// All exports happen entirely client-side. Nothing leaves the browser.

/**
 * Download the underlying SQLite database as a `.sqlite` binary file.
 * Uses sqlite-wasm's Worker1 `export` command.
 *
 * @param {Object} engine — must expose .promiser (the sqlite-wasm promiser)
 * @param {string} filename — suggested download name
 */
export async function exportSqliteFile(engine, filename = "playground.sqlite") {
    if (!engine?.promiser) throw new Error("engine.promiser is unavailable");
    const res = await engine.promiser("export", {});
    const r = res?.result;
    if (!r?.byteArray) throw new Error("export 결과가 비어 있습니다.");
    const blob = new Blob([r.byteArray], { type: r.mimetype || "application/x-sqlite3" });
    _triggerDownload(blob, filename);
}

/**
 * Build a portable SQL dump (CREATE + INSERT) of every user table.
 * Idempotent (each table wrapped with DROP IF EXISTS). Returns the dump text.
 * Accepts anything engine-shaped: { exec(), listTables() }.
 */
export async function buildSqlDump(engine) {
    const tables = await engine.listTables();
    const lines = [];
    lines.push("-- Playground SQL dump — generated " + new Date().toISOString());
    lines.push("PRAGMA foreign_keys = OFF;");
    lines.push("BEGIN TRANSACTION;");
    for (const t of tables) {
        const def = await engine.exec(
            "SELECT sql FROM sqlite_schema WHERE type='table' AND name = ?"
                .replace("?", `'${t.replace(/'/g, "''")}'`)
        );
        const createSql = def.rows[0]?.[0];
        if (!createSql) continue;
        lines.push("");
        lines.push(`DROP TABLE IF EXISTS "${t.replace(/"/g, '""')}";`);
        lines.push(createSql + ";");
        // Rows
        const info = await engine.exec(`PRAGMA table_info("${t.replace(/"/g, '""')}")`);
        const cols = info.rows.map((r) => r[1]);
        const colList = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
        const data = await engine.exec(`SELECT ${colList} FROM "${t.replace(/"/g, '""')}"`);
        const CHUNK = 200;
        for (let i = 0; i < data.rows.length; i += CHUNK) {
            const slice = data.rows.slice(i, i + CHUNK);
            const valuesSql = slice.map((row) => {
                const lits = row.map(_sqlLiteral);
                return "    (" + lits.join(", ") + ")";
            }).join(",\n");
            lines.push(`INSERT INTO "${t.replace(/"/g, '""')}" (${colList}) VALUES`);
            lines.push(valuesSql + ";");
        }
    }
    lines.push("COMMIT;");
    lines.push("PRAGMA foreign_keys = ON;");
    return lines.join("\n") + "\n";
}

/**
 * Build the SQL dump and download it as a .sql file.
 *
 * @param {Object} engine — uses engine.exec() / engine.listTables()
 * @param {string} filename
 */
export async function exportSqlDump(engine, filename = "playground.sql") {
    const text = await buildSqlDump(engine);
    downloadText(text, filename, "application/sql;charset=utf-8");
}

/** Download plain text as a file. */
export function downloadText(text, filename, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([text], { type: mime });
    _triggerDownload(blob, filename);
}

function _sqlLiteral(v) {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(v);
    if (v instanceof Uint8Array) {
        // BLOB → X'...' hex literal
        const hex = Array.from(v).map((b) => b.toString(16).padStart(2, "0")).join("");
        return `X'${hex}'`;
    }
    return "'" + String(v).replace(/'/g, "''") + "'";
}

/**
 * Convert a query result to CSV text and download.
 *
 * @param {{columns: string[], rows: any[][]}} result
 * @param {string} filename
 */
export function exportResultCsv(result, filename = "result.csv") {
    if (!result || !result.columns?.length) {
        throw new Error("저장할 결과가 없습니다.");
    }
    const lines = [];
    lines.push(result.columns.map(_csvCell).join(","));
    for (const row of result.rows) {
        lines.push(row.map(_csvCell).join(","));
    }
    // UTF-8 BOM so Excel opens Korean correctly
    const blob = new Blob(["﻿" + lines.join("\n") + "\n"],
        { type: "text/csv;charset=utf-8" });
    _triggerDownload(blob, filename);
}

function _csvCell(v) {
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" ? String(v) : String(v);
    if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}
