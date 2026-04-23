"""Apply revenue-sharing config from CSV to locations.

Reads backend/data/revenue_sharing_stations.csv and for each row:
  - share_basis = 'revenue'
  - location_share_rate = percentage / 100
  - station_type = 'showroom' | 'gas_station'

Match is by locations.name (exact). Unmatched rows are printed at the end
so the operator can decide whether to rename or skip.

Usage (local docker Postgres):
    PYTHONPATH=. ./venv/Scripts/python.exe scripts/apply_revenue_sharing.py
"""
import asyncio
import csv
from pathlib import Path

import asyncpg

from app.config import settings


CSV_PATH = Path(__file__).resolve().parents[1] / "data" / "revenue_sharing_stations.csv"

TYPE_MAP = {
    "Showroom": "showroom",
    "Gas station": "gas_station",
}


def parse_csv() -> list[tuple[str, str, float]]:
    rows: list[tuple[str, str, float]] = []
    with CSV_PATH.open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            name = r["Location"].strip()
            st_type = TYPE_MAP.get(r["Type"].strip(), r["Type"].strip().lower())
            rate = float(r["Revenue Sharing"].strip().rstrip("%")) / 100
            rows.append((name, st_type, rate))
    return rows


async def main() -> None:
    rows = parse_csv()
    print(f"CSV: {len(rows)} rows")
    conn = await asyncpg.connect(settings.database_url)
    try:
        matched = 0
        unmatched: list[str] = []
        for name, st_type, rate in rows:
            result = await conn.execute(
                """
                UPDATE locations
                   SET share_basis = 'revenue',
                       location_share_rate = $2,
                       station_type = $3
                 WHERE name = $1
                """,
                name, rate, st_type,
            )
            # asyncpg returns e.g. 'UPDATE 1' or 'UPDATE 0'
            if result.endswith(" 1"):
                matched += 1
            else:
                unmatched.append(name)
        print(f"updated: {matched}")
        if unmatched:
            print(f"unmatched ({len(unmatched)}):")
            for n in unmatched:
                print(f"  - {n}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
