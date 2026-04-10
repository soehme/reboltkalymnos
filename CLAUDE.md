# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A vanilla JS Progressive Web App (PWA) for browsing the Rebolt Kalymnos climbing route maintenance log. No build system, no npm, no framework — plain HTML/CSS/JS served as static files via GitHub Pages.

## Development

```bash
python3 scripts/scrape.py        # fetch latest data → data/routes.json
python3 -m http.server 8788      # serve at http://localhost:8788
```

The scraper has no external Python dependencies. The GitHub Action runs it daily at 06:00 UTC and auto-commits `data/routes.json`.

## Architecture

All app logic lives in three files:

- **`index.html`** — complete HTML structure (no templating). Two panels inside `#app`: the main list panel and `.detail-panel`. The wrench menu `#menu-nav` sits outside `#app`.
- **`app.js`** — all JavaScript. State: `allRoutes[]`, `activeTerms[]` (the active search filters). Key flows:
  - Search input → `showAutocomplete()` → user picks → `addTerm()` → `render()`
  - Card click → `openDetail()` → adds `.detail-open` to `#app` (CSS slide-in)
  - Burger click → `openMenu()` / `closeMenu()` → toggles `.open` on `#menu-nav`
- **`style.css`** — all styles. Detail panel slide-in and wrench menu open/close are CSS-driven via class toggles.

### Data shape (`data/routes.json`)

```json
{
  "updated": "2025-04-11T06:00:00Z",
  "count": 1234,
  "routes": [
    { "crag": "...", "route": "...", "job": "...", "hardware": "...", "date": "...", "dateSort": "YYYY-MM" }
  ]
}
```

`dateSort` is a `YYYY-MM` string used for the year filter (`>= year` comparison). Dates that couldn't be parsed become `"0000-00"`.

### Service worker (`sw.js`)

Cache name is `rebolt-v4` — **bump this version** whenever cached assets change. Strategy: network-first for `data/routes.json`, cache-first for all other assets.

### Search / filter

`activeTerms` is an array of `{ label, type }` where `type` is `"crag"`, `"route"`, `"year"`, or `"text"`. All terms must match (AND logic). Year filter (`type === "year"`) is "since year X" — only one year term is allowed at a time (adding a new one replaces the old).

### Analytics

PostHog is included inline in `index.html` for usage analytics. The project key is `phc_yn9Xf72sa5M5ZUjkK8VZQFdZNo7SbXnTnMDMdDT2nqtA` (EU endpoint).
