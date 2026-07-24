// result-table.js — Render an exec() result into a scrollable HTML <table>.
//
// Phase 1 keeps this simple: render all rows up to MAX_ROWS, then show a
// "N rows of M shown" notice. Phase 5 will swap in true row virtualization.

const MAX_ROWS = 500;

/**
 * @param {HTMLElement} mountEl
 * @param {Object} result  { columns: string[], rows: any[][], lastRowsAffected: number, elapsedMs: number, statements: number }
 */
export function renderResultTable(mountEl, result) {
    mountEl.innerHTML = "";

    if (!result || (!result.rows.length && !result.columns.length)) {
        const p = document.createElement("p");
        p.className = "result-empty";
        const affected = result?.lastRowsAffected ?? 0;
        const elapsed = result?.elapsedMs ?? 0;
        const stmts = result?.statements ?? 0;
        const stmtNote = stmts > 1 ? ` (${stmts}개 문장)` : "";
        p.textContent =
            affected > 0
                ? `행 ${affected.toLocaleString()}개 영향${stmtNote} — ${elapsed.toFixed(0)} ms`
                : `결과 없음${stmtNote} — ${elapsed.toFixed(0)} ms`;
        mountEl.appendChild(p);
        return;
    }

    const meta = document.createElement("div");
    meta.className = "result-meta";
    const shown = Math.min(result.rows.length, MAX_ROWS);
    const stmts = result?.statements ?? 0;
    const stmtNote = stmts > 1 ? ` · ${stmts}개 문장 실행` : "";
    const affectedNote = result?.lastRowsAffected > 0
        ? ` · ${result.lastRowsAffected.toLocaleString()}행 변경`
        : "";
    meta.textContent =
        result.rows.length > MAX_ROWS
            ? `행 ${shown.toLocaleString()}개 표시 / 총 ${result.rows.length.toLocaleString()}개${stmtNote}${affectedNote} — ${result.elapsedMs.toFixed(0)} ms`
            : `행 ${result.rows.length.toLocaleString()}개${stmtNote}${affectedNote} — ${result.elapsedMs.toFixed(0)} ms`;
    mountEl.appendChild(meta);

    const wrap = document.createElement("div");
    wrap.className = "result-scroll";
    const table = document.createElement("table");
    table.className = "result-table";
    const thead = document.createElement("thead");
    const headTr = document.createElement("tr");
    for (const col of result.columns) {
        const th = document.createElement("th");
        th.textContent = col;
        headTr.appendChild(th);
    }
    thead.appendChild(headTr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (let i = 0; i < shown; i++) {
        const row = result.rows[i];
        const tr = document.createElement("tr");
        for (const v of row) {
            const td = document.createElement("td");
            if (v === null || v === undefined) {
                td.textContent = "NULL";
                td.className = "null";
            } else if (typeof v === "number") {
                td.textContent = String(v);
                td.className = "num";
            } else if (v instanceof Uint8Array) {
                td.textContent = `BLOB (${v.length} bytes)`;
                td.className = "blob";
            } else {
                td.textContent = String(v);
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    mountEl.appendChild(wrap);
}
