"""Apply station sharing config (GP + Revenue) from CSVs to locations.

Reads:
  backend/data/gp_sharing_stations.csv       -> share_basis='gp'
  backend/data/revenue_sharing_stations.csv  -> share_basis='revenue'

For each row:
  - share_basis        = 'gp' | 'revenue'
  - location_share_rate = 1 - (percentage / 100)
      (CSV % is Sharge's cut; location_share_rate is the *location's* cut,
       so we inverse.)
  - station_type       = normalized snake_case of CSV 'Type'
  - transaction_fee_rate = 0.0365   (flat 3.65% ex-VAT for all)
  - internet_cost        = 598      (flat 598 THB ex-VAT for all)

Match is by locations.name (exact). GP is applied first; revenue overrides on
name collisions (currently only 'ICC INTERNATIONAL 22 kW' is in both).
Unmatched rows are printed at the end so the operator can decide whether to
rename locations or skip.

Usage (local docker Postgres):
    PYTHONPATH=. ./venv/Scripts/python.exe scripts/apply_station_sharing.py
"""
import asyncio
import csv
from pathlib import Path

import asyncpg

from app.config import settings


DATA_DIR = Path(__file__).resolve().parents[1] / "data"

SOURCES = [
    ("gp", DATA_DIR / "gp_sharing_stations.csv", "GP Sharing"),
    ("revenue", DATA_DIR / "revenue_sharing_stations.csv", "Revenue Sharing"),
]

TYPE_MAP = {
    "showroom": "showroom",
    "gas station": "gas_station",
    "shopping_mall": "shopping_mall",
    "office": "office",
    "residential": "residential",
    "hotel": "hotel",
}

TX_FEE_RATE = 0.0365
INTERNET_COST = 598

# CSV name -> DB name. Used when the CSV spelling differs from the canonical
# name already seeded in `locations` (e.g. casing, trailing qualifier).
NAME_REMAP = {
    "Habito mall": "Habito Mall",
    "VIA 61": "VIA 61 (Private)",
    "ST21 Makro Roi Et": "ST28 Makro Roi Et",
}


def normalize_type(raw: str) -> str:
    key = raw.strip().lower()
    return TYPE_MAP.get(key, key.replace(" ", "_"))


def fix_name(s: str) -> str:
    # CSV was exported as UTF-8 but mis-read as CP1252 / latin-1, so Thai chars
    # come through as e.g. 'à¸ªà¸à¸²à¸'. Round-trip back to the real chars.
    try:
        s = s.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    # NBSP (\xa0) leaks in from Excel copy-paste; collapse to normal space.
    return s.replace("\xa0", " ").strip()


def parse_csv(path: Path, rate_col: str) -> list[tuple[str, str, float]]:
    rows: list[tuple[str, str, float]] = []
    with path.open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            name = fix_name(r["Location"])
            name = NAME_REMAP.get(name, name)
            if not name:
                continue
            st_type = normalize_type(r["Type"])
            sharge_rate = float(r[rate_col].strip().rstrip("%")) / 100
            location_rate = 1 - sharge_rate
            rows.append((name, st_type, location_rate))
    return rows


async def apply_basis(
    conn: asyncpg.Connection,
    basis: str,
    rows: list[tuple[str, str, float]],
) -> tuple[int, int]:
    """UPSERT each CSV row into locations. Returns (updated, inserted)."""
    updated = inserted = 0
    for name, st_type, rate in rows:
        row = await conn.fetchrow(
            """
            INSERT INTO locations
                   (name, share_basis, location_share_rate, station_type,
                    transaction_fee_rate, internet_cost)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (name) DO UPDATE SET
                share_basis = EXCLUDED.share_basis,
                location_share_rate = EXCLUDED.location_share_rate,
                station_type = EXCLUDED.station_type,
                transaction_fee_rate = EXCLUDED.transaction_fee_rate,
                internet_cost = EXCLUDED.internet_cost
            RETURNING (xmax = 0) AS was_insert
            """,
            name, basis, rate, st_type, TX_FEE_RATE, INTERNET_COST,
        )
        if row["was_insert"]:
            inserted += 1
        else:
            updated += 1
    return updated, inserted


CLEANUP_SQL = """
UPDATE locations
   SET name = trim(replace(name, chr(160), ' '))
 WHERE name <> trim(replace(name, chr(160), ' '));
"""


async def main() -> None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        cleaned = await conn.execute(CLEANUP_SQL)
        print(f"cleanup (NBSP/trim): {cleaned}")
        for basis, path, rate_col in SOURCES:
            if not path.exists():
                print(f"[{basis}] skip: {path.name} not found")
                continue
            rows = parse_csv(path, rate_col)
            print(f"[{basis}] CSV: {len(rows)} rows ({path.name})")
            updated, inserted = await apply_basis(conn, basis, rows)
            print(f"[{basis}] updated: {updated}, inserted: {inserted}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
