"""Bulk insert + query for `payment_rows` (Q1145 payment-centric snapshots)."""

from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.db.pool import get_pool

logger = logging.getLogger(__name__)

# Columns in payment_rows, aligned with Q1145 SELECT order for bulk-insert.
COLUMNS = [
    "payment_id", "payment_status", "refund_type",
    "payment_amount", "refund_amount", "net_amount",
    "payment_provider", "payment_transaction_id", "refund_transaction_id",
    "payment_created_bkk",
    "is_invoice_primary",
    "invoice_id", "invoice_status", "organization_id",
    "etax_number", "invoice_amount", "total_discount", "discount_label",
    "reference_id", "session_start_bkk", "session_end_bkk",
    "kwh", "total_time", "total_overtime",
    "location_name", "location_code", "evse_name",
    "user_email", "privilege_program_name", "vin",
]

_TS_COLS = {"payment_created_bkk", "session_start_bkk", "session_end_bkk"}
_UUID_COLS = {"payment_id", "invoice_id", "organization_id"}
_NUMERIC_COLS = {
    "payment_amount", "refund_amount", "net_amount",
    "invoice_amount", "total_discount",
    "kwh", "total_time", "total_overtime",
}
_BOOL_COLS = {"is_invoice_primary"}


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
    if col in _UUID_COLS:
        if isinstance(value, UUID):
            return value
        try:
            return UUID(str(value))
        except (ValueError, AttributeError):
            return None
    if col in _NUMERIC_COLS and not isinstance(value, (int, float, Decimal)):
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    if col in _BOOL_COLS:
        if isinstance(value, bool):
            return value
        s = str(value).strip().lower()
        return s in ("true", "t", "1", "yes")
    return value


async def insert_payment_rows(snapshot_id: str, rows: list[list[Any]], source_columns: list[str]) -> int:
    if not rows:
        return 0
    idx = {name: i for i, name in enumerate(source_columns)}
    missing = [c for c in COLUMNS if c not in idx]
    if missing:
        logger.warning("Q1145 source missing columns: %s", missing)

    records = []
    for r in rows:
        rec = [snapshot_id]
        for c in COLUMNS:
            i = idx.get(c)
            rec.append(_coerce(c, r[i]) if i is not None else None)
        records.append(tuple(rec))

    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.copy_records_to_table(
            "payment_rows",
            records=records,
            columns=["snapshot_id", *COLUMNS],
        )
    logger.info("inserted %d payment rows for snapshot %s", len(records), snapshot_id)
    return len(records)


async def delete_payment_rows(snapshot_id: str) -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM payment_rows WHERE snapshot_id = $1::uuid", snapshot_id,
        )
    return int(result.split()[-1]) if result else 0


async def load_payment_rows(
    snapshot_id: str,
    *,
    location_name: str | None = None,
    location_names: list[str] | None = None,
) -> tuple[list[list[Any]], list[str]]:
    """Same shape as `load_snapshot_rows` — (rows, col_names) for feed into
    payment-level process_rows."""
    query = f"SELECT {', '.join(COLUMNS)} FROM payment_rows WHERE snapshot_id = $1::uuid"
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
        if isinstance(v, UUID):
            return str(v)
        if isinstance(v, Decimal):
            return float(v)
        return v

    rows = [[_json_safe(r[c]) for c in COLUMNS] for r in records]
    return rows, COLUMNS
