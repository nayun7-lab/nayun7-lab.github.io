// schema-panel.js — Render an always-visible, expandable schema browser.
//
// Each table is a collapsed pill; clicking expands it to show its columns
// with type + PK/FK markers. Clicking a table or column name inserts the
// identifier at the editor's cursor — handy for non-typists writing Korean
// column names.

/**
 * @param {Object} opts
 * @param {HTMLElement} opts.mountEl
 * @param {Object} opts.engine
 * @param {Function} [opts.onInsert]  callback(text) — insert text at cursor
 */
export function createSchemaPanel({ mountEl, engine, onInsert }) {
    let expanded = new Set();
    let filter = "";

    async function refresh() {
        const tables = await engine.listTables();
        // Build per-table metadata
        const meta = [];
        for (const t of tables) {
            const info = await engine.exec(`PRAGMA table_info("${t}")`);
            const cols = info.rows.map((r) => ({
                name: r[1], type: (r[2] || "TEXT").toUpperCase(),
                pk: !!r[5], notnull: !!r[3],
            }));
            const fk = await engine.exec(`PRAGMA foreign_key_list("${t}")`);
            const fkSet = new Set(fk.rows.map((r) => r[3]));
            for (const c of cols) c.fk = fkSet.has(c.name);
            const cnt = await engine.exec(`SELECT COUNT(*) FROM "${t}"`);
            meta.push({ table: t, columns: cols, rowCount: cnt.rows[0]?.[0] ?? 0 });
        }
        _render(meta);
    }

    function _matchFilter(tm) {
        if (!filter) return true;
        const f = filter.toLowerCase();
        if (tm.table.toLowerCase().includes(f)) return true;
        return tm.columns.some((c) => c.name.toLowerCase().includes(f));
    }

    function _render(meta) {
        mountEl.innerHTML = "";

        const header = document.createElement("div");
        header.className = "schema-header";
        header.innerHTML = `
            <span class="schema-title">스키마</span>
            <input type="search" class="schema-filter" placeholder="테이블/컬럼 검색…">
            <button type="button" class="schema-collapse-all" title="모두 접기">−</button>
            <button type="button" class="schema-expand-all"   title="모두 펼치기">＋</button>
        `;
        mountEl.appendChild(header);
        const filterInput = header.querySelector(".schema-filter");
        filterInput.value = filter;
        filterInput.addEventListener("input", () => {
            filter = filterInput.value;
            _render(meta);
            const next = mountEl.querySelector(".schema-filter");
            if (next) { next.focus(); next.setSelectionRange(filter.length, filter.length); }
        });
        header.querySelector(".schema-collapse-all").addEventListener("click", () => {
            expanded.clear();
            _render(meta);
        });
        header.querySelector(".schema-expand-all").addEventListener("click", () => {
            for (const tm of meta) expanded.add(tm.table);
            _render(meta);
        });

        const list = document.createElement("ul");
        list.className = "schema-list";
        for (const tm of meta) {
            if (!_matchFilter(tm)) continue;
            const isOpen = expanded.has(tm.table);
            const li = document.createElement("li");
            li.className = "schema-table" + (isOpen ? " open" : "");
            const head = document.createElement("button");
            head.type = "button";
            head.className = "schema-table-head";
            head.innerHTML = `
                <span class="schema-twisty">${isOpen ? "▾" : "▸"}</span>
                <span class="schema-table-name"></span>
                <span class="schema-rowcount">${tm.rowCount.toLocaleString()}행</span>
            `;
            head.querySelector(".schema-table-name").textContent = tm.table;
            head.addEventListener("click", (e) => {
                // Click anywhere on the row toggles; shift-click inserts name.
                if (e.shiftKey || e.altKey) {
                    if (onInsert) onInsert(_quoteIdent(tm.table));
                    return;
                }
                if (isOpen) expanded.delete(tm.table); else expanded.add(tm.table);
                _render(meta);
            });
            li.appendChild(head);

            if (isOpen) {
                const cols = document.createElement("ul");
                cols.className = "schema-cols";
                for (const c of tm.columns) {
                    const cli = document.createElement("li");
                    cli.className = "schema-col";
                    const flags = [];
                    if (c.pk) flags.push("PK");
                    if (c.fk) flags.push("FK");
                    if (c.notnull && !c.pk) flags.push("NN");
                    cli.innerHTML = `
                        <button type="button" class="schema-col-btn" title="클릭: 컬럼명 삽입">
                            <span class="schema-col-name"></span>
                            <span class="schema-col-type">${c.type}</span>
                            ${flags.length ? `<span class="schema-col-flags">${flags.join(" · ")}</span>` : ""}
                        </button>
                    `;
                    cli.querySelector(".schema-col-name").textContent = c.name;
                    cli.querySelector(".schema-col-btn").addEventListener("click", () => {
                        if (onInsert) onInsert(_quoteIdent(c.name));
                    });
                    cols.appendChild(cli);
                }
                li.appendChild(cols);
            }
            list.appendChild(li);
        }
        if (!list.children.length) {
            const empty = document.createElement("p");
            empty.className = "schema-empty";
            empty.textContent = filter ? `'${filter}'와 일치하는 항목 없음` : "(스키마가 비어 있습니다)";
            mountEl.appendChild(empty);
        } else {
            mountEl.appendChild(list);
        }
    }

    function _quoteIdent(name) {
        // Wrap with double quotes only when the identifier contains non-ASCII
        // word chars (Hangul) or any non-identifier punctuation.
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return name;
        return `"${String(name).replace(/"/g, '""')}"`;
    }

    return { refresh };
}
