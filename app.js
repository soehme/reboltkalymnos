/* Rebolt Kalymnos PWA */

const DATA_URL = "data/routes.json";

let allRoutes = [];
let allCrags = new Set();
let allRouteNames = new Set();
let activeTerms = []; // array of { label, type: 'crag'|'route'|'text' }

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $search       = document.getElementById("search");
const $autocomplete = document.getElementById("autocomplete");
const $chips        = document.getElementById("chips");
const $list         = document.getElementById("list");
const $status       = document.getElementById("status");
const $count        = document.getElementById("count");
const $empty        = document.getElementById("empty");
const $burger       = document.getElementById("burger");
const $menuNav      = document.getElementById("menu-nav");
const $menuClose    = document.getElementById("menu-close");
const $menuUpdated  = document.getElementById("menu-updated");
const $app          = document.getElementById("app");
const $btnBack      = document.getElementById("btn-back");
const $btnCrag      = document.getElementById("btn-crag-filter");

let activeRoute = null;

let acIndex = -1;

// ── Detail panel ─────────────────────────────────────────────────────────────
function openDetail(r) {
  activeRoute = r;
  document.getElementById("detail-name").textContent     = r.route;
  document.getElementById("detail-job").textContent      = r.job;
  document.getElementById("detail-date").textContent     = r.date;
  document.getElementById("detail-hardware").textContent = r.hardware;
  document.getElementById("detail-hardware-field").hidden = !r.hardware;
  document.getElementById("detail-crag").textContent     = r.crag;
  $app.classList.add("detail-open");
}
function closeDetail() {
  $app.classList.remove("detail-open");
}
$btnBack.addEventListener("click", closeDetail);
$btnCrag.addEventListener("click", () => {
  closeDetail();
  addTerm(activeRoute.crag, "crag");
});

// ── Wrench menu ──────────────────────────────────────────────────────────────
function openMenu() {
  $menuNav.classList.add("open");
  $burger.classList.add("menu-open");
  $burger.setAttribute("aria-expanded", "true");
  $menuNav.setAttribute("aria-hidden", "false");
}
function closeMenu() {
  $menuNav.classList.remove("open");
  $burger.classList.remove("menu-open");
  $burger.setAttribute("aria-expanded", "false");
  $menuNav.setAttribute("aria-hidden", "true");
}
function toggleMenu() {
  $menuNav.classList.contains("open") ? closeMenu() : openMenu();
}
// ── Android install prompt ────────────────────────────────────────────────────
let deferredPrompt = null;
const $btnInstall = document.getElementById("btn-install");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $btnInstall.hidden = false;
});
$btnInstall.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $btnInstall.hidden = true;
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  $btnInstall.hidden = true;
});

// ── iOS install banner ────────────────────────────────────────────────────────
const $iosBanner = document.getElementById("ios-banner");
const $iosBannerClose = document.getElementById("ios-banner-close");
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = navigator.standalone === true;

if (isIOS && !isStandalone && !localStorage.getItem("rk-install-dismissed")) {
  setTimeout(() => { $iosBanner.hidden = false; }, 10000);
}
$iosBannerClose.addEventListener("click", () => {
  $iosBanner.hidden = true;
  localStorage.setItem("rk-install-dismissed", "1");
});

$burger.addEventListener("click", toggleMenu);
$menuClose.addEventListener("click", closeMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $menuNav.classList.contains("open")) closeMenu();
});

// Reload button
document.getElementById("btn-reload").addEventListener("click", () => location.reload());

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

    if (json.siteUpdated) {
      // siteUpdated is "YYYY-MM-DD" — parse as local date to avoid UTC offset shifting the day
      const [y, mo, day] = json.siteUpdated.split("-").map(Number);
      const d = new Date(y, mo - 1, day);
      $menuUpdated.textContent = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } else if (json.updated) {
      const d = new Date(json.updated);
      $menuUpdated.textContent = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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

  // Year filter: "26"/"24" → 20XX suffix; "20"/"202" → prefix list; "2024" → exact
  const currentYear = new Date().getFullYear();
  if (/^(2\d{1,3}|\d{2})$/.test(q)) {
    if (q.length === 4) {
      const y = parseInt(q, 10);
      if (y >= 2000 && y <= currentYear) suggestions.push({ label: q, type: "year" });
    } else if (q.length === 2 && !q.startsWith("20")) {
      const y = 2000 + parseInt(q, 10);
      if (y <= currentYear) suggestions.push({ label: String(y), type: "year" });
    } else {
      const candidates = [];
      for (let y = currentYear; y >= 2000; y--) {
        if (String(y).startsWith(q)) candidates.push(y);
        if (candidates.length >= 5) break;
      }
      candidates.forEach((y) => suggestions.push({ label: String(y), type: "year" }));
    }
  }

  // Crags first
  for (const crag of allCrags) {
    if (suggestions.length >= 4) break;
    if (crag.toLowerCase().includes(ql)) suggestions.push({ label: crag, type: "crag" });
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
  // Year: replace existing year filter
  if (type === "year") {
    const idx = activeTerms.findIndex((t) => t.type === "year");
    if (idx !== -1) activeTerms.splice(idx, 1);
  }
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
    const chipDisplay = t.type === "year" ? `since ${esc(t.label)}` : esc(t.label);
    const chipTypeLabel = t.type === "text" || t.type === "year" ? "" : t.type;
    chip.innerHTML = `<span class="chip-label">${chipDisplay}</span><span class="chip-type">${chipTypeLabel}</span><button class="chip-remove" aria-label="Remove ${esc(t.label)}">×</button>`;
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
  if (term.type === "year") {
    const ds = route.dateSort || "";
    if (!ds || ds.startsWith("0000")) return false;
    return ds.slice(0, 4) >= term.label;
  }
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
    <span class="crag">${esc(r.crag)}</span>
    <div class="route-name">${esc(r.route)}</div>
    <div class="job">${esc(r.job)}<span class="date"> · ${esc(r.date)}</span></div>
    ${r.hardware ? `<div class="hardware">${esc(r.hardware)}</div>` : ""}
  `;
  li.addEventListener("click", () => openDetail(r));
  return li;
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
