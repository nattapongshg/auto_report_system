"""Report schedules — recurring auto generate+send by day of month."""

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.supabase_client import supabase

router = APIRouter(prefix="/schedules", tags=["schedules"])


class ScheduleCreate(BaseModel):
    name: str
    location_ids: list[str] = Field(default_factory=list)
    trigger_day: int = Field(ge=1, le=28)
    is_active: bool = True


class ScheduleUpdate(BaseModel):
    name: str | None = None
    location_ids: list[str] | None = None
    trigger_day: int | None = Field(default=None, ge=1, le=28)
    is_active: bool | None = None


@router.get("")
async def list_schedules():
    items = await supabase.select("report_schedules", "select=*&order=trigger_day.asc,name.asc")
    return {"items": items, "total": len(items)}


@router.post("", status_code=201)
async def create_schedule(payload: ScheduleCreate):
    row = await supabase.insert("report_schedules", payload.model_dump())
    return row


@router.get("/{schedule_id}")
async def get_schedule(schedule_id: str):
    row = await supabase.select("report_schedules", f"id=eq.{schedule_id}", single=True)
    if not row:
        raise HTTPException(404, "Schedule not found")
    return row


@router.put("/{schedule_id}")
async def update_schedule(schedule_id: str, payload: ScheduleUpdate):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(400, "Nothing to update")
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    row = await supabase.update("report_schedules", f"id=eq.{schedule_id}", data)
    if not row:
        raise HTTPException(404, "Schedule not found")
    return row


@router.delete("/{schedule_id}", status_code=204)
async def delete_schedule(schedule_id: str):
    await supabase.delete("report_schedules", f"id=eq.{schedule_id}")


@router.post("/{schedule_id}/run")
async def run_schedule_now(schedule_id: str, background_tasks: BackgroundTasks):
    """Trigger a schedule manually against the latest completed snapshot.

    Resolves: latest snapshot (by year_month desc) → init entries if missing →
    for each location_id in schedule, save defaults + dispatch send-bulk task.
    Electricity cost is taken from locations.electricity_cost (must be pre-filled).
    """
    sched = await supabase.select("report_schedules", f"id=eq.{schedule_id}", single=True)
    if not sched:
        raise HTTPException(404, "Schedule not found")
    if not sched.get("location_ids"):
        raise HTTPException(400, "Schedule has no locations")

    snapshot = await supabase.select(
        "monthly_snapshots",
        "status=eq.completed&order=year_month.desc&limit=1",
        single=False,
    )
    if not snapshot:
        raise HTTPException(400, "No completed snapshot available")
    snap = snapshot[0]

    background_tasks.add_task(_run_schedule_task, sched, snap)
    return {"scheduled": True, "schedule_id": schedule_id, "snapshot": snap["year_month"]}


async def _run_schedule_task(sched: dict, snap: dict):
    """Run one schedule: init entries if needed, fill defaults from locations,
    send-bulk for the configured location_ids."""
    from app.api.workflow import _run_schedule_for_snapshot

    result = await _run_schedule_for_snapshot(sched, snap)
    await supabase.update("report_schedules", f"id=eq.{sched['id']}", {
        "last_run_at": datetime.now(timezone.utc).isoformat(),
        "last_run_status": result["status"],
        "last_run_detail": result["detail"],
    })
