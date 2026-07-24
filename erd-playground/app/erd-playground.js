const STORAGE_KEY = "db-course-erd-playground";
const SVG_NS = "http://www.w3.org/2000/svg";
const CARD_WIDTH = 230;
const HEADER_HEIGHT = 38;
const ROW_HEIGHT = 24;
const PADDING = 12;
const ENTITY_TEXT_LIMIT = 27;

const samples = {
  school: {
    entities: [
      entity("students", 80, 90, [
        col("student_id", "INTEGER", "PK", false),
        col("name", "TEXT", "", false),
        col("grade", "INTEGER", "", false),
        col("class_no", "INTEGER", "", false)
      ]),
      entity("courses", 410, 90, [
        col("course_id", "TEXT", "PK", false),
        col("name", "TEXT", "", false),
        col("credit", "INTEGER", "", true)
      ]),
      entity("enrollments", 245, 330, [
        col("student_id", "INTEGER", "PK/FK", false, "students", "student_id"),
        col("course_id", "TEXT", "PK/FK", false, "courses", "course_id"),
        col("semester", "TEXT", "", false),
        col("score", "INTEGER", "", true)
      ])
    ],
    relationships: [
      relation("students", "enrollments", "enrolls", "1", "N", true),
      relation("courses", "enrollments", "is_taken_in", "1", "N", true)
    ]
  },
  library: {
    entities: [
      entity("students", 80, 80, [col("student_id", "INTEGER", "PK", false), col("name", "TEXT", "", false), col("class_no", "INTEGER", "", false)]),
      entity("books", 430, 80, [col("book_id", "INTEGER", "PK", false), col("title", "TEXT", "", false), col("publisher", "TEXT", "", true)]),
      entity("loans", 255, 315, [col("loan_id", "INTEGER", "PK", false), col("student_id", "INTEGER", "FK", false, "students", "student_id"), col("book_id", "INTEGER", "FK", false, "books", "book_id"), col("loaned_at", "DATE", "", false), col("returned_at", "DATE", "", true)])
    ],
    relationships: [
      relation("students", "loans", "borrows", "1", "0..N", false),
      relation("books", "loans", "is_loaned_as", "1", "0..N", false)
    ]
  },
  club: {
    entities: [
      entity("students", 80, 95, [col("student_id", "INTEGER", "PK", false), col("name", "TEXT", "", false), col("grade", "INTEGER", "", false)]),
      entity("clubs", 430, 95, [col("club_id", "INTEGER", "PK", false), col("name", "TEXT", "", false), col("teacher_name", "TEXT", "", true)]),
      entity("club_members", 250, 330, [col("club_id", "INTEGER", "PK/FK", false, "clubs", "club_id"), col("student_id", "INTEGER", "PK/FK", false, "students", "student_id"), col("join_date", "DATE", "", false), col("role", "TEXT", "", true)])
    ],
    relationships: [
      relation("students", "club_members", "joins", "1", "N", true),
      relation("clubs", "club_members", "has_member", "1", "N", true)
    ]
  }
};

let state = restoreState();
let pointerDrag = null;

