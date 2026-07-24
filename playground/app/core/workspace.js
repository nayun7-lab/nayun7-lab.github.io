// workspace.js — Multi-tab .sql workspace stored in localStorage.
//
// The DB itself is in OPFS. This module only tracks the *tabs* (named query
// scratchpads) and which one is active. Each tab holds its own SQL text.

const KEY = "playground:workspace:v1";

const STARTER_SQL = `-- 한국고등학교 데이터셋 — 9개 테이블이 미리 적재되어 있습니다.
-- Ctrl + Enter (Mac: Cmd + Enter) 로 실행하세요.

SELECT 이름, 학년, 반
FROM students
WHERE 학년 = 1
LIMIT 10;`;

function _newId() {
    return "t-" + Math.random().toString(36).slice(2, 10);
}

function _defaultState(starterSql = STARTER_SQL) {
    const id = _newId();
    return {
        tabs: [{ id, name: "Query 1", content: starterSql }],
        activeId: id,
        nextN: 2,
    };
}

function _load(key = KEY, starterSql = STARTER_SQL) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return _defaultState(starterSql);
        const obj = JSON.parse(raw);
        if (!obj || !Array.isArray(obj.tabs) || obj.tabs.length === 0) {
            return _defaultState(starterSql);
        }
        return obj;
    } catch {
        return _defaultState(starterSql);
    }
}

function _save(state, key = KEY) {
    try {
        localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
        console.warn("[workspace] save failed:", e);
    }
}

export function createWorkspace({ storageKey = KEY, starterSql = STARTER_SQL } = {}) {
    let state = _load(storageKey, starterSql);
    const listeners = new Set();

    function _emit() {
        for (const fn of listeners) fn(state);
    }

    function subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    }

    function list() {
        return state.tabs.slice();
    }
    function getActive() {
        return state.tabs.find((t) => t.id === state.activeId) || state.tabs[0];
    }
    function getActiveId() {
        return state.activeId;
    }
    function setActive(id) {
        if (!state.tabs.some((t) => t.id === id)) return;
        state.activeId = id;
        _save(state, storageKey);
        _emit();
    }
    function create(name) {
        const id = _newId();
        const tabName = name || `Query ${state.nextN++}`;
        state.tabs.push({ id, name: tabName, content: "" });
        state.activeId = id;
        _save(state, storageKey);
        _emit();
        return id;
    }
    function updateContent(id, content) {
        const t = state.tabs.find((x) => x.id === id);
        if (!t) return;
        if (t.content === content) return;
        t.content = content;
        _save(state, storageKey);
        // No _emit — content change shouldn't repaint the tab strip
    }
    function rename(id, newName) {
        const t = state.tabs.find((x) => x.id === id);
        if (!t) return;
        const trimmed = (newName || "").trim();
        if (!trimmed) return;
        t.name = trimmed.slice(0, 40);
        _save(state, storageKey);
        _emit();
    }
    function remove(id) {
        if (state.tabs.length <= 1) return false;  // never drop the last tab
        const idx = state.tabs.findIndex((t) => t.id === id);
        if (idx < 0) return false;
        state.tabs.splice(idx, 1);
        if (state.activeId === id) {
            state.activeId = state.tabs[Math.max(0, idx - 1)].id;
        }
        _save(state, storageKey);
        _emit();
        return true;
    }

    return {
        list, getActive, getActiveId, setActive,
        create, updateContent, rename, remove,
        subscribe,
    };
}
