// main.js — Standalone playground entry point.

import { createEngine }    from "./core/engine.js";
import { createWorkspace } from "./core/workspace.js";
import { translateError }  from "./core/i18n-errors.js";
import { encodeShare, decodeFromHash, copyToClipboard } from "./core/share.js";
import { buildErdModel }   from "./core/erd.js";
import { exportSqliteFile, exportSqlDump, exportResultCsv, downloadText } from "./core/exporter.js";
import { importSqliteBytes, serializeQueryTabs, parseQueryTabsFile } from "./core/importer.js";
import { createEditor }      from "./ui/editor.js";
import { createTabBar }      from "./ui/tabs.js";
import { renderResultTable } from "./ui/result-table.js";
import { tryRenderChart }    from "./ui/result-chart.js";
import { renderErd }         from "./ui/erd-view.js";
import { createSchemaPanel } from "./ui/schema-panel.js";
import { EXAMPLES }          from "./data/examples.js";

const $ = (sel) => document.querySelector(sel);

const statusEl    = $("#status");
const elapsedEl   = $("#elapsed");
const totalRowsEl = $("#total-rows");
const vfsEl       = $("#vfs-info");
const tabsMount   = $("#tabs-mount");
const editorMount = $("#editor-mount");
const resultMount = $("#result-mount");
const errorMount  = $("#error-mount");
const schemaMount = $("#schema-mount");
const runBtn      = $("#run-btn");
const resetBtn    = $("#reset-btn");
const csvBtn      = $("#csv-btn");
const csvFile     = $("#csv-file");
const shareBtn    = $("#share-btn");
const exportBtn   = $("#export-btn");
const exportMenu  = $("#export-menu");
const importBtn   = $("#import-btn");
const importMenu  = $("#import-menu");
const importDbFile      = $("#import-db-file");
const importSqlFile     = $("#import-sql-file");
const importQueriesFile = $("#import-queries-file");
const exampleSelect = $("#example-select");
const resultCsvBtn  = $("#result-csv-btn");
const modeBadge     = $("#mode-badge");
const modeSubtitle  = $("#mode-subtitle");

// Result-area tabs
const tabResultBtn = $("#result-tab-table");
const tabChartBtn  = $("#result-tab-chart");
const tabErdBtn    = $("#result-tab-erd");
const chartMount   = $("#chart-mount");
const erdMount     = $("#erd-mount");

let lastResult = null;
let engine;
let editor;
let workspace;
let schemaPanel;

const SEED_URL = "./app/data/seed.sql";
const params = new URLSearchParams(location.search);
const isEmptyMode = params.get("mode") === "empty";
const freshEmpty = isEmptyMode && params.get("fresh") === "1";
const engineMode = {
    key: isEmptyMode ? "empty" : "seed",
    dbName: isEmptyMode ? "playground-empty.db" : "playground.db",
    seedUrl: isEmptyMode ? undefined : SEED_URL,
};
const workspaceStorageKey = isEmptyMode
    ? "playground:workspace:empty:v1"
    : "playground:workspace:v1";
const emptyStarterSql = `-- 빈 DB 실습 모드
-- seed 데이터 없이 시작합니다. CREATE TABLE부터 직접 작성하세요.
-- Ctrl + Enter (Mac: Cmd + Enter) 로 실행합니다.

PRAGMA foreign_keys = ON;
`;

function applyModeCopy() {
    if (isEmptyMode) {
        modeBadge.textContent = "빈 DB 실습 모드";
        modeSubtitle.textContent = "seed 데이터 없이 빈 SQLite 데이터베이스에서 시작합니다. CREATE TABLE 실습처럼 스키마를 직접 만드는 수업에 사용합니다.";
        resetBtn.title = "빈 데이터베이스로 초기화";
    } else {
        modeBadge.textContent = "seed 데이터 모드";
        modeSubtitle.textContent = "한국고등학교 데이터셋이 미리 적재되어 있습니다. 자유롭게 쿼리를 작성하고 실행하세요. 모든 작업은 브라우저 안에서만 일어나며 데이터는 외부로 전송되지 않습니다.";
        resetBtn.title = "seed 데이터로 초기화";
    }
}

