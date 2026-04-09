# Rebolt Kalymnos PWA

Mobile-friendly Progressive Web App for the [Rebolt Kalymnos](https://reboltkalymnos.org/rebolt-log/) climbing route maintenance log. Works offline.

## Features

- Search by crag or route name
- Filter by crag (chip buttons)
- Sorted newest first
- Offline support via Service Worker
- Installable as a home screen app (iOS/Android)

## Setup (GitHub Pages)

1. Fork / push this repo to GitHub
2. Go to **Settings → Pages** → Source: `main` branch, root `/`
3. The GitHub Action runs daily at 06:00 UTC and commits fresh data

## Local development

```bash
python3 scripts/scrape.py        # fetch latest data
python3 -m http.server 8788       # open http://localhost:8788
```

## Data source

Scraped from [reboltkalymnos.org/rebolt-log/](https://reboltkalymnos.org/rebolt-log/) — no affiliation.
