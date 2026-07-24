// i18n-errors.js — Map raw SQLite error strings to plain Korean explanations.
//
// Each entry: { match: RegExp, ko: (groups) => string, hint?: string }
// We try patterns in order; the first match wins. Falls back to the raw message
// (still wrapped in a generic Korean prefix) if nothing matches.

const RULES = [
    {
        match: /no such table:\s*(\S+)/i,
        ko: (m) => `존재하지 않는 테이블: ${m[1]}`,
        hint: "테이블 이름의 철자를 확인하거나, CREATE TABLE 문을 먼저 실행했는지 확인하세요.",
    },
    {
        match: /no such column:\s*(\S+)/i,
        ko: (m) => `존재하지 않는 컬럼: ${m[1]}`,
        hint: "컬럼 이름의 철자를 확인하세요. 테이블별로 컬럼 목록을 확인하려면 좌측 스키마 패널을 참고하세요.",
    },
    {
        match: /no such function:\s*(\S+)/i,
        ko: (m) => `존재하지 않는 함수: ${m[1]}`,
        hint: "SQLite가 지원하는 함수 이름인지 확인하세요. (예: COUNT, SUM, AVG, COALESCE, LENGTH)",
    },
    {
        match: /no such savepoint:\s*(\S+)/i,
        ko: (m) => `존재하지 않는 SAVEPOINT: ${m[1]}`,
        hint: "ROLLBACK TO/RELEASE 전에 SAVEPOINT를 만들었는지 확인하세요.",
    },
    {
        match: /UNIQUE constraint failed:\s*(.+)/i,
        ko: (m) => `UNIQUE 제약 위반: ${m[1]}`,
        hint: "이미 같은 값이 있는 행이 존재합니다. PRIMARY KEY 또는 UNIQUE 컬럼에 중복된 값을 INSERT/UPDATE 하려고 했는지 확인하세요.",
    },
    {
        match: /NOT NULL constraint failed:\s*(.+)/i,
        ko: (m) => `NOT NULL 제약 위반: ${m[1]} 컬럼에 NULL이 들어가려 했습니다`,
        hint: "해당 컬럼에 값을 지정하거나, 스키마에서 NULL 허용으로 바꾸세요.",
    },
    {
        match: /FOREIGN KEY constraint failed/i,
        ko: () => "외래키(FOREIGN KEY) 제약 위반",
        hint: "참조하려는 부모 행이 실제로 존재하는지 확인하세요. 부모를 먼저 INSERT한 뒤 자식을 INSERT 하세요.",
    },
    {
        match: /CHECK constraint failed(?::\s*(.+))?/i,
        ko: (m) => `CHECK 제약 위반${m[1] ? `: ${m[1]}` : ""}`,
        hint: "테이블에 정의된 CHECK 조건을 어겼습니다. CREATE TABLE 정의의 CHECK 절을 확인하세요.",
    },
    {
        match: /datatype mismatch/i,
        ko: () => "자료형 불일치",
        hint: "컬럼에 정의된 형식과 다른 종류의 값을 넣으려 했습니다. 예: INTEGER 컬럼에 문자열.",
    },
    {
        match: /near\s*"([^"]+)":\s*syntax error/i,
        ko: (m) => `구문 오류: '${m[1]}' 근처`,
        hint: "괄호, 콜론, 따옴표가 짝지어졌는지, 키워드 철자가 맞는지 확인하세요.",
    },
    {
        match: /incomplete input/i,
        ko: () => "불완전한 입력 (쿼리가 마무리되지 않았습니다)",
        hint: "닫는 괄호, 닫는 따옴표, 마지막 세미콜론(;)이 누락되지 않았는지 확인하세요.",
    },
    {
        match: /unrecognized token:\s*"([^"]+)"/i,
        ko: (m) => `인식할 수 없는 토큰: '${m[1]}'`,
        hint: "오타가 있거나 SQL이 아닌 문자가 들어갔습니다.",
    },
    {
        match: /ambiguous column name:\s*(\S+)/i,
        ko: (m) => `중복되는 컬럼 이름: ${m[1]}`,
        hint: "JOIN으로 합쳐진 여러 테이블에 같은 이름의 컬럼이 있습니다. '테이블.컬럼' 형식으로 명시하세요.",
    },
    {
        match: /sub-?select returns (\d+) columns - expected (\d+)/i,
        ko: (m) => `서브쿼리가 ${m[1]}개 컬럼을 반환했지만 ${m[2]}개가 필요합니다`,
        hint: "서브쿼리의 SELECT 절에서 컬럼 개수를 맞추세요.",
    },
    {
        match: /(\d+) values for (\d+) columns/i,
        ko: (m) => `INSERT 값 개수 불일치: ${m[2]}개 컬럼에 ${m[1]}개 값을 주려 했습니다`,
        hint: "VALUES (...) 안의 값 개수를 컬럼 개수와 맞추세요.",
    },
    {
        match: /table\s+(\S+)\s+has\s+(\d+)\s+columns? but (\d+) values were supplied/i,
        ko: (m) => `INSERT 값 개수 불일치: '${m[1]}' 테이블은 ${m[2]}개 컬럼이지만 ${m[3]}개 값이 주어졌습니다`,
        hint: "VALUES 안의 값 개수를 컬럼 개수와 맞추거나, INSERT INTO 표 (지정컬럼…) 로 명시하세요.",
    },
    {
        match: /column\s+(\S+)\s+is not unique/i,
        ko: (m) => `'${m[1]}' 컬럼이 모호합니다 (여러 테이블에 동일 이름)`,
        hint: "테이블 별칭 또는 '테이블.컬럼' 형식을 사용하세요.",
    },
    {
        match: /\bGROUP BY\b/i,
        priority: 100, // only fire if more specific patterns didn't match — see below
        ko: () => "GROUP BY 관련 오류",
        hint: "SELECT 절에 GROUP BY 컬럼 외의 컬럼을 그대로 두면 안 됩니다. 집계함수(COUNT, AVG 등)로 감싸거나 GROUP BY 절에 추가하세요.",
        guard: (msg) => /aggregate|GROUP BY/i.test(msg),
    },
    {
        match: /database is locked/i,
        ko: () => "데이터베이스가 잠겨 있습니다",
        hint: "다른 쿼리가 끝나기를 기다린 뒤 다시 시도하세요. 브라우저 탭이 여러 개인지 확인하세요.",
    },
    {
        match: /access permission denied/i,
        ko: () => "접근 권한이 없습니다",
        hint: "브라우저 스토리지(OPFS/IndexedDB) 권한 또는 시크릿 모드 제약을 확인하세요.",
    },
    {
        match: /too many SQL variables/i,
        ko: () => "SQL 변수(? 또는 :name)가 너무 많습니다",
        hint: "한 번에 바인딩할 수 있는 변수 수의 상한(999개)을 초과했습니다. 여러 INSERT로 나누세요.",
    },
    {
        match: /interrupted/i,
        ko: () => "쿼리가 중단되었습니다",
        hint: "실행 중인 쿼리를 사용자 또는 시스템이 취소했습니다.",
    },
    {
        match: /out of memory/i,
        ko: () => "메모리 부족",
        hint: "결과 행 수가 너무 많거나, 매우 큰 INSERT 묶음일 수 있습니다. 작게 나누어 실행하세요.",
    },
    {
        match: /string or blob too big/i,
        ko: () => "문자열 또는 BLOB 값이 너무 큽니다",
        hint: "한 셀에 1GB가 넘는 값을 넣을 수 없습니다.",
    },
    {
        match: /(\S+):\s*Cannot add a column with non-constant default/i,
        ko: (m) => `ALTER TABLE 오류: '${m[1]}' 컬럼의 DEFAULT는 상수여야 합니다`,
        hint: "DEFAULT CURRENT_DATE 등 동적 기본값은 새 컬럼에 사용할 수 없습니다. 컬럼을 추가한 뒤 UPDATE로 채우세요.",
    },
    {
        match: /Cannot add a NOT NULL column with default value NULL/i,
        ko: () => "ALTER TABLE 오류: NOT NULL 컬럼은 기본값이 필요합니다",
        hint: "기존 행을 채울 DEFAULT 값을 지정하거나, NULL 허용 컬럼으로 추가한 뒤 UPDATE 하세요.",
    },
    {
        match: /attempt to write a readonly database/i,
        ko: () => "읽기 전용 데이터베이스에 쓰기를 시도했습니다",
        hint: "현재 데이터베이스가 읽기 전용으로 열려 있습니다. INSERT/UPDATE/DELETE는 불가능합니다.",
    },
    {
        match: /no such collation sequence:\s*(\S+)/i,
        ko: (m) => `존재하지 않는 정렬 규칙: ${m[1]}`,
        hint: "SQLite 기본 COLLATE는 BINARY · NOCASE · RTRIM 세 가지입니다.",
    },
    {
        match: /no such index:\s*(\S+)/i,
        ko: (m) => `존재하지 않는 인덱스: ${m[1]}`,
        hint: "DROP INDEX 전에 인덱스가 실제로 존재하는지 확인하세요.",
    },
    {
        match: /already exists/i,
        ko: () => "이미 존재합니다",
        hint: "같은 이름의 객체가 이미 있습니다. CREATE … IF NOT EXISTS 또는 DROP 후 재생성하세요.",
    },
    {
        match: /malformed database/i,
        ko: () => "데이터베이스 파일이 손상되었습니다",
        hint: "DB를 초기화한 뒤 seed.sql을 다시 적재하세요.",
    },
    {
        match: /(?:near|expects)\s*"?(.+?)"?$/i,
        ko: (m) => `구문 분석 실패: '${m[1]}' 부근`,
        hint: "키워드 순서, 괄호, 따옴표를 점검하세요.",
    },
];

/**
 * Translate a SQLite error message to a Korean explanation.
 *
 * @param {string} rawMessage
 * @returns {{ko: string, hint?: string, raw: string, matched: boolean}}
 */
export function translateError(rawMessage) {
    const raw = String(rawMessage || "").trim();
    if (!raw) {
        return { ko: "알 수 없는 오류", raw, matched: false };
    }
    for (const rule of RULES) {
        if (rule.guard && !rule.guard(raw)) continue;
        const m = raw.match(rule.match);
        if (m) {
            return {
                ko: rule.ko(m),
                hint: rule.hint,
                raw,
                matched: true,
            };
        }
    }
    return { ko: `SQL 오류: ${raw}`, raw, matched: false };
}
