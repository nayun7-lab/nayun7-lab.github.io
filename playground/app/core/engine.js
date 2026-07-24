// engine.js — Worker-backed sqlite-wasm engine.
//
// Tries OPFS first (persistent across reloads, fast, requires COOP/COEP for
// multi-threaded mode but the single-threaded SAH pool also works fine on
// vanilla GitHub Pages). Falls back to in-memory ":memory:" if OPFS is
// unavailable (older browsers, private windows, etc.).
//
// Public API is fully async:
//   const engine = await createEngine({ dbName, seedUrl });
//   const result = await engine.exec("SELECT ...");
//   const tables = await engine.listTables();
//   const schema = await engine.getSchema();
//   await engine.resetToSeed(seedUrl);

import { sqlite3Worker1Promiser } from "../../vendor/sqlite-wasm/index.mjs";

const WORKER_URL = new URL(
    "../../vendor/sqlite-wasm/sqlite3-worker1.mjs",
    import.meta.url
);

/**
 * Create the engine. The returned object has only async methods.
 *
 * @param {Object} opts
 * @param {string} [opts.dbName="playground.db"]  OPFS file name (per origin).
 * @param {string} [opts.seedUrl]                 If the DB is empty / fresh, run this SQL.
 * @returns {Promise<Engine>}
 */
