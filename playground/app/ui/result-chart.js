// result-chart.js — Heuristic auto-chart for query results.
//
// Renders one of:
//   - bar chart (2 cols: TEXT label + numeric)
//   - line chart (2 cols: date-like label + numeric)
//   - grouped bar (3 cols: 1 categorical + 2 numeric)
//   - nothing (returns false and shows a message)

import {
    Chart,
    BarController, BarElement,
    LineController, LineElement, PointElement,
    LinearScale, CategoryScale,
    Tooltip, Legend, Title,
} from "../../vendor/chart.js/chart.mjs";

Chart.register(
    BarController, BarElement,
    LineController, LineElement, PointElement,
    LinearScale, CategoryScale,
    Tooltip, Legend, Title,
);

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function _isNumeric(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === "number") return Number.isFinite(v);
    return /^-?\d+(\.\d+)?$/.test(String(v));
}
function _colIsNumeric(rows, j) {
    if (!rows.length) return false;
    let n = 0;
    for (const r of rows) {
        if (j < r.length && _isNumeric(r[j])) n++;
    }
    return n >= Math.max(2, rows.length * 0.9);
}
function _colIsDateLike(rows, j) {
    if (!rows.length) return false;
    let n = 0;
    for (const r of rows) {
        const v = j < r.length ? r[j] : null;
        if (typeof v === "string" && DATE_RE.test(v)) n++;
    }
    return n >= rows.length * 0.9;
}

let _chartInstance = null;

/**
 * Try to render a chart of `result` (engine.exec output shape) into mountEl.
 * Returns the kind of chart rendered, or null if not applicable.
 */
export function tryRenderChart(mountEl, result) {
    if (_chartInstance) {
        _chartInstance.destroy();
        _chartInstance = null;
    }
    mountEl.innerHTML = "";

    if (!result || !result.rows.length || !result.columns.length) {
        mountEl.innerHTML = '<p class="chart-empty">차트로 표시할 결과가 없습니다.</p>';
        return null;
    }
    if (result.rows.length > 200) {
        mountEl.innerHTML = '<p class="chart-empty">행이 너무 많아 차트를 생략합니다 (200행 초과).</p>';
        return null;
    }

    const cols = result.columns;
    const rows = result.rows;

    let kind = null;
    let chartCfg = null;

    if (cols.length === 2) {
        if (!_colIsNumeric(rows, 0) && _colIsNumeric(rows, 1)) {
            const isLine = _colIsDateLike(rows, 0);
            kind = isLine ? "line" : "bar";
            const labels = rows.map((r) => String(r[0]));
            const data = rows.map((r) => Number(r[1]));
            chartCfg = {
                type: kind,
                data: {
                    labels,
                    datasets: [{
                        label: cols[1],
                        data,
                        backgroundColor: "rgba(0,45,86,0.65)",
                        borderColor: "#002D56",
                        borderWidth: 2,
                        fill: false,
                    }],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        title: { display: true, text: `${cols[0]} → ${cols[1]}` },
                    },
                    scales: {
                        y: { beginAtZero: true },
                    },
                },
            };
        }
    } else if (cols.length === 3 && !_colIsNumeric(rows, 0)
               && _colIsNumeric(rows, 1) && _colIsNumeric(rows, 2)) {
        kind = "bar-2y";
        const labels = rows.map((r) => String(r[0]));
        chartCfg = {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: cols[1],
                        data: rows.map((r) => Number(r[1])),
                        backgroundColor: "rgba(0,45,86,0.65)",
                    },
                    {
                        label: cols[2],
                        data: rows.map((r) => Number(r[2])),
                        backgroundColor: "rgba(141,113,80,0.65)",
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: `${cols[0]} — ${cols[1]} vs ${cols[2]}` },
                },
                scales: { y: { beginAtZero: true } },
            },
        };
    }

    if (!chartCfg) {
        mountEl.innerHTML = '<p class="chart-empty">차트로 자동 변환할 수 있는 결과 형태가 아닙니다. (2-3개 컬럼, 첫 컬럼이 라벨, 나머지가 숫자여야 합니다.)</p>';
        return null;
    }

    const canvas = document.createElement("canvas");
    canvas.style.maxHeight = "320px";
    mountEl.appendChild(canvas);
    _chartInstance = new Chart(canvas, chartCfg);
    return kind;
}
