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

URL = "https://reboltkalymnos.org/rebolt-log/"
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


def fetch_html(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def parse_table(html):
    """Extract table rows without external dependencies."""
    # Find tbody content
    tbody_match = re.search(r"<tbody[^>]*>(.*?)</tbody>", html, re.DOTALL | re.IGNORECASE)
    if not tbody_match:
        raise ValueError("No <tbody> found in page")

    tbody = tbody_match.group(1)
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", tbody, re.DOTALL | re.IGNORECASE)

    routes = []
    for row in rows:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL | re.IGNORECASE)
        if len(cells) < 5:
            continue

        def clean(s):
            import html
            s = re.sub(r"<[^>]+>", "", s)
            s = html.unescape(s)
            return s.strip()

        crag, route, job, hardware, date = [clean(c) for c in cells[:5]]
        if not crag and not route:
            continue

        routes.append({
            "crag": crag,
            "route": route,
            "job": job,
            "hardware": hardware,
            "date": date,
            "dateSort": parse_date_sort(date),
        })

    return routes


def main():
    print(f"Fetching {URL} ...")
    html = fetch_html(URL)

    print("Parsing table ...")
    routes = parse_table(html)
    print(f"Found {len(routes)} routes")

    if len(routes) < 500:
        raise ValueError(f"Only {len(routes)} routes found – scraping may have failed (expected ≥500)")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "count": len(routes),
        "routes": routes,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"Saved to {OUTPUT}")


if __name__ == "__main__":
    main()
