"""Overwrite `locations.station_type` and `locations.group_name` from the
master SHARGE LOCATIONS xlsx `Location Type` column.

Unconditional replace — anything previously set from the GP/Revenue sharing
CSVs is overridden. 10 types are currently seen in the spreadsheet:
    residential, bcp, showroom, shopping_mall, shell, office,
    hotel, showroom_new_model, susco, shopping_mall_tier

`group_name` gets the same value so the Groups page surfaces them out of the
box; operators can rename/merge in the UI afterwards.

Usage:
    PYTHONPATH=. ./venv/Scripts/python.exe scripts/apply_location_types.py \
        "c:/auto_report_system/SHARGE LOCATIONS - Copy.xlsx"
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")  # Thai chars in unmatched list

import asyncpg
import openpyxl

from app.config import settings


DEFAULT_XLSX = Path("c:/auto_report_system/SHARGE LOCATIONS - Copy.xlsx")


def parse_xlsx(path: Path) -> list[tuple[str, str]]:
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb["Locations"]
    it = ws.iter_rows(values_only=True)
    header = [str(c).strip() if c else "" for c in next(it)]
    name_i = header.index("Locations")
    type_i = header.index("Location Type")

    rows: list[tuple[str, str]] = []
    for r in it:
        name = r[name_i]
        if not name:
            continue
        t = (r[type_i] or "").strip() if r[type_i] else ""
        if not t:
            continue
        rows.append((str(name).strip(), t))
    return rows


async def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    print(f"reading {path}")
    rows = parse_xlsx(path)
    print(f"parsed {len(rows)} rows")

    conn = await asyncpg.connect(settings.database_url)
    try:
        updated = 0
        unmatched: list[str] = []
        async with conn.transaction():
            for name, t in rows:
                r = await conn.execute(
                    """
                    UPDATE locations
                       SET station_type = $2,
                           group_name   = $2
                     WHERE name = $1
                    """,
                    name, t,
                )
                if r.endswith(" 1"):
                    updated += 1
                else:
                    unmatched.append(name)

        print(f"updated: {updated}")
        if unmatched:
            print(f"unmatched ({len(unmatched)}) — not in locations table:")
            for n in unmatched[:20]:
                print(f"  - {n}")
            if len(unmatched) > 20:
                print(f"  ... and {len(unmatched) - 20} more")

        # Final breakdown
        summary = await conn.fetch(
            "SELECT group_name, COUNT(*) n FROM locations WHERE group_name IS NOT NULL GROUP BY 1 ORDER BY n DESC"
        )
        print("\ngroup_name / station_type distribution:")
        for s in summary:
            print(f"  {s['group_name']:30} {s['n']}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