const el = {
  canvas: document.querySelector("#erdCanvas"),
  addEntityBtn: document.querySelector("#addEntityBtn"),
  addRelationBtn: document.querySelector("#addRelationBtn"),
  deleteBtn: document.querySelector("#deleteBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  exportPngBtn: document.querySelector("#exportPngBtn"),
  importFile: document.querySelector("#importFile"),
  copySpecBtn: document.querySelector("#copySpecBtn"),
  specOutput: document.querySelector("#specOutput"),
  validationList: document.querySelector("#validationList"),
  emptyEditor: document.querySelector("#emptyEditor"),
  entityEditor: document.querySelector("#entityEditor"),
  relationEditor: document.querySelector("#relationEditor"),
  entityName: document.querySelector("#entityName"),
  columnList: document.querySelector("#columnList"),
  addColumnBtn: document.querySelector("#addColumnBtn"),
  relationName: document.querySelector("#relationName"),
  relationFrom: document.querySelector("#relationFrom"),
  relationTo: document.querySelector("#relationTo"),
  relationFromCard: document.querySelector("#relationFromCard"),
  relationToCard: document.querySelector("#relationToCard"),
  relationIdentifying: document.querySelector("#relationIdentifying")
};

render();

document.querySelectorAll("[data-sample]").forEach((button) => {
  button.addEventListener("click", () => loadSample(button.dataset.sample));
});

el.addEntityBtn.addEventListener("click", addEntity);
el.addRelationBtn.addEventListener("click", addRelationship);
el.deleteBtn.addEventListener("click", deleteSelected);
el.resetBtn.addEventListener("click", () => loadSample("school"));
el.exportJsonBtn.addEventListener("click", exportJson);
el.exportPngBtn.addEventListener("click", exportPng);
el.importFile.addEventListener("change", importJson);
el.copySpecBtn.addEventListener("click", copySpec);
el.addColumnBtn.addEventListener("click", addColumn);

el.entityName.addEventListener("input", () => {
  const current = selectedEntity();
  if (!current) return;
  const previousName = current.name;
  current.name = normalizeName(el.entityName.value);
  state.relationships.forEach((rel) => {
    if (rel.fromName === previousName) rel.fromName = current.name;
    if (rel.toName === previousName) rel.toName = current.name;
  });
  state.entities.forEach((ent) => {
    ent.columns.forEach((column) => {
      if (column.refEntity === previousName) column.refEntity = current.name;
    });
  });
  saveAndRefresh();
});

[
  el.relationName,
  el.relationFrom,
  el.relationTo,
  el.relationFromCard,
  el.relationToCard,
  el.relationIdentifying
].forEach((input) => input.addEventListener("input", updateRelationshipFromEditor));

document.addEventListener("keydown", (event) => {
  if (event.key === "Delete" || event.key === "Backspace") {
    if (!["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
      deleteSelected();
    }
  }
  if (event.key === "Escape") {
    selectItem(null, null);
  }
});

document.addEventListener("pointermove", (event) => {
  if (!pointerDrag) return;
  const ent = state.entities.find((item) => item.id === pointerDrag.id);
  if (!ent) return;
  const dx = event.clientX - pointerDrag.startClientX;
  const dy = event.clientY - pointerDrag.startClientY;
  if (!pointerDrag.active && Math.hypot(dx, dy) < 4) return;
  pointerDrag.active = true;
  const point = svgPoint(event);
  ent.x = clamp(pointerDrag.originalX + (point.x - pointerDrag.startSvgX), 12, 735);
  ent.y = clamp(pointerDrag.originalY + (point.y - pointerDrag.startSvgY), 52, 620);
  saveAndRefresh();
});

document.addEventListener("pointerup", () => {
  if (!pointerDrag) return;
  const shouldRender = pointerDrag.active;
  pointerDrag = null;
  if (shouldRender) saveAndRender();
});

function entity(name, x, y, columns) {
  return { id: uid("ent"), name, x, y, columns };
}

function col(name, type = "TEXT", key = "", nullable = true, refEntity = "", refColumn = "") {
  return { id: uid("col"), name, type, key, nullable, refEntity, refColumn };
}

function relation(fromName, toName, label, fromCard, toCard, identifying = false) {
  return { id: uid("rel"), fromName, toName, label, fromCard, toCard, identifying };
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function restoreState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.entities) && Array.isArray(parsed.relationships)) {
        normalizeState(parsed);
        return parsed;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return structuredClone(samples.school);
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function saveAndRefresh() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderCanvas();
  renderValidation();
  el.specOutput.value = generateSpec();
}

function loadSample(name) {
  state = structuredClone(samples[name]);
  normalizeState(state);
  state.selected = null;
  saveAndRender();
}

function render() {
  renderCanvas();
  renderEditor();
  renderValidation();
  el.specOutput.value = generateSpec();
}

function renderCanvas() {
  el.canvas.innerHTML = "";
  el.canvas.setAttribute("viewBox", "0 0 980 720");
  renderDefs();
  state.relationships.forEach(drawRelationship);
  state.entities.forEach(drawEntity);
}

function renderDefs() {
  const defs = svg("defs");
  const marker = svg("marker", {
    id: "arrow",
    markerWidth: 8,
    markerHeight: 8,
    refX: 7,
    refY: 4,
    orient: "auto",
    markerUnits: "strokeWidth"
  });
  marker.append(svg("path", { d: "M 0 0 L 8 4 L 0 8 z", fill: "#566473" }));
  defs.append(marker);
  el.canvas.append(defs);
}

function drawRelationship(rel) {
  const from = entityByName(rel.fromName);
  const to = entityByName(rel.toName);
  if (!from || !to) return;
  const a = anchorPoint(from, to);
  const b = anchorPoint(to, from);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;

  const line = svg("line", {
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    class: [
      "relation-line",
      rel.identifying ? "identifying" : "",
      isSelected("relationship", rel.id) ? "selected" : ""
    ].join(" "),
    "data-id": rel.id
  });
  line.addEventListener("click", (event) => {
    event.stopPropagation();
    selectItem("relationship", rel.id);
  });

  el.canvas.append(line);
  el.canvas.append(text(mx, my - 8, rel.label || "(관계명)", "relation-label", "middle"));
  el.canvas.append(text(a.x + (b.x - a.x) * 0.16, a.y + (b.y - a.y) * 0.16 - 8, rel.fromCard, "card-label", "middle"));
  el.canvas.append(text(b.x + (a.x - b.x) * 0.16, b.y + (a.y - b.y) * 0.16 - 8, rel.toCard, "card-label", "middle"));
}

function drawEntity(ent) {
  const height = HEADER_HEIGHT + Math.max(ent.columns.length, 1) * ROW_HEIGHT + PADDING;
  const clipId = `clip_${ent.id}`;
  const g = svg("g", {
    class: `entity-card ${isSelected("entity", ent.id) ? "selected" : ""}`,
    transform: `translate(${ent.x},${ent.y})`,
    "data-id": ent.id
  });

  const clip = svg("clipPath", { id: clipId });
  clip.append(svg("rect", { x: 8, y: HEADER_HEIGHT, width: CARD_WIDTH - 16, height: Math.max(0, height - HEADER_HEIGHT - 4) }));
  g.append(clip);
  g.append(svg("rect", { class: "outer", width: CARD_WIDTH, height }));
  g.append(svg("rect", { class: "header", width: CARD_WIDTH, height: HEADER_HEIGHT }));
  g.append(text(12, 24, ent.name || "(unnamed)", "entity-title", "start"));
  const dragHandle = svg("rect", { class: "drag-handle", x: CARD_WIDTH - 50, y: 7, width: 42, height: 24, rx: 4 });
  g.append(dragHandle);
  g.append(text(CARD_WIDTH - 29, 23, "MOVE", "drag-handle-text", "middle"));

  ent.columns.forEach((column, index) => {
    const y = HEADER_HEIGHT + 18 + index * ROW_HEIGHT;
    const display = formatColumnForEntity(column);
    const node = text(12, y, display.shortText, column.key ? "key" : "", "start");
    node.setAttribute("clip-path", `url(#${clipId})`);
    if (display.fullText !== display.shortText) node.append(svg("title", {}, display.fullText));
    g.append(node);
  });

  g.addEventListener("click", (event) => {
    event.stopPropagation();
    selectItem("entity", ent.id);
  });

  dragHandle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const point = svgPoint(event);
    selectItem("entity", ent.id);
    pointerDrag = {
      id: ent.id,
      active: false,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startSvgX: point.x,
      startSvgY: point.y,
      originalX: ent.x,
      originalY: ent.y
    };
  });
  el.canvas.append(g);
}

