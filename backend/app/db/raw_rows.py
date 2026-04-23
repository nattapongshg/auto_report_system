"""Bulk insert + query for `metabase_rows` — replaces on-disk JSON snapshots."""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.db.pool import get_pool

logger = logging.getLogger(__name__)

# Column order must match metabase_rows schema (see db/init/15_metabase_rows.sql).
# `id`, `snapshot_id`, `inserted_at` are handled outside.
COLUMNS = [
    "invoice_id", "invoice_status", "etax_number", "reference_id",
    "session_start_bkk", "session_end_bkk", "paid_date_bkk",
    "user_email", "location_name", "location_code", "evse_name",
    "kwh", "total_time", "total_overtime", "total_overtime_cost",
    "invoice_amount", "total_discount", "total_refund", "price_per_kwh",
    "payment_amount", "payment_status", "payment_provider", "payment_transaction_id",
    "discount_label", "privilege_program_name", "discount_provider",
    "discount_status", "vin",
]

# Columns that should be parsed as timestamps when Metabase returns strings.
_TS_COLS = {"session_start_bkk", "session_end_bkk", "paid_date_bkk"}

# Columns that can be None but come back as empty strings from Metabase.
_NULLABLE_UUID = {"invoice_id"}


def _coerce(col: str, value: Any) -> Any:
    if value in (None, ""):
        return None
    if col in _TS_COLS:
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    if col in _NULLABLE_UUID and value == "":
        return None
    return value


async def insert_snapshot_rows(
    snapshot_id: str,
    rows: list[list[Any]],
    source_columns: list[str],
) -> int:
    """Bulk-insert raw rows for a snapshot using asyncpg COPY.

    `source_columns` is the column list coming from Metabase so we can align
    arbitrary input ordering to our canonical `COLUMNS` order.
    """
    if not rows:
        return 0

    idx = {name: i for i, name in enumerate(source_columns)}
    missing = [c for c in COLUMNS if c not in idx]
    if missing:
        logger.warning("source missing columns: %s (will insert as NULL)", missing)

    records = []
    for r in rows:
        rec = [snapshot_id]
        for c in COLUMNS:
            i = idx.get(c)
            rec.append(_coerce(c, r[i]) if i is not None else None)
        records.append(tuple(rec))

    pool = await get_pool()
    async with pool.acquire() as conn:
        # copy_records_to_table is an order of magnitude faster than INSERT
        await conn.copy_records_to_table(
            "metabase_rows",
            records=records,
            columns=["snapshot_id", *COLUMNS],
        )
    logger.info("inserted %d raw rows for snapshot %s", len(records), snapshot_id)
    return len(records)


async def delete_snapshot_rows(snapshot_id: str) -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM metabase_rows WHERE snapshot_id = $1::uuid",
            snapshot_id,
        )
    # result like "DELETE 180514"
    return int(result.split()[-1]) if result else 0


async def load_snapshot_rows(
    snapshot_id: str,
    *,
    location_name: str | None = None,
    location_names: list[str] | None = None,
) -> tuple[list[list[Any]], list[str]]:
    """Return `(rows, col_names)` shaped like the old JSON format.

    Pass `location_names` to narrow to a subset — much faster than loading the
    full 175k-row snapshot only to filter in Python when you're generating
    a single location's report.
    """
    query = f"""
        SELECT {", ".join(COLUMNS)}
        FROM metabase_rows
        WHERE snapshot_id = $1::uuid
    """
    args: list[Any] = [snapshot_id]
    if location_name is not None:
        query += " AND location_name = $2"
        args.append(location_name)
    elif location_names:
        query += " AND location_name = ANY($2::text[])"
        args.append(list(location_names))

    pool = await get_pool()
    async with pool.acquire() as conn:
        records = await conn.fetch(query, *args)

    def _json_safe(v: Any) -> Any:
        # openpyxl can't serialize UUID/Decimal; process_rows / excel_builder
        # expect plain strings / floats like the old JSON snapshot format.
        if isinstance(v, UUID):
            return str(v)
        if isinstance(v, Decimal):
            return float(v)
        return v

    rows = [[_json_safe(r[c]) for c in COLUMNS] for r in records]
    return rows, COLUMNS


async def count_snapshot_rows(snapshot_id: str) -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchval(
            "SELECT count(*) FROM metabase_rows WHERE snapshot_id = $1::uuid",
            snapshot_id,
        )
