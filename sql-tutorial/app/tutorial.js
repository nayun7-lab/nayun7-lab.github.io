import { createEngine } from "../../playground/app/core/engine.js";
import { translateError } from "../../playground/app/core/i18n-errors.js";
import { renderResultTable } from "../../playground/app/ui/result-table.js";

const SEED_URL = "../playground/app/data/seed.sql";

const LESSONS = [
    {
        chapter: "1장",
        title: "SELECT와 FROM: 필요한 열만 읽기",
        concept: "SELECT는 결과로 보고 싶은 열을 고르고, FROM은 그 열을 어느 테이블에서 읽을지 지정합니다. 처음에는 테이블 전체를 보는 대신, 질문에 필요한 열만 선택하는 습관을 들이는 것이 좋습니다.",
        points: ["별칭 AS는 결과표의 컬럼 이름을 읽기 좋게 바꿉니다.", "LIMIT은 실습 중 너무 많은 행이 한 번에 나오지 않게 합니다."],
        question: "SELECT * 대신 필요한 열만 쓰면 어떤 장점이 있을까요?",
        answer: "결과를 읽기 쉬워지고, 실제 시스템에서는 불필요한 데이터 전송과 처리 비용도 줄어듭니다.",
        sql: `SELECT 학번,
       이름,
       학년 || '-' || 반 AS 학급
FROM students
ORDER BY 학년, 반, 번호
LIMIT 12;`,
    },
    {
        chapter: "2장",
        title: "WHERE: 행을 조건으로 걸러내기",
        concept: "WHERE는 테이블의 모든 행 중에서 조건을 만족하는 행만 남깁니다. 조건은 비교 연산자와 AND, OR, NOT을 조합해 만들 수 있습니다.",
        points: ["문자열 값은 작은따옴표로 감쌉니다.", "AND는 모든 조건이 참이어야 하고, OR는 하나라도 참이면 됩니다."],
        question: "괄호 없이 AND와 OR를 섞으면 왜 위험할까요?",
        answer: "AND가 OR보다 먼저 계산되기 때문에 의도와 다른 조건식이 될 수 있습니다. 복합 조건은 괄호로 명확히 묶는 것이 안전합니다.",
        sql: `SELECT 이름, 학년, 반, 성별
FROM students
WHERE 학년 = 1
  AND 성별 = '여'
ORDER BY 반, 번호
LIMIT 15;`,
    },
    {
        chapter: "3장",
        title: "LIKE, IN, BETWEEN: 자주 쓰는 조건 패턴",
        concept: "LIKE는 문자열 패턴, IN은 여러 후보 값, BETWEEN은 범위를 표현합니다. 조건이 길어질수록 SQL이 설명문처럼 읽히도록 쓰는 것이 중요합니다.",
        points: ["LIKE '김%'는 김으로 시작하는 값을 찾습니다.", "BETWEEN은 양 끝 값을 포함합니다.", "IN은 OR를 여러 번 쓰는 상황을 짧게 만듭니다."],
        question: "WHERE 과목코드 IN (...)은 OR 조건 여러 개와 논리적으로 어떻게 연결될까요?",
        answer: "지정한 값 중 하나와 같으면 참입니다. 즉 과목코드 = 'KOR01' OR 과목코드 = 'MAT01' 같은 조건을 간결하게 쓴 것입니다.",
        sql: `SELECT s.이름, s.학년, c.과목명, sc.점수
FROM scores sc
JOIN students s ON s.학번 = sc.학번
JOIN courses c ON c.과목코드 = sc.과목코드
WHERE s.이름 LIKE '김%'
  AND sc.과목코드 IN ('KOR01', 'MAT01', 'ENG01')
  AND sc.점수 BETWEEN 80 AND 100
ORDER BY sc.점수 DESC, s.이름
LIMIT 20;`,
    },
    {
        chapter: "4장",
        title: "NULL: 값이 없음을 다루기",
        concept: "NULL은 0이나 빈 문자열이 아니라, 아직 알 수 없거나 적용되지 않는 값입니다. 그래서 = NULL이 아니라 IS NULL 또는 IS NOT NULL을 사용합니다.",
        points: ["NULL과의 비교는 일반 비교 연산자로 판단할 수 없습니다.", "COALESCE는 NULL일 때 대신 보여줄 값을 지정합니다."],
        question: "반납일이 NULL인 도서 대출 기록은 어떤 의미로 해석할 수 있을까요?",
        answer: "이 데이터셋에서는 아직 반납되지 않은 대출 기록으로 해석할 수 있습니다. 업무 규칙에 따라 NULL의 의미를 문서화하는 것이 중요합니다.",
        sql: `SELECT s.이름,
       b.제목,
       bl.대출일,
       COALESCE(bl.반납일, '미반납') AS 반납상태
FROM book_loans bl
JOIN students s ON s.학번 = bl.학번
JOIN books b ON b.도서번호 = bl.도서번호
WHERE bl.반납일 IS NULL
ORDER BY bl.대출일
LIMIT 15;`,
    },
    {
        chapter: "5장",
        title: "ORDER BY, DISTINCT, LIMIT: 결과를 정리하기",
        concept: "SQL의 결과는 정렬을 명시하지 않으면 순서를 보장하지 않습니다. ORDER BY로 정렬 기준을 쓰고, DISTINCT로 중복을 제거하며, LIMIT으로 필요한 만큼만 확인합니다.",
        points: ["DESC는 내림차순, ASC는 오름차순입니다.", "DISTINCT는 SELECT에 적은 열 조합 전체를 기준으로 중복을 판단합니다."],
        question: "DISTINCT 이름, 학년을 쓰면 이름만 중복 제거되는 것이 맞을까요?",
        answer: "아닙니다. 이름과 학년의 조합이 같을 때만 중복으로 봅니다. 이름만 중복 제거하려면 SELECT DISTINCT 이름처럼 이름만 선택해야 합니다.",
        sql: `SELECT DISTINCT 학년, 반
FROM students
ORDER BY 학년 ASC, 반 ASC
LIMIT 12;`,
    },
    {
        chapter: "6장",
        title: "집계 함수: 여러 행을 하나의 값으로 요약하기",
        concept: "COUNT, AVG, MIN, MAX, SUM 같은 집계 함수는 여러 행을 요약해 하나의 값을 만듭니다. 전체 평균, 최고점, 행 수처럼 데이터의 큰 윤곽을 확인할 때 사용합니다.",
        points: ["COUNT(*)는 행 수를 셉니다.", "AVG(점수)는 NULL을 제외하고 평균을 계산합니다.", "ROUND는 소수점 자릿수를 정리할 때 씁니다."],
        question: "COUNT(*)와 COUNT(반납일)은 어떤 차이가 있을까요?",
        answer: "COUNT(*)는 모든 행을 세지만, COUNT(반납일)은 반납일이 NULL이 아닌 행만 셉니다.",
        sql: `SELECT COUNT(*) AS 성적행수,
       ROUND(AVG(점수), 1) AS 평균점수,
       MIN(점수) AS 최저점,
       MAX(점수) AS 최고점
FROM scores;`,
    },
    {
        chapter: "7장",
        title: "GROUP BY와 HAVING: 그룹별로 요약하기",
        concept: "GROUP BY는 같은 값을 가진 행끼리 묶은 뒤, 그룹마다 집계 결과를 계산합니다. HAVING은 집계가 끝난 그룹을 조건으로 걸러낼 때 사용합니다.",
        points: ["WHERE는 그룹을 만들기 전 행을 거릅니다.", "HAVING은 GROUP BY 후 만들어진 그룹을 거릅니다."],
        question: "평균 점수가 77점 이상인 과목만 보려면 WHERE와 HAVING 중 무엇을 써야 할까요?",
        answer: "평균 점수는 그룹별 집계 결과이므로 HAVING을 써야 합니다. HAVING 줄을 지우고 다시 실행해 보면 6과목 전체가 나오고, 조건을 걸면 3과목만 남는 것을 비교할 수 있습니다.",
        sql: `SELECT c.과목명,
       COUNT(*) AS 응시건수,
       ROUND(AVG(sc.점수), 1) AS 평균점수
FROM scores sc
JOIN courses c ON c.과목코드 = sc.과목코드
GROUP BY c.과목명
HAVING AVG(sc.점수) >= 77
ORDER BY 평균점수 DESC;`,
    },
    {
        chapter: "8장",
        title: "INNER JOIN: 연결되는 행만 합치기",
        concept: "JOIN은 여러 테이블에 나뉜 정보를 하나의 결과로 합칩니다. INNER JOIN은 양쪽 테이블에서 조인 조건이 맞는 행만 결과에 남깁니다.",
        points: ["ON에는 두 테이블을 연결하는 기준 컬럼을 씁니다.", "별칭을 쓰면 긴 테이블 이름을 줄이고 컬럼 출처를 명확히 할 수 있습니다."],
        question: "scores와 courses를 조인할 때 과목코드가 기준이 되는 이유는 무엇일까요?",
        answer: "scores에는 과목코드만 있고 과목명은 courses에 있습니다. 같은 과목코드를 기준으로 연결해야 점수 행에 과목명을 붙일 수 있습니다.",
        sql: `SELECT s.이름,
       co.과목명,
       sc.학기,
       sc.점수
FROM scores sc
JOIN students s ON s.학번 = sc.학번
JOIN courses co ON co.과목코드 = sc.과목코드
WHERE s.학년 = 3
ORDER BY s.이름, co.과목명
LIMIT 20;`,
    },
    {
        chapter: "9장",
        title: "LEFT JOIN: 없는 관계도 보존하기",
        concept: "LEFT JOIN은 왼쪽 테이블의 행을 모두 유지하고, 오른쪽 테이블에 맞는 행이 없으면 오른쪽 컬럼을 NULL로 채웁니다. 누락된 관계를 찾을 때 유용합니다.",
        points: ["LEFT JOIN 후 오른쪽 PK가 NULL인 행을 찾으면 연결되지 않은 대상을 찾을 수 있습니다.", "INNER JOIN과 결과 행 수가 달라지는 이유를 꼭 확인합니다."],
        question: "책을 한 권도 빌리지 않은 학생을 찾을 때 INNER JOIN을 쓰면 왜 안 될까요?",
        answer: "INNER JOIN은 대출 기록이 있는 학생만 남기기 때문에, 대출 기록이 없는 학생은 애초에 결과에서 사라집니다.",
        sql: `SELECT s.학번, s.이름, s.학년, s.반
FROM students s
LEFT JOIN book_loans bl ON bl.학번 = s.학번
WHERE bl.대출ID IS NULL
ORDER BY s.학년, s.반, s.번호
LIMIT 20;`,
    },
    {
        chapter: "10장",
        title: "다중 JOIN: 업무 질문을 결과표로 만들기",
        concept: "현실의 질문은 여러 테이블을 동시에 필요로 합니다. 조인은 한 번에 끝나는 문법이 아니라, 질문에 필요한 테이블을 하나씩 이어 붙이는 과정입니다.",
        points: ["먼저 중심이 되는 사실 테이블을 고릅니다.", "그 다음 이름, 설명, 분류 같은 보조 정보를 가진 테이블을 연결합니다."],
        question: "아래 쿼리에서 중심 테이블은 무엇이고, 왜 그렇게 볼 수 있을까요?",
        answer: "중심 테이블은 book_loans입니다. 질문의 한 행이 '한 번의 대출'을 의미하고, 학생과 도서 정보는 그 대출을 설명하기 위해 붙기 때문입니다.",
        sql: `SELECT bl.대출ID,
       s.이름 AS 학생,
       s.학년 || '-' || s.반 AS 학급,
       b.제목,
       bl.대출일,
       COALESCE(bl.반납일, '미반납') AS 반납상태
FROM book_loans bl
JOIN students s ON s.학번 = bl.학번
JOIN books b ON b.도서번호 = bl.도서번호
ORDER BY bl.대출일 DESC
LIMIT 20;`,
    },
    {
        chapter: "11장",
        title: "서브쿼리: 쿼리 안의 쿼리",
        concept: "서브쿼리는 한 쿼리의 결과를 다른 쿼리의 조건이나 비교 대상으로 사용하는 방법입니다. 평균보다 높은 점수, 한 번이라도 참여한 학생처럼 기준을 먼저 계산해야 하는 질문에 적합합니다.",
        points: ["스칼라 서브쿼리는 값 하나를 반환합니다.", "IN 서브쿼리는 여러 후보 값 목록을 반환할 수 있습니다."],
        question: "전체 평균보다 높은 점수를 찾을 때 평균값을 직접 숫자로 쓰지 않는 이유는 무엇일까요?",
        answer: "데이터가 바뀌면 평균도 바뀌기 때문입니다. 서브쿼리로 계산하면 항상 현재 데이터 기준의 평균을 사용합니다.",
        sql: `SELECT s.이름,
       c.과목명,
       sc.점수
FROM scores sc
JOIN students s ON s.학번 = sc.학번
JOIN courses c ON c.과목코드 = sc.과목코드
WHERE sc.점수 > (SELECT AVG(점수) FROM scores)
ORDER BY sc.점수 DESC
LIMIT 20;`,
    },
    {
        chapter: "12장",
        title: "CTE: WITH로 중간 결과에 이름 붙이기",
        concept: "CTE는 WITH 절로 중간 결과에 이름을 붙이는 방식입니다. 긴 쿼리를 단계별로 읽게 만들고, 같은 계산을 다음 SELECT에서 깔끔하게 재사용할 수 있습니다.",
        points: ["CTE는 복잡한 쿼리를 설명 가능한 단위로 나눕니다.", "실무에서는 디버깅과 리뷰가 쉬운 SQL이 좋은 SQL입니다."],
        question: "CTE를 쓰면 성능이 항상 좋아질까요?",
        answer: "항상 그렇지는 않습니다. CTE의 가장 중요한 장점은 복잡한 쿼리를 읽기 쉬운 단계로 나누는 것입니다.",
        sql: `WITH 학생평균 AS (
    SELECT s.학번,
           s.이름,
           s.학년,
           ROUND(AVG(sc.점수), 1) AS 평균점수
    FROM students s
    JOIN scores sc ON sc.학번 = s.학번
    GROUP BY s.학번, s.이름, s.학년
)
SELECT *
FROM 학생평균
WHERE 평균점수 >= 85
ORDER BY 평균점수 DESC, 이름
LIMIT 20;`,
    },
    {
        chapter: "13장",
        title: "CASE와 COALESCE: 결과를 해석하기 좋게 바꾸기",
        concept: "CASE는 조건에 따라 다른 값을 만들어 내고, COALESCE는 NULL일 때 대체값을 줍니다. SQL 결과를 사람이 바로 읽을 수 있는 보고서 형태로 바꿀 때 자주 사용합니다.",
        points: ["CASE WHEN 조건 THEN 값 ELSE 값 END 형태를 사용합니다.", "원본 데이터를 바꾸는 것이 아니라 조회 결과의 표시 방식을 바꾸는 것입니다."],
        question: "CASE로 만든 등급 컬럼은 실제 scores 테이블에 저장될까요?",
        answer: "아닙니다. SELECT 결과에만 계산되어 표시됩니다. 저장하려면 별도의 컬럼 추가나 UPDATE가 필요합니다.",
        sql: `SELECT s.이름,
       c.과목명,
       sc.점수,
       CASE
           WHEN sc.점수 >= 90 THEN 'A'
           WHEN sc.점수 >= 80 THEN 'B'
           WHEN sc.점수 >= 70 THEN 'C'
           ELSE 'D'
       END AS 등급
FROM scores sc
JOIN students s ON s.학번 = sc.학번
JOIN courses c ON c.과목코드 = sc.과목코드
ORDER BY sc.점수 DESC, s.이름
LIMIT 20;`,
    },
    {
        chapter: "14장",
        title: "문자열과 날짜 함수: 값 가공하기",
        concept: "SQLite는 문자열 일부를 자르는 substr, 길이를 재는 length, 날짜 차이를 계산하는 julianday 같은 함수를 제공합니다. 함수는 원본 값을 분석에 맞는 형태로 바꿀 때 사용합니다.",
        points: ["substr(값, 시작, 길이)는 문자열 일부를 반환합니다.", "julianday 날짜끼리 빼면 날짜 차이를 일 단위로 계산할 수 있습니다."],
        question: "날짜를 TEXT로 저장해도 비교가 되는 이유는 무엇일까요?",
        answer: "이 데이터셋은 YYYY-MM-DD 형식으로 저장되어 문자열 순서와 날짜 순서가 일치합니다. 형식이 섞이면 날짜 함수나 정규화가 필요합니다.",
        sql: `SELECT 대출ID,
       substr(대출일, 1, 7) AS 대출월,
       대출일,
       반납일,
       CASE
           WHEN 반납일 IS NULL THEN NULL
           ELSE CAST(julianday(반납일) - julianday(대출일) AS INTEGER)
       END AS 대출일수
FROM book_loans
ORDER BY 대출일 DESC
LIMIT 20;`,
    },
    {
        chapter: "15장",
        title: "윈도우 함수: 행을 유지한 채 순위와 누적값 계산하기",
        concept: "GROUP BY는 여러 행을 그룹당 한 행으로 줄입니다. 반면 윈도우 함수는 원래 행을 유지하면서 순위, 누적합, 그룹 내 평균 같은 값을 옆에 붙입니다.",
        points: ["PARTITION BY는 계산 범위를 나눕니다.", "ORDER BY는 그 범위 안에서 순서를 정합니다.", "ROW_NUMBER는 같은 점수라도 순번을 하나씩 다르게 부여합니다."],
        question: "학년별 상위권 학생을 보려면 왜 PARTITION BY 학년이 필요할까요?",
        answer: "전체 학교 기준 순위가 아니라 각 학년 안에서 다시 순위를 매겨야 하기 때문입니다.",
        sql: `WITH 학생평균 AS (
    SELECT s.학번,
           s.이름,
           s.학년,
           ROUND(AVG(sc.점수), 1) AS 평균점수
    FROM students s
    JOIN scores sc ON sc.학번 = s.학번
    GROUP BY s.학번, s.이름, s.학년
),
순위 AS (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY 학년
               ORDER BY 평균점수 DESC, 이름
           ) AS 학년내순위
    FROM 학생평균
)
SELECT 학년, 학년내순위, 이름, 평균점수
FROM 순위
WHERE 학년내순위 <= 5
ORDER BY 학년, 학년내순위;`,
    },
];