function selectItem(type, id) {
  state.selected = type && id ? { type, id } : null;
  updateSelectionClasses();
  renderEditor();
}

function updateSelectionClasses() {
  el.canvas.querySelectorAll(".entity-card").forEach((node) => {
    node.classList.toggle("selected", isSelected("entity", node.dataset.id));
  });
  el.canvas.querySelectorAll(".relation-line").forEach((node) => {
    node.classList.toggle("selected", isSelected("relationship", node.dataset.id));
  });
}

function renderEditor() {
  el.emptyEditor.classList.toggle("hidden", Boolean(state.selected));
  el.entityEditor.classList.toggle("hidden", state.selected?.type !== "entity");
  el.relationEditor.classList.toggle("hidden", state.selected?.type !== "relationship");
  renderEntityEditor();
  renderRelationshipEditor();
}

function renderEntityEditor() {
  const ent = selectedEntity();
  if (!ent) return;
  el.entityName.value = ent.name;
  el.columnList.innerHTML = "";
  ent.columns.forEach((column) => {
    normalizeColumn(column);
    const row = document.createElement("div");
    row.className = "column-row";
    row.innerHTML = `
      <label>속성명
        <input data-field="name" aria-label="속성명" value="${escapeAttr(column.name)}">
      </label>
      <label>타입
        <input data-field="type" aria-label="타입" value="${escapeAttr(column.type)}">
      </label>
      <label>키
        <select data-field="key" aria-label="키">
          <option value="">일반</option>
          <option value="PK">PK</option>
          <option value="FK">FK</option>
          <option value="PK/FK">PK/FK</option>
        </select>
      </label>
      <label class="nullable-control">
        <input data-field="nullable" type="checkbox">
        NULL 허용
      </label>
      <label class="fk-ref ${isForeignKey(column) ? "" : "hidden"}">참조 엔티티
        <select data-field="refEntity" aria-label="참조 엔티티"></select>
      </label>
      <label class="fk-ref ${isForeignKey(column) ? "" : "hidden"}">참조 컬럼
        <select data-field="refColumn" aria-label="참조 컬럼"></select>
      </label>
      <button type="button" aria-label="속성 삭제">×</button>
    `;
    const nameInput = row.querySelector('[data-field="name"]');
    const typeInput = row.querySelector('[data-field="type"]');
    const keySelect = row.querySelector('[data-field="key"]');
    const nullableInput = row.querySelector('[data-field="nullable"]');
    const refEntitySelect = row.querySelector('[data-field="refEntity"]');
    const refColumnSelect = row.querySelector('[data-field="refColumn"]');
    const deleteButton = row.querySelector("button");
    keySelect.value = column.key;
    nullableInput.checked = column.nullable;
    populateReferenceEntitySelect(refEntitySelect, column.refEntity, ent.id);
    populateReferenceColumnSelect(refColumnSelect, column.refEntity, column.refColumn);
    nameInput.addEventListener("input", () => {
      const previousName = column.name;
      column.name = normalizeName(nameInput.value);
      state.entities.forEach((otherEntity) => {
        otherEntity.columns.forEach((otherColumn) => {
          if (otherColumn.refEntity === ent.name && otherColumn.refColumn === previousName) {
            otherColumn.refColumn = column.name;
          }
        });
      });
      saveAndRefresh();
    });
    typeInput.addEventListener("input", () => {
      column.type = typeInput.value.toUpperCase();
      saveAndRefresh();
    });
    keySelect.addEventListener("input", () => {
      column.key = keySelect.value;
      if (!isForeignKey(column)) {
        column.refEntity = "";
        column.refColumn = "";
      } else if (!column.refEntity) {
        const firstRef = state.entities.find((item) => item.id !== ent.id);
        column.refEntity = firstRef?.name || "";
        column.refColumn = firstPrimaryKeyColumn(firstRef)?.name || "";
      }
      saveAndRender();
    });
    nullableInput.addEventListener("input", () => {
      column.nullable = nullableInput.checked;
      saveAndRefresh();
    });
    refEntitySelect.addEventListener("input", () => {
      column.refEntity = refEntitySelect.value;
      column.refColumn = firstPrimaryKeyColumn(entityByName(column.refEntity))?.name || "";
      saveAndRender();
    });
    refColumnSelect.addEventListener("input", () => {
      column.refColumn = refColumnSelect.value;
      saveAndRefresh();
    });
    deleteButton.addEventListener("click", () => {
      ent.columns = ent.columns.filter((item) => item.id !== column.id);
      saveAndRender();
    });
    el.columnList.append(row);
  });
}