function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.dataset.kind = kind || "info";
}
function showError(message) {
    const t = translateError(message);
    errorMount.innerHTML = "";
    errorMount.hidden = false;

    const head = document.createElement("p");
    head.className = "err-head";
    head.textContent = "오류: " + t.ko;
    errorMount.appendChild(head);

    if (t.hint) {
        const hint = document.createElement("p");
        hint.className = "err-hint";
        hint.textContent = "힌트: " + t.hint;
        errorMount.appendChild(hint);
    }

    if (t.raw && t.raw !== t.ko) {
        const details = document.createElement("details");
        details.className = "err-details";
        const summary = document.createElement("summary");
        summary.textContent = "원문 보기";
        details.appendChild(summary);
        const pre = document.createElement("pre");
        pre.textContent = t.raw;
        details.appendChild(pre);
        errorMount.appendChild(details);
    }
}
function clearError() {
    errorMount.innerHTML = "";
    errorMount.hidden = true;
}

async function refreshSchema() {
    if (schemaPanel) await schemaPanel.refresh();
    if (editor && engine) editor.updateSchema(await engine.getSchema());
}

async function runSql(text) {
    const sql = (text ?? editor.getDoc()).trim();
    if (!sql) {
        clearError();
        renderResultTable(resultMount, null);
        resultCsvBtn.hidden = true;
        return;
    }
    clearError();
    try {
        const result = await engine.exec(sql);
        lastResult = result;
        renderResultTable(resultMount, result);
        resultCsvBtn.hidden = !(result.rows?.length && result.columns?.length);
        await refreshSchema();
        if (currentResultTab === "chart") tryRenderChart(chartMount, result);
        else if (currentResultTab === "erd") renderErdNow();
    } catch (e) {
        lastResult = null;
        showError(e && e.message ? e.message : String(e));
        renderResultTable(resultMount, null);
        resultCsvBtn.hidden = true;
    }
}

let currentResultTab = "table";

function switchResultTab(name) {
    currentResultTab = name;
    for (const [btn, panel, key] of [
        [tabResultBtn, resultMount, "table"],
        [tabChartBtn,  chartMount,  "chart"],
        [tabErdBtn,    erdMount,    "erd"],
    ]) {
        const active = key === name;
        btn?.classList.toggle("active", active);
        if (panel) panel.hidden = !active;
    }
    if (name === "chart" && lastResult) tryRenderChart(chartMount, lastResult);
    else if (name === "erd") renderErdNow();
}

async function renderErdNow() {
    if (!engine) return;
    erdMount.innerHTML = '<p style="padding:1rem; color:var(--gray);">ERD 렌더링 중…</p>';
    try {
        const { mermaid: src, tables } = await buildErdModel(engine);
        erdMount.innerHTML = "";
        const graphBox = document.createElement("div");
        graphBox.className = "erd-graph";
        erdMount.appendChild(graphBox);
        try {
            await renderErd(graphBox, src);
        } catch (e) {
            graphBox.innerHTML = '<p class="erd-error">관계 다이어그램 렌더링 실패: ' + (e?.message || e) + "</p>";
        }
        const colsBox = document.createElement("div");
        colsBox.className = "erd-columns";
        const title = document.createElement("h3");
        title.className = "erd-cols-title";
        title.textContent = "테이블별 컬럼 상세";
        colsBox.appendChild(title);
        for (const t of tables) {
            const h = document.createElement("h4");
            h.className = "erd-cols-table-name";
            h.textContent = t.table;
            colsBox.appendChild(h);
            const tbl = document.createElement("table");
            tbl.className = "erd-cols-table";
            tbl.innerHTML = `<thead><tr><th>컬럼</th><th>타입</th><th>키</th><th>참조</th></tr></thead>`;
            const tbody = document.createElement("tbody");
            for (const c of t.columns) {
                const tr = document.createElement("tr");
                const keys = [];
                if (c.pk) keys.push("PK");
                if (c.fk) keys.push("FK");
                if (c.notnull && !c.pk) keys.push("NOT NULL");
                const ref = c.fkRef ? `${c.fkRef.table}.${c.fkRef.column}` : "";
                tr.innerHTML =
                    `<td><code>${_escHtml(c.name)}</code></td>` +
                    `<td>${_escHtml(c.type)}</td>` +
                    `<td>${keys.join(" · ")}</td>` +
                    `<td>${_escHtml(ref)}</td>`;
                tbody.appendChild(tr);
            }
            tbl.appendChild(tbody);
            colsBox.appendChild(tbl);
        }
        erdMount.appendChild(colsBox);
    } catch (e) {
        console.error(e);
        erdMount.innerHTML = '<p class="erd-error">ERD 생성 실패: ' + (e?.message || e) + "</p>";
    }
}

