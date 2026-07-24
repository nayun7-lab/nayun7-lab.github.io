// erd.js — Introspect SQLite schema and emit (a) a Mermaid erDiagram source
// for the relationship graph, and (b) a structured schema model for an HTML
// column-details table.
//
// Why we split: Mermaid v11 erDiagram requires attribute names to match
// `[A-Za-z_][A-Za-z0-9_$-]*` (ASCII identifiers). Quoting is only honored on
// entity names. Korean column names like `학번` therefore can NOT live inside
// the Mermaid `entity { ... }` block. So we emit only the relationship lines
// in Mermaid and render the columns as plain HTML below.

/**
 * Build a Mermaid erDiagram source — relationships only, no per-table columns.
 * @param {Object} engine — { exec, listTables }
 * @returns {Promise<{mermaid: string, tables: Array}>}
 */
export async function buildErdModel(engine) {
    const tables = await engine.listTables();
    if (!tables.length) {
        return {
            mermaid: "erDiagram\n    %% (스키마가 비어 있습니다)",
            tables: [],
        };
    }

    const tableModels = [];

    for (const t of tables) {
        const info = await engine.exec(`PRAGMA table_info("${t}")`);
        const cols = info.rows.map((row) => {
            // (cid, name, type, notnull, dflt, pk)
            return {
                name: row[1],
                type: (row[2] || "TEXT").toUpperCase(),
                notnull: !!row[3],
                pk: !!row[5],
                fk: false, // filled below
                fkRef: null,
            };
        });
        const fk = await engine.exec(`PRAGMA foreign_key_list("${t}")`);
        // (id, seq, table, from, to, on_update, on_delete, match)
        const fkByCol = new Map();
        for (const row of fk.rows) {
            const fromCol = row[3];
            const refTable = row[2];
            const refCol = row[4];
            fkByCol.set(fromCol, { table: refTable, column: refCol });
        }
        for (const c of cols) {
            if (fkByCol.has(c.name)) {
                c.fk = true;
                c.fkRef = fkByCol.get(c.name);
            }
        }
        tableModels.push({ table: t, columns: cols });
    }

    // ── Mermaid: relationships only ──────────────────────────────────────
    const lines = ["erDiagram"];

    // Declare every entity as an empty-bodied box so isolated tables (no FKs)
    // still appear in the diagram. Mermaid accepts quoted entity names.
    for (const tm of tableModels) {
        lines.push(`    ${_quoteName(tm.table)} {`);
        // Empty body — columns are rendered in the HTML schema table below.
        // (Adding a placeholder ASCII column here would just clutter the box.)
        lines.push(`    }`);
    }

    // Relationships: parent ||--o{ child : "fromCol"
    for (const tm of tableModels) {
        const seen = new Set();
        for (const c of tm.columns) {
            if (!c.fk || !c.fkRef) continue;
            const key = c.fkRef.table + "->" + c.name;
            if (seen.has(key)) continue;
            seen.add(key);
            const labelSafe = String(c.name).replace(/"/g, "");
            lines.push(
                `    ${_quoteName(c.fkRef.table)} ||--o{ ${_quoteName(tm.table)} : "${labelSafe}"`
            );
        }
    }

    return { mermaid: lines.join("\n"), tables: tableModels };
}

/**
 * Build a Mermaid erDiagram source (kept for backwards-compat with main.js).
 */
export async function buildErdMermaid(engine) {
    const { mermaid } = await buildErdModel(engine);
    return mermaid;
}

function _quoteName(s) {
    if (/^[A-Za-z_][\w]*$/.test(s)) return s;
    return `"${String(s).replace(/"/g, "")}"`;
}
