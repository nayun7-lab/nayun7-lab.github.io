# 데이터베이스 실습 사이트 — GitHub Pages 배포용

SQL Playground · SQL Tutorial · ERD Playground 세 가지 실습 도구가 들어 있는
**완전히 독립적인 정적 웹사이트**입니다. 이 폴더의 내용물을 GitHub Pages에
올리기만 하면 학생들이 설치 없이 브라우저로 접속해 실습할 수 있습니다.

- 서버·데이터베이스 설치가 전혀 필요 없습니다. SQLite가 브라우저 안(WebAssembly)에서 직접 실행됩니다.
- 학생 데이터는 외부로 전송되지 않고 각자 브라우저 안에서만 처리됩니다.
- 실습 데이터셋(가상의 "한국고등학교")과 예제 쿼리가 미리 들어 있습니다.

---

## 1. 딱 하나만 수정하면 됩니다: `site-config.js`

`site-config.js` 파일을 메모장(또는 아무 텍스트 편집기)으로 열어
**과목명, 선생님 성함, 학교 이름, 학기, 색상**을 수정하고 저장하세요.
첫 화면과 세 실습 도구 페이지 전체에 자동으로 반영됩니다.

```js
courseTitle: "데이터베이스 실습",   ← 과목/사이트 이름
teacherName: "이준현",              ← 선생님 성함
schoolName:  "한국중학교",          ← 학교 이름
semester:    "2026학년도 1학기",    ← 학기
colors: {
  base:  "#002D56",                 ← 기본 색 (제목·버튼·배경)
  point: "#8D7150",                 ← 강조 색
},
```

따옴표(`"`)와 쉼표(`,`)만 지우지 않으면 됩니다.
색상 코드는 구글에서 "color picker"를 검색해 원하는 색의 `#RRGGBB` 값을 복사하세요.

다른 파일은 수정하지 않아도 됩니다. (`config-apply.js`는 설정을 반영하는
프로그램이므로 수정 금지)

## 2. GitHub Pages에 올리기

1. https://github.com 에 가입/로그인합니다.
2. 오른쪽 위 **+** → **New repository** → 이름 입력(예: `db-practice`) →
   **Public** 선택 → **Create repository**.
3. 만들어진 저장소 화면에서 **uploading an existing file** 링크를 클릭합니다.
4. 이 폴더를 컴퓨터에서 열고, **폴더 안의 내용물 전체**(index.html,
   site-config.js, playground, sql-tutorial, erd-playground, shared.css …)를
   선택해 업로드 창에 끌어다 놓습니다.
   - 폴더 자체가 아니라 **안의 내용물**을 올려야 `index.html`이 저장소 최상위에 위치합니다.
5. 아래 **Commit changes** 버튼을 누릅니다.
6. 저장소의 **Settings → Pages** 로 이동해
   - Source: **Deploy from a branch**
   - Branch: **main**, 폴더: **/ (root)** 를 선택하고 **Save**.
7. 1–5분 뒤 같은 화면 상단에 주소가 나타납니다:
   `https://<계정이름>.github.io/<저장소이름>/`
   이 주소를 학생들에게 공유하면 됩니다.

이후 `site-config.js`를 다시 수정하고 싶으면: 저장소에서 파일 클릭 → 연필
아이콘(Edit) → 수정 → Commit changes. 1–2분 뒤 사이트에 반영됩니다.

## 3. 폴더 구조

```
├── index.html        ← 첫 화면 (실습 도구 목록)
├── site-config.js    ← ★ 선생님이 수정하는 유일한 파일
├── config-apply.js   ← 설정 반영 스크립트 (수정 금지)
├── shared.css        ← 공통 디자인
├── shared.js         ← 공통 동작
├── playground/       ← SQL Playground (자유 실습 / 빈 DB 모드)
├── sql-tutorial/     ← SQL Tutorial (단계별 학습)
├── erd-playground/   ← ERD Playground (ER 다이어그램 설계)
├── sample-csv/       ← CSV 업로드 연습용 예시 파일 3개 + 추천 쿼리 안내
└── .nojekyll         ← GitHub Pages 설정 파일 (지우지 마세요)
```

**CSV 업로드 실습**: `sample-csv/` 폴더에 연습용 파일 3개(조인·집계·NULL 연습)와
파일별 추천 쿼리가 담긴 안내문(README.md)이 있습니다. 학생에게는 파일을 직접
나눠 주거나, 배포된 사이트 주소 뒤에
`/sample-csv/체육대회_기록.csv` 처럼 붙인 링크로 내려받게 하면 됩니다.

폴더와 파일의 위치·이름을 바꾸면 도구끼리 서로를 찾지 못해 동작하지 않습니다.
(예: `sql-tutorial`은 `playground` 폴더 안의 엔진과 데이터를 함께 사용합니다.)

## 4. 자주 묻는 질문

- **주소로 들어갔는데 404가 떠요** — 업로드 직후에는 배포에 몇 분 걸립니다.
  또 `index.html`이 저장소 최상위에 있는지 확인하세요.
- **색을 바꿨는데 그대로예요** — 브라우저 캐시입니다. `Ctrl+F5`(Mac은
  `Cmd+Shift+R`)로 강력 새로고침하세요.
- **학생 컴퓨터에 뭘 설치해야 하나요?** — 아무것도 필요 없습니다. 최신
  Chrome/Edge/Safari/Firefox면 됩니다.
- **학생이 쓴 쿼리는 어디에 저장되나요?** — 각자 브라우저의 저장소(OPFS /
  localStorage)에만 남습니다. 서버로 전송되지 않으며, 선생님도 볼 수 없습니다.
- **작업을 파일로 주고받을 수 있나요?** — SQL Playground의 **내보내기 ▾**로
  DB(.sqlite/.sql)와 **쿼리 탭 전체(.sql)** 를 파일로 저장하고, **가져오기 ▾**로
  다시 불러올 수 있습니다. 과제 제출(학생→선생님)과 수업 자료 배포(선생님→학생)
  모두 이 파일로 하면 됩니다.
- **인터넷이 안 되는 교실에서도 되나요?** — 이 배포판은 웹사이트이므로 접속에
  인터넷이 필요합니다. 오프라인 교실용으로는 함께 제공되는 **로컬 실행용
  폴더**(`teacher-site-local`)를 사용하세요.
