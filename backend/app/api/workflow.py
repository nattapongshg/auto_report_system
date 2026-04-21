"""Monthly report workflow: pending_input → submitted → approved → sent."""

import logging
import os
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from app.supabase_client import supabase
from app.engine.privilege_calc import process_rows, refresh_cache
from app.engine.excel_builder import build_report
from app.engine.email_service import send_report_email
from app.db.raw_rows import load_snapshot_rows

router = APIRouter(prefix="/workflow", tags=["workflow"])

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "output")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")


# Business constants (previously duplicated inline)
TX_FEE_RATE = 0.0365
VAT_RATE = 0.07
LOCATION_SHARE_RATE = 0.40
DEFAULT_INTERNET_COST = 598
DEFAULT_ETAX = 184
ETAX_PER_DOC = 1  # THB per e-tax document (pre-VAT); final cost adds 7% VAT downstream


def _compute_preview(revenue: float, electricity: float, internet: float,
                     etax: float,
                     *, tx_fee_rate: float = TX_FEE_RATE,
                     share_rate: float = LOCATION_SHARE_RATE) -> dict:
    """Compute GP preview from revenue + costs. Single source of truth."""
    tx_fee = revenue * tx_fee_rate
    vat_on_fee = tx_fee * VAT_RATE
    total_fee = tx_fee + vat_on_fee
    internet_vat = internet * (1 + VAT_RATE)
    etax_vat = etax * (1 + VAT_RATE)
    remaining = revenue - total_fee - electricity - internet_vat - etax_vat
    share = remaining * share_rate
    return {
        "preview_revenue": round(revenue, 2),
        "preview_gp": round(remaining, 2),
        "preview_share": round(share, 2),
    }


async def _fetch_location_configs(location_ids: list[str]) -> dict[str, dict]:
    """Fetch location config rows keyed by id. Empty list returns {}."""
    if not location_ids:
        return {}
    ids_csv = ",".join(location_ids)
    rows = await supabase.select("locations", f"id=in.({ids_csv})")
    return {r["id"]: r for r in rows}


def _rates_from_config(loc_config: dict | None) -> tuple[float, float]:
    """Return (tx_fee_rate, share_rate) with sensible fallbacks."""
    if not loc_config:
        return TX_FEE_RATE, LOCATION_SHARE_RATE
    tx = loc_config.get("transaction_fee_rate")
    share = loc_config.get("location_share_rate")
    return (
        float(tx) if tx is not None else TX_FEE_RATE,
        float(share) if share is not None else LOCATION_SHARE_RATE,
    )


# ─── Initialize month ───

@router.delete("/reset/{snapshot_id}")
async def reset_snapshot_entries(snapshot_id: str):
    """Delete all entries for a snapshot. Allows re-init with current locations."""
    await supabase.delete("monthly_location_inputs", f"snapshot_id=eq.{snapshot_id}")
    return {"reset": True, "snapshot_id": snapshot_id}


