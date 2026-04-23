"""Revenue calculation for payment-centric snapshots (Q1145).

One row = one payment. Revenue is derived per-row with clear rules:

  refund_type == 'full'           → 0
  refund_type == 'partial'         → amount - refund_amount
  paid + cash provider             → payment_amount  (customer cash)
  paid + credit provider + rate    → kwh × share_rate   (partner billed at rate)
  paid + credit provider + no rate → payment_amount     (face value of credit used)

Group-null rule (Shell etc.): at groups in GROUPS_WITH_NULL_PRIVILEGE, credit
providers lose their partner rate and fall back to payment_amount (base price).

Attribution: `is_invoice_primary` flags the first payment per invoice, used
to pick kwh/etax_number once per invoice when aggregating.
"""
from __future__ import annotations

from app.engine.privilege_calc import (
    GROUPS_WITH_NULL_PRIVILEGE,
    load_group_rates, load_location_groups, load_privilege_configs,
    refresh_cache,
)


CASH_PROVIDERS = {"stripe", "sharge-wallet"}
CREDIT_PROVIDERS = {"sharge", "sharge-points", "shell", "sharge-tier"}


def calc_payment_revenue(
    row: dict,
    priv_configs: dict[str, dict],
    group_rates: dict[str, dict[str, float]],
    location_group: str | None,
) -> float:
    status = (row.get("payment_status") or "").strip().lower()
    refund_type = (row.get("refund_type") or "").strip().lower()
    amount = float(row.get("payment_amount") or 0)
    refund = float(row.get("refund_amount") or 0)
    provider = (row.get("payment_provider") or "").strip().lower()
    kwh = float(row.get("kwh") or 0)

    # Refunds
    if status == "refunded":
        if refund_type == "partial":
            return max(0.0, amount - refund)
        # full refund or refund_type unspecified → 0
        return 0.0

    # Paid — cash providers pay face value to Sharge.
    if provider in CASH_PROVIDERS:
        return amount

    if provider in CREDIT_PROVIDERS:
        pp_name = (row.get("privilege_program_name") or "").strip()
        priv = priv_configs.get(f"pp:{pp_name}") if pp_name else None
        ptype = (priv.get("privilege_type") if priv else None) or ""

        # Percent-type privileges (e.g. Gold/Silver/Platinum Tier) are a
        # discount bookkeeping entry — the customer's real cash goes through
        # a paired stripe/sharge-wallet payment in the SAME invoice. Counting
        # the sharge-tier row too would double-count against the cash one.
        if ptype == "percent":
            return 0.0

        # Group-null rule: at Shell-like groups we ignore the partner rate.
        skip_rate = location_group in GROUPS_WITH_NULL_PRIVILEGE

        rate = None
        if priv and not skip_rate:
            pid = priv.get("id")
            override = group_rates.get(pid, {}).get(location_group) if pid and location_group else None
            if override is not None:
                rate = float(override)
            elif priv.get("share_rate") is not None:
                rate = float(priv["share_rate"])

        if rate is not None and rate > 0 and kwh > 0:
            return kwh * rate
        # No rate → use credit face value (amount charged against credit).
        return amount

    # Unknown provider / misconfigured row → treat as cash.
    return amount


async def process_payment_rows(
    rows: list[list],
    col_names: list[str],
    location_name: str | None = None,
) -> list[dict]:
    """Attach `_revenue` to each payment row. Filters by location if given."""
    priv_configs = await load_privilege_configs()
    group_rates = await load_group_rates()
    loc_groups = await load_location_groups()

    idx = {n: i for i, n in enumerate(col_names)}
    loc_i = idx.get("location_name")

    out: list[dict] = []
    for r in rows:
        if location_name and loc_i is not None and r[loc_i] != location_name:
            continue
        row_dict = {n: r[i] for i, n in enumerate(col_names)}
        loc = row_dict.get("location_name") or ""
        group = loc_groups.get(loc)
        row_dict["_revenue"] = calc_payment_revenue(row_dict, priv_configs, group_rates, group)
        out.append(row_dict)
    return out


async def aggregate_by_location(snapshot_id: str) -> dict[str, dict]:
    """Return per-location totals from payment_rows:
        {location_name: {revenue, kwh, etax_count, rows, payment_rows}}
    kwh/etax counted once per invoice via is_invoice_primary flag."""
    from app.db.payment_rows import load_payment_rows
    await refresh_cache()
    rows, cols = await load_payment_rows(snapshot_id)
    idx = {n: i for i, n in enumerate(cols)}

    priv_configs = await load_privilege_configs()
    group_rates = await load_group_rates()
    loc_groups = await load_location_groups()

    agg: dict[str, dict] = {}
    for r in rows:
        rd = {n: r[i] for i, n in enumerate(cols)}
        loc = rd.get("location_name") or ""
        kwh = float(rd.get("kwh") or 0)
        if kwh <= 0:
            continue
        bucket = agg.setdefault(loc, {
            "revenue": 0.0, "kwh": 0.0, "etax_count": 0,
            "payment_rows": 0, "invoice_rows": 0,
        })
        bucket["payment_rows"] += 1
        bucket["revenue"] += calc_payment_revenue(
            rd, priv_configs, group_rates, loc_groups.get(loc)
        )
        if rd.get("is_invoice_primary"):
            bucket["invoice_rows"] += 1
            bucket["kwh"] += kwh
            if rd.get("etax_number"):
                bucket["etax_count"] += 1
    return agg
