/* Rebolt Kalymnos PWA */

const DATA_URL = "data/routes.json";

let allRoutes = [];
let allCrags = new Set();
let allRouteNames = new Set();
let activeTerms = []; // array of { label, type: 'crag'|'route'|'text' }

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $search     = document.getElementById("search");
const $autocomplete = document.getElementById("autocomplete");
const $chips      = document.getElementById("chips");
const $list       = document.getElementById("list");
const $status     = document.getElementById("status");
const $count      = document.getElementById("count");
const $empty      = document.getElementById("empty");
const $badge      = document.getElementById("updated-badge");

let acIndex = -1; // keyboard-selected autocomplete item

// ── Init ──────────────────────────────────────────────────────────────────────
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
loadData();

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    allRoutes = json.routes.sort((a, b) =>
      a.crag.localeCompare(b.crag) || a.route.localeCompare(b.route)
    );

    allRoutes.forEach((r) => {
      allCrags.add(r.crag);
      allRouteNames.add(r.route);
    });

    if (json.updated) {
      const d = new Date(json.updated);
      $badge.textContent = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      $badge.hidden = false;
    }

    $status.hidden = true;
    render();
  } catch (err) {
    $status.textContent = "Failed to load data. Check your connection.";
    console.error(err);
  }
}

// ── Search input ──────────────────────────────────────────────────────────────
$search.addEventListener("input", () => {
  acIndex = -1;
  const q = $search.value.trim();
  if (q.length < 2) { closeAutocomplete(); return; }
  showAutocomplete(q);
});

$search.addEventListener("keydown", (e) => {
  const items = $autocomplete.querySelectorAll("[role=option]");
  if (e.key === "ArrowDown") {
    e.preventDefault();
    acIndex = Math.min(acIndex + 1, items.length - 1);
    highlightAc(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    acIndex = Math.max(acIndex - 1, -1);
    highlightAc(items);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (acIndex >= 0 && items[acIndex]) {
      items[acIndex].click();
    } else if ($search.value.trim()) {
      addTerm($search.value.trim(), "text");
      $search.value = "";
      closeAutocomplete();
    }
  } else if (e.key === "Escape") {
    closeAutocomplete();
  } else if (e.key === "Backspace" && $search.value === "" && activeTerms.length) {
    removeTerm(activeTerms.length - 1);
  }
});

$search.addEventListener("blur", () => setTimeout(closeAutocomplete, 150));

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrapper")) closeAutocomplete();
});

// ── Autocomplete ──────────────────────────────────────────────────────────────
function showAutocomplete(q) {
  const ql = q.toLowerCase();
  const suggestions = [];

  // Crags first
  for (const crag of allCrags) {
    if (crag.toLowerCase().includes(ql)) suggestions.push({ label: crag, type: "crag" });
    if (suggestions.length >= 4) break;
  }

  // Then routes (up to total of 8)
  for (const route of allRouteNames) {
    if (suggestions.length >= 8) break;
    if (route.toLowerCase().includes(ql)) suggestions.push({ label: route, type: "route" });
  }

  if (!suggestions.length) { closeAutocomplete(); return; }

  $autocomplete.innerHTML = "";
  suggestions.forEach((s, i) => {
    const li = document.createElement("li");
    li.role = "option";
    li.className = "ac-item";
    li.innerHTML = `<span class="ac-label">${esc(s.label)}</span><span class="ac-type ac-type--${s.type}">${s.type}</span>`;
    li.addEventListener("mousedown", (e) => e.preventDefault());
    li.addEventListener("click", () => {
      addTerm(s.label, s.type);
      $search.value = "";
      closeAutocomplete();
      $search.focus();
    });
    $autocomplete.appendChild(li);
  });

  $autocomplete.hidden = false;
  $search.setAttribute("aria-expanded", "true");
}

function closeAutocomplete() {
  $autocomplete.hidden = true;
  $search.setAttribute("aria-expanded", "false");
  acIndex = -1;
}

function highlightAc(items) {
  items.forEach((el, i) => el.classList.toggle("ac-active", i === acIndex));
}

// ── Term chips ────────────────────────────────────────────────────────────────
function addTerm(label, type) {
  // Avoid duplicates
  if (activeTerms.some((t) => t.label.toLowerCase() === label.toLowerCase())) return;
  activeTerms.push({ label, type: type || "text" });
  renderChips();
  render();
}

function removeTerm(idx) {
  activeTerms.splice(idx, 1);
  renderChips();
  render();
}

function renderChips() {
  $chips.innerHTML = "";
  activeTerms.forEach((t, i) => {
    const chip = document.createElement("span");
    chip.className = `chip chip--${t.type}`;
    chip.innerHTML = `<span class="chip-label">${esc(t.label)}</span><span class="chip-type">${t.type === "text" ? "" : t.type}</span><button class="chip-remove" aria-label="Remove ${esc(t.label)}">×</button>`;
    chip.querySelector(".chip-remove").addEventListener("click", () => removeTerm(i));
    $chips.appendChild(chip);
  });
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const filtered = activeTerms.length === 0
    ? allRoutes
    : allRoutes.filter((r) => activeTerms.every((t) => matchesTerm(r, t)));

  $list.innerHTML = "";
  $empty.hidden = filtered.length > 0;

  $count.textContent = filtered.length === allRoutes.length
    ? `${filtered.length} routes`
    : `${filtered.length} of ${allRoutes.length} routes`;
  $count.hidden = false;

  filtered.forEach((r) => $list.appendChild(card(r)));
}

function matchesTerm(route, term) {
  const q = term.label.toLowerCase();
  if (term.type === "crag")  return route.crag.toLowerCase() === q;
  if (term.type === "route") return route.route.toLowerCase() === q;
  // free text: match anywhere
  return (
    route.crag.toLowerCase().includes(q) ||
    route.route.toLowerCase().includes(q) ||
    route.job.toLowerCase().includes(q) ||
    route.hardware.toLowerCase().includes(q)
  );
}

function card(r) {
  const li = document.createElement("li");
  li.className = "card";
  li.innerHTML = `
    <div class="card-meta">
      <span class="crag">${esc(r.crag)}</span>
      <span class="date">${esc(r.date)}</span>
    </div>
    <div class="route-name">${esc(r.route)}</div>
    <div class="job">${esc(r.job)}</div>
    ${r.hardware ? `<div class="hardware">${esc(r.hardware)}</div>` : ""}
  `;
  return li;
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
