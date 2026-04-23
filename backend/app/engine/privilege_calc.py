"""Calculate revenue per row based on privilege_configs from Supabase."""

from app.supabase_client import supabase

# Business rule: at these location groups, privileges always resolve to NULL
# rate (Sharge's arrangement with the group is settled out-of-band, so
# per-session privilege revenue shouldn't double-count for the location).
GROUPS_WITH_NULL_PRIVILEGE = {"shell"}

# In-memory cache
_privilege_cache: dict[str, dict] | None = None
# Group-rate overrides: {privilege_config_id: {group_name: share_rate}}
_group_rate_cache: dict[str, dict[str, float]] | None = None
# locations.name → group_name (for resolving group per row)
_location_group_cache: dict[str, str] | None = None


async def load_privilege_configs() -> dict[str, dict]:
    """Load all privilege configs. Returns dict with two key namespaces:
    - items keyed by privilege_program_name (primary)
    - items keyed by discount_label (fallback for legacy rows)
    """
    global _privilege_cache
    if _privilege_cache is not None:
        return _privilege_cache

    items = await supabase.select("privilege_configs", "select=*&is_active=eq.true")
    cache: dict[str, dict] = {}
    for item in items:
        if item.get("privilege_program_name"):
            cache[f"pp:{item['privilege_program_name']}"] = item
        if item.get("discount_label"):
            # Only set if not already claimed by a pp-keyed entry
            cache.setdefault(f"dl:{item['discount_label']}", item)
    _privilege_cache = cache
    return _privilege_cache


async def load_group_rates() -> dict[str, dict[str, float]]:
    """Load privilege_group_rates into {privilege_config_id: {group_name: rate}}."""
    global _group_rate_cache
    if _group_rate_cache is not None:
        return _group_rate_cache
    rows = await supabase.select("privilege_group_rates", "select=*")
    cache: dict[str, dict[str, float]] = {}
    for r in rows:
        pid = r["privilege_config_id"]
        cache.setdefault(pid, {})[r["group_name"]] = float(r["share_rate"])
    _group_rate_cache = cache
    return _group_rate_cache


async def load_location_groups() -> dict[str, str]:
    """Map location.name → group_name for runtime lookup during process_rows."""
    global _location_group_cache
    if _location_group_cache is not None:
        return _location_group_cache
    rows = await supabase.select("locations", "select=name,group_name&group_name=not.is.null")
    _location_group_cache = {r["name"]: r["group_name"] for r in rows if r.get("group_name")}
    return _location_group_cache


async def refresh_cache():
    global _privilege_cache, _group_rate_cache, _location_group_cache
    _privilege_cache = None
    _group_rate_cache = None
    _location_group_cache = None
    await load_privilege_configs()
    await load_group_rates()
    await load_location_groups()


def resolve_share_rate(
    privilege_config: dict | None,
    location_group: str | None,
    group_rates: dict[str, dict[str, float]] | None = None,
) -> float | None:
    """Pick the share_rate to use:
    1. If location_group is in GROUPS_WITH_NULL_PRIVILEGE → always NULL
       (privilege rate ignored; revenue falls back to total_discount).
    2. Per-privilege group override (from privilege_group_rates) if set.
    3. Privilege's default share_rate.
    """
    if not privilege_config:
        return None
    if location_group and location_group in GROUPS_WITH_NULL_PRIVILEGE:
        return None
    if location_group and group_rates:
        pid = privilege_config.get("id")
        if pid and pid in group_rates:
            override = group_rates[pid].get(location_group)
            if override is not None:
                return override
    sr = privilege_config.get("share_rate")
    return float(sr) if sr is not None else None


