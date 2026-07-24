// share.js — Encode / decode workspace state into URL hash for sharing.
//
// Use case: a teacher writes a query in their browser, copies the URL, sends
// it to a student. The student opens the URL → sees the exact same SQL.
//
// Format: #share=<URL-safe LZ-string compressed JSON>
// Payload schema:
//   { v: 1, tabs: [{name, content}, ...], activeIdx: number }
//
// We deliberately do NOT include DB state — only the queries. That keeps
// shared URLs small and avoids leaking student data through a copy-paste.

import {
    compressToEncodedURIComponent,
    decompressFromEncodedURIComponent,
} from "../../vendor/lz-string/lz-string.mjs";

const HASH_KEY = "share=";

export function encodeShare(workspaceState) {
    const payload = {
        v: 1,
        tabs: workspaceState.tabs.map((t) => ({ name: t.name, content: t.content })),
        activeIdx: workspaceState.tabs.findIndex((t) => t.id === workspaceState.activeId),
    };
    const compressed = compressToEncodedURIComponent(JSON.stringify(payload));
    return `#${HASH_KEY}${compressed}`;
}

export function decodeFromHash(hash) {
    const h = (hash || "").replace(/^#/, "");
    if (!h.startsWith(HASH_KEY)) return null;
    const compressed = h.slice(HASH_KEY.length);
    if (!compressed) return null;
    try {
        const json = decompressFromEncodedURIComponent(compressed);
        if (!json) return null;
        const obj = JSON.parse(json);
        if (!obj || obj.v !== 1 || !Array.isArray(obj.tabs)) return null;
        return obj;
    } catch {
        return null;
    }
}

/**
 * Best-effort copy of text to clipboard. Returns true on success.
 */
export async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // fall through to legacy path
        }
    }
    // Legacy fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
        ok = document.execCommand("copy");
    } catch {
        ok = false;
    }
    document.body.removeChild(ta);
    return ok;
}
