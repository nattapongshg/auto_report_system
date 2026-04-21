"""Fetch data from Metabase with adaptive time-window splitting to bypass 2000-row limit."""

import asyncio
import httpx
from datetime import datetime, timedelta

from app.config import settings


async def fetch_window(
    question_id: int,
    start: str,
    end: str,
    params: list[dict] | None = None,
) -> tuple[list[list], list[dict] | None]:
    """Fetch a single time window. Returns (rows, cols_meta)."""
    # Build parameters - replace date values with current window's start/end
    parameters = []
    if params:
        for p in params:
            # Detect if this is start or end param from target tag name
            tag_name = ""
            try:
                tag_name = p.get("target", [[], ["", ""]])[1][1].lower()
            except (IndexError, TypeError):
                pass
            is_start = "start" in tag_name or "start" in p.get("slug", "").lower()
            param = {"type": p.get("type", "date/single"), "target": p["target"], "value": start if is_start else end}
            if "id" in p:
                param["id"] = p["id"]
            parameters.append(param)
    else:
        parameters = [
            {"type": "date/single", "target": ["variable", ["template-tag", "PaidDate_start"]], "value": start},
            {"type": "date/single", "target": ["variable", ["template-tag", "PaidDate_end"]], "value": end},
        ]

    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(
            f"{settings.metabase_base_url}/api/card/{question_id}/query",
            headers={"x-api-key": settings.metabase_api_key, "Content-Type": "application/json"},
            json={"parameters": parameters},
        )
        data = resp.json()

    if data.get("status") != "completed":
        return [], None

    rows = data.get("data", {}).get("rows", [])
    cols = data.get("data", {}).get("cols")
    return rows, cols


async def fetch_adaptive(
    question_id: int,
    start: str,
    end: str,
    params: list[dict] | None = None,
    on_progress: callable = None,
) -> tuple[list[list], list[dict]]:
    """Fetch with adaptive splitting when hitting 2000-row limit."""
    rows, cols = await fetch_window(question_id, start, end, params)
    await asyncio.sleep(0.3)

    if len(rows) < 2000:
        if on_progress:
            on_progress(f"{start} -> {end}: {len(rows)} rows")
        return rows, cols

    # Split in half
    dt_s = datetime.fromisoformat(start)
    dt_e = datetime.fromisoformat(end)
    dt_m = dt_s + (dt_e - dt_s) / 2
    dt_m = dt_m.replace(second=0, microsecond=0)
    mid = dt_m.strftime("%Y-%m-%dT%H:%M:%S")

    if dt_m <= dt_s or dt_m >= dt_e:
        if on_progress:
            on_progress(f"[WARN] Cannot split {start}->{end}: {len(rows)} rows")
        return rows, cols

    if on_progress:
        on_progress(f"[SPLIT] {start}->{end} at {mid}")

    rows_a, cols_a = await fetch_adaptive(question_id, start, mid, params, on_progress)
    rows_b, cols_b = await fetch_adaptive(question_id, mid, end, params, on_progress)
    return rows_a + rows_b, cols_a or cols_b


async def fetch_date_range(
    question_id: int,
    date_start: str,
    date_end: str,
    params: list[dict] | None = None,
    on_progress: callable = None,
) -> tuple[list[list], list[str]]:
    """Fetch full date range by splitting into 6-hour windows with adaptive sub-splitting."""
    from datetime import date as date_type

    all_rows = []
    col_names = None

    current = datetime.fromisoformat(date_start).date() if "T" not in date_start else datetime.fromisoformat(date_start).date()
    end_date = datetime.fromisoformat(date_end).date() if "T" not in date_end else datetime.fromisoformat(date_end).date()

    while current <= end_date:
        d = current.isoformat()
        d_next = (current + timedelta(days=1)).isoformat()

        windows = [
            (f"{d}T00:00:00", f"{d}T06:00:00"),
            (f"{d}T06:00:00", f"{d}T12:00:00"),
            (f"{d}T12:00:00", f"{d}T18:00:00"),
            (f"{d}T18:00:00", f"{d_next}T00:00:00"),
        ]

        day_total = 0
        for ws, we in windows:
            rows, cols_meta = await fetch_adaptive(question_id, ws, we, params, on_progress)
            if col_names is None and cols_meta:
                col_names = [c["name"] for c in cols_meta]
            all_rows.extend(rows)
            day_total += len(rows)

        if on_progress:
            on_progress(f"{d}: {day_total} rows (total: {len(all_rows)})")

        current += timedelta(days=1)

    return all_rows, col_names or []