function renderRelationshipEditor() {
  const rel = selectedRelationship();
  if (!rel) return;
  populateEntitySelect(el.relationFrom, rel.fromName);
  populateEntitySelect(el.relationTo, rel.toName);
  el.relationName.value = rel.label;
  el.relationFromCard.value = rel.fromCard;
  el.relationToCard.value = rel.toCard;
  el.relationIdentifying.checked = rel.identifying;
}

function populateEntitySelect(select, value) {
  select.innerHTML = "";
  state.entities.forEach((ent) => {
    const option = document.createElement("option");
    option.value = ent.name;
    option.textContent = ent.name;
    select.append(option);
  });
  select.value = value;
}

function populateReferenceEntitySelect(select, value, currentEntityId) {
  select.innerHTML = '<option value="">참조 없음</option>';
  state.entities
    .filter((ent) => ent.id !== currentEntityId)
    .forEach((ent) => {
      const option = document.createElement("option");
      option.value = ent.name;
      option.textContent = ent.name;
      select.append(option);
    });
  select.value = value || "";
}

function populateReferenceColumnSelect(select, entityName, value) {
  select.innerHTML = '<option value="">컬럼 선택</option>';
  const ent = entityByName(entityName);
  if (!ent) return;
  ent.columns
    .filter((column) => column.key.includes("PK"))
    .forEach((column) => {
      const option = document.createElement("option");
      option.value = column.name;
      option.textContent = `${column.name} (${column.type})`;
      select.append(option);
    });
  select.value = value || "";
}

