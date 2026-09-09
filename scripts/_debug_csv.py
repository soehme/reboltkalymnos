#!/usr/bin/env python3
"""Temporary diagnostic script to locate the moved CSV export. Not part of the app."""

import re
import urllib.request
import urllib.error

PAGE_URL = "https://reboltkalymnos.org/rebolt-log/"
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"


def fetch(url, method="GET"):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:
        return f"ERR:{e}", b""


def main():
    print(f"GET {PAGE_URL}")
    status, body = fetch(PAGE_URL)
    print(f"  -> {status}, {len(body)} bytes")
    html = body.decode("utf-8", errors="replace")

    print("\n--- searching for .csv references in HTML ---")
    for m in re.finditer(r'[^"\'>\s]*\.csv[^"\'<\s]*', html, re.IGNORECASE):
        print(" found:", m.group(0))

    print("\n--- searching for href attributes containing 'csv' ---")
    for m in re.finditer(r'href=["\']([^"\']*csv[^"\']*)["\']', html, re.IGNORECASE):
        print(" href:", m.group(1))

    print("\n--- searching for any /wp-content/uploads or export-looking links ---")
    for m in re.finditer(r'href=["\']([^"\']*(?:export|download|uploads)[^"\']*)["\']', html, re.IGNORECASE):
        print(" link:", m.group(1))

    candidates = [
        "https://reboltkalymnos.org/CSV.csv",
        "https://reboltkalymnos.org/csv.csv",
        "https://reboltkalymnos.org/Csv.csv",
        "https://reboltkalymnos.org/rebolt-log/CSV.csv",
        "https://reboltkalymnos.org/wp-content/uploads/CSV.csv",
        "https://reboltkalymnos.org/data.csv",
    ]
    print("\n--- probing candidate CSV URLs ---")
    for url in candidates:
        status, body = fetch(url)
        print(f"  {url} -> {status} ({len(body)} bytes)")

    print("\n--- searching for api/fetch endpoints referenced in scripts ---")
    seen = set()
    for m in re.finditer(r'["\'](/(?:api|_next/data)[^"\']*)["\']', html):
        if m.group(1) not in seen:
            seen.add(m.group(1))
            print(" api path:", m.group(1))
    for m in re.finditer(r'fetch\((["\'][^"\')]+)', html):
        print(" fetch call:", m.group(1))

    print("\n--- searching for field-name markers (crag/route/job/hardware) ---")
    for field in ["crag", "hardware", "\"job\"", "\"route\"", "rebolt", "csv", "export"]:
        idxs = [m.start() for m in re.finditer(re.escape(field), html, re.IGNORECASE)]
        print(f"  '{field}': {len(idxs)} occurrences")
        if idxs and field in ("crag", "hardware"):
            i = idxs[0]
            print("    context:", html[max(0, i - 150):i + 150].replace("\n", " "))

    print("\n--- looking for other page routes (nav links) that might list a data/export page ---")
    for m in re.finditer(r'href=["\'](/[a-zA-Z0-9/_-]*)["\']', html):
        seen.add(m.group(1))
    for path in sorted(seen):
        print(" nav link:", path)

    print("\n--- last 1500 chars of HTML (for manual inspection) ---")
    print(html[-1500:])


if __name__ == "__main__":
    main()
