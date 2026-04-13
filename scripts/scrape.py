#!/usr/bin/env python3
"""
Scrapes the Rebolt Kalymnos maintenance log and saves it as routes.json.
"""

import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PAGE_URL = "https://reboltkalymnos.org/rebolt-log/"
CSV_URL = "https://reboltkalymnos.org/CSV.csv"
OUTPUT = Path(__file__).parent.parent / "data" / "routes.json"

MONTH_MAP = {
    "january": "01", "february": "02", "march": "03", "april": "04",
    "may": "05", "june": "06", "july": "07", "august": "08",
    "september": "09", "october": "10", "november": "11", "december": "12",
}


def parse_date_sort(text):
    """Convert display date to sortable YYYY-MM string."""
    text = text.strip()
    # Already in YYYY-MM format
    if re.match(r"^\d{4}-\d{2}$", text):
        return text
    # "Month YYYY"
    m = re.match(r"^(\w+)\s+(\d{4})$", text, re.IGNORECASE)
    if m:
        month = MONTH_MAP.get(m.group(1).lower())
        if month:
            return f"{m.group(2)}-{month}"
    # "YYYY/YY" or "YYYY/YYYY"
    m = re.match(r"^(\d{4})", text)
    if m:
        return f"{m.group(1)}-00"
    return "0000-00"


def fetch_text(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def parse_site_updated(html):
    """Extract the 'Last updated: DD Month YYYY' date from the page."""
    m = re.search(r"Last updated[:\s]+(\d{1,2}\s+\w+\s+\d{4})", html, re.IGNORECASE)
    if not m:
        return None
    text = m.group(1).strip()
    # Parse "09 April 2026" → "2026-04-09"
    try:
        dt = datetime.strptime(text, "%d %B %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_csv(text):
    """Parse the CSV data into route dicts."""
    import csv
    import io
    reader = csv.DictReader(io.StringIO(text))
    routes = []
    for row in reader:
        crag = row.get("CRAG", "").strip()
        route = row.get("ROUTE", "").strip()
        if not crag and not route:
            continue
        date = row.get("DATE", "").strip()
        routes.append({
            "crag": crag,
            "route": route,
            "job": row.get("JOB", "").strip(),
            "hardware": row.get("HARDWARE", "").strip(),
            "date": date,
            "dateSort": parse_date_sort(date),
        })
    return routes


def main():
    print(f"Fetching {PAGE_URL} ...")
    html = fetch_text(PAGE_URL)

    print(f"Fetching {CSV_URL} ...")
    csv_text = fetch_text(CSV_URL)

    print("Parsing CSV ...")
    routes = parse_csv(csv_text)
    print(f"Found {len(routes)} routes")

    if len(routes) < 500:
        raise ValueError(f"Only {len(routes)} routes found – scraping may have failed (expected ≥500)")

    site_updated = parse_site_updated(html)
    print(f"Site updated: {site_updated or '(not found)'}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "siteUpdated": site_updated,
        "count": len(routes),
        "routes": routes,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"Saved to {OUTPUT}")


if __name__ == "__main__":
    main()
