// importer.js — Load a .sqlite DB file, run a .sql script, and save/restore
// editor query tabs. Counterpart of exporter.js.
//
// .sqlite import path (works with both the Worker engine and the main-thread
// engine): bytes → temporary main-thread sqlite3 DB (sqlite3_deserialize) →
// portable SQL dump → wipe current DB → replay dump on the active engine.
// Views/indexes are not carried over — same scope as the .sql export.

import { buildSqlDump } from "./exporter.js";
import { getMainSqlite3 } from "./sqlite3-main.js";

const SQLITE_MAGIC = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66,
                      0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]; // "SQLite format 3\0"

export function looksLikeSqliteFile(bytes) {
    if (!bytes || bytes.length < 16) return false;
    return SQLITE_MAGIC.every((b, i) => bytes[i] === b);
}

/**
 * Replace the current DB contents with the given .sqlite file bytes.
 * Returns { tables, rows } of the imported result.
 */
export async function importSqliteBytes(engine, bytes) {
    if (!looksLikeSqliteFile(bytes)) {
        throw new Error("SQLite 데이터베이스 파일이 아닙니다. .sqlite 또는 .db 파일을 선택하세요.");
    }
    const sqlite3 = await getMainSqlite3();
    const db = new sqlite3.oo1.DB();
    let dump;
    try {
        const p = sqlite3.wasm.allocFromTypedArray(bytes);
        const rc = sqlite3.capi.sqlite3_deserialize(
            db.pointer, "main", p, bytes.byteLength, bytes.byteLength,
            sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
            sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE
        );
        if (rc) throw new Error("DB 파일을 여는 데 실패했습니다 (오류 코드 " + rc + ")");
        dump = await buildSqlDump(_oo1Adapter(db));
    } finally {
        try { db.close(); } catch {}
    }

    await engine.resetToSeed(undefined); // 모든 테이블/뷰 삭제
    await engine.exec(dump);

    const tables = await engine.listTables();
    let rows = 0;
    for (const t of tables) rows += await engine.rowCount(t);
    return { tables: tables.length, rows };
}

/** Minimal engine-shaped adapter over a main-thread oo1.DB for buildSqlDump. */
function _oo1Adapter(db) {
    async function exec(sql) {
        const resultRows = [];
        const columnNames = [];
        db.exec({ sql, rowMode: "array", resultRows, columnNames });
        return { columns: columnNames, rows: resultRows };
    }
    async function listTables() {
        const r = await exec(
            "SELECT name FROM sqlite_schema WHERE type='table' " +
            "AND name NOT LIKE 'sqlite_%' ORDER BY name"
        );
        return r.rows.map((row) => row[0]);
    }
    return { exec, listTables };
}

/* ── 쿼리 탭 저장 파일 (.sql) ─────────────────────────────────────────
   사람이 읽을 수 있는 일반 .sql 텍스트로 저장한다. 탭 경계는 아래
   마커 주석 한 줄로 표시하고, 불러올 때 같은 마커로 다시 나눈다. */

const TAB_MARK_START = "-- ═══ 탭: ";
const TAB_MARK_END = " ═══";
const TAB_MARK_RE = /^-- ═══ 탭: (.*) ═══\s*$/;

export function serializeQueryTabs(tabs) {
    const lines = [
        "-- SQL Playground 쿼리 저장 파일",
        "-- '가져오기 ▾ → 쿼리 파일을 편집기 탭으로 열기'로 다시 불러올 수 있습니다.",
        "",
    ];
    for (const t of tabs) {
        const name = String(t.name || "Query").replace(/[\r\n]+/g, " ").trim();
        lines.push(TAB_MARK_START + name + TAB_MARK_END);
        lines.push((t.content || "").replace(/\s+$/, ""));
        lines.push("");
    }
    return lines.join("\n");
}

/**
 * Parse a query-tabs file back into [{name, content}]. A plain .sql file
 * without markers becomes a single tab named after the file.
 */
export function parseQueryTabsFile(text, fallbackName = "가져온 쿼리") {
    const lines = String(text ?? "").split(/\r?\n/);
    const tabs = [];
    let cur = null;
    for (const line of lines) {
        const m = line.match(TAB_MARK_RE);
        if (m) {
            if (cur) tabs.push(cur);
            cur = { name: m[1].trim() || fallbackName, content: [] };
        } else if (cur) {
            cur.content.push(line);
        }
    }
    if (cur) tabs.push(cur);

    if (!tabs.length) {
        const content = String(text ?? "").trim();
        if (!content) return [];
        return [{ name: fallbackName, content }];
    }
    return tabs.map((t) => ({
        name: t.name,
        content: t.content.join("\n").trim(),
    }));
}
