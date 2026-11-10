// Google Sheet that holds the classroom list. Share it as "Anyone with the link can view",
// then paste its ID (the part of the sheet URL between /d/ and /edit) below.
// Expected columns (header row, any order): Grade, Section (optional), URL.
const SHEET_ID = "1nibptp5XSD9QuYtI5UCYXrvF_i3PluB1WJLv6xQZzgI";
// The tab's gid, from the "#gid=" part of the sheet URL.
const SHEET_GID = "0";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

const toClassroom = (grade, section, url) => ({
  grade,
  section,
  code: url.replace(/\/+$/, "").split("/").pop().split("?")[0],
  url,
});

// Used when the sheet cannot be loaded.
const fallbackClassrooms = [
  ["KG3", "A", "yeo-jmpj-amm"],
  ["KG3", "B", "kww-fzyk-qun"],
  ["KG3", "C", "exe-mefr-qdq"],
  ["KG3", "D", "kem-bahk-kxn"],
  ["Grade 1", "A", "uqk-tojm-tkf"],
  ["Grade 1", "B", "wrq-ziwf-gxb"],
  ["Grade 1", "C", "axp-wzwi-upv"],
  ["Grade 1", "D", "bkg-jzke-owy"],
  ["Grade 1", "E", "wsz-jtud-jvo"],
  ["Grade 2", "A", "cse-pwte-dee"],
  ["Grade 2", "B", "wgb-wmqc-bai"],
  ["Grade 2", "C", "vue-pwip-ijh"],
  ["Grade 2", "D", "wug-qnif-ege"],
  ["Grade 2", "E", "dgc-anfb-rum"],
  ["Grade 3", "A", "vwz-tfbn-qgf"],
  ["Grade 3", "B", "kqs-phvd-itq"],
  ["Grade 3", "C", "cck-vepo-fka"],
  ["Grade 3", "D", "rvj-ystn-scb"],
  ["Grade 3", "E", "bqi-uxtj-nwz"],
  ["Grade 3", "G", "hfu-xvtj-fyy"],
  ["Grade 4", "A", "jdx-vovw-tjt"],
  ["Grade 4", "B", "oxo-mnew-ffc"],
  ["Grade 4", "C", "azj-ocdv-rpy"],
  ["Grade 4", "D", "bci-zgdg-jpy"],
  ["Grade 4", "E", "gtg-wwvm-xmg"],
  ["Grade 4", "G", "xdg-rewq-tuk"],
  ["Grade 5", "A", "mss-hmkw-wwu"],
  ["Grade 5", "B", "bvr-giip-iwo"],
  ["Grade 5", "C", "icy-xqoz-wic"],
  ["Grade 5", "D", "oga-nayq-fga"],
  ["Grade 5", "E", "krc-uepy-wdu"],
  ["Grade 6", "A", "wmd-eava-nfh"],
  ["Grade 6", "B", "yuf-mxpk-yku"],
  ["Grade 6", "C", "foj-ocxv-ahf"],
  ["Grade 6", "D", "tdp-eksg-joa"],
  ["Grade 7", "A", "upq-uyci-fkh"],
  ["Grade 7", "B", "njz-hsjr-jjs"],
  ["Grade 7", "C", "eza-hdwn-qtb"],
  ["Grade 7", "D", "zwr-pads-mrg"],
  ["Grade 8", "A", "mzg-tcbx-mjs"],
  ["Grade 8", "B", "kiq-shdg-krs"],
  ["Grade 8", "C", "fij-yagp-gfm"],
  ["Grade 8", "D", "drm-cter-yvi"],
  ["Grade 9", "A", "omn-xqaa-dru"],
  ["Grade 9", "B", "tce-vpbi-zok"],
  ["Grade 10", "A", "xrh-vxyy-kgf"],
  ["Grade 10", "B", "umt-jjep-rex"],
  ["Grade 10", "C", "bhp-jkrv-xxz"],
  ["Grade 11", "A", "sgq-abpb-gdr"],
  ["Grade 11", "B", "kpp-fsnh-jcx"],
  ["Grade 11", "C", "dyy-mmtg-uwi"],
  ["Grade 12", "A", "wyh-nodg-iih"],
  ["Grade 12", "B", "ozk-uags-njp"],
].map(([grade, section, code]) => toClassroom(grade, section, `https://meet.google.com/${code}`));

let classrooms = [];

const gradeGroups = document.querySelector("#grade-groups");
const totalCount = document.querySelector("#total-count");
const searchInput = document.querySelector("#classroom-search");
const status = document.querySelector("#results-status");
const emptyState = document.querySelector("#empty-state");
const filterButtons = [...document.querySelectorAll(".filter-button")];
const toast = document.querySelector("#toast");
let activeFilter = "all";
let toastTimer;

const isKg = (grade) => /^kg/i.test(grade);
const gradeNumber = (grade) => Number(grade.match(/\d+/)?.[0] ?? 0);

const stageFor = (grade) => {
  if (isKg(grade)) return "kg";
  const number = gradeNumber(grade);
  if (number <= 5) return "elementary";
  if (number <= 8) return "middle";
  return "high";
};

