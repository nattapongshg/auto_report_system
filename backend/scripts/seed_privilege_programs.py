"""Seed privilege_configs with all unique privilege_program_names found in Q1144.

Strategy:
  - Fetch recent Q1144 data (configurable window)
  - Collect every unique privilege_program_name
  - For each, upsert a privilege_configs row (is_active=true, privilege_type defaults to 'credit')
  - Preserve existing configs (only insert missing ones)

Usage:
    cd backend && PYTHONPATH=. ./venv/Scripts/python.exe scripts/seed_privilege_programs.py 2026-01 2026-04
"""

import asyncio
import sys
from collections import Counter

from app.engine.fetcher import fetch_date_range
from app.supabase_client import supabase


async def main(start: str, end: str):
    print(f"Fetching Q1144 from {start} to {end} ...")
    rows, names = await fetch_date_range(1144, start, end)
    if not rows or not names:
        print("No rows fetched")
        return

    pp_idx = names.index("privilege_program_name")
    dl_idx = names.index("discount_label")

    # Collect unique (program_name, sample_discount_label) pairs
    pairs: dict[str, str] = {}
    freq: Counter = Counter()
    for r in rows:
        pp = (r[pp_idx] or "").split(",")[0].strip()
        if not pp:
            continue
        freq[pp] += 1
        if pp not in pairs:
            pairs[pp] = r[dl_idx] or ""

    print(f"Found {len(pairs)} unique privilege_program_names (in {len(rows)} rows)")

    existing = await supabase.select(
        "privilege_configs",
        "select=id,privilege_program_name,discount_label"
    )
    existing_by_pp = {e["privilege_program_name"]: e for e in existing if e.get("privilege_program_name")}
    existing_by_dl = {e["discount_label"]: e for e in existing if e.get("discount_label")}

    inserted = 0
    linked = 0
    skipped = 0
    for pp, dl in pairs.items():
        if pp in existing_by_pp:
            skipped += 1
            continue
        # If an old entry exists keyed by discount_label, just backfill the pp name
        if dl and dl in existing_by_dl:
            old = existing_by_dl[dl]
            if not old.get("privilege_program_name"):
                await supabase.update(
                    "privilege_configs", f"id=eq.{old['id']}",
                    {"privilege_program_name": pp}
                )
                linked += 1
                continue
        await supabase.insert("privilege_configs", {
            "privilege_program_name": pp,
            "discount_label": dl or None,
            "privilege_type": "credit",
            "is_active": True,
            "notes": f"Auto-seeded (freq: {freq[pp]})",
        })
        inserted += 1

    print(f"Inserted {inserted} new · Linked {linked} existing · Skipped {skipped} already-seeded")


if __name__ == "__main__":
    start = sys.argv[1] if len(sys.argv) > 1 else "2026-01-01"
    end = sys.argv[2] if len(sys.argv) > 2 else "2026-04-01"
    asyncio.run(main(start, end))