function renderValidation() {
  const items = validate();
  el.validationList.innerHTML = "";
  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = `validation-item ${item.level}`;
    div.textContent = item.message;
    el.validationList.append(div);
  });
}

function validate() {
  const messages = [];
  state.entities.forEach((ent) => {
    if (!ent.name.trim()) messages.push({ level: "error", message: "이름이 비어 있는 엔티티가 있습니다." });
    if (!ent.columns.some((column) => column.key.includes("PK"))) {
      messages.push({ level: "error", message: `${ent.name}: PK 속성이 필요합니다.` });
    }
    if (ent.columns.length === 0) messages.push({ level: "warn", message: `${ent.name}: 속성이 하나 이상 필요합니다.` });
    ent.columns.forEach((column) => {
      if (!isForeignKey(column)) return;
      if (!column.refEntity || !column.refColumn) {
        messages.push({ level: "warn", message: `${ent.name}.${column.name}: FK 참조 대상 엔티티와 컬럼을 지정하세요.` });
        return;
      }
      const refEnt = entityByName(column.refEntity);
      const refCol = refEnt?.columns.find((item) => item.name === column.refColumn);
      if (!refEnt || !refCol) {
        messages.push({ level: "error", message: `${ent.name}.${column.name}: FK 참조 대상이 현재 ERD에 없습니다.` });
      } else if (!refCol.key.includes("PK")) {
        messages.push({ level: "warn", message: `${ent.name}.${column.name}: FK는 보통 참조 엔티티의 PK를 가리킵니다.` });
      }
    });
  });

  state.relationships.forEach((rel) => {
    if (!rel.label.trim()) messages.push({ level: "warn", message: "관계명이 비어 있습니다. 동사형 이름을 붙이세요." });
    if (!entityByName(rel.fromName) || !entityByName(rel.toName)) {
      messages.push({ level: "error", message: `${rel.label || "관계"}: 연결된 엔티티가 없습니다.` });
    }
    if (isMany(rel.fromCard) && isMany(rel.toCard)) {
      messages.push({ level: "warn", message: `${rel.label}: N:M 직선 하나로 남기지 말고 교차 엔티티로 분해하세요.` });
    }
    if (!rel.fromCard || !rel.toCard) messages.push({ level: "error", message: `${rel.label}: 양 끝 카디널리티가 필요합니다.` });
  });

  if (!messages.length) messages.push({ level: "ok", message: "핵심 점검 통과: PK, 관계명, 카디널리티가 채워져 있습니다." });
  return messages;
}

function addEntity() {
  const count = state.entities.length + 1;
  const ent = entity(`new_entity_${count}`, 120 + count * 28, 120 + count * 18, [
    col("id", "INTEGER", "PK", false),
    col("name", "TEXT", "", false)
  ]);
  state.entities.push(ent);
  state.selected = { type: "entity", id: ent.id };
  saveAndRender();
}