export async function createEngine({ dbName = "playground.db", seedUrl } = {}) {
    const log = (...a) => console.log("[engine]", ...a);

    // Spawn a Worker that hosts sqlite-wasm. The promiser auto-wires onmessage.
    const promiser = await new Promise((resolve) => {
        const p = sqlite3Worker1Promiser({
            worker: () => new Worker(WORKER_URL, { type: "module" }),
            onready: () => resolve(p),
        });
    });
    log("worker promiser ready");

    const cfg = await promiser("config-get", {});
    const vfsList = cfg.result.vfsList || [];
    const opfsAvailable = vfsList.includes("opfs");
    log(`SQLite ${cfg.result.version.libVersion} loaded; VFS list: ${vfsList.join(", ")}`);

    // Open DB. If OPFS is available, use `file:NAME?vfs=opfs` for the standard
    // async OPFS VFS (persistent across reloads).
    let openedFilename;
    let usedVfs = "memory";
    if (opfsAvailable) {
        try {
            const r = await promiser("open", {
                filename: `file:${dbName}?vfs=opfs`,
            });
            openedFilename = r.result.filename;
            usedVfs = "opfs";
        } catch (e) {
            console.warn("[engine] OPFS open failed, falling back to memory:", e);
        }
    }
    if (!openedFilename) {
        const r = await promiser("open", { filename: ":memory:" });
        openedFilename = r.result.filename;
        usedVfs = "memory";
    }
    log(`DB opened: ${openedFilename} (vfs=${usedVfs})`);

    async function exec(sql) {
        const t0 = performance.now();
        const statements = _splitStatements(sql);
        const stmtCount = statements.length;

        // Multi-statement scripts: sqlite-wasm Worker1 fills `resultRows` from
        // the FIRST SELECT and clobbers `columnNames` from the FIRST statement.
        // sqlite3 CLI / extract-expected-output show the LAST SELECT instead,
        // which matches student intuition ("the answer is what came out last").
        // Reconcile: run all-but-last as a script (no rowMode), then run only
        // the last statement with rowMode to harvest its rows.
        const last = statements[stmtCount - 1] || sql;
        const head = stmtCount > 1
            ? statements.slice(0, -1).map(s => s + ";").join("\n")
            : "";

        try {
            if (head) {
                await promiser("exec", { sql: head });
            }
            const res = await promiser("exec", {
                sql: last + ";",
                rowMode: "array",
                resultRows: [],
                columnNames: [],
                countChanges: true,
            });
            const r = res.result || {};
            return {
                columns: r.columnNames || [],
                rows: r.resultRows || [],
                statements: stmtCount,
                lastRowsAffected: r.changeCount ?? 0,
                elapsedMs: performance.now() - t0,
            };
        } catch (raw) {
            // Re-throw structured promiser rejection as a real Error so
            // downstream `e.message` works (translateError needs a string).
            const msg = _extractErrorMessage(raw);
            const err = new Error(msg);
            err.cause = raw;
            throw err;
        }
    }

    function _extractErrorMessage(raw) {
        if (!raw) return "알 수 없는 오류";
        if (typeof raw === "string") return raw;
        if (raw instanceof Error) return raw.message || String(raw);
        // promiser reject shape: { type:'error', result:{message,name,stack}, ... }
        const r = raw.result;
        if (r) {
            if (typeof r === "string") return r;
            if (r.message) return r.message;
            if (r.error)   return typeof r.error === "string" ? r.error : (r.error.message || JSON.stringify(r.error));
        }
        if (raw.message) return raw.message;
        // Fallback: stringify but drop "[object Object]" trash
        try {
            const s = JSON.stringify(raw);
            return s === "{}" ? "알 수 없는 오류" : s;
        } catch {
            return String(raw);
        }
    }

    /**
     * Split a SQL script into separate statement strings. Returns the
     * statement texts (without trailing semicolons), skipping empty pieces
     * and respecting string literals / identifier quotes / comments so
     * `INSERT INTO t VALUES ('a;b');` stays as one statement.
     */
    function _splitStatements(sql) {
        const out = [];
        let cur = [];
        let nonWs = 0;
        let i = 0;
        const len = sql.length;
        let state = "code";
        const flush = () => {
            const s = cur.join("").trim();
            if (s) out.push(s);
            cur = [];
            nonWs = 0;
        };
        while (i < len) {
            const c = sql[i];
            const next = sql[i + 1];
            if (state === "code") {
                if (c === "-" && next === "-") { state = "linecomment"; cur.push(c, next); i += 2; continue; }
                if (c === "/" && next === "*") { state = "blockcomment"; cur.push(c, next); i += 2; continue; }
                if (c === "'") { state = "sq"; cur.push(c); nonWs++; i++; continue; }
                if (c === '"') { state = "dq"; cur.push(c); nonWs++; i++; continue; }
                if (c === "`") { state = "bt"; cur.push(c); nonWs++; i++; continue; }
                if (c === "[") { state = "bracket"; cur.push(c); nonWs++; i++; continue; }
                if (c === ";") { flush(); i++; continue; }
                if (!/\s/.test(c)) nonWs++;
                cur.push(c); i++; continue;
            }
            if (state === "linecomment") { cur.push(c); if (c === "\n") state = "code"; i++; continue; }
            if (state === "blockcomment") {
                cur.push(c);
                if (c === "*" && next === "/") { cur.push(next); state = "code"; i += 2; continue; }
                i++; continue;
            }
            if (state === "sq") {
                cur.push(c);
                if (c === "'" && next === "'") { cur.push(next); i += 2; continue; }
                if (c === "'") { state = "code"; i++; continue; }
                i++; continue;
            }
            if (state === "dq") {
                cur.push(c);
                if (c === '"' && next === '"') { cur.push(next); i += 2; continue; }
                if (c === '"') { state = "code"; i++; continue; }
                i++; continue;
            }
            if (state === "bt") {
                cur.push(c);
                if (c === "`" && next === "`") { cur.push(next); i += 2; continue; }
                if (c === "`") { state = "code"; i++; continue; }
                i++; continue;
            }
            if (state === "bracket") {
                cur.push(c);
                if (c === "]") { state = "code"; i++; continue; }
                i++; continue;
            }
        }
        flush();
        return out;
    }

    /**
     * Count SQL statements in a script. Used purely for the result meta line
     * ("N statements executed"); sqlite-wasm itself handles the actual exec.
     */
    function _countStatements(sql) {
        let n = 0;
        let nonWs = 0;
        let i = 0;
        const len = sql.length;
        let state = "code"; // code | sq | dq | bt | bracket | linecomment | blockcomment
        while (i < len) {
            const c = sql[i];
            const next = sql[i + 1];
            if (state === "code") {
                if (c === "-" && next === "-") { state = "linecomment"; i += 2; continue; }
                if (c === "/" && next === "*") { state = "blockcomment"; i += 2; continue; }
                if (c === "'") { state = "sq"; nonWs++; i++; continue; }
                if (c === '"') { state = "dq"; nonWs++; i++; continue; }
                if (c === "`") { state = "bt"; nonWs++; i++; continue; }
                if (c === "[") { state = "bracket"; nonWs++; i++; continue; }
                if (c === ";") {
                    if (nonWs > 0) { n++; nonWs = 0; }
                    i++; continue;
                }
                if (!/\s/.test(c)) nonWs++;
                i++; continue;
            }
            if (state === "linecomment") {
                if (c === "\n") state = "code";
                i++; continue;
            }
            if (state === "blockcomment") {
                if (c === "*" && next === "/") { state = "code"; i += 2; continue; }
                i++; continue;
            }
            if (state === "sq") {
                if (c === "'" && next === "'") { i += 2; continue; }
                if (c === "'") { state = "code"; i++; continue; }
                i++; continue;
            }
            if (state === "dq") {
                if (c === '"' && next === '"') { i += 2; continue; }
                if (c === '"') { state = "code"; i++; continue; }
                i++; continue;
            }
            if (state === "bt") {
                if (c === "`" && next === "`") { i += 2; continue; }
                if (c === "`") { state = "code"; i++; continue; }
                i++; continue;
            }
            if (state === "bracket") {
                if (c === "]") { state = "code"; i++; continue; }
                i++; continue;
            }
        }
        // Trailing non-terminated statement counts too
        if (nonWs > 0) n++;
        return n;
    }

    async function listTables() {
        const r = await exec(
            "SELECT name FROM sqlite_schema WHERE type='table' " +
            "AND name NOT LIKE 'sqlite_%' ORDER BY name"
        );
        return r.rows.map((row) => row[0]);
    }

    async function listViews() {
        const r = await exec(
            "SELECT name FROM sqlite_schema WHERE type='view' " +
            "AND name NOT LIKE 'sqlite_%' ORDER BY name"
        );
        return r.rows.map((row) => row[0]);
    }

    async function rowCount(table) {
        if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(table)) {
            throw new Error(`invalid table name: ${table}`);
        }
        const r = await exec(`SELECT COUNT(*) FROM "${table}"`);
        return r.rows[0]?.[0] ?? 0;
    }

    async function getSchema() {
        // PRAGMA table_info works for both tables and views in SQLite.
        const names = [...await listTables(), ...await listViews()];
        const schema = {};
        for (const t of names) {
            const r = await exec(`PRAGMA table_info("${t.replace(/"/g, '""')}")`);
            schema[t] = r.rows.map((row) => row[1]);
        }
        return schema;
    }

    async function isEmpty() {
        const tables = await listTables();
        return tables.length === 0;
    }

    async function runSeedIfEmpty(url) {
        if (!url) return false;
        if (!(await isEmpty())) return false;
        const sql = await (await fetch(url)).text();
        const t0 = performance.now();
        await exec(sql);
        log(`seed.sql executed in ${(performance.now() - t0).toFixed(0)} ms`);
        return true;
    }

    async function resetToSeed(url) {
        // Drop ALL user objects (tables + views) in a single script so we don't
        // pay per-roundtrip latency for each DROP.
        const tables = await listTables();
        const views  = await listViews();
        const dropParts = [
            "PRAGMA foreign_keys = OFF;",
            ...views.map((v)  => `DROP VIEW  IF EXISTS "${v.replace(/"/g, '""')}";`),
            ...tables.map((t) => `DROP TABLE IF EXISTS "${t.replace(/"/g, '""')}";`),
            "PRAGMA foreign_keys = ON;",
        ];
        await exec(dropParts.join("\n"));
        if (url) {
            const sql = await (await fetch(url)).text();
            await exec(sql);
        }
    }

    if (seedUrl) {
        await runSeedIfEmpty(seedUrl);
    }

    return {
        exec,
        listTables,
        listViews,
        rowCount,
        getSchema,
        isEmpty,
        resetToSeed,
        vfs: usedVfs,
        filename: openedFilename,
        // expose the underlying promiser for advanced use (e.g. export, dump)
        promiser,
    };
}
