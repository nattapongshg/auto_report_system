"""Calculate revenue per row based on privilege_configs from Supabase."""

from app.supabase_client import supabase

# In-memory cache
_privilege_cache: dict[str, dict] | None = None


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


async def refresh_cache():
    global _privilege_cache
    _privilege_cache = None
    return await load_privilege_configs()


def calc_revenue(
    row: dict,
    privilege_config: dict | None,
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
    share_rate = privilege_config.get("share_rate")

    if ptype == "percent":
        return net_payment

    if ptype == "credit":
        # credit revenue independent of customer payment (no cash flow)
        # so refunds don't reduce it — unless the invoice itself was marked refunded (handled above)
        if share_rate is not None and share_rate > 0:
            return kwh * float(share_rate)
        else:
            return total_discount

    if ptype == "mixed" and net_payment == 0:
        if share_rate is not None and share_rate > 0:
            return kwh * float(share_rate)
        else:
            return total_discount

    # mixed with payment > 0
    return net_payment


async def process_rows(
    rows: list[list],
    col_names: list[str],
    location_name: str | None = None,
) -> list[dict]:
    """Process raw Metabase rows into dicts with calculated revenue.
    Filters by location if specified."""

    configs = await load_privilege_configs()

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

        # Calculate revenue
        revenue = calc_revenue(row_dict, priv_config)
        row_dict["_revenue"] = revenue
        row_dict["_privilege_type"] = priv_config["privilege_type"] if priv_config else None
        row_dict["_share_rate"] = float(priv_config["share_rate"]) if priv_config and priv_config.get("share_rate") else None

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
