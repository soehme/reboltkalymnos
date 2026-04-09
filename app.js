/* Rebolt Kalymnos PWA */

const DATA_URL = "data/routes.json";

let allRoutes = [];
let activeCrag = null;
let searchQuery = "";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $search = document.getElementById("search");
const $cragFilters = document.getElementById("crag-filters");
const $list = document.getElementById("list");
const $status = document.getElementById("status");
const $count = document.getElementById("count");
const $empty = document.getElementById("empty");
const $badge = document.getElementById("updated-badge");

// ── Init ──────────────────────────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

loadData();

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // Sort newest first (empty dateSort goes to bottom)
    allRoutes = json.routes.sort((a, b) => b.dateSort.localeCompare(a.dateSort));

    if (json.updated) {
      const d = new Date(json.updated);
      $badge.textContent = `Updated ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
      $badge.hidden = false;
    }

    $status.hidden = true;
    buildCragFilters();
    render();
  } catch (err) {
    $status.textContent = "Failed to load data. Check your connection.";
    console.error(err);
  }
}

// ── Filters ───────────────────────────────────────────────────────────────────
function buildCragFilters() {
  const crags = [...new Set(allRoutes.map((r) => r.crag))].sort();

  const allChip = chip("All", null);
  allChip.classList.add("active");
  $cragFilters.appendChild(allChip);

  crags.forEach((crag) => $cragFilters.appendChild(chip(crag, crag)));
}

function chip(label, value) {
  const btn = document.createElement("button");
  btn.className = "chip";
  btn.textContent = label;
  btn.addEventListener("click", () => {
    activeCrag = value;
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    render();
  });
  return btn;
}

// ── Search ────────────────────────────────────────────────────────────────────
$search.addEventListener("input", () => {
  searchQuery = $search.value.trim().toLowerCase();
  render();
});

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const q = searchQuery;
  const filtered = allRoutes.filter((r) => {
    if (activeCrag && r.crag !== activeCrag) return false;
    if (!q) return true;
    return (
      r.crag.toLowerCase().includes(q) ||
      r.route.toLowerCase().includes(q) ||
      r.job.toLowerCase().includes(q)
    );
  });

  $list.innerHTML = "";
  $empty.hidden = filtered.length > 0;

  $count.textContent = `${filtered.length} route${filtered.length !== 1 ? "s" : ""}`;
  $count.hidden = false;

  filtered.forEach((r) => $list.appendChild(card(r)));
}

function card(r) {
  const li = document.createElement("li");
  li.className = "card";
  li.innerHTML = `
    <div class="card-header">
      <span class="crag">${esc(r.crag)}</span>
      <span class="date">${esc(r.date)}</span>
    </div>
    <div class="route">${esc(r.route)}</div>
    <div class="job">${esc(r.job)}</div>
    <div class="hardware">${esc(r.hardware)}</div>
  `;
  return li;
}

function esc(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