const orderGrade = (grade) => (isKg(grade) ? gradeNumber(grade) - 100 : gradeNumber(grade));

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') inQuotes = false;
      else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function rowsToClassrooms([header = [], ...body]) {
  const columnFor = (...names) =>
    header.findIndex((title) => names.some((name) => title.trim().toLowerCase().includes(name)));
  const gradeCol = columnFor("grade", "level");
  const sectionCol = columnFor("section");
  const urlCol = columnFor("url", "link", "meet");
  if (gradeCol < 0 || urlCol < 0) throw new Error("Sheet needs a Grade column and a URL column");

  return body
    .map((cells) => {
      let grade = (cells[gradeCol] ?? "").trim();
      let section = sectionCol >= 0 ? (cells[sectionCol] ?? "").trim() : "";
      // "Grade 1A" or "Grade 1 - A" in a single column.
      const combined = !section && grade.match(/^(.*\d)\s*[-–]?\s*([A-Z])$/i);
      if (combined) [, grade, section] = combined;
      if (/^\d+$/.test(grade)) grade = `Grade ${grade}`;
      // Cells may hold extra text around the link, e.g. "A: https://meet.google.com/…".
      const url = (cells[urlCol] ?? "").match(/https:\/\/\S+/i)?.[0] ?? "";
      return toClassroom(grade, section.toUpperCase(), url);
    })
    .filter((classroom) => classroom.grade && classroom.url);
}

async function loadClassrooms() {
  status.textContent = "Loading classrooms…";
  try {
    if (SHEET_ID === "PASTE_YOUR_SHEET_ID_HERE") throw new Error("SHEET_ID is not set");
    const response = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const loaded = rowsToClassrooms(parseCsv(await response.text()));
    if (!loaded.length) throw new Error("No classrooms found in the sheet");
    classrooms = loaded;
  } catch (error) {
    console.error("Could not load classrooms from Google Sheet:", error);
    classrooms = fallbackClassrooms;
    if (SHEET_ID !== "PASTE_YOUR_SHEET_ID_HERE") {
      showToast("Could not load the latest classroom list. Showing saved links.");
    }
  }
  totalCount.textContent = classrooms.length;
  renderClassrooms();
}

function cardMarkup(classroom) {
  const grade = escapeHtml(classroom.grade);
  const section = escapeHtml(classroom.section);
  const url = escapeHtml(classroom.url);
  const title = `${grade} ${section}`.trim();
  const sectionWord = isKg(classroom.grade) ? "Kindergarten" : "Section";
  return `
    <article class="classroom-card">
      <span class="room-avatar" aria-hidden="true">${section || gradeNumber(classroom.grade) || "•"}</span>
      <div class="room-info">
        <strong>${title}</strong>
        <span>${section ? `${sectionWord} ${section}` : sectionWord === "Section" ? "Classroom" : sectionWord}</span>
      </div>
      <div class="card-actions">
        <button class="copy-button" type="button" data-copy="${url}" aria-label="Copy ${title} Meet link" title="Copy Meet link">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="7" y="7" width="10" height="11" rx="1.8" stroke="currentColor" stroke-width="1.5" />
            <path d="M13 7V4.8A1.8 1.8 0 0 0 11.2 3H4.8A1.8 1.8 0 0 0 3 4.8v7.4A1.8 1.8 0 0 0 4.8 14H7" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>
        <a class="meet-link" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="Join ${title} Google Meet" title="Join Google Meet">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 6.8A1.8 1.8 0 0 1 4.8 5h6.4A1.8 1.8 0 0 1 13 6.8v6.4a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 13.2V6.8Z" stroke="currentColor" stroke-width="1.5" />
            <path d="m13 8 4-2v8l-4-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
      </div>
    </article>`;
}

function renderClassrooms() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visible = classrooms.filter((classroom) => {
    const matchesStage = activeFilter === "all" || stageFor(classroom.grade) === activeFilter;
    const matchesQuery = `${classroom.grade} ${classroom.section} ${classroom.code}`
      .toLocaleLowerCase()
      .includes(query);
    return matchesStage && matchesQuery;
  });
  const groups = visible.reduce((byGrade, classroom) => {
    const rooms = byGrade.get(classroom.grade) ?? [];
    rooms.push(classroom);
    byGrade.set(classroom.grade, rooms);
    return byGrade;
  }, new Map());

  gradeGroups.innerHTML = [...groups.entries()]
    .sort(([first], [second]) => orderGrade(first) - orderGrade(second))
    .map(
      ([grade, rooms]) => `
        <section class="grade-group" aria-label="${escapeHtml(grade)} classrooms">
          <h3 class="grade-heading">${escapeHtml(grade)}<span class="grade-subtitle">${rooms.length} ${rooms.length === 1 ? "classroom" : "classrooms"}</span></h3>
          <div class="classroom-grid">${rooms.map(cardMarkup).join("")}</div>
        </section>`,
    )
    .join("");

  emptyState.hidden = visible.length > 0;
  status.textContent = `Showing ${visible.length} of ${classrooms.length} classrooms`;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

searchInput.addEventListener("input", renderClassrooms);

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((filter) => {
      const isActive = filter === button;
      filter.classList.toggle("is-active", isActive);
      filter.setAttribute("aria-pressed", String(isActive));
    });
    renderClassrooms();
  });
});

gradeGroups.addEventListener("click", async (event) => {
  const button = event.target.closest(".copy-button");
  if (!button) return;

  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    showToast("Meet link copied to clipboard.");
  } catch {
    showToast("Could not copy the link. Open the room and copy its address.");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});

loadClassrooms();
