// erd-view.js — Load Mermaid and render an erDiagram.
//
// Standalone teacher package: prefer the bundled UMD build in
// vendor/mermaid/ so the ERD tab works fully offline; fall back to the
// jsDelivr CDN if the local file is missing. Diagram colors follow the
// site theme (site-config.js → CSS variables).

const LOCAL_UMD = new URL("../../vendor/mermaid/mermaid.min.js", import.meta.url).href;
const CDN = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
}

function loadLocalUmd() {
    return new Promise((resolve, reject) => {
        if (window.mermaid) return resolve(window.mermaid);
        const s = document.createElement("script");
        s.src = LOCAL_UMD;
        s.onload = () => window.mermaid
            ? resolve(window.mermaid)
            : reject(new Error("mermaid global missing after load"));
        s.onerror = () => { s.remove(); reject(new Error("local mermaid not found")); };
        document.head.appendChild(s);
    });
}

let _mermaidP = null;
async function getMermaid() {
    if (!_mermaidP) {
        _mermaidP = loadLocalUmd()
            .catch(() => import(/* @vite-ignore */ CDN).then((m) => m.default))
            .then((mermaid) => {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: "neutral",
                    themeVariables: {
                        primaryColor: cssVar("--base-pale", "#e8eef5"),
                        primaryBorderColor: cssVar("--base", "#002D56"),
                        primaryTextColor: cssVar("--ink", "#1A1A1A"),
                        lineColor: cssVar("--point", "#8D7150"),
                    },
                });
                return mermaid;
            });
        _mermaidP.catch(() => { _mermaidP = null; });
    }
    return _mermaidP;
}

/**
 * Render Mermaid `erDiagram` source into `mountEl`. Returns the rendered SVG
 * element. Caller is responsible for clearing the mount before calling again.
 */
export async function renderErd(mountEl, mermaidSrc) {
    const mermaid = await getMermaid();
    const id = "erd-" + Math.random().toString(36).slice(2, 9);
    try {
        const { svg } = await mermaid.render(id, mermaidSrc);
        mountEl.innerHTML = svg;
        const svgEl = mountEl.querySelector("svg");
        if (svgEl) {
            svgEl.style.maxWidth = "100%";
            svgEl.style.height = "auto";
        }
        return svgEl;
    } catch (e) {
        mountEl.innerHTML = "";
        const err = document.createElement("pre");
        err.className = "erd-error";
        err.textContent = "ERD 렌더링 실패: " + (e?.message || e);
        mountEl.appendChild(err);
        throw e;
    }
}
