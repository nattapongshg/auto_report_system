"""Report Generation — group-centric one-click bulk generate+email.

Flow:
    1. Operator picks a year_month + group.
    2. GET /preview resolves the latest completed snapshot for that month,
       ensures per-location inputs exist, and returns the ready-to-gen list
       (revenue/electricity/etax/share_rate pre-filled per location).
    3. Operator optionally edits email recipients (individual or bulk).
    4. POST /run fans out generate+email as a background task (same engine as
       workflow.send_bulk).
    5. Recurring batches can be saved as templates (name + group + email map)
       and rerun next month with a single POST /templates/{id}/run.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.api.workflow import (
    BulkSubmitEntry,
    DEFAULT_ETAX,
    DEFAULT_INTERNET_COST,
    _generate_and_send_task,
    _save_inputs,
    init_month,
)
from app.db.pool import get_pool
from app.engine.privilege_calc import process_rows, refresh_cache
from app.db.raw_rows import load_snapshot_rows
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/report-gen", tags=["report-gen"])


# ─── preview ────────────────────────────────────────────────────────────────


async def _resolve_snapshot(year_month: str) -> dict:
    """Pick the latest completed snapshot for a year_month (Q1144 or Q1145).
    Both are supported by the generation flow."""
    snaps = await supabase.select(
        "monthly_snapshots",
        f"year_month=eq.{year_month}&status=eq.completed"
        "&order=created_at.desc&limit=1",
    )
    if not snaps:
        raise HTTPException(404, f"No completed snapshot for {year_month}")
    return snaps[0]


@router.get("/preview")
async def preview(year_month: str, group: str | None = None) -> dict[str, Any]:
    snapshot = await _resolve_snapshot(year_month)
    snapshot_id = snapshot["id"]

    # Ensure monthly_location_inputs exist (idempotent).
    await init_month(snapshot_id)

    # Pull locations (optionally filtered by group) joined with their current
    # per-snapshot input row. Use asyncpg directly — one query vs N REST calls.
    pool = await get_pool()
    async with pool.acquire() as conn:
        q = """
            SELECT l.id, l.name, l.station_code, l.group_name, l.station_type,
                   l.share_basis, l.location_share_rate, l.transaction_fee_rate,
                   l.internet_cost, l.email_recipients, l.ca,
                   mli.id AS entry_id, mli.status, mli.electricity_cost,
                   mli.etax, mli.preview_revenue, mli.preview_kwh, mli.preview_rows,
                   mli.preview_gp, mli.preview_share,
                   mli.file_path, mli.email_sent_at
              FROM locations l
         LEFT JOIN monthly_location_inputs mli
                ON mli.location_id = l.id AND mli.snapshot_id = $1
             WHERE l.is_active = true
        """
        args: list[Any] = [snapshot_id]
        if group:
            q += " AND l.group_name = $2"
            args.append(group)
        q += " ORDER BY l.name ASC"
        rows = await conn.fetch(q, *args)

    def _f(v: Any) -> float | None:
        return float(v) if v is not None else None

    items = [
        {
            "location_id": str(r["id"]),
            "location_name": r["name"],
            "station_code": r["station_code"],
            "group_name": r["group_name"],
            "station_type": r["station_type"],
            "share_basis": r["share_basis"],
            "share_rate": _f(r["location_share_rate"]),
            "tx_fee_rate": _f(r["transaction_fee_rate"]),
            "internet_cost": _f(r["internet_cost"]) or DEFAULT_INTERNET_COST,
            "email_recipients": r["email_recipients"] or [],
            "ca": r["ca"],
            "entry_id": str(r["entry_id"]) if r["entry_id"] else None,
            "status": r["status"],
            "electricity_cost": _f(r["electricity_cost"]),
            "etax": _f(r["etax"]),
            "revenue": _f(r["preview_revenue"]),
            "kwh": _f(r["preview_kwh"]),
            "rows": r["preview_rows"],
            "gp": _f(r["preview_gp"]),
            "share": _f(r["preview_share"]),
            "file_path": r["file_path"],
            "email_sent_at": r["email_sent_at"].isoformat() if r["email_sent_at"] else None,
        }
        for r in rows
    ]

    groups_q = await conn.fetch(
        "SELECT group_name, COUNT(*) n FROM locations WHERE is_active AND group_name IS NOT NULL GROUP BY 1 ORDER BY n DESC"
    ) if False else None  # no-op placeholder to keep code simple
    # (groups list is served via /report-gen/groups below)

    return {
        "snapshot_id": snapshot_id,
        "year_month": year_month,
        "group": group,
        "count": len(items),
        "items": items,
    }


@router.get("/groups")
async def list_groups() -> dict[str, Any]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT group_name, COUNT(*) n FROM locations "
            "WHERE is_active AND group_name IS NOT NULL "
            "GROUP BY 1 ORDER BY n DESC"
        )
    return {"groups": [{"group_name": r["group_name"], "count": r["n"]} for r in rows]}


# ─── run ────────────────────────────────────────────────────────────────────


class RunEntry(BaseModel):
    location_id: str
    electricity_cost: float
    internet_cost: float | None = None
    etax: float | None = None
    emails: list[str] | None = None
    skip_email: bool = False


class RunRequest(BaseModel):
    year_month: str
    entries: list[RunEntry] = Field(default_factory=list)


@router.post("/run")
async def run(payload: RunRequest, background_tasks: BackgroundTasks) -> dict[str, Any]:
    """Generate + (optionally) email reports for the given locations."""
    if not payload.entries:
        raise HTTPException(400, "no entries to run")

    snapshot = await _resolve_snapshot(payload.year_month)
    snapshot_id = snapshot["id"]

    # Make sure entries exist for these locations.
    await init_month(snapshot_id)

    loc_ids = [e.location_id for e in payload.entries]
    ids_csv = ",".join(loc_ids)
    existing = await supabase.select(
        "monthly_location_inputs",
        f"snapshot_id=eq.{snapshot_id}&location_id=in.({ids_csv})",
    )
    by_loc = {e["location_id"]: e for e in existing}
    missing = [lid for lid in loc_ids if lid not in by_loc]
    if missing:
        raise HTTPException(404, f"no inputs for locations: {missing}")

    # Load only the target locations' rows — avoids a 175k-row scan when
    # user is generating one report.
    target_locs = {by_loc[e.location_id]["location_name"] for e in payload.entries}
    raw_rows, col_names = await load_snapshot_rows(
        snapshot_id, location_names=list(target_locs)
    )
    processed_by_loc: dict = {}
    if raw_rows:
        await refresh_cache()
        for row in await process_rows(raw_rows, col_names, None):
            loc = row.get("location_name")
            if loc in target_locs:
                processed_by_loc.setdefault(loc, []).append(row)

    loc_configs_q = await supabase.select("locations", f"id=in.({ids_csv})")
    loc_configs = {r["id"]: r for r in loc_configs_q}

    # Persist costs on each entry.
    updated = []
    email_overrides: dict[str, list[str]] = {}
    skip_emails: set[str] = set()
    for e in payload.entries:
        entry = by_loc[e.location_id]
        cfg = loc_configs.get(e.location_id, {})
        internet = e.internet_cost if e.internet_cost is not None else float(cfg.get("internet_cost") or DEFAULT_INTERNET_COST)
        etax = e.etax if e.etax is not None else float(entry.get("etax") or DEFAULT_ETAX)
        payload_entry = BulkSubmitEntry(
            entry_id=entry["id"],
            electricity_cost=e.electricity_cost,
            internet_cost=internet,
            etax=etax,
        )
        row = await _save_inputs(entry, payload_entry, processed_by_loc, loc_config=cfg)
        await supabase.update("monthly_location_inputs", f"id=eq.{row['id']}",
                              {"status": "generating"})
        updated.append(row)
        if e.emails is not None:
            email_overrides[row["id"]] = e.emails
        if e.skip_email:
            skip_emails.add(row["id"])

    background_tasks.add_task(
        _generate_and_send_task,
        snapshot_id, updated,
        email_overrides or None,
        skip_emails or None,
    )
    return {"snapshot_id": snapshot_id, "processing": len(updated)}


# ─── templates ──────────────────────────────────────────────────────────────


class Template(BaseModel):
    name: str
    group_name: str | None = None
    location_ids: list[str] = Field(default_factory=list)
    email_mapping: dict[str, list[str]] = Field(default_factory=dict)


@router.get("/templates")
async def list_templates() -> dict[str, Any]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, name, group_name, location_ids, email_mapping, created_at, updated_at "
            "FROM report_gen_templates ORDER BY updated_at DESC"
        )
    return {"items": [
        {
            "id": str(r["id"]),
            "name": r["name"],
            "group_name": r["group_name"],
            "location_ids": [str(x) for x in (r["location_ids"] or [])],
            "email_mapping": r["email_mapping"] or {},
            "created_at": r["created_at"].isoformat(),
            "updated_at": r["updated_at"].isoformat(),
        } for r in rows
    ]}


@router.post("/templates")
async def create_template(t: Template) -> dict[str, Any]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        r = await conn.fetchrow(
            """
            INSERT INTO report_gen_templates (name, group_name, location_ids, email_mapping)
            VALUES ($1, $2, $3::uuid[], $4::jsonb)
            RETURNING id
            """,
            t.name, t.group_name, t.location_ids, json.dumps(t.email_mapping),
        )
    return {"id": str(r["id"])}


@router.put("/templates/{tid}")
async def update_template(tid: str, t: Template) -> dict[str, Any]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        r = await conn.execute(
            """
            UPDATE report_gen_templates
               SET name = $2, group_name = $3, location_ids = $4::uuid[],
                   email_mapping = $5::jsonb, updated_at = now()
             WHERE id = $1
            """,
            tid, t.name, t.group_name, t.location_ids, json.dumps(t.email_mapping),
        )
    if not r.endswith(" 1"):
        raise HTTPException(404, "template not found")
    return {"updated": True}


@router.delete("/templates/{tid}")
async def delete_template(tid: str) -> dict[str, Any]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        r = await conn.execute("DELETE FROM report_gen_templates WHERE id = $1", tid)
    if not r.endswith(" 1"):
        raise HTTPException(404, "template not found")
    return {"deleted": True}
