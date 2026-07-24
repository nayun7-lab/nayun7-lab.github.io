// editor.js — CodeMirror 6 SQL editor with schema-aware autocomplete.

import {
    EditorState, Compartment,
    EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection,
    defaultKeymap, history, historyKeymap, indentWithTab,
    sql, SQLite, schemaCompletionSource,
    syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput,
    autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap,
    searchKeymap, highlightSelectionMatches,
} from "../../vendor/codemirror/cm6.mjs";

/**
 * Mount a CodeMirror 6 editor inside `mountEl`.
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.mountEl
 * @param {string}     [opts.initialDoc]
 * @param {Object}     [opts.schema]   {tableName: [colName, ...], ...}
 * @param {Function}   [opts.onRun]    callback(text) when Ctrl/Cmd-Enter pressed
 * @returns {{view: EditorView, getDoc: () => string, setDoc: (s: string) => void,
 *           updateSchema: (s: Object) => void}}
 */
export function createEditor({ mountEl, initialDoc = "", schema = {}, onRun, onChange }) {
    const schemaCompartment = new Compartment();

    function makeSqlExtension(schemaObj) {
        return sql({
            dialect: SQLite,
            schema: schemaObj,
            // Upper-keywords feels more authoritative for teachers reading the
            // editor; SQLite itself is case-insensitive so this is purely visual.
            upperCaseKeywords: true,
        });
    }

    const runKey = {
        key: "Mod-Enter",
        preventDefault: true,
        run: () => {
            if (typeof onRun === "function") {
                onRun(view.state.doc.toString());
            }
            return true;
        },
    };

    const state = EditorState.create({
        doc: initialDoc,
        extensions: [
            lineNumbers(),
            highlightActiveLineGutter(),
            highlightActiveLine(),
            drawSelection(),
            history(),
            indentOnInput(),
            bracketMatching(),
            closeBrackets(),
            autocompletion(),
            highlightSelectionMatches(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            keymap.of([
                runKey,
                indentWithTab,
                ...closeBracketsKeymap,
                ...defaultKeymap,
                ...historyKeymap,
                ...searchKeymap,
                ...completionKeymap,
            ]),
            schemaCompartment.of(makeSqlExtension(schema)),
            EditorView.contentAttributes.of({
                "aria-label": "SQL 편집기",
                "aria-multiline": "true",
            }),
            // Fire onChange callback (debounced 200ms) when the doc changes.
            EditorView.updateListener.of((upd) => {
                if (upd.docChanged && typeof onChange === "function") {
                    onChange(view.state.doc.toString());
                }
            }),
            EditorView.theme({
                "&": { height: "100%", fontSize: "14px" },
                ".cm-scroller": { fontFamily: "var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace)" },
                ".cm-content": { padding: "8px 0" },
                "&.cm-focused": { outline: "none" },
            }),
        ],
    });

    const view = new EditorView({ state, parent: mountEl });

    function getDoc() {
        return view.state.doc.toString();
    }
    function setDoc(text) {
        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: text },
        });
    }
    function updateSchema(newSchema) {
        view.dispatch({
            effects: schemaCompartment.reconfigure(makeSqlExtension(newSchema)),
        });
    }

    /** Insert text at the current cursor (or replace selection) and focus. */
    function insertAtCursor(text) {
        const { from, to } = view.state.selection.main;
        view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
        });
        view.focus();
    }

    return { view, getDoc, setDoc, updateSchema, insertAtCursor };
}
