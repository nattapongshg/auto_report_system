"""Upload PEA/MEA electricity bill exports and match them to locations by CA.

Two-step flow:
  1. POST /upload?provider=pea|mea&dry_run=1 — parse only, return preview stats
  2. POST /upload?provider=pea|mea           — parse + upsert (same request
     shape; frontend re-posts after the user confirms).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from app.db.pool import get_pool
from app.engine.electricity_parser import BillRow, parse_mea, parse_pea

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/electricity-bills", tags=["electricity"])


def _parse(provider: str, filename: str, data: bytes) -> list[BillRow]:
    if provider == "mea":
        return parse_mea(data, source_file=filename)
    if provider == "pea":
        return parse_pea(data, source_file=filename)
    raise HTTPException(400, f"unknown provider: {provider!r}")


async def _match_report(cas: list[str]) -> tuple[list[dict], list[str]]:
    """Returns (matched_rows, unmatched_cas). Each matched row:
    {ca, location_name}."""
    if not cas:
        return [], []
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT ca, name FROM locations WHERE ca = ANY($1::text[])",
            cas,
        )
    matched = [{"ca": r["ca"], "location_name": r["name"]} for r in rows]
    matched_set = {r["ca"] for r in rows}
    unmatched = sorted(set(cas) - matched_set)
    return matched, unmatched


@router.post("/upload")
async def upload_bills(
    provider: Literal["pea", "mea"] = Query(...),
    dry_run: bool = Query(False),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    data = await file.read()
    try:
        rows = _parse(provider, file.filename or "", data)
    except Exception as e:
        logger.exception("parse failed")
        raise HTTPException(400, f"parse failed: {e}")

    if not rows:
        return {
            "provider": provider,
            "file": file.filename,
            "parsed": 0,
            "matched": 0,
            "unmatched_cas": [],
            "periods": [],
            "sample": [],
            "committed": 0,
        }

    unique_cas = list({r.ca for r in rows})
    matched, unmatched = await _match_report(unique_cas)
    matched_by_ca = {m["ca"]: m["location_name"] for m in matched}

    # Group counts per billing period (useful when file spans months).
    period_counts: dict[str, int] = {}
    for r in rows:
        period_counts[r.year_month] = period_counts.get(r.year_month, 0) + 1

    sample = [
        {
            "ca": r.ca,
            "year_month": r.year_month,
            "kwh": float(r.kwh) if r.kwh is not None else None,
            "amount": float(r.amount) if r.amount is not None else None,
            "vat": float(r.vat) if r.vat is not None else None,
            "total": float(r.total),
            "invoice_no": r.invoice_no,
            "location_name": matched_by_ca.get(r.ca),
        }
        for r in rows[:10]
    ]

    committed = 0
    if not dry_run:
        pool = await get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                for r in rows:
                    await conn.execute(
                        """
                        INSERT INTO electricity_bills
                               (provider, ca, year_month, kwh, amount, vat, total,
                                invoice_no, bill_date, raw, source_file, updated_at)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,now())
                        ON CONFLICT (provider, ca, year_month) DO UPDATE SET
                            kwh = EXCLUDED.kwh,
                            amount = EXCLUDED.amount,
                            vat = EXCLUDED.vat,
                            total = EXCLUDED.total,
                            invoice_no = EXCLUDED.invoice_no,
                            bill_date = EXCLUDED.bill_date,
                            raw = EXCLUDED.raw,
                            source_file = EXCLUDED.source_file,
                            updated_at = now()
                        """,
                        r.provider, r.ca, r.year_month, r.kwh, r.amount, r.vat, r.total,
                        r.invoice_no, r.bill_date, json.dumps(r.raw, default=str),
                        r.raw.get("source") if isinstance(r.raw, dict) else None,
                    )
                    committed += 1

    return {
        "provider": provider,
        "file": file.filename,
        "parsed": len(rows),
        "matched": len(matched),
        "unmatched_cas": unmatched,
        "periods": [{"year_month": ym, "count": c} for ym, c in sorted(period_counts.items())],
        "sample": sample,
        "committed": committed,
        "dry_run": dry_run,
    }


@router.delete("")
async def clear_bills(
    year_month: str | None = Query(None),
    provider: Literal["pea", "mea"] | None = Query(None),
) -> dict[str, Any]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        if year_month and provider:
            r = await conn.execute(
                "DELETE FROM electricity_bills WHERE year_month=$1 AND provider=$2",
                year_month, provider,
            )
        elif year_month:
            r = await conn.execute("DELETE FROM electricity_bills WHERE year_month=$1", year_month)
        elif provider:
            r = await conn.execute("DELETE FROM electricity_bills WHERE provider=$1", provider)
        else:
            r = await conn.execute("TRUNCATE electricity_bills")
    return {"result": r}


@router.get("")
async def list_bills(
    year_month: str = Query(..., description="YYYY-MM"),
    provider: str | None = Query(None),
) -> dict[str, Any]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        q = """
            SELECT b.id, b.provider, b.ca, b.year_month, b.kwh, b.amount, b.vat,
                   b.total, b.invoice_no, b.bill_date,
                   l.id AS location_id, l.name AS location_name
              FROM electricity_bills b
         LEFT JOIN locations l ON l.ca = b.ca
             WHERE b.year_month = $1
        """
        args: list[Any] = [year_month]
        if provider:
            q += " AND b.provider = $2"
            args.append(provider)
        q += " ORDER BY l.name NULLS LAST, b.ca"
        rows = await conn.fetch(q, *args)

    return {
        "year_month": year_month,
        "count": len(rows),
        "rows": [
            {
                "id": str(r["id"]),
                "provider": r["provider"],
                "ca": r["ca"],
                "year_month": r["year_month"],
                "kwh": float(r["kwh"]) if r["kwh"] is not None else None,
                "amount": float(r["amount"]) if r["amount"] is not None else None,
                "vat": float(r["vat"]) if r["vat"] is not None else None,
                "total": float(r["total"]),
                "invoice_no": r["invoice_no"],
                "bill_date": r["bill_date"].isoformat() if r["bill_date"] else None,
                "location_id": str(r["location_id"]) if r["location_id"] else None,
                "location_name": r["location_name"],
            }
            for r in rows
        ],
    }