function _escHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

async function shareCurrent() {
    if (!workspace) return;
    workspace.updateContent(workspace.getActiveId(), editor.getDoc());
    const state = { tabs: workspace.list(), activeId: workspace.getActiveId() };
    const hash = encodeShare(state);
    // location.origin은 file:// 페이지에서 브라우저에 따라 "null" 문자열이
    // 되므로 href 기반으로 조립한다 (http/https/file 모두 동작).
    const url = location.href.split("#")[0] + hash;
    const ok = await copyToClipboard(url);
    setStatus(ok ? "공유 URL이 클립보드에 복사되었습니다." : "URL 복사 실패 — 직접 복사하세요: " + url,
              ok ? "ok" : "info");
}

function tryRestoreFromHash() {
    const data = decodeFromHash(location.hash);
    if (!data || !data.tabs || !data.tabs.length) return false;
    try { localStorage.removeItem(workspaceStorageKey); } catch {}
    const stateForLs = {
        tabs: data.tabs.map((t, i) => ({
            id: "t-" + Math.random().toString(36).slice(2, 10),
            name: t.name || `Query ${i + 1}`,
            content: t.content || "",
        })),
        nextN: data.tabs.length + 1,
        activeId: null,
    };
    const safeIdx = Math.max(0, Math.min(data.activeIdx || 0, stateForLs.tabs.length - 1));
    stateForLs.activeId = stateForLs.tabs[safeIdx].id;
    try { localStorage.setItem(workspaceStorageKey, JSON.stringify(stateForLs)); } catch {}
    return true;
}

async function resetToSeed() {
    const target = isEmptyMode ? "빈 데이터베이스" : "seed 데이터";
    if (!confirm(`현재 변경 사항을 모두 버리고 ${target}로 초기화합니다. 계속할까요?`)) return;
    setStatus("초기화 중…", "loading");
    try {
        await engine.resetToSeed(engineMode.seedUrl);
        await refreshSchema();
        clearError();
        renderResultTable(resultMount, null);
        resultCsvBtn.hidden = true;
        setStatus("초기화 완료", "ok");
    } catch (e) {
        showError(e && e.message ? e.message : String(e));
        setStatus("초기화 실패", "error");
    }
}

function switchActiveTab(newId) {
    const cur = workspace.getActiveId();
    if (cur && cur !== newId) {
        workspace.updateContent(cur, editor.getDoc());
    }
}
function onWorkspaceChanged() {
    const active = workspace.getActive();
    if (active && editor && editor.getDoc() !== active.content) {
        editor.setDoc(active.content);
    }
}

function populateExampleSelect() {
    exampleSelect.innerHTML = '<option value="">예제 불러오기…</option>';
    // Group by lesson visually (CSS handles separators via the prefix in title)
    EXAMPLES.forEach((ex, i) => {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = ex.title;
        exampleSelect.appendChild(opt);
    });
}
function loadExample(idx) {
    const ex = EXAMPLES[idx];
    if (!ex || !editor) return;
    // Open in a NEW tab so the student's current work isn't lost
    workspace.updateContent(workspace.getActiveId(), editor.getDoc());
    const newId = workspace.create(ex.title.split("·").pop().trim().slice(0, 30));
    // Switch active tab — workspace.create already sets it active and emits
    workspace.updateContent(newId, ex.sql);
    // Force editor to load new content (subscribe handler also runs)
    editor.setDoc(ex.sql);
}

