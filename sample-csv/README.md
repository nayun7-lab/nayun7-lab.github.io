# CSV 업로드 연습용 예시 파일

SQL Playground의 **CSV 업로드** 버튼으로 올려서 실습할 수 있는 예시 파일 3개입니다.
모두 UTF-8(BOM) 인코딩이라 엑셀에서도 바로 열립니다.

업로드 방법: SQL Playground → `CSV 업로드` 버튼 → 파일 선택 → 테이블 이름 확인 →
왼쪽 스키마 목록에 새 테이블이 나타나면 성공입니다.

---

## 1. 체육대회_기록.csv — JOIN 연습

기존 `students` 테이블의 실제 학번이 들어 있어 **조인 실습**에 좋습니다.
컬럼: `학번`(정수) · `종목`(문자) · `기록_초`(실수)

```sql
-- 종목별 1위 기록
SELECT 종목, MIN(기록_초) AS 최고기록
FROM 체육대회_기록
GROUP BY 종목;

-- 학생 이름과 함께 100m 순위 보기
SELECT s.이름, s.학년, s.반, r.기록_초
FROM 체육대회_기록 r
JOIN students s ON s.학번 = r.학번
WHERE r.종목 = '100m 달리기'
ORDER BY r.기록_초;

-- 학년별 평균 기록
SELECT s.학년, r.종목, ROUND(AVG(r.기록_초), 1) AS 평균기록
FROM 체육대회_기록 r
JOIN students s ON s.학번 = r.학번
GROUP BY s.학년, r.종목
ORDER BY r.종목, s.학년;
```

## 2. 매점_판매.csv — 집계(GROUP BY) 연습

다른 테이블 없이 단독으로 쓰는 판매 기록입니다.
컬럼: `판매일`(문자, YYYY-MM-DD) · `상품`(문자) · `단가`(정수) · `수량`(정수)

```sql
-- 상품별 총 매출
SELECT 상품, SUM(단가 * 수량) AS 총매출
FROM 매점_판매
GROUP BY 상품
ORDER BY 총매출 DESC;

-- 하루 매출 흐름
SELECT 판매일, SUM(단가 * 수량) AS 일매출
FROM 매점_판매
GROUP BY 판매일;

-- 총매출 3만 원 이상인 상품만 (HAVING) — 6개 중 4개만 남습니다
SELECT 상품, SUM(단가 * 수량) AS 총매출
FROM 매점_판매
GROUP BY 상품
HAVING SUM(단가 * 수량) >= 30000;
```

## 3. 도서_희망신청.csv — NULL과 따옴표 필드 연습

`신청사유`가 비어 있는 행이 섞여 있고(업로드하면 **NULL**로 저장됩니다),
`"데이터베이스, 첫걸음"`처럼 **쉼표가 든 따옴표 필드**도 들어 있습니다.
컬럼: `학번`(정수) · `희망도서`(문자) · `신청사유`(문자, 일부 NULL)

```sql
-- 사유를 적지 않은 신청 찾기 (IS NULL)
SELECT 학번, 희망도서
FROM 도서_희망신청
WHERE 신청사유 IS NULL;

-- NULL을 대체 문구로 바꿔 보기 (COALESCE)
SELECT 희망도서, COALESCE(신청사유, '(사유 없음)') AS 사유
FROM 도서_희망신청;

-- 학년별 신청 건수 (JOIN + GROUP BY)
SELECT s.학년, COUNT(*) AS 신청수
FROM 도서_희망신청 w
JOIN students s ON s.학번 = w.학번
GROUP BY s.학년;
```
