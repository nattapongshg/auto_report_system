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