async function handleCsvUpload(file) {
    if (!file) return;
    const { uploadCsvToTable, decodeFile, parseCsv, inferType } = await import("./core/csv.js");
    clearError();
    setStatus(`'${file.name}' 분석 중…`, "loading");
    try {
        const { text, encoding, hadBom } = await decodeFile(file);
        const { header, rows } = parseCsv(text);
        if (!header.length || !rows.length) {
            throw new Error("CSV에 헤더 또는 데이터 행이 없습니다.");
        }
        const types = {};
        for (let j = 0; j < header.length; j++) {
            types[header[j]] = inferType(rows.map((r) => r[j] ?? ""));
        }
        const defaultName = file.name.replace(/\.csv$/i, "")
            .replace(/[^A-Za-z0-9가-힣_]/g, "_");
        const tableName = prompt(
            `파일: ${file.name} (${encoding}${hadBom ? ", BOM" : ""})\n` +
            `컬럼 ${header.length}개, 행 ${rows.length}개.\n` +
            `테이블 이름을 입력하세요:`,
            defaultName
        );
        if (!tableName) {
            setStatus("업로드 취소됨", "info");
            return;
        }
        setStatus(`'${tableName}' 테이블 생성 중…`, "loading");
        const result = await uploadCsvToTable({ engine, file, tableName, mode: "replace" });
        await refreshSchema();
        setStatus(
            `완료 — '${result.table}' 테이블에 ${result.rowCount}행 (${result.encoding}${result.hadBom ? ", BOM" : ""}).`,
            "ok"
        );
        if (result.encoding === "euc-kr") {
            showError("CSV가 EUC-KR로 감지되었습니다. 가능하면 엑셀에서 'CSV UTF-8 (쉼표로 분리)' 형식으로 다시 저장하기를 권장합니다.");
        }
        renderResultTable(resultMount, null);
        resultCsvBtn.hidden = true;
    } catch (e) {
        showError(e?.message || String(e));
        setStatus("", "info");
    }
}

async function handleExport(format) {
    try {
        if (format === "sqlite") {
            await exportSqliteFile(engine, "playground.sqlite");
            setStatus("DB가 playground.sqlite로 저장되었습니다.", "ok");
        } else if (format === "sql") {
            await exportSqlDump(engine, "playground.sql");
            setStatus("DB가 playground.sql로 저장되었습니다.", "ok");
        } else if (format === "queries") {
            // 현재 편집 중인 내용까지 반영해서 저장
            workspace.updateContent(workspace.getActiveId(), editor.getDoc());
            const text = serializeQueryTabs(workspace.list());
            downloadText(text, "queries.sql", "application/sql;charset=utf-8");
            setStatus(`쿼리 탭 ${workspace.list().length}개가 queries.sql로 저장되었습니다.`, "ok");
        }
    } catch (e) {
        showError(e?.message || String(e));
    } finally {
        exportMenu.hidden = true;
    }
}

async function handleImportDb(file) {
    if (!file) return;
    const target = isEmptyMode ? "빈 DB 모드" : "seed 데이터 모드";
    if (!confirm(`현재 DB(${target})의 내용을 모두 버리고 '${file.name}' 파일의 내용으로 교체합니다. 계속할까요?`)) {
        setStatus("가져오기 취소됨", "info");
        return;
    }
    clearError();
    setStatus(`'${file.name}' 여는 중…`, "loading");
    try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const r = await importSqliteBytes(engine, bytes);
        await refreshSchema();
        renderResultTable(resultMount, null);
        resultCsvBtn.hidden = true;
        setStatus(`가져오기 완료 — 테이블 ${r.tables}개, 총 ${r.rows.toLocaleString()}행. '초기화' 버튼으로 언제든 처음 상태로 되돌릴 수 있습니다.`, "ok");
    } catch (e) {
        showError(e?.message || String(e));
        setStatus("가져오기 실패", "error");
    }
}