@router.post("/init/{snapshot_id}")
async def init_month(snapshot_id: str):
    """Create pending entries for ALL active locations from a snapshot."""
    snapshot = await supabase.select("monthly_snapshots", f"id=eq.{snapshot_id}", single=True)
    if not snapshot or snapshot["status"] != "completed":
        raise HTTPException(400, "Snapshot not ready")

    year_month = snapshot["year_month"]

    existing = await supabase.select("monthly_location_inputs", f"snapshot_id=eq.{snapshot_id}&limit=1")
    if existing:
        items = await supabase.select(
            "monthly_location_inputs",
            f"snapshot_id=eq.{snapshot_id}&order=location_name.asc"
        )
        return {"items": items, "total": len(items)}

    locations = await supabase.select("locations", "is_report_enabled=eq.true&order=name.asc")

    loc_counts: dict[str, int] = {}
    etax_counts: dict[str, int] = {}
    loc_revenue: dict[str, float] = {}
    loc_kwh: dict[str, float] = {}

    raw_rows, col_names = await load_snapshot_rows(snapshot_id)
    if raw_rows:
        loc_idx = col_names.index("location_name")
        etax_idx = col_names.index("etax_number") if "etax_number" in col_names else None
        kwh_idx = col_names.index("kwh") if "kwh" in col_names else None
        for r in raw_rows:
            loc = r[loc_idx]
            if not loc:
                continue
            kwh_val = float(r[kwh_idx] or 0) if kwh_idx is not None else 1.0
            if kwh_val <= 0:
                continue  # skip 0-kWh rows for both row_count AND etax_count
            loc_counts[loc] = loc_counts.get(loc, 0) + 1
            if etax_idx is not None and r[etax_idx]:
                etax_counts[loc] = etax_counts.get(loc, 0) + 1

        # Compute per-location revenue + kwh using privilege logic (accurate preview)
        await refresh_cache()
        all_processed = await process_rows(raw_rows, col_names, None)
        for row in all_processed:
            loc = row.get("location_name")
            if not loc:
                continue
            loc_revenue[loc] = loc_revenue.get(loc, 0.0) + float(row.get("_revenue", 0) or 0)
            loc_kwh[loc] = loc_kwh.get(loc, 0.0) + float(row.get("kwh", 0) or 0)

    rows_to_insert = []
    for loc in locations:
        row_count = loc_counts.get(loc["name"], 0)
        etax_count = etax_counts.get(loc["name"], 0)
        etax_value = etax_count * ETAX_PER_DOC if etax_count else (loc.get("etax") or DEFAULT_ETAX)
        rows_to_insert.append({
            "snapshot_id": snapshot_id,
            "location_id": loc["id"],
            "location_name": loc["name"],
            "year_month": year_month,
            "status": "pending",
            "electricity_cost": loc.get("electricity_cost") or 0,
            "internet_cost": loc.get("internet_cost") or DEFAULT_INTERNET_COST,
            "etax": etax_value,
            "preview_rows": row_count,
            "preview_revenue": round(loc_revenue.get(loc["name"], 0.0), 2),
            "preview_kwh": round(loc_kwh.get(loc["name"], 0.0), 2),
        })

    # Batch insert in chunks of 200 to stay under request size limits
    created = []
    for i in range(0, len(rows_to_insert), 200):
        chunk = rows_to_insert[i:i + 200]
        created.extend(await supabase.insert_many("monthly_location_inputs", chunk))

    return {"items": created, "total": len(created)}


# ─── List entries ───

@router.get("/{snapshot_id}")
async def list_entries(snapshot_id: str, status: str | None = None):
    params = f"snapshot_id=eq.{snapshot_id}&order=location_name.asc"
    if status:
        params += f"&status=eq.{status}"
    items = await supabase.select("monthly_location_inputs", params)

    # Stats
    statuses = {}
    for item in items:
        s = item["status"]
        statuses[s] = statuses.get(s, 0) + 1

    return {"items": items, "total": len(items), "stats": statuses}


# ─── Submit inputs ───

class SubmitInputs(BaseModel):
    electricity_cost: float
    internet_cost: float = DEFAULT_INTERNET_COST
    etax: float = DEFAULT_ETAX
    bill_image_url: str | None = None
    email_recipients: list[str] | None = None  # override locations.email_recipients for this send
    skip_email: bool = False  # generate file only, don't send email


class BulkSubmitEntry(BaseModel):
    entry_id: str
    electricity_cost: float
    internet_cost: float = DEFAULT_INTERNET_COST
    etax: float = DEFAULT_ETAX
    bill_image_url: str | None = None
    email_recipients: list[str] | None = None


class BulkSubmitRequest(BaseModel):
    entries: list[BulkSubmitEntry]


async def _save_inputs(entry: dict, payload: SubmitInputs | BulkSubmitEntry,
                       processed_by_loc: dict,
                       loc_config: dict | None = None) -> dict:
    """Save costs + compute preview. Status stays 'pending'. Returns updated row."""
    loc_name = entry["location_name"]
    processed = processed_by_loc.get(loc_name, [])
    tx_rate, share_rate = _rates_from_config(loc_config)

    preview = {"preview_rows": len(processed)}
    if processed:
        revenue = sum(float(r.get("_revenue", 0)) for r in processed)
        total_kwh = sum(float(r.get("kwh", 0)) for r in processed)
        preview["preview_kwh"] = round(total_kwh, 2)
        preview.update(_compute_preview(
            revenue,
            payload.electricity_cost,
            payload.internet_cost,
            payload.etax,
            tx_fee_rate=tx_rate,
            share_rate=share_rate,
        ))

    update = {
        "electricity_cost": payload.electricity_cost,
        "internet_cost": payload.internet_cost,
        "etax": payload.etax,
        "bill_image_url": payload.bill_image_url,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        **preview,
    }

    return await supabase.update("monthly_location_inputs", f"id=eq.{entry['id']}", update)


