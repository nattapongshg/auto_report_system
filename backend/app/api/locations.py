from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.supabase_client import supabase

router = APIRouter(prefix="/locations", tags=["locations"])


# Fields exposed to the monthly-report config UI
_CONFIG_FIELDS = (
    "id,name,station_code,is_active,is_report_enabled,"
    "location_share_rate,transaction_fee_rate,"
    "electricity_cost,internet_cost,etax,"
    "email_recipients,group_name"
)


class LocationUpdate(BaseModel):
    is_report_enabled: bool | None = None
    location_share_rate: float | None = None
    transaction_fee_rate: float | None = None
    electricity_cost: float | None = None
    internet_cost: float | None = None
    etax: float | None = None
    email_recipients: list[str] | None = None
    group_name: str | None = None


@router.get("")
async def list_locations(report_enabled: bool | None = None):
    """List locations with their monthly-report config fields."""
    params = f"select={_CONFIG_FIELDS}&is_active=eq.true&order=name.asc"
    if report_enabled is not None:
        params += f"&is_report_enabled=eq.{str(report_enabled).lower()}"
    items = await supabase.select("locations", params)
    return {"items": items, "total": len(items)}


@router.put("/{location_id}")
async def update_location(location_id: str, payload: LocationUpdate):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(400, "Nothing to update")
    row = await supabase.update("locations", f"id=eq.{location_id}", data)
    if not row:
        raise HTTPException(404, "Location not found")
    return row
