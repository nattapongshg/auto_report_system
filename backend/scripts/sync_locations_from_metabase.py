"""Sync `locations` table from Q1146 (Location Master).

Fetches every open ocpi_location + evse/connector aggregates and upserts into
our `locations` table. Match by `ocpi_location_id` (stable uuid). New
locations get inserted; existing ones get updated but existing CA, share_rate,
group_name, email_recipients, internet_cost, etc. are preserved (only the
fields sourced from Metabase are overwritten).

Run with VPN:
    PYTHONPATH=. ./venv/Scripts/python.exe scripts/sync_locations_from_metabase.py
"""
from __future__ import annotations

import asyncio
import sys
from typing import Any

import httpx
import asyncpg

from app.config import settings

sys.stdout.reconfigure(encoding="utf-8")

QUESTION_ID = 1146


# Only these fields are sourced from Q1146 — the rest of the locations row
# (CA, share_rate, group_name, email_recipients, etc.) is preserved.
METABASE_FIELDS = [
    "name", "station_code", "city", "state", "location_type",
    "requires_booking", "enable_overtime", "overtime_price",
    "idle_price", "kwh_price",
    "evse_count", "connector_count", "max_connector_power",
    "brands", "power_types", "operator_id",
]


async def fetch_master() -> list[dict]:
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(
            f"{settings.metabase_base_url}/api/card/{QUESTION_ID}/query",
            headers={"x-api-key": settings.metabase_api_key},
            json={"parameters": []},
        )
        r.raise_for_status()
        data = r.json()
        cols = [c["name"] for c in data["data"]["cols"]]
        return [dict(zip(cols, row)) for row in data["data"]["rows"]]


def _coerce(v: Any) -> Any:
    # JSON strings → None-preserve, numeric → float, bool stays bool
    if v is None or v == "":
        return None
    return v


async def main() -> None:
    print(f"Fetching Q{QUESTION_ID} from Metabase...")
    rows = await fetch_master()
    print(f"  → {len(rows)} open locations\n")

    conn = await asyncpg.connect(settings.database_url)
    try:
        inserted = updated = 0
        for r in rows:
            ocpi_id = r.get("location_id")
            name = r.get("name")
            if not name:
                continue

            # Match by ocpi_location_id first, then by name as fallback.
            existing = await conn.fetchrow(
                "SELECT id FROM locations WHERE ocpi_location_id = $1",
                ocpi_id,
            )
            if not existing:
                existing = await conn.fetchrow(
                    "SELECT id FROM locations WHERE name = $1", name,
                )

            update_vals = {
                "name": name,
                "station_code": r.get("station_code"),
                "city": r.get("city"),
                "state": r.get("state"),
                "location_type": r.get("location_type"),
                "requires_booking": bool(r.get("requires_booking")),
                "enable_overtime": bool(r.get("enable_overtime")),
                "overtime_price": _coerce(r.get("overtime_price")),
                "idle_price": _coerce(r.get("idle_price")),
                "kwh_price": _coerce(r.get("kwh_price")),
                "evse_count": r.get("evse_count"),
                "connector_count": r.get("connector_count"),
                "max_connector_power": r.get("max_connector_power"),
                "brands": r.get("brands"),
                "power_types": r.get("power_types"),
                "operator_id": r.get("operator_id"),
                "ocpi_location_id": ocpi_id,
                "is_active": True,  # open in metabase
            }

            if existing:
                set_clauses = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(update_vals))
                await conn.execute(
                    f"UPDATE locations SET {set_clauses} WHERE id = $1",
                    existing["id"], *update_vals.values(),
                )
                updated += 1
            else:
                cols = list(update_vals.keys())
                placeholders = ", ".join(f"${i + 1}" for i in range(len(cols)))
                await conn.execute(
                    f"INSERT INTO locations ({', '.join(cols)}) VALUES ({placeholders})",
                    *update_vals.values(),
                )
                inserted += 1

        print(f"updated: {updated}, inserted: {inserted}")

        # Summary
        r = await conn.fetchrow("""
            SELECT COUNT(*) total,
                   COUNT(*) FILTER (WHERE requires_booking) booking,
                   COUNT(*) FILTER (WHERE enable_overtime) overtime,
                   COUNT(*) FILTER (WHERE ocpi_location_id IS NOT NULL) synced
              FROM locations
        """)
        print(f"\nlocations: total={r['total']}  booking={r['booking']}  "
              f"overtime={r['overtime']}  synced={r['synced']}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
