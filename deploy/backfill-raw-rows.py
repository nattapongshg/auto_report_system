"""One-shot: migrate existing backend/data/*.json into metabase_rows table.

For each snapshot where `file_path` points to a JSON file, load it and COPY
the rows into Postgres. Skips snapshots already populated.

Usage:
    cd backend && PYTHONPATH=. ./venv/Scripts/python.exe ../deploy/backfill-raw-rows.py
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# Fix import path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.db.pool import close_pool  # noqa: E402
from app.db.raw_rows import (  # noqa: E402
    count_snapshot_rows, delete_snapshot_rows, insert_snapshot_rows,
)
from app.supabase_client import supabase  # noqa: E402


async def main():
    snapshots = await supabase.select(
        "monthly_snapshots",
        "select=id,year_month,file_path,total_rows&status=eq.completed"
    )
    for s in snapshots:
        fp = s.get("file_path")
        if not fp or not os.path.exists(fp):
            print(f"  {s['year_month']}: no local file ({fp}) — skip")
            continue

        existing = await count_snapshot_rows(s["id"])
        if existing > 0:
            print(f"  {s['year_month']}: already has {existing} rows in DB — skip")
            continue

        with open(fp, "r", encoding="utf-8") as f:
            data = json.load(f)
        rows = data.get("rows") or []
        cols = data.get("cols") or []
        if not rows:
            print(f"  {s['year_month']}: empty JSON — skip")
            continue

        print(f"  {s['year_month']}: inserting {len(rows)} rows...", end=" ", flush=True)
        await delete_snapshot_rows(s["id"])
        inserted = await insert_snapshot_rows(s["id"], rows, cols)
        print(f"done ({inserted})")

    await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
