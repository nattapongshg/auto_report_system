"""One-shot data migration: Supabase Cloud → local Postgres.

Reads every row from each table via the old Supabase REST API and writes it
into the new local Postgres via asyncpg. Idempotent-ish: uses ON CONFLICT
on the PK to update if the row already exists.

Usage:
    # Populate both sides in .env
    export OLD_SUPABASE_URL=https://tbvjmmmpbzpbdrvimdlp.supabase.co
    export OLD_SUPABASE_SERVICE_KEY=eyJ...
    export NEW_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/auto_report

    python deploy/migrate-from-supabase.py
"""

import asyncio
import os
import sys

import asyncpg
import httpx


TABLES_IN_ORDER = [
    # Parents first → children last (FK order).
    # metabase_rows is populated by re-fetching snapshots on the new box,
    # not migrated — it would be 100+ MB per month via REST.
    "locations",
    "privilege_configs",
    "monthly_snapshots",
    "monthly_location_inputs",
    "group_report_inputs",
    "report_schedules",
]

PAGE_SIZE = 1000


async def fetch_all(url: str, key: str, table: str) -> list[dict]:
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    out: list[dict] = []
    offset = 0
    async with httpx.AsyncClient(timeout=60) as c:
        while True:
            r = await c.get(
                f"{url}/rest/v1/{table}",
                headers={**headers, "Range-Unit": "items", "Range": f"{offset}-{offset + PAGE_SIZE - 1}"},
            )
            r.raise_for_status()
            rows = r.json()
            out.extend(rows)
            if len(rows) < PAGE_SIZE:
                return out
            offset += PAGE_SIZE


async def upsert_rows(conn: asyncpg.Connection, table: str, rows: list[dict]):
    if not rows:
        return
    cols = list(rows[0].keys())
    col_sql = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(f"${i+1}" for i in range(len(cols)))
    # Build UPDATE clause excluding primary key `id`
    updates = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in cols if c != "id")
    conflict_clause = f"ON CONFLICT (id) DO UPDATE SET {updates}" if updates else "ON CONFLICT (id) DO NOTHING"
    stmt = f'INSERT INTO "{table}" ({col_sql}) VALUES ({placeholders}) {conflict_clause}'

    async with conn.transaction():
        for row in rows:
            values = [row[c] for c in cols]
            await conn.execute(stmt, *values)


async def main():
    old_url = os.environ["OLD_SUPABASE_URL"].rstrip("/")
    old_key = os.environ["OLD_SUPABASE_SERVICE_KEY"]
    new_dsn = os.environ["NEW_DATABASE_URL"]

    print(f"Migrating from {old_url} → {new_dsn.split('@')[-1]}")
    conn = await asyncpg.connect(new_dsn)
    try:
        for table in TABLES_IN_ORDER:
            print(f"\n→ {table}: fetching...", end=" ", flush=True)
            rows = await fetch_all(old_url, old_key, table)
            print(f"{len(rows)} rows, writing...", end=" ", flush=True)
            await upsert_rows(conn, table, rows)
            print("done.")
    finally:
        await conn.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyError as e:
        print(f"Missing env: {e}", file=sys.stderr)
        sys.exit(1)
