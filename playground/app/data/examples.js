// examples.js — Lesson-indexed example query library.
//
// Each entry maps to a curriculum lesson and showcases the SQL feature
// taught in that lesson against the 한국고등학교 seed dataset.

export const EXAMPLES = [
    {
        lesson: "13-14",
        title: "기본 SELECT/WHERE",
        sql: `-- 1학년 학생 명단 (이름·반)
SELECT 이름, 학년, 반
FROM students
WHERE 학년 = 1
ORDER BY 반, 번호
LIMIT 20;`,
    },
    {
        lesson: "15-16",
        title: "AND/OR/NULL",
        sql: `-- 1학년 또는 2학년인 학생 중 점수가 80점 이상인 행 (NULL 제외)
SELECT s.이름, s.학년, sc.과목코드, sc.점수
FROM students s
JOIN scores  sc USING (학번)
WHERE (s.학년 = 1 OR s.학년 = 2)
  AND sc.점수 IS NOT NULL
  AND sc.점수 >= 80
ORDER BY sc.점수 DESC
LIMIT 20;`,
    },
    {
        lesson: "17-18",
        title: "LIKE/IN/BETWEEN",
        sql: `-- 김씨 성을 가진 학생, 2024년 9월 ~ 12월 사이에 책을 빌린 기록
SELECT s.이름, bl.대출일, b.제목
FROM students s
JOIN book_loans bl USING (학번)
JOIN books      b  USING (도서번호)
WHERE s.이름 LIKE '김%'
  AND bl.대출일 BETWEEN '2024-09-01' AND '2024-12-31'
ORDER BY bl.대출일;`,
    },
    {
        lesson: "19-20",
        title: "ORDER BY / DISTINCT / LIMIT",
        sql: `-- 점수 상위 10명 (DISTINCT로 중복 학생 제거; LIMIT으로 페이지네이션)
SELECT DISTINCT s.이름, s.학년, sc.점수
FROM students s
JOIN scores sc USING (학번)
ORDER BY sc.점수 DESC, s.이름
LIMIT 10 OFFSET 0;`,
    },
    {
        lesson: "21-22",
        title: "COUNT/SUM/AVG/MIN/MAX",
        sql: `-- 학년별 평균 점수와 인원수
SELECT s.학년,
       COUNT(DISTINCT s.학번) AS 인원,
       ROUND(AVG(sc.점수), 1) AS 평균점수,
       MIN(sc.점수)            AS 최저,
       MAX(sc.점수)            AS 최고
FROM students s
JOIN scores  sc USING (학번)
GROUP BY s.학년
ORDER BY s.학년;`,
    },
    {
        lesson: "23-24",
        title: "GROUP BY / HAVING",
        sql: `-- 동아리별 가입 인원수, 5명 이상만 (HAVING)
SELECT c.이름 AS 동아리, COUNT(*) AS 인원
FROM clubs c
JOIN club_members cm USING (동아리번호)
GROUP BY c.이름
HAVING COUNT(*) >= 5
ORDER BY 인원 DESC;`,
    },
    {
        lesson: "25-26",
        title: "INNER JOIN",
        sql: `-- 학생 + 과목 + 점수 — 3-way INNER JOIN
SELECT s.이름, co.과목명, sc.학기, sc.점수
FROM students s
JOIN scores  sc USING (학번)
JOIN courses co USING (과목코드)
WHERE s.학년 = 3
ORDER BY s.이름, sc.학기, co.과목명
LIMIT 30;`,
    },
    {
        lesson: "27-28",
        title: "LEFT JOIN (책 한 권도 안 빌린 학생)",
        sql: `-- LEFT JOIN으로 책을 한 권도 안 빌린 학생 명단
SELECT s.이름, s.학년, s.반
FROM students s
LEFT JOIN book_loans bl USING (학번)
WHERE bl.대출ID IS NULL
ORDER BY s.학년, s.반, s.번호;`,
    },
    {
        lesson: "27-28",
        title: "LEFT JOIN + COALESCE (미반납 표시)",
        sql: `-- 학생 + 도서 대출 기록; 미반납은 '미반납'으로 표시
SELECT s.이름,
       b.제목,
       bl.대출일,
       COALESCE(bl.반납일, '미반납') AS 반납상태
FROM students s
LEFT JOIN book_loans bl USING (학번)
LEFT JOIN books      b  USING (도서번호)
WHERE s.학번 BETWEEN 250101 AND 250110
ORDER BY s.학번, bl.대출일;`,
    },
    {
        lesson: "11-12",
        title: "정규화 (비정규화 → 분해)",
        sql: `-- 시작 상태: 비정규화된 wide row (담임 정보가 매 점수마다 반복)
SELECT * FROM 통합성적표_원본 LIMIT 5;

-- 분해 결과(이미 정규화된 테이블들)와 비교:
SELECT s.학번, s.이름, c.학년, c.반, t.이름 AS 담임, co.과목명, sc.점수
FROM scores  sc
JOIN students s ON s.학번 = sc.학번
JOIN classes  c ON c.학년 = s.학년 AND c.반 = s.반
JOIN teachers t ON t.교사번호 = c.담임교사번호
JOIN courses  co ON co.과목코드 = sc.과목코드
LIMIT 5;`,
    },
    {
        lesson: "29-30",
        title: "CTE로 과목별 평균 초과 학생",
        sql: `WITH subject_avg AS (
  SELECT 과목코드, AVG(점수) AS 평균점수
  FROM scores
  GROUP BY 과목코드
)
SELECT s.학번, s.이름, c.과목명,
       sc.점수, ROUND(a.평균점수, 1) AS 과목평균
FROM scores AS sc
JOIN subject_avg AS a ON a.과목코드 = sc.과목코드
JOIN students AS s ON s.학번 = sc.학번
JOIN courses AS c ON c.과목코드 = sc.과목코드
WHERE sc.점수 > a.평균점수
ORDER BY c.과목명, sc.점수 DESC, s.학번
LIMIT 20;`,
    },
    {
        lesson: "31-32",
        title: "기준값 확인과 ROLLBACK",
        sql: `BEGIN;
UPDATE scores
SET 점수 = 97
WHERE 성적ID = 1 AND 점수 = 95;
SELECT changes() AS 변경행수;
ROLLBACK;
SELECT 성적ID, 점수
FROM scores
WHERE 성적ID = 1;`,
    },
    {
        lesson: "33-34",
        title: "복합 인덱스와 실행 계획",
        sql: `DROP INDEX IF EXISTS idx_loans_student_date;
CREATE INDEX idx_loans_student_date
ON book_loans(학번, 대출일 DESC);

EXPLAIN QUERY PLAN
SELECT 대출ID, 도서번호, 대출일
FROM book_loans
WHERE 학번 = 250114
ORDER BY 대출일 DESC;`,
    },
    {
        lesson: "35-36",
        title: "개인정보 최소화 조회",
        sql: `SELECT s.학년,
       COUNT(l.대출ID) AS 대출건수
FROM students AS s
LEFT JOIN book_loans AS l ON l.학번 = s.학번
GROUP BY s.학년
ORDER BY s.학년;`,
    },
    {
        lesson: "9-10",
        title: "CREATE TABLE + PK/FK + 제약",
        sql: `-- 학교 매점 메뉴 테이블 만들기
DROP TABLE IF EXISTS 매점주문;
DROP TABLE IF EXISTS 매점메뉴;

CREATE TABLE 매점메뉴 (
    메뉴번호   INTEGER PRIMARY KEY,
    메뉴이름   TEXT NOT NULL,
    가격       INTEGER NOT NULL CHECK (가격 >= 0)
);

CREATE TABLE 매점주문 (
    주문번호   INTEGER PRIMARY KEY,
    학번       INTEGER NOT NULL,
    메뉴번호   INTEGER NOT NULL,
    수량       INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (학번)     REFERENCES students(학번),
    FOREIGN KEY (메뉴번호) REFERENCES 매점메뉴(메뉴번호)
);

INSERT INTO 매점메뉴 VALUES (1, '김밥', 2500), (2, '떡볶이', 3500);
INSERT INTO 매점주문 VALUES (1, 250101, 1, 2);

SELECT s.이름, m.메뉴이름, o.수량 * m.가격 AS 합계
FROM 매점주문 o
JOIN students s ON s.학번 = o.학번
JOIN 매점메뉴 m ON m.메뉴번호 = o.메뉴번호;`,
    },
];
