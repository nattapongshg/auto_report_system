"""Re-populate privilege_configs after the move off Supabase.

Two sources are combined:

1. `db/init/91_seed_privileges.sql` — curated mapping that encodes which
   discount_label is `credit` / `percent` / `mixed` and optional share_rate.
   This is the authoritative source for `privilege_type` (hand-classified).

2. `metabase_rows` in the local Postgres — contains every raw Q1144 row we
   have ever snapshotted, including `privilege_program_name` which is the new
   primary key (Q1144 joined `privilege_programs.name`).

Result: one row per unique `privilege_program_name` observed in the snapshots,
linked to a `discount_label` and inheriting its `privilege_type` / `share_rate`
from the curated map. Rows in the curated map that never appeared in
metabase_rows are kept as pp-less fallback entries.

Safe to re-run — wipes the table and rebuilds from scratch.

Usage:
    PYTHONPATH=. ./venv/Scripts/python.exe scripts/migrate_privileges_from_local.py
"""
from __future__ import annotations

import asyncio
import re
from collections import Counter
from pathlib import Path

import asyncpg

from app.config import settings


INIT_DIR = Path(__file__).resolve().parents[1] / "db" / "init"
SEED_FILES = [INIT_DIR / "30_privilege_config.sql", INIT_DIR / "91_seed_privileges.sql"]

# 91-style (single VALUES tuple per INSERT).
_SINGLE_RE = re.compile(
    r"INSERT INTO privilege_configs \([^)]+\) VALUES "
    r"\('((?:[^']|'')*)', '((?:[^']|'')*)', '((?:[^']|'')*)'(?:, (NULL|[\d.]+))?\)"
)

# 30-style (single tuple inside a multi-row INSERT body).
_TUPLE_RE = re.compile(
    r"\('((?:[^']|'')*)', '((?:[^']|'')*)', '((?:[^']|'')*)'(?:, (NULL|[\d.]+))?\)"
)


def parse_curated_seed() -> list[tuple[str, str, str, float | None]]:
    """Return list of (discount_label, display_name, privilege_type, share_rate).

    Parses both the 30_privilege_config.sql multi-row INSERT chunks and the
    91_seed_privileges.sql single-row INSERTs. Duplicate discount_labels are
    kept (different display_names coexist under the same dl)."""
    out: list[tuple[str, str, str, float | None]] = []
    seen: set[tuple[str, str, str]] = set()
    for f in SEED_FILES:
        text = f.read_text(encoding="utf-8")
        for m in _TUPLE_RE.finditer(text):
            dl, dn, pt, sr = m.group(1), m.group(2), m.group(3), m.group(4)
            if pt not in ("credit", "percent", "mixed"):
                continue
            key = (dl, dn, pt)
            if key in seen:
                continue
            seen.add(key)
            rate = None if sr in (None, "NULL") else float(sr)
            out.append((dl.replace("''", "'"), dn.replace("''", "'"), pt, rate))
    return out


async def main() -> None:
    curated = parse_curated_seed()
    print(f"parsed {len(curated)} curated rows from {[f.name for f in SEED_FILES]}")

    # discount_label -> first curated (display_name, privilege_type, share_rate).
    # Same dl may appear multiple times in the seed (different display_names).
    # The first one wins as the "type" for that dl.
    type_by_dl: dict[str, tuple[str, float | None]] = {}
    for dl, _dn, pt, sr in curated:
        type_by_dl.setdefault(dl, (pt, sr))

    conn = await asyncpg.connect(settings.database_url)
    try:
        # Distinct (pp, dl) pairs actually seen in snapshots.
        rows = await conn.fetch(
            """
            SELECT privilege_program_name,
                   MIN(discount_label) AS discount_label,
                   COUNT(*) AS freq
              FROM metabase_rows
             WHERE privilege_program_name IS NOT NULL
               AND privilege_program_name <> ''
             GROUP BY privilege_program_name
            """
        )
        pp_pairs = [(r["privilege_program_name"], r["discount_label"], r["freq"]) for r in rows]
        print(f"found {len(pp_pairs)} unique privilege_program_names in metabase_rows")

        # Wipe + rebuild inside one transaction.
        async with conn.transaction():
            await conn.execute("DELETE FROM privilege_configs")

            # Dedupe by pp_primary (comma-joined names collapse to the first name).
            dedup: dict[str, tuple[str | None, int]] = {}
            for pp, dl, freq in pp_pairs:
                pp_primary = pp.split(",")[0].strip()
                if not pp_primary:
                    continue
                prev = dedup.get(pp_primary)
                if prev is None or freq > prev[1]:
                    dedup[pp_primary] = (dl, freq)

            # 1) One row per privilege_program_name, inheriting type from the
            #    curated dl map when available, defaulting to 'credit' otherwise.
            inserted_pp = 0
            for pp_primary, (dl, freq) in dedup.items():
                pt, sr = type_by_dl.get(dl or "", ("credit", None))
                await conn.execute(
                    """
                    INSERT INTO privilege_configs
                           (privilege_program_name, discount_label, display_name,
                            privilege_type, share_rate, is_active, notes)
                    VALUES ($1, $2, $3, $4, $5, TRUE, $6)
                    """,
                    pp_primary, dl or None, pp_primary, pt, sr,
                    f"Migrated from metabase_rows (freq: {freq})",
                )
                inserted_pp += 1

            # 2) Curated rows whose discount_label never surfaced with a pp name —
            #    keep them as fallback (pp = NULL, keyed by discount_label only).
            #    Skip dls we already inserted under a pp since the dl lookup will
            #    happen via dl->pp entry anyway.
            seen_dls = {dl for _pp, dl, _freq in pp_pairs if dl}
            inserted_fallback = 0
            for dl, dn, pt, sr in curated:
                if dl in seen_dls:
                    continue
                await conn.execute(
                    """
                    INSERT INTO privilege_configs
                           (discount_label, display_name, privilege_type, share_rate,
                            is_active, notes)
                    VALUES ($1, $2, $3, $4, TRUE, 'Curated fallback (no pp in snapshots)')
                    """,
                    dl, dn, pt, sr,
                )
                inserted_fallback += 1

        print(f"inserted: {inserted_pp} by pp, {inserted_fallback} curated fallback")
        total = await conn.fetchval("SELECT COUNT(*) FROM privilege_configs")
        by_type = await conn.fetch(
            "SELECT privilege_type, COUNT(*) n FROM privilege_configs GROUP BY 1 ORDER BY 1"
        )
        print(f"total: {total}")
        for r in by_type:
            print(f"  {r['privilege_type']:8} {r['n']}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