async def _load_snapshot_data(snapshot_id: str) -> tuple[dict, list, list]:
    """Load snapshot + raw rows + col names. Returns (snapshot, rows, cols).

    Rows come from `metabase_rows` (was on-disk JSON before).
    """
    snapshot = await supabase.select("monthly_snapshots", f"id=eq.{snapshot_id}", single=True)
    if not snapshot:
        raise HTTPException(404, "Snapshot not found")
    rows, cols = await load_snapshot_rows(snapshot_id)
    return snapshot, rows, cols


@router.put("/{snapshot_id}/save/{entry_id}")
async def save_inputs(snapshot_id: str, entry_id: str, payload: SubmitInputs):
    """Save costs for a single entry without generating."""
    entry = await supabase.select("monthly_location_inputs", f"id=eq.{entry_id}", single=True)
    if not entry:
        raise HTTPException(404, "Entry not found")

    _, raw_rows, col_names = await _load_snapshot_data(snapshot_id)
    processed_by_loc = {}
    if raw_rows:
        await refresh_cache()
        processed = await process_rows(raw_rows, col_names, entry["location_name"])
        processed_by_loc[entry["location_name"]] = processed

    loc_configs = await _fetch_location_configs([entry["location_id"]])
    loc_config = loc_configs.get(entry["location_id"])
    return await _save_inputs(entry, payload, processed_by_loc, loc_config=loc_config)


@router.post("/{snapshot_id}/send/{entry_id}")
async def send_single(snapshot_id: str, entry_id: str, payload: SubmitInputs,
                      background_tasks: BackgroundTasks):
    """Save costs + generate Excel + send email for ONE location."""
    entry = await supabase.select("monthly_location_inputs", f"id=eq.{entry_id}", single=True)
    if not entry:
        raise HTTPException(404, "Entry not found")

    _, raw_rows, col_names = await _load_snapshot_data(snapshot_id)
    processed_by_loc = {}
    if raw_rows:
        await refresh_cache()
        processed = await process_rows(raw_rows, col_names, entry["location_name"])
        processed_by_loc[entry["location_name"]] = processed

    loc_configs = await _fetch_location_configs([entry["location_id"]])
    loc_config = loc_configs.get(entry["location_id"])
    entry = await _save_inputs(entry, payload, processed_by_loc, loc_config=loc_config)

    await supabase.update("monthly_location_inputs", f"id=eq.{entry_id}",
                          {"status": "generating"})

    overrides = {entry["id"]: payload.email_recipients} if payload.email_recipients is not None else None
    skip_emails = {entry["id"]} if payload.skip_email else None
    background_tasks.add_task(_generate_and_send_task, snapshot_id, [entry], overrides, skip_emails)
    return {"processing": True, "entry_id": entry_id, "skip_email": payload.skip_email}


@router.post("/{snapshot_id}/send-bulk")
async def send_bulk(snapshot_id: str, payload: BulkSubmitRequest,
                    background_tasks: BackgroundTasks):
    """Save costs + generate + send email for multiple entries in one batch."""
    if not payload.entries:
        raise HTTPException(400, "No entries provided")

    entry_ids = [e.entry_id for e in payload.entries]
    ids_csv = ",".join(entry_ids)
    existing = await supabase.select(
        "monthly_location_inputs",
        f"snapshot_id=eq.{snapshot_id}&id=in.({ids_csv})"
    )
    existing_by_id = {e["id"]: e for e in existing}
    missing = [eid for eid in entry_ids if eid not in existing_by_id]
    if missing:
        raise HTTPException(404, f"Entries not found: {missing}")

    _, raw_rows, col_names = await _load_snapshot_data(snapshot_id)
    processed_by_loc: dict = {}
    if raw_rows:
        await refresh_cache()
        target_locs = {existing_by_id[e.entry_id]["location_name"] for e in payload.entries}
        all_processed = await process_rows(raw_rows, col_names, None)
        for row in all_processed:
            loc = row.get("location_name")
            if loc in target_locs:
                processed_by_loc.setdefault(loc, []).append(row)

    loc_ids = list({existing_by_id[e.entry_id]["location_id"] for e in payload.entries})
    loc_configs = await _fetch_location_configs(loc_ids)

    updated = []
    for sub in payload.entries:
        entry = existing_by_id[sub.entry_id]
        loc_config = loc_configs.get(entry["location_id"])
        row = await _save_inputs(entry, sub, processed_by_loc, loc_config=loc_config)
        await supabase.update("monthly_location_inputs", f"id=eq.{row['id']}",
                              {"status": "generating"})
        updated.append(row)

    background_tasks.add_task(_generate_and_send_task, snapshot_id, updated)
    return {"processing": len(updated)}


