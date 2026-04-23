"""Report Summary Template CRUD + formula preview."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.engine.template_engine import build_context, safe_eval, render_text
from app.engine.template_repo import refresh_cache
from app.supabase_client import supabase

router = APIRouter(prefix="/report-templates", tags=["report-templates"])


class TemplateCreate(BaseModel):
    code: str
    name: str
    description: str | None = None
    share_basis: str = "gp"  # gp | revenue
    layout_style: str = "standard"  # standard | dealer
    params: dict[str, Any] = {}
    summary_layout: list[dict[str, Any]] = []
    is_default_for_group: str | None = None


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    share_basis: str | None = None
    layout_style: str | None = None
    params: dict[str, Any] | None = None
    summary_layout: list[dict[str, Any]] | None = None
    is_default_for_group: str | None = None


class PreviewRequest(BaseModel):
    template: TemplateCreate
    revenue: float = 15000
    electricity_cost: float = 500
    internet_cost: float = 598
    etax: float = 5
    location_share_rate: float = 0.40
    evse_count: int = 1
    location_name: str = "Sample Location"


@router.get("")
async def list_templates():
    rows = await supabase.select("report_layout_templates", "select=*&order=code.asc")
    return {"items": rows or [], "total": len(rows or [])}


@router.post("", status_code=201)
async def create_template(payload: TemplateCreate):
    data = payload.model_dump(exclude_unset=True)
    row = await supabase.insert("report_layout_templates", data)
    await refresh_cache()
    return row


@router.get("/{template_id}")
async def get_template(template_id: str):
    row = await supabase.select("report_layout_templates", f"id=eq.{template_id}", single=True)
    if not row:
        raise HTTPException(404, "Template not found")
    return row


@router.put("/{template_id}")
async def update_template(template_id: str, payload: TemplateUpdate):
    existing = await supabase.select("report_layout_templates", f"id=eq.{template_id}", single=True)
    if not existing:
        raise HTTPException(404, "Template not found")
    if existing.get("is_builtin"):
        # Allow editing params / summary_layout / description on builtins,
        # but don't allow renaming the code or flipping group assignment.
        data = payload.model_dump(exclude_unset=True)
        data.pop("is_default_for_group", None)
    else:
        data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(400, "Nothing to update")
    row = await supabase.update("report_layout_templates", f"id=eq.{template_id}", data)
    await refresh_cache()
    return row


@router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: str):
    existing = await supabase.select("report_layout_templates", f"id=eq.{template_id}", single=True)
    if not existing:
        raise HTTPException(404, "Template not found")
    if existing.get("is_builtin"):
        raise HTTPException(400, "Cannot delete built-in template")
    await supabase.delete("report_layout_templates", f"id=eq.{template_id}")
    await refresh_cache()


@router.post("/preview")
async def preview_template(payload: PreviewRequest):
    """Dry-run: evaluate each summary_layout row against sample inputs and return
    rendered labels + values. Lets the UI show a live preview while editing
    formulas without actually generating an Excel file."""
    tpl = payload.template
    params = tpl.params or {}
    share_basis = tpl.share_basis or "gp"

    ctx = build_context(
        revenue=payload.revenue,
        manual_inputs={
            "location_share_rate": payload.location_share_rate,
            "electricity_cost": payload.electricity_cost,
            "internet_cost": payload.internet_cost,
            "etax": payload.etax,
            "evse_count": payload.evse_count,
        },
        location_name=payload.location_name,
        params=params,
        share_basis=share_basis,
    )

    out: list[dict] = []
    for row_cfg in (tpl.summary_layout or []):
        entry = {
            "row": row_cfg.get("row"),
            "kind": row_cfg.get("kind") or "default",
            "label": render_text(row_cfg.get("label"), ctx),
            "note": render_text(row_cfg.get("note"), ctx),
            "value": None,
            "error": None,
        }
        expr = row_cfg.get("value")
        if expr:
            try:
                entry["value"] = safe_eval(expr, ctx)
            except Exception as e:
                entry["error"] = str(e)
        for k in ("fill", "bold", "border"):
            if row_cfg.get(k) is not None:
                entry[k] = row_cfg[k]
        out.append(entry)

    return {"rows": out, "context": {k: v for k, v in ctx.items() if not callable(v)}}
