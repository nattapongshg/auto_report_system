from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.supabase_client import supabase
from app.engine.privilege_calc import refresh_cache

router = APIRouter(prefix="/privileges", tags=["privileges"])


class PrivilegeCreate(BaseModel):
    privilege_program_name: str
    discount_label: str | None = None
    privilege_type: str = "credit"  # credit | percent | mixed
    share_rate: float | None = None
    notes: str | None = None


class PrivilegeUpdate(BaseModel):
    privilege_program_name: str | None = None
    discount_label: str | None = None
    privilege_type: str | None = None
    share_rate: float | None = None
    notes: str | None = None
    is_active: bool | None = None


@router.get("")
async def list_privileges(privilege_type: str | None = None):
    params = "select=*&order=privilege_program_name.asc,discount_label.asc"
    if privilege_type:
        params += f"&privilege_type=eq.{privilege_type}"
    items = await supabase.select("privilege_configs", params)
    return {"items": items, "total": len(items)}


@router.post("", status_code=201)
async def create_privilege(payload: PrivilegeCreate):
    data = payload.model_dump(exclude_unset=True)
    row = await supabase.insert("privilege_configs", data)
    await refresh_cache()
    return row


@router.get("/{privilege_id}")
async def get_privilege(privilege_id: str):
    row = await supabase.select("privilege_configs", f"id=eq.{privilege_id}", single=True)
    if not row:
        raise HTTPException(404, "Privilege config not found")
    return row


@router.put("/{privilege_id}")
async def update_privilege(privilege_id: str, payload: PrivilegeUpdate):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(400, "Nothing to update")
    row = await supabase.update("privilege_configs", f"id=eq.{privilege_id}", data)
    if not row:
        raise HTTPException(404, "Privilege config not found")
    await refresh_cache()
    return row


@router.delete("/{privilege_id}", status_code=204)
async def delete_privilege(privilege_id: str):
    await supabase.delete("privilege_configs", f"id=eq.{privilege_id}")
    await refresh_cache()


# ─── group-rate overrides ───────────────────────────────────────────────────
# Per-location-group rate override. Example: Mercedes Free charging defaults
# to 7.2/kWh, but sessions at Shell gas stations bill Mercedes at 9.0/kWh.

class GroupRate(BaseModel):
    group_name: str
    share_rate: float
    notes: str | None = None


@router.get("/group-rates/all")
async def list_all_group_rates():
    """All overrides across every privilege — batched so the UI can render
    inline chips on the privilege list without N per-row requests."""
    items = await supabase.select("privilege_group_rates", "select=*&order=group_name.asc")
    return {"items": items, "total": len(items)}


@router.get("/{privilege_id}/group-rates")
async def list_group_rates(privilege_id: str):
    items = await supabase.select(
        "privilege_group_rates",
        f"privilege_config_id=eq.{privilege_id}&order=group_name.asc",
    )
    return {"items": items, "total": len(items)}


@router.post("/{privilege_id}/group-rates", status_code=201)
async def create_group_rate(privilege_id: str, payload: GroupRate):
    data = payload.model_dump(exclude_unset=True)
    data["privilege_config_id"] = privilege_id
    row = await supabase.insert("privilege_group_rates", data)
    await refresh_cache()
    return row


@router.put("/{privilege_id}/group-rates/{override_id}")
async def update_group_rate(privilege_id: str, override_id: str, payload: GroupRate):
    data = payload.model_dump(exclude_unset=True)
    row = await supabase.update(
        "privilege_group_rates",
        f"id=eq.{override_id}&privilege_config_id=eq.{privilege_id}",
        data,
    )
    if not row:
        raise HTTPException(404, "Override not found")
    await refresh_cache()
    return row


@router.delete("/{privilege_id}/group-rates/{override_id}", status_code=204)
async def delete_group_rate(privilege_id: str, override_id: str):
    await supabase.delete(
        "privilege_group_rates",
        f"id=eq.{override_id}&privilege_config_id=eq.{privilege_id}",
    )
    await refresh_cache()