async def _generate_and_send_task(snapshot_id: str, items: list,
                                  email_overrides: dict[str, list[str]] | None = None,
                                  skip_emails: set[str] | None = None):
    snapshot = await supabase.select("monthly_snapshots", f"id=eq.{snapshot_id}", single=True)
    year_month = snapshot["year_month"]

    raw_rows, col_names = await load_snapshot_rows(snapshot_id)

    await refresh_cache()

    # Process + group rows by location in a single pass.
    target_locs = {item["location_name"] for item in items}
    all_processed = await process_rows(raw_rows, col_names, None)
    processed_by_loc: dict = {}
    for row in all_processed:
        loc = row.get("location_name")
        if loc in target_locs:
            processed_by_loc.setdefault(loc, []).append(row)

    # Fetch all location configs upfront (one DB round-trip)
    loc_configs = await _fetch_location_configs(list({i["location_id"] for i in items}))

    for item in items:
        loc_name = item["location_name"]
        try:
            await supabase.update("monthly_location_inputs", f"id=eq.{item['id']}", {"status": "generating"})

            processed = processed_by_loc.get(loc_name, [])

            if not processed:
                await supabase.update("monthly_location_inputs", f"id=eq.{item['id']}", {
                    "status": "sent", "preview_rows": 0,
                })
                continue

            # Get bill image
            bill_path = None
            if item.get("bill_image_url"):
                local = os.path.join(os.path.dirname(__file__), "..", "..", "uploads",
                                     os.path.basename(item["bill_image_url"]))
                if os.path.exists(local):
                    bill_path = local

            loc_config = loc_configs.get(item["location_id"])
            tx_rate, share_rate = _rates_from_config(loc_config)

            manual_inputs = {
                "date_start": f"{year_month}-01",
                "date_end": f"{year_month}-28",
                "electricity_cost": float(item.get("electricity_cost") or 0),
                "internet_cost": float(item.get("internet_cost") or DEFAULT_INTERNET_COST),
                "etax": float(item.get("etax") or DEFAULT_ETAX),
                "transaction_fee_rate": tx_rate,
                "location_share_rate": share_rate,
            }

            excel_bytes = build_report(
                rows=processed,
                location_name=loc_name,
                manual_inputs=manual_inputs,
                bill_image_path=bill_path,
            )

            safe_name = loc_name.replace(" ", "_").replace("/", "_")[:50]
            filename = f"{safe_name}_{year_month}.xlsx"
            output_path = os.path.join(OUTPUT_DIR, filename)

            with open(output_path, "wb") as f:
                f.write(excel_bytes.read())
            file_size = os.path.getsize(output_path)

            # Send email — prefer per-request override, fallback to location config
            skip_email = skip_emails is not None and item["id"] in skip_emails
            override = (email_overrides or {}).get(item["id"]) if email_overrides else None
            recipients = override if override is not None else ((loc_config or {}).get("email_recipients") or [])

            email_sent = None
            email_error = None
            if recipients and not skip_email:
                # Build summary to embed in the email body (matches Excel Summary sheet)
                revenue = sum(float(r.get("_revenue", 0)) for r in processed)
                tx_fee = revenue * tx_rate
                vat_on_fee = tx_fee * VAT_RATE
                total_fee = tx_fee + vat_on_fee
                internet_incl_vat = manual_inputs["internet_cost"] * (1 + VAT_RATE)
                etax_incl_vat = manual_inputs["etax"] * (1 + VAT_RATE)
                remaining = (revenue - total_fee - manual_inputs["electricity_cost"]
                             - internet_incl_vat - etax_incl_vat)
                location_share = remaining * share_rate
                before_vat = location_share / (1 + VAT_RATE)
                vat_portion = location_share - before_vat

                email_summary = {
                    "revenue": revenue,
                    "tx_fee_rate": tx_rate,
                    "vat_rate": VAT_RATE,
                    "location_share_rate": share_rate,
                    "tx_fee": tx_fee,
                    "vat_on_fee": vat_on_fee,
                    "total_fee": total_fee,
                    "electricity_cost": manual_inputs["electricity_cost"],
                    "internet_cost": manual_inputs["internet_cost"],
                    "internet_incl_vat": internet_incl_vat,
                    "etax": manual_inputs["etax"],
                    "etax_incl_vat": etax_incl_vat,
                    "remaining": remaining,
                    "location_share": location_share,
                    "vat_portion": vat_portion,
                    "before_vat": before_vat,
                }

                result = send_report_email(
                    to=recipients,
                    location_name=loc_name,
                    year_month=year_month,
                    file_path=output_path,
                    file_name=filename,
                    summary=email_summary,
                )
                if result.get("status") == "sent":
                    email_sent = datetime.now(timezone.utc).isoformat()
                else:
                    email_error = result.get("error") or "Email provider rejected the send"

            # If recipients configured + not skipped + email failed → status = failed
            final_status = "failed" if (recipients and not skip_email and not email_sent) else "sent"
            update_data = {
                "status": final_status,
                "file_name": filename,
                "file_path": output_path,
                "file_size_bytes": file_size,
                "email_sent_at": email_sent,
            }
            if email_error:
                update_data["email_error"] = email_error
            await supabase.update("monthly_location_inputs", f"id=eq.{item['id']}", update_data)
            logger.info("%s: %s (%d rows)", loc_name, final_status, len(processed))

        except Exception as e:
            await supabase.update("monthly_location_inputs", f"id=eq.{item['id']}", {
                "status": "failed",
                "email_error": str(e),
            })
            logger.exception("%s: generate failed", loc_name)


