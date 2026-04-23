"""Load report_layout_templates. In-memory cache; refresh after writes."""
from __future__ import annotations

from typing import Any

from app.supabase_client import supabase


_cache: dict[str, Any] | None = None


async def _load_all() -> dict[str, Any]:
    rows = await supabase.select("report_layout_templates", "select=*&order=code.asc")
    by_id = {r["id"]: r for r in (rows or [])}
    by_code = {r["code"]: r for r in (rows or [])}
    by_group = {r["is_default_for_group"]: r for r in (rows or []) if r.get("is_default_for_group")}
    return {"by_id": by_id, "by_code": by_code, "by_group": by_group, "all": list(rows or [])}


async def get_cache() -> dict[str, Any]:
    global _cache
    if _cache is None:
        _cache = await _load_all()
    return _cache


async def refresh_cache() -> None:
    global _cache
    _cache = await _load_all()


async def resolve_for_location(location_cfg: dict | None, group_name: str | None) -> dict | None:
    """Pick template for a location.

    Precedence:
      1. locations.report_layout_template_id  (per-location override)
      2. report_layout_templates.is_default_for_group = group_name
      3. code='standard_gp' fallback
    """
    cache = await get_cache()
    tpl_id = (location_cfg or {}).get("report_layout_template_id")
    if tpl_id and tpl_id in cache["by_id"]:
        return cache["by_id"][tpl_id]
    if group_name and group_name in cache["by_group"]:
        return cache["by_group"][group_name]
    return cache["by_code"].get("standard_gp")