const TABLE_DESCRIPTIONS = {
    students: "학생 기본 정보",
    teachers: "교사 기본 정보",
    classes: "학급과 담임",
    courses: "과목 코드와 과목명",
    scores: "학생별 과목 성적",
    clubs: "동아리 정보",
    club_members: "동아리 가입",
    books: "도서 정보",
    book_loans: "도서 대출",
    통합성적표_원본: "정규화 전 원본 예시",
};

const statusEl = document.querySelector("#status");
const vfsEl = document.querySelector("#vfs-info");
const lessonListEl = document.querySelector("#lesson-list");
const schemaGridEl = document.querySelector("#schema-grid");

let engine = null;

function setStatus(text, kind = "info") {
    statusEl.textContent = text;
    statusEl.dataset.kind = kind;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderLessons() {
    lessonListEl.innerHTML = "";
    LESSONS.forEach((lesson, idx) => {
        const card = document.createElement("article");
        card.className = "lesson-card";
        card.id = `lesson-${idx + 1}`;
        card.innerHTML = `
            <div class="lesson-copy">
                <span class="lesson-kicker">${escapeHtml(lesson.chapter)}</span>
                <h3>${escapeHtml(lesson.title)}</h3>
                <p>${escapeHtml(lesson.concept)}</p>
                <ul>${lesson.points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
                <div class="check-question">
                    <strong>확인 질문</strong>
                    <p>${escapeHtml(lesson.question)}</p>
                </div>
            </div>
            <div class="lesson-workspace">
                <textarea class="sql-editor" aria-label="${escapeHtml(lesson.title)} SQL 편집기" spellcheck="false">${escapeHtml(lesson.sql)}</textarea>
                <div class="lesson-actions">
                    <button class="run-btn" type="button" disabled>실행</button>
                    <button class="reset-btn" type="button">예제 복원</button>
                    <button class="copy-btn" type="button">SQL 복사</button>
                    <button class="answer-btn" type="button" aria-expanded="false">해설 보기</button>
                </div>
                <div class="answer-panel" hidden>${escapeHtml(lesson.answer)}</div>
                <div class="error-card" hidden></div>
                <div class="result-box"><p class="result-empty">실행하면 결과가 여기에 표시됩니다.</p></div>
            </div>
        `;

        const textarea = card.querySelector(".sql-editor");
        const runBtn = card.querySelector(".run-btn");
        const resetBtn = card.querySelector(".reset-btn");
        const copyBtn = card.querySelector(".copy-btn");
        const answerBtn = card.querySelector(".answer-btn");
        const answerPanel = card.querySelector(".answer-panel");
        const errorBox = card.querySelector(".error-card");
        const resultBox = card.querySelector(".result-box");

        runBtn.addEventListener("click", async () => {
            await runLesson({ sql: textarea.value, runBtn, errorBox, resultBox });
        });
        resetBtn.addEventListener("click", () => {
            textarea.value = lesson.sql;
            errorBox.hidden = true;
            renderResultTable(resultBox, null);
        });
        copyBtn.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(textarea.value);
                copyBtn.textContent = "복사됨";
                setTimeout(() => { copyBtn.textContent = "SQL 복사"; }, 1100);
            } catch {
                textarea.select();
                document.execCommand("copy");
            }
        });
        answerBtn.addEventListener("click", () => {
            const next = answerPanel.hidden;
            answerPanel.hidden = !next;
            answerBtn.setAttribute("aria-expanded", String(next));
            answerBtn.textContent = next ? "해설 숨기기" : "해설 보기";
        });

        lessonListEl.appendChild(card);
    });
}