function addRelationship() {
  if (state.entities.length < 2) return;
  const rel = {
    id: uid("rel"),
    fromName: state.entities[0].name,
    toName: state.entities[1].name,
    label: "relates_to",
    fromCard: "1",
    toCard: "N",
    identifying: false
  };
  state.relationships.push(rel);
  state.selected = { type: "relationship", id: rel.id };
  saveAndRender();
}

function addColumn() {
  const ent = selectedEntity();
  if (!ent) return;
  ent.columns.push(col("new_column", "TEXT", "", true));
  saveAndRender();
}

function deleteSelected() {
  if (!state.selected) return;
  if (state.selected.type === "entity") {
    const ent = selectedEntity();
    state.entities = state.entities.filter((item) => item.id !== state.selected.id);
    if (ent) state.relationships = state.relationships.filter((rel) => rel.fromName !== ent.name && rel.toName !== ent.name);
  }
  if (state.selected.type === "relationship") {
    state.relationships = state.relationships.filter((item) => item.id !== state.selected.id);
  }
  state.selected = null;
  saveAndRender();
}

function updateRelationshipFromEditor() {
  const rel = selectedRelationship();
  if (!rel) return;
  rel.label = normalizeName(el.relationName.value);
  rel.fromName = el.relationFrom.value;
  rel.toName = el.relationTo.value;
  rel.fromCard = el.relationFromCard.value;
  rel.toCard = el.relationToCard.value;
  rel.identifying = el.relationIdentifying.checked;
  saveAndRefresh();
}

function exportJson() {
  download("erd-playground.json", "application/json", JSON.stringify(state, null, 2));
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed.entities) || !Array.isArray(parsed.relationships)) throw new Error("invalid");
      normalizeState(parsed);
      state = parsed;
      state.selected = null;
      saveAndRender();
    } catch {
      alert("JSON 형식이 올바르지 않습니다.");
    }
  });
  reader.readAsText(file);
  event.target.value = "";
}

async function exportPng() {
  const clone = el.canvas.cloneNode(true);
  clone.setAttribute("xmlns", SVG_NS);
  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 1000;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "erd.png";
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  };
  image.src = url;
}

async function copySpec() {
  await navigator.clipboard.writeText(el.specOutput.value);
  el.copySpecBtn.textContent = "복사 완료";
  setTimeout(() => {
    el.copySpecBtn.textContent = "정의서 초안 복사";
  }, 1100);
}

function generateSpec() {
  const lines = ["# 테이블 정의서 초안", ""];
  state.entities.forEach((ent) => {
    lines.push(`## ${ent.name}`, "");
    lines.push("| 컬럼 | 타입 | 키 | NULL 허용 | FK 참조 | 설명 |");
    lines.push("|---|---|---|---|---|---|");
    ent.columns.forEach((column) => {
      const ref = isForeignKey(column) && column.refEntity ? `${column.refEntity}.${column.refColumn || "?"}` : "-";
      lines.push(`| ${column.name} | ${column.type} | ${column.key || "-"} | ${column.nullable ? "YES" : "NO"} | ${ref} |  |`);
    });
    lines.push("");
  });
  lines.push("## 관계", "");
  lines.push("| 관계명 | 시작 | 끝 | 카디널리티 | 식별 관계 |");
  lines.push("|---|---|---|---|---|");
  state.relationships.forEach((rel) => {
    lines.push(`| ${rel.label} | ${rel.fromName} | ${rel.toName} | ${rel.fromCard}:${rel.toCard} | ${rel.identifying ? "YES" : "NO"} |`);
  });
  return lines.join("\n");
}

function selectedEntity() {
  if (state.selected?.type !== "entity") return null;
  return state.entities.find((ent) => ent.id === state.selected.id) || null;
}

function selectedRelationship() {
  if (state.selected?.type !== "relationship") return null;
  return state.relationships.find((rel) => rel.id === state.selected.id) || null;
}

function entityByName(name) {
  return state.entities.find((ent) => ent.name === name);
}