async function handleImportScript(file) {
    if (!file) return;
    clearError();
    setStatus(`'${file.name}' 실행 중…`, "loading");
    try {
        const text = await file.text();
        if (!text.trim()) throw new Error("파일이 비어 있습니다.");
        const result = await engine.exec(text);
        lastResult = result;
        renderResultTable(resultMount, result);
        resultCsvBtn.hidden = !(result.rows?.length && result.columns?.length);
        await refreshSchema();
        setStatus(`스크립트 실행 완료 — ${result.statements}개 문장 (${result.elapsedMs.toFixed(0)} ms)`, "ok");
    } catch (e) {
        showError(e?.message || String(e));
        setStatus("스크립트 실행 실패", "error");
    }
}

async function handleImportQueries(file) {
    if (!file) return;
    clearError();
    try {
        const text = await file.text();
        const tabs = parseQueryTabsFile(text, file.name.replace(/\.sql$/i, ""));
        if (!tabs.length) throw new Error("파일에서 불러올 쿼리가 없습니다.");
        // 현재 작업 보존 후 새 탭으로 추가
        workspace.updateContent(workspace.getActiveId(), editor.getDoc());
        let lastContent = "";
        for (const t of tabs) {
            const id = workspace.create(t.name.slice(0, 30));
            workspace.updateContent(id, t.content);
            lastContent = t.content;
        }
        editor.setDoc(lastContent);
        setStatus(`쿼리 탭 ${tabs.length}개를 불러왔습니다.`, "ok");
    } catch (e) {
        showError(e?.message || String(e));
        setStatus("쿼리 파일 불러오기 실패", "error");
    }
}
function handleResultCsv() {
    if (!lastResult) return;
    try {
        exportResultCsv(lastResult, "result.csv");
        setStatus("결과가 result.csv로 저장되었습니다.", "ok");
    } catch (e) {
        showError(e?.message || String(e));
    }
}

async function boot() {
    applyModeCopy();
    setStatus("SQLite 엔진을 불러오는 중…", "loading");
    const t0 = performance.now();

    const restoredShare = tryRestoreFromHash();
    if (restoredShare) {
        try { history.replaceState(null, "", location.pathname + location.search); } catch {}
    }

    try {
        engine = await createEngine({
            dbName: engineMode.dbName,
            seedUrl: engineMode.seedUrl,
        });
        if (freshEmpty) {
            await engine.resetToSeed(undefined);
            params.delete("fresh");
            const nextSearch = params.toString();
            const nextUrl = location.pathname + (nextSearch ? `?${nextSearch}` : "") + location.hash;
            try { history.replaceState(null, "", nextUrl); } catch {}
        }
        if (location.search.includes("debug=1")) window.__engine = engine; // gated

        const tables = await engine.listTables();
        let total = 0;
        for (const t of tables) total += await engine.rowCount(t);

        elapsedEl.textContent = `${(performance.now() - t0).toFixed(0)} ms`;
        totalRowsEl.textContent = total.toLocaleString();
        vfsEl.textContent = engine.vfs === "opfs"
            ? `OPFS (${isEmptyMode ? "빈 DB 전용" : "seed DB"} 저장소)`
            : "메모리 (새로고침 시 사라짐)";
        setStatus(`준비 완료 — ${isEmptyMode ? "빈 DB 모드" : "seed 데이터 모드"} · 테이블 ${tables.length}개, 총 ${total.toLocaleString()}행`, "ok");

        // Workspace + tab bar
        workspace = createWorkspace({
            storageKey: workspaceStorageKey,
            starterSql: isEmptyMode ? emptyStarterSql : undefined,
        });
        workspace.subscribe(onWorkspaceChanged);

        const activeTab = workspace.getActive();
        editor = createEditor({
            mountEl: editorMount,
            initialDoc: activeTab.content || "",
            schema: await engine.getSchema(),
            onRun: runSql,
            onChange: (text) => workspace.updateContent(workspace.getActiveId(), text),
        });

        createTabBar({ mountEl: tabsMount, workspace, onSwitch: switchActiveTab });

        // Schema panel (left aside) — click inserts identifier at cursor
        schemaPanel = createSchemaPanel({
            mountEl: schemaMount,
            engine,
            onInsert: (text) => editor.insertAtCursor(text),
        });
        await schemaPanel.refresh();

        // Example library
        populateExampleSelect();

        // Enable controls
        runBtn.disabled = false;
        resetBtn.disabled = false;
        csvBtn.disabled = false;
        shareBtn.disabled = false;
        exportBtn.disabled = false;
        importBtn.disabled = false;
        exampleSelect.disabled = false;

        if (restoredShare) {
            setStatus("공유 URL에서 쿼리를 복원했습니다.", "ok");
        }
    } catch (e) {
        console.error(e);
        setStatus("부팅 실패: " + (e && e.message ? e.message : e), "error");
    }
}

