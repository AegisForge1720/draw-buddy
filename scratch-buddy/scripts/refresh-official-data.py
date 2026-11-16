#!/usr/bin/env python3
"""Refresh local caches of official NY Open Data lottery files.

preview-only, Ralph no-go. For scratch-buddy-full-preview only.
Do not merge into scratch-buddy-wip or main.

Pulls:
  - xyvi-fbb9 Lottery Daily Retailer Sales (By Game): Beginning 2024
    (latest business day plus 7- and 30-day totals, joined later in the app
    to 2vvn-pdyi by agent number with leading zeros stripped)
  - nzqa-7unk Scratch-Off Game Daily Prize Status Report (statewide)

Does not invent numbers. Stores with no row in a window are omitted from that
window rather than written as zero. Run from the scratch-buddy folder:

    python3 scripts/refresh-official-data.py
"""

from __future__ import annotations

import json
import ssl
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
UA = "ScratchBuddyPreview/1.0 (private preview cache refresh)"
SALES_ID = "xyvi-fbb9"
PRIZES_ID = "nzqa-7unk"
SALES_PAGE = (
    "https://data.ny.gov/Government-Finance/"
    "Lottery-Daily-Retailer-Sales-By-Game-Beginning-202/xyvi-fbb9"
)
PRIZES_PAGE = (
    "https://data.ny.gov/Government-Finance/"
    "Scratch-Off-Game-Daily-Prize-Status-Report/nzqa-7unk"
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def et_now() -> datetime:
    return datetime.now(ET)


def iso_et(dt: datetime) -> str:
    return dt.astimezone(ET).isoformat(timespec="seconds")


def unix_to_et_iso(value) -> str | None:
    if value is None:
        return None
    try:
        stamp = int(value)
    except (TypeError, ValueError):
        return None
    return iso_et(datetime.fromtimestamp(stamp, tz=timezone.utc))


def agent_key(value) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    stripped = text.lstrip("0")
    return stripped if stripped else "0"


def parse_amount(value):
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:  # NaN
        return None
    if number == int(number):
        return int(number)
    return number


def parse_count(value):
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def bus_day_text(value) -> str | None:
    if not value:
        return None
    text = str(value)
    return text[:10] if len(text) >= 10 else text


def add_amounts(left, right):
    if left is None:
        return right
    if right is None:
        return left
    total = left + right
    if total == int(total):
        return int(total)
    return total


def fetch(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    context = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=180, context=context) as response:
        payload = json.load(response)
    return payload


def resource_url(dataset_id: str, params: dict) -> str:
    query = urllib.parse.urlencode(params, safe="(),'*")
    return f"https://data.ny.gov/resource/{dataset_id}.json?{query}"


def fetch_metadata(dataset_id: str) -> dict:
    return fetch(f"https://data.ny.gov/api/views/{dataset_id}.json")


def fetch_all(dataset_id: str, params: dict, page_size: int = 50000) -> list:
    rows = []
    offset = 0
    while True:
        page_params = dict(params)
        page_params["$limit"] = str(page_size)
        page_params["$offset"] = str(offset)
        page = fetch(resource_url(dataset_id, page_params))
        if not isinstance(page, list):
            raise SystemExit(f"Unexpected response from {dataset_id}: {type(page)}")
        rows.extend(page)
        print(f"  fetched {len(page)} rows (total {len(rows)}) from {dataset_id}", flush=True)
        if len(page) < page_size:
            break
        offset += page_size
    return rows


def latest_business_day() -> str:
    rows = fetch(resource_url(SALES_ID, {"$select": "max(bus_day) as latest", "$limit": "1"}))
    if not rows or not rows[0].get("latest"):
        raise SystemExit("The sales file did not return a latest business day.")
    day = bus_day_text(rows[0]["latest"])
    if not day:
        raise SystemExit("The sales file latest business day could not be read.")
    return day


def window_start(latest: str, days: int) -> str:
    end = date.fromisoformat(latest)
    start = end - timedelta(days=days - 1)
    return start.isoformat()


def soda_day(day: str) -> str:
    return f"{day}T00:00:00.000"


def fetch_window_totals(start: str, end: str) -> dict:
    where = f"bus_day >= '{soda_day(start)}' AND bus_day <= '{soda_day(end)}'"
    rows = fetch_all(
        SALES_ID,
        {
            "$select": (
                "agtno,"
                "sum(draw_paid) as draw_paid,"
                "sum(ig_paid) as ig_paid,"
                "sum(ig_settles) as ig_settles,"
                "count(*) as days"
            ),
            "$where": where,
            "$group": "agtno",
        },
    )
    out = {}
    for row in rows:
        key = agent_key(row.get("agtno"))
        if not key:
            continue
        days = parse_count(row.get("days"))
        if not days:
            continue
        out[key] = {
            "draw_paid": parse_amount(row.get("draw_paid")),
            "ig_paid": parse_amount(row.get("ig_paid")),
            "ig_settles": parse_amount(row.get("ig_settles")),
            "daysWithRows": days,
        }
    return out


def fetch_latest_day(day: str) -> dict:
    rows = fetch_all(
        SALES_ID,
        {
            "$select": "agtno,bus_day,draw_paid,ig_paid,ig_settles",
            "$where": f"bus_day = '{soda_day(day)}'",
        },
    )
    out = {}
    for row in rows:
        key = agent_key(row.get("agtno"))
        if not key:
            continue
        out[key] = {
            "bus_day": bus_day_text(row.get("bus_day")) or day,
            "draw_paid": parse_amount(row.get("draw_paid")),
            "ig_paid": parse_amount(row.get("ig_paid")),
            "ig_settles": parse_amount(row.get("ig_settles")),
        }
    return out


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {path} ({path.stat().st_size} bytes)", flush=True)


def refresh_sales() -> dict:
    print("Refreshing xyvi-fbb9 daily retailer sales cache…", flush=True)
    meta = fetch_metadata(SALES_ID)
    latest = latest_business_day()
    start7 = window_start(latest, 7)
    start30 = window_start(latest, 30)
    print(f"  latest business day {latest}; 7-day {start7} to {latest}; 30-day {start30} to {latest}", flush=True)
    latest_rows = fetch_latest_day(latest)
    days7 = fetch_window_totals(start7, latest)
    days30 = fetch_window_totals(start30, latest)
    stores = {}
    keys = set(latest_rows) | set(days7) | set(days30)
    for key in keys:
        entry = {}
        if key in latest_rows:
            entry["latest"] = latest_rows[key]
        if key in days7:
            entry["days7"] = days7[key]
        if key in days30:
            entry["days30"] = days30[key]
        if entry:
            stores[key] = entry
    payload = {
        "source": meta.get("name") or "Lottery Daily Retailer Sales (By Game): Beginning 2024",
        "sourceAgency": "New York State Gaming Commission, Division of Lottery, published on NY Open Data (data.ny.gov)",
        "datasetId": SALES_ID,
        "sourcePage": SALES_PAGE,
        "sourceApi": f"https://data.ny.gov/resource/{SALES_ID}.json",
        "joinDatasetId": "2vvn-pdyi",
        "joinKey": "agtno joined to retailer after stripping leading zeros",
        "retrievedAt": iso_et(et_now()),
        "retrievedAtTimeZone": "America/New_York",
        "sourceRowsUpdatedAt": unix_to_et_iso(meta.get("rowsUpdatedAt")),
        "latestBusinessDay": latest,
        "window7Start": start7,
        "window30Start": start30,
        "officialFields": {
            "draw_paid": "Daily DRAW PAID Sales",
            "ig_paid": "Daily IG PAID Sales",
            "ig_settles": "Daily IG SETTLES Sales",
        },
        "notes": (
            "UNAUDITED SALES DATA, as labeled by the official overview. "
            "Amounts are the official field values (or sums of those values over the dated windows). "
            "A missing row is omitted rather than stored as zero. "
            "Under-$600 cash-outs only show where tickets were cashed; a prize of $600 or more is claimed from the Commission, not an ordinary retailer. "
            "This cache is for a private preview only."
        ),
        "storeCount": len(stores),
        "latestDayRowCount": len(latest_rows),
        "stores": stores,
    }
    write_json(DATA / "retailer-sales.json", payload)
    return payload


def refresh_prizes() -> dict:
    print("Refreshing nzqa-7unk scratch-off prize status cache…", flush=True)
    meta = fetch_metadata(PRIZES_ID)
    rows = fetch_all(
        PRIZES_ID,
        {"$select": "game_number,game_name,prize_amount,paid,unpaid,total", "$order": "game_number,prize_amount"},
        page_size=5000,
    )
    official = []
    for row in rows:
        game_number = str(row.get("game_number") or "").strip()
        game_name = str(row.get("game_name") or "").strip()
        prize_amount = str(row.get("prize_amount") or "").strip()
        if not game_number or not prize_amount:
            continue
        official.append(
            {
                "game_number": game_number,
                "game_name": game_name,
                "prize_amount": prize_amount,
                "paid": parse_count(row.get("paid")),
                "unpaid": parse_count(row.get("unpaid")),
                "total": parse_count(row.get("total")),
            }
        )
    games = {row["game_number"] for row in official}
    payload = {
        "source": meta.get("name") or "Scratch-Off Game Daily Prize Status Report",
        "sourceAgency": "New York State Gaming Commission, published on NY Open Data (data.ny.gov)",
        "datasetId": PRIZES_ID,
        "sourcePage": PRIZES_PAGE,
        "sourceApi": f"https://data.ny.gov/resource/{PRIZES_ID}.json",
        "retrievedAt": iso_et(et_now()),
        "retrievedAtTimeZone": "America/New_York",
        "sourceRowsUpdatedAt": unix_to_et_iso(meta.get("rowsUpdatedAt")),
        "rowCount": len(official),
        "gameCount": len(games),
        "officialFields": {
            "game_number": "game_number",
            "game_name": "game_name",
            "prize_amount": "prize_amount",
            "paid": "paid",
            "unpaid": "unpaid",
            "total": "total",
        },
        "notes": (
            "Statewide counts for each scratch-off game and prize tier from the official prize status report. "
            "These figures are not per store and do not say where tickets were sold or cashed. "
            "The official files maintained by the New York Lottery prevail if they disagree with this cache. "
            "This cache is for a private preview only."
        ),
        "rows": official,
    }
    write_json(DATA / "prizes-remaining.json", payload)
    return payload


def main() -> int:
    sales = refresh_sales()
    prizes = refresh_prizes()
    print(
        f"Done. Sales stores={sales['storeCount']} latest={sales['latestBusinessDay']} "
        f"prize rows={prizes['rowCount']} games={prizes['gameCount']}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