function anchorPoint(from, to) {
  const fromHeight = HEADER_HEIGHT + Math.max(from.columns.length, 1) * ROW_HEIGHT + PADDING;
  const toHeight = HEADER_HEIGHT + Math.max(to.columns.length, 1) * ROW_HEIGHT + PADDING;
  const cx = from.x + CARD_WIDTH / 2;
  const cy = from.y + fromHeight / 2;
  const tx = to.x + CARD_WIDTH / 2;
  const ty = to.y + toHeight / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return { x: cx + Math.sign(dx) * CARD_WIDTH / 2, y: cy };
  }
  return { x: cx, y: cy + Math.sign(dy) * fromHeight / 2 };
}

function isSelected(type, id) {
  return state.selected?.type === type && state.selected?.id === id;
}

function isMany(cardinality) {
  return cardinality.includes("N");
}

function formatColumnForEntity(column) {
  const keyText = column.key ? `[${column.key}] ` : "";
  const typeText = column.type ? `: ${column.type}` : "";
  const fkText = isForeignKey(column) ? " -> FK" : "";
  const nullableText = column.nullable ? "" : " NOT NULL";
  const shortBase = `${keyText}${column.name}${typeText}${fkText}${nullableText}`;
  const fullRef = isForeignKey(column) && column.refEntity ? ` -> ${column.refEntity}.${column.refColumn || "?"}` : "";
  const fullText = `${keyText}${column.name}${typeText}${fullRef}${nullableText}`;
  return {
    shortText: truncateText(shortBase, ENTITY_TEXT_LIMIT),
    fullText
  };
}

function truncateText(value, limit) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function isForeignKey(column) {
  return column.key.includes("FK");
}

function firstPrimaryKeyColumn(ent) {
  return ent?.columns.find((column) => column.key.includes("PK")) || null;
}

function normalizeState(nextState) {
  nextState.entities?.forEach((ent) => {
    ent.columns = Array.isArray(ent.columns) ? ent.columns : [];
    ent.columns.forEach(normalizeColumn);
  });
  inferMissingForeignKeys(nextState);
}

function normalizeColumn(column) {
  column.id ||= uid("col");
  column.name ||= "";
  column.type ||= "TEXT";
  column.key ||= "";
  column.nullable = column.nullable !== false;
  column.refEntity ||= "";
  column.refColumn ||= "";
}

function inferMissingForeignKeys(nextState) {
  nextState.entities?.forEach((ent) => {
    ent.columns.forEach((column) => {
      if (!isForeignKey(column) || (column.refEntity && column.refColumn)) return;
      const inferred = inferReferenceForColumn(nextState, ent, column);
      if (inferred) {
        column.refEntity = inferred.entity.name;
        column.refColumn = inferred.column.name;
      } else if (ent.name === "clubs" && column.name === "teacher_id") {
        column.key = "";
        column.name = "teacher_name";
        column.type = "TEXT";
        column.refEntity = "";
        column.refColumn = "";
      }
    });
  });
}

function inferReferenceForColumn(nextState, ownerEntity, column) {
  const base = column.name.replace(/_id$/, "");
  const candidates = new Set([base, `${base}s`, `${base}es`]);
  for (const ent of nextState.entities || []) {
    if (ent.id === ownerEntity.id) continue;
    if (!candidates.has(ent.name)) continue;
    const pk = ent.columns.find((item) => item.key.includes("PK") && (item.name === column.name || item.name.endsWith("_id")));
    if (pk) return { entity: ent, column: pk };
  }
  for (const ent of nextState.entities || []) {
    if (ent.id === ownerEntity.id) continue;
    const pk = ent.columns.find((item) => item.key.includes("PK") && item.name === column.name);
    if (pk) return { entity: ent, column: pk };
  }
  return null;
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, "_");
}

function svg(tag, attrs = {}, content = "") {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (content) node.textContent = content;
  return node;
}

function text(x, y, content, className, anchor) {
  const node = svg("text", { x, y, class: className, "text-anchor": anchor });
  node.textContent = content;
  return node;
}

function download(filename, type, content) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeAttr(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function svgPoint(event) {
  const point = el.canvas.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(el.canvas.getScreenCTM().inverse());
}