async function runLesson({ sql, runBtn, errorBox, resultBox }) {
    if (!engine) return;
    runBtn.disabled = true;
    runBtn.textContent = "실행 중";
    errorBox.hidden = true;
    errorBox.innerHTML = "";
    try {
        const result = await engine.exec(sql.trim());
        renderResultTable(resultBox, result);
    } catch (err) {
        const translated = translateError(err?.message || String(err));
        errorBox.innerHTML = `
            <p><strong>오류:</strong> ${escapeHtml(translated.ko)}</p>
            ${translated.hint ? `<p><strong>힌트:</strong> ${escapeHtml(translated.hint)}</p>` : ""}
        `;
        errorBox.hidden = false;
        renderResultTable(resultBox, null);
    } finally {
        runBtn.disabled = false;
        runBtn.textContent = "실행";
    }
}

async function renderSchema() {
    const preferredOrder = [
        "students",
        "teachers",
        "classes",
        "courses",
        "scores",
        "clubs",
        "club_members",
        "books",
        "book_loans",
    ];
    const schema = await engine.getSchema();
    const names = [
        ...preferredOrder.filter((name) => schema[name]),
        ...Object.keys(schema).filter((name) => !preferredOrder.includes(name)).sort(),
    ];
    schemaGridEl.innerHTML = "";
    for (const name of names) {
        const card = document.createElement("div");
        card.className = "schema-card";
        const columns = schema[name].slice(0, 8).join(", ");
        const suffix = schema[name].length > 8 ? " ..." : "";
        card.innerHTML = `
            <h3>${escapeHtml(name)}</h3>
            <p>${escapeHtml(TABLE_DESCRIPTIONS[name] || "학습용 테이블")}</p>
            <p><code>${escapeHtml(columns + suffix)}</code></p>
        `;
        schemaGridEl.appendChild(card);
    }
}

async function boot() {
    renderLessons();
    try {
        const started = performance.now();
        engine = await createEngine({
            dbName: "sql-tutorial.db",
            seedUrl: SEED_URL,
        });
        await renderSchema();
        const tables = await engine.listTables();
        let totalRows = 0;
        for (const table of tables) {
            totalRows += await engine.rowCount(table);
        }
        vfsEl.textContent = engine.vfs === "opfs" ? "브라우저 로컬 저장소" : "메모리";
        setStatus(`준비 완료: 테이블 ${tables.length}개, 총 ${totalRows.toLocaleString()}행 · ${(performance.now() - started).toFixed(0)} ms`, "ok");
        document.querySelectorAll(".run-btn").forEach((btn) => { btn.disabled = false; });
    } catch (err) {
        console.error(err);
        setStatus(`실습 환경을 불러오지 못했습니다: ${err?.message || err}`, "error");
    }
}

boot();
