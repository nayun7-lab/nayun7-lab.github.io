/* ═══════════════════════════════════════════════════════════════
   config-apply.js — site-config.js 값을 페이지에 반영하는 스크립트.
   ★ 이 파일은 수정하지 마세요. 설정은 site-config.js에서만 바꿉니다.
   ═══════════════════════════════════════════════════════════════

   동작:
   1. colors 설정을 CSS 변수(--base, --point, …)로 주입하고,
      옅은 파생색(--base-pale 등)을 자동 계산한다.
   2. DOM 로드 후 data-config="키" 속성이 붙은 요소의 텍스트를
      해당 설정값으로 채운다. (특수 키: footerLine = 학교 · 이름 · 학기)
   3. 문서 제목의 {{COURSE}} 토큰을 courseTitle로 치환한다.
   ═══════════════════════════════════════════════════════════════ */

(function () {
    "use strict";

    var cfg = window.SITE_CONFIG || {};
    var colors = cfg.colors || {};
    var root = document.documentElement;

    /* ── 1. 색상 주입 ─────────────────────────────────────────── */

    function hexToRgb(hex) {
        if (typeof hex !== "string") return null;
        var m = hex.trim().replace(/^#/, "");
        if (m.length === 3) m = m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
        if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
        return [
            parseInt(m.slice(0, 2), 16),
            parseInt(m.slice(2, 4), 16),
            parseInt(m.slice(4, 6), 16),
        ];
    }
    function tint(rgb, alpha) {
        return "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", " + alpha + ")";
    }
    function setVar(name, value) {
        if (value) root.style.setProperty(name, value);
    }

    var baseRgb = hexToRgb(colors.base);
    if (baseRgb) {
        setVar("--base", colors.base.trim());
        setVar("--base-light", tint(baseRgb, 0.20));
        setVar("--base-pale", tint(baseRgb, 0.08));
    }
    var pointRgb = hexToRgb(colors.point);
    if (pointRgb) {
        setVar("--point", colors.point.trim());
        setVar("--point-light", tint(pointRgb, 0.20));
        setVar("--point-pale", tint(pointRgb, 0.10));
    }
    if (hexToRgb(colors.ink))   setVar("--ink",   colors.ink.trim());
    if (hexToRgb(colors.gray))  setVar("--gray",  colors.gray.trim());
    if (hexToRgb(colors.light)) setVar("--light", colors.light.trim());
    if (hexToRgb(colors.line))  setVar("--line",  colors.line.trim());

    /* ── 1b. 파비콘 — base 색상의 데이터베이스 실린더 아이콘 ──── */

    var favColor = baseRgb ? colors.base.trim() : "#002D56";
    var favSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<path fill="' + favColor + '" fill-opacity="0.78" d="M5 7v18c0 2.9 4.9 5.2 11 5.2s11-2.3 11-5.2V7c0 2.9-4.9 5.2-11 5.2S5 9.9 5 7z"/>' +
        '<ellipse fill="' + favColor + '" cx="16" cy="7" rx="11" ry="5"/>' +
        "</svg>";
    var fav = document.createElement("link");
    fav.rel = "icon";
    fav.type = "image/svg+xml";
    fav.href = "data:image/svg+xml," + encodeURIComponent(favSvg);
    document.head.appendChild(fav);

    /* ── 2. 텍스트 채우기 ─────────────────────────────────────── */

    function joinParts(parts) {
        return parts
            .filter(function (v) { return v && String(v).trim(); })
            .join(" · ");
    }

    function textFor(key) {
        if (key === "footerLine") {
            return joinParts([cfg.schoolName, cfg.teacherName, cfg.semester]);
        }
        if (key === "metaLine") {
            return joinParts([cfg.teacherName, cfg.semester]);
        }
        var v = cfg[key];
        return (v === undefined || v === null) ? "" : String(v);
    }

    function applyText() {
        var nodes = document.querySelectorAll("[data-config]");
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var value = textFor(el.getAttribute("data-config"));
            if (value) el.textContent = value;
            else if (!el.textContent) el.style.display = "none";
        }
        if (document.title.indexOf("{{COURSE}}") !== -1) {
            document.title = document.title
                .split("{{COURSE}}")
                .join(cfg.courseTitle || "데이터베이스 실습");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyText);
    } else {
        applyText();
    }
})();