// ─── Service Worker (opt-in, Phase 6) ────────────────────────────────────────
// The async OPFS VFS works without COOP/COEP. Uncomment to upgrade to
// multi-threaded / synchronous-OPFS mode (requires COOP/COEP injection).
//
// if ("serviceWorker" in navigator) {
//     navigator.serviceWorker.register(new URL("../sw.js", import.meta.url)).then((reg) => {
//         if (!navigator.serviceWorker.controller) {
//             navigator.serviceWorker.addEventListener("controllerchange", () => {
//                 if (!sessionStorage.getItem("sw-reloaded")) {
//                     sessionStorage.setItem("sw-reloaded", "1");
//                     location.reload();
//                 }
//             });
//         }
//     }).catch((e) => console.warn("[sw] register failed:", e));
// }

// ─── Event wiring ────────────────────────────────────────────────────────────
runBtn.addEventListener("click", () => runSql());
resetBtn.addEventListener("click", () => resetToSeed());
csvBtn.addEventListener("click", () => csvFile.click());
csvFile.addEventListener("change", async (ev) => {
    const f = ev.target.files?.[0];
    await handleCsvUpload(f);
    csvFile.value = "";
});
shareBtn.addEventListener("click", () => shareCurrent());

// Export dropdown
exportBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    importMenu.hidden = true;
    exportMenu.hidden = !exportMenu.hidden;
});
exportMenu.querySelectorAll("button[data-fmt]").forEach((btn) => {
    btn.addEventListener("click", () => handleExport(btn.dataset.fmt));
});

// Import dropdown — 항목 선택 시 해당 파일 선택창을 연다
importBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    exportMenu.hidden = true;
    importMenu.hidden = !importMenu.hidden;
});
importMenu.querySelectorAll("button[data-imp]").forEach((btn) => {
    btn.addEventListener("click", () => {
        importMenu.hidden = true;
        if (btn.dataset.imp === "db") importDbFile.click();
        else if (btn.dataset.imp === "script") importSqlFile.click();
        else if (btn.dataset.imp === "queries") importQueriesFile.click();
    });
});
importDbFile.addEventListener("change", async (ev) => {
    await handleImportDb(ev.target.files?.[0]);
    importDbFile.value = "";
});
importSqlFile.addEventListener("change", async (ev) => {
    await handleImportScript(ev.target.files?.[0]);
    importSqlFile.value = "";
});
importQueriesFile.addEventListener("change", async (ev) => {
    await handleImportQueries(ev.target.files?.[0]);
    importQueriesFile.value = "";
});

document.addEventListener("click", (e) => {
    if (!exportMenu.contains(e.target) && e.target !== exportBtn) {
        exportMenu.hidden = true;
    }
    if (!importMenu.contains(e.target) && e.target !== importBtn) {
        importMenu.hidden = true;
    }
});

// Result-area tabs
tabResultBtn.addEventListener("click", () => switchResultTab("table"));
tabChartBtn.addEventListener("click", () => switchResultTab("chart"));
tabErdBtn.addEventListener("click", () => switchResultTab("erd"));

// Result CSV download
resultCsvBtn.addEventListener("click", handleResultCsv);

// Example library
exampleSelect.addEventListener("change", (e) => {
    const v = e.target.value;
    if (v === "") return;
    loadExample(Number(v));
    e.target.value = ""; // reset to placeholder
});

boot();