def calc_revenue(
    row: dict,
    privilege_config: dict | None,
    *,
    location_group: str | None = None,
    group_rates: dict[str, dict[str, float]] | None = None,
) -> float:
    """Calculate revenue for a single row based on privilege type.

    Logic:
    - Fully refunded invoices → revenue = 0 (customer got everything back)
    - Partially refunded → net = payment_amount - total_refund
    - percent type: revenue = net_payment
    - credit/mixed with payment=0:
        - share_rate exists: revenue = kwh * share_rate
        - no share_rate: revenue = total_discount
    - mixed with payment>0: revenue = net_payment
    """
    payment_amount = float(row.get("payment_amount") or 0)
    total_refund = float(row.get("total_refund") or 0)
    total_discount = float(row.get("total_discount") or 0)
    invoice_amount = float(row.get("invoice_amount") or 0)
    kwh = float(row.get("kwh") or 0)
    invoice_status = row.get("invoice_status") or ""

    # Full refund → zero revenue
    if invoice_status == "refunded":
        return 0.0

    # Net payment after partial refund
    net_payment = max(0.0, payment_amount - total_refund)

    # billed_to_organization: use invoice_amount (no payment record exists)
    if invoice_status == "billed_to_organization":
        return max(0.0, invoice_amount - total_refund)

    if not privilege_config:
        # No config found - auto-detect from data pattern
        if net_payment == 0 and total_discount > 0:
            # Looks like a charging credit - use total_discount as revenue
            return total_discount
        return net_payment

    ptype = privilege_config.get("privilege_type", "percent")
    share_rate = resolve_share_rate(privilege_config, location_group, group_rates)

    if ptype == "percent":
        return net_payment

    if ptype == "credit":
        # "Payment-method change" detection: customer initially paid cash then
        # switched to credit, so the stripe payment was fully refunded. The
        # location still earned revenue (partner honored the credit). We spot
        # this by: total_refund == payment_amount AND discount_status == paid.
        # In that case total_discount may be 0 even though credit was used.
        discount_status = (row.get("discount_status") or "").strip().lower()
        is_method_change = (
            total_refund > 0
            and abs(total_refund - payment_amount) < 0.01
            and discount_status == "paid"
            and invoice_status != "refunded"
        )

        # Credit privileges: partner pays Sharge for credit used. If the
        # session also had cash payment (credit 100 + cash 200 on a 300 bill),
        # Sharge's revenue = cash from customer + partner-paid credit portion.
        if share_rate is not None and share_rate > 0:
            credit_portion = kwh * float(share_rate)
        elif is_method_change:
            # total_discount didn't get populated for the credit swap — use
            # invoice_amount (what the credit ended up covering).
            credit_portion = invoice_amount
        else:
            credit_portion = total_discount

        # Don't double-count: in method-change, the refunded cash was replaced
        # by credit, not lost — so cash portion is 0, credit portion stands.
        cash_portion = 0.0 if is_method_change else net_payment
        return cash_portion + credit_portion

    # Fallback (unknown types): treat as percent
    return net_payment


async def process_rows(
    rows: list[list],
    col_names: list[str],
    location_name: str | None = None,
) -> list[dict]:
    """Process raw Metabase rows into dicts with calculated revenue.
    Filters by location if specified."""

    configs = await load_privilege_configs()
    group_rates = await load_group_rates()
    loc_groups = await load_location_groups()

    col_idx = {name: i for i, name in enumerate(col_names)}
    loc_idx = col_idx.get("location_name")
    result = []

    kwh_idx = col_idx.get("kwh")

    for row in rows:
        # Filter by location
        if location_name and loc_idx is not None:
            if row[loc_idx] != location_name:
                continue

        # Skip 0 kWh rows
        if kwh_idx is not None:
            kwh_val = float(row[kwh_idx] or 0)
            if kwh_val <= 0:
                continue

        # Convert to dict
        row_dict = {name: row[i] for i, name in enumerate(col_names)}

        # Lookup privilege config:
        # 1. privilege_program_name (Q1144 — authoritative; first name if comma-joined)
        # 2. discount_label fallback (with/without " Used" suffix)
        discount_label = row_dict.get("discount_label") or ""
        pp_raw = (row_dict.get("privilege_program_name") or "").split(",")[0].strip()

        priv_config = None
        if pp_raw:
            priv_config = configs.get(f"pp:{pp_raw}")
        if not priv_config and discount_label:
            priv_config = configs.get(f"dl:{discount_label}")
            if not priv_config and not discount_label.endswith(" Used"):
                priv_config = configs.get(f"dl:{discount_label} Used")
            if not priv_config and discount_label.endswith(" Used"):
                priv_config = configs.get(f"dl:{discount_label[:-5]}")

        # Calculate revenue (with group-specific rate override if configured)
        loc_group = loc_groups.get(row_dict.get("location_name") or "")
        revenue = calc_revenue(
            row_dict, priv_config,
            location_group=loc_group, group_rates=group_rates,
        )
        effective_rate = resolve_share_rate(priv_config, loc_group, group_rates)
        row_dict["_revenue"] = revenue
        row_dict["_privilege_type"] = priv_config["privilege_type"] if priv_config else None
        row_dict["_share_rate"] = effective_rate

        # Privilege Name priority:
        #   1. privilege_program_name (from Q1144 — authoritative, from privilege_programs.name)
        #   2. discount_label (from Q1097 fallback — wallet name + " Used")
        # Q1144 may comma-concat duplicates e.g. "Silver Tier,Silver Tier" → dedupe.
        pp_name = (row_dict.get("privilege_program_name") or "").strip()
        if pp_name:
            parts = [p.strip() for p in pp_name.split(",") if p.strip()]
            # preserve order, drop duplicates
            seen: list[str] = []
            for p in parts:
                if p not in seen:
                    seen.append(p)
            row_dict["_display_name"] = ",".join(seen)
        else:
            row_dict["_display_name"] = discount_label

        result.append(row_dict)

    return result