async def _run_schedule_for_snapshot(sched: dict, snapshot: dict) -> dict:
    """Invoked by the scheduler. Ensures entries exist, fills defaults from locations,
    and dispatches generate-and-send for the schedule's location_ids.

    Returns {status: success|partial|failed, detail: {...}}.
    """
    snapshot_id = snapshot["id"]
    location_ids: list[str] = sched.get("location_ids") or []
    if not location_ids:
        return {"status": "failed", "detail": {"error": "no locations"}}

    # Ensure entries exist for this snapshot (call init which is idempotent)
    await init_month(snapshot_id)  # noqa — uses global `supabase`

    # Fetch entries for requested locations
    ids_csv = ",".join(location_ids)
    entries = await supabase.select(
        "monthly_location_inputs",
        f"snapshot_id=eq.{snapshot_id}&location_id=in.({ids_csv})",
    )
    if not entries:
        return {"status": "failed", "detail": {"error": "no entries for configured locations"}}

    # Fill electricity from locations (fallback 0 → skip)
    loc_configs = await _fetch_location_configs(location_ids)

    skipped = []
    to_send: list[BulkSubmitEntry] = []
    for e in entries:
        cfg = loc_configs.get(e["location_id"], {})
        elec = float(cfg.get("electricity_cost") or 0)
        if elec <= 0:
            skipped.append({"location": e["location_name"], "reason": "no electricity_cost in location config"})
            continue
        to_send.append(BulkSubmitEntry(
            entry_id=e["id"],
            electricity_cost=elec,
            internet_cost=float(cfg.get("internet_cost") or DEFAULT_INTERNET_COST),
            etax=float(e.get("etax") or DEFAULT_ETAX),
        ))

    if not to_send:
        return {"status": "failed", "detail": {"skipped": skipped, "sent": 0}}

    # Reuse bulk logic directly (no background_tasks here — we're already in a task)
    _, raw_rows, col_names = await _load_snapshot_data(snapshot_id)
    processed_by_loc: dict = {}
    if raw_rows:
        await refresh_cache()
        target_locs = {e["location_name"] for e in entries}
        all_processed = await process_rows(raw_rows, col_names, None)
        for row in all_processed:
            loc = row.get("location_name")
            if loc in target_locs:
                processed_by_loc.setdefault(loc, []).append(row)

    entries_by_id = {e["id"]: e for e in entries}
    saved = []
    for sub in to_send:
        ent = entries_by_id[sub.entry_id]
        loc_config = loc_configs.get(ent["location_id"])
        row = await _save_inputs(ent, sub, processed_by_loc, loc_config=loc_config)
        await supabase.update("monthly_location_inputs", f"id=eq.{row['id']}",
                              {"status": "generating"})
        saved.append(row)

    # Run generate+send synchronously in this task so last_run_status reflects reality
    await _generate_and_send_task(snapshot_id, saved)

    # Fetch final statuses
    ids = ",".join(r["id"] for r in saved)
    final = await supabase.select(
        "monthly_location_inputs",
        f"id=in.({ids})&select=id,status,location_name,email_error"
    )
    sent = sum(1 for f in final if f["status"] == "sent")
    failed = [f for f in final if f["status"] == "failed"]

    detail = {
        "snapshot": snapshot["year_month"],
        "sent": sent,
        "failed": len(failed),
        "skipped": skipped,
        "errors": [{"location": f["location_name"], "error": f.get("email_error")} for f in failed],
    }
    if failed and sent == 0:
        status = "failed"
    elif failed or skipped:
        status = "partial"
    else:
        status = "success"
    return {"status": status, "detail": detail}
