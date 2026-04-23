"""Create a new Metabase question that clones Q1097 + adds privilege_program_name.

Cross-checks by joining privilege_codes → privilege_programs so the Privilege Name
uniquely identifies the program used (not just the wallet label).

Usage:
    cd backend && ./venv/Scripts/python.exe scripts/create_enhanced_question.py
"""

import asyncio
import sys

import httpx

from app.config import settings


ENHANCED_SQL = """WITH params AS (
  SELECT
    ({{PaidDate_start}}::timestamp AT TIME ZONE 'Asia/Bangkok' AT TIME ZONE 'UTC') AS start_utc,
    ({{PaidDate_end}}  ::timestamp AT TIME ZONE 'Asia/Bangkok' AT TIME ZONE 'UTC') AS end_utc
),
invoice_data AS MATERIALIZED (
  SELECT
    i.id AS invoice_id,
    i.status,
    i.organization_id,
    i.invoice_number,
    -- Fleet invoices (billed_to_organization) have settled_at = NULL; fall
    -- back to created_at so they still pass the period filter and show up
    -- with a sensible paid-date in the report.
    COALESCE(i.settled_at, i.created_at) AS settled_at,
    i.total_satang,
    i.total_discount_satang,
    i.total_refund_satang,
    COALESCE(dl.discount_label, '') AS discount_label
  FROM public.invoices i
  CROSS JOIN params p
  LEFT JOIN LATERAL (
    SELECT STRING_AGG(e.elem ->> 'label', ',' ORDER BY e.ord) AS discount_label
    FROM jsonb_array_elements(COALESCE(i.discounts, '[]'::jsonb))
      WITH ORDINALITY AS e(elem, ord)
  ) dl ON TRUE
  WHERE i.status IN ('settled', 'refunded', 'billed_to_organization')
    AND COALESCE(i.settled_at, i.created_at) BETWEEN p.start_utc AND p.end_utc
),
payments_agg AS MATERIALIZED (
  SELECT
    p.invoice_id,
    COALESCE(STRING_AGG(p.payment_status, ',')
      FILTER (WHERE pm.provider IN ('stripe', 'sharge-wallet')
              AND p.payment_status IN ('paid', 'refunded')), '') AS payment_status,
    COALESCE(STRING_AGG(pm.provider, ',')
      FILTER (WHERE pm.provider IN ('stripe', 'sharge-wallet')
              AND p.payment_status IN ('paid', 'refunded')), '') AS payment_provider,
    COALESCE(STRING_AGG(p.transaction_id, ',')
      FILTER (WHERE pm.provider IN ('stripe', 'sharge-wallet')
              AND p.payment_status IN ('paid', 'refunded')), '') AS payment_transaction_id,
    (COALESCE(SUM(p.amount)
      FILTER (WHERE pm.provider IN ('stripe', 'sharge-wallet')
              AND p.payment_status IN ('paid', 'refunded')), 0)::float8 / 100.0) AS payment_amount,
    COALESCE(STRING_AGG(pm.provider, ',')
      FILTER (WHERE pm.provider IN ('sharge', 'sharge-points', 'shell', 'sharge-tier')
              AND p.payment_status = 'paid'), '') AS discount_provider,
    COALESCE(STRING_AGG(p.payment_status, ',')
      FILTER (WHERE pm.provider IN ('sharge', 'sharge-points', 'shell', 'sharge-tier')
              AND p.payment_status = 'paid'), '') AS discount_status,
    COALESCE(STRING_AGG(LEFT(pc.vin, 17), ',')
      FILTER (WHERE pm.provider IN ('sharge', 'sharge-points', 'shell', 'sharge-tier')
              AND p.payment_status = 'paid'
              AND pc.vin IS NOT NULL), '') AS vin_list,
    -- NEW: aggregate the real privilege program name(s)
    COALESCE(STRING_AGG(pp.name, ',')
      FILTER (WHERE pm.provider IN ('sharge', 'sharge-points', 'shell', 'sharge-tier')
              AND p.payment_status = 'paid'
              AND pp.name IS NOT NULL), '') AS privilege_program_name
  FROM invoice_data i
  JOIN public.payments p ON p.invoice_id = i.invoice_id
  JOIN public.payment_methods pm ON pm.id = p.payment_method_id
  LEFT JOIN public.privilege_codes pc
    ON (pm.attributes #>> array['activation_code']) = pc.activation_code
  -- NEW: privilege_program_id lives on payment_methods, not privilege_codes
  LEFT JOIN public.privilege_programs pp
    ON pp.id = pm.privilege_program_id
  WHERE
    (pm.provider IN ('stripe', 'sharge-wallet') AND p.payment_status IN ('paid', 'refunded'))
    OR
    (pm.provider IN ('sharge', 'sharge-points', 'shell', 'sharge-tier') AND p.payment_status = 'paid')
  GROUP BY p.invoice_id
),
sessions_for_invoices AS MATERIALIZED (
  SELECT os.invoice_id, os.reference_id, os.start_date_time, os.end_date_time,
         os.location_id, os.evse_id, os.user_id, os.kwh
  FROM public.ocpi_sessions os
  JOIN invoice_data i ON i.invoice_id = os.invoice_id
),
cdr_for_invoices AS MATERIALIZED (
  SELECT c.invoice_id, c.total_time, c.total_overtime, c.total_overtime_cost
  FROM public.ocpi_cdrs c
  JOIN invoice_data i ON i.invoice_id = c.invoice_id
)
SELECT
  i.invoice_id,
  i.status AS invoice_status,
  i.invoice_number AS etax_number,
  os.reference_id,
  os.start_date_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok' AS session_start_bkk,
  os.end_date_time   AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok' AS session_end_bkk,
  i.settled_at       AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok' AS paid_date_bkk,
  COALESCE(u.email, 'Unknown') AS user_email,
  COALESCE(loc.name, 'Unknown') AS location_name,
  COALESCE(loc.station_code, 'Unknown') AS location_code,
  COALESCE(evse.name, 'Unknown') AS evse_name,
  os.kwh,
  COALESCE(cdr.total_time, 0) AS total_time,
  COALESCE(cdr.total_overtime, 0) AS total_overtime,
  (COALESCE((cdr.total_overtime_cost #>> '{incl_vat}')::numeric, 0) / 100.0) AS total_overtime_cost,
  (i.total_satang::float8 / 100.0) AS invoice_amount,
  (i.total_discount_satang::float8 / 100.0) AS total_discount,
  (i.total_refund_satang::float8 / 100.0) AS total_refund,
  -- Price per kWh (like Q748) — null-safe
  CASE WHEN os.kwh > 0
       THEN ROUND((i.total_satang::numeric / 100.0 / os.kwh)::numeric, 4)
       ELSE NULL END AS price_per_kwh,
  COALESCE(p.payment_amount, 0) AS payment_amount,
  COALESCE(p.payment_status, '') AS payment_status,
  COALESCE(p.payment_provider, '') AS payment_provider,
  COALESCE(p.payment_transaction_id, '') AS payment_transaction_id,
  COALESCE(i.discount_label, '') AS discount_label,
  -- NEW: authoritative privilege name from privilege_programs
  COALESCE(p.privilege_program_name, '') AS privilege_program_name,
  COALESCE(p.discount_provider, '') AS discount_provider,
  COALESCE(p.discount_status, '') AS discount_status,
  COALESCE(p.vin_list, '') AS vin
FROM invoice_data i
LEFT JOIN sessions_for_invoices os ON os.invoice_id = i.invoice_id
LEFT JOIN payments_agg p ON p.invoice_id = i.invoice_id
LEFT JOIN public.ocpi_locations loc ON os.location_id = loc.id
LEFT JOIN public.ocpi_evses evse ON os.evse_id = evse.id
LEFT JOIN public.users u ON os.user_id = u.id
LEFT JOIN cdr_for_invoices cdr ON cdr.invoice_id = i.invoice_id
ORDER BY i.settled_at DESC;
"""


async def main():
    async with httpx.AsyncClient(timeout=30) as c:
        # Get template from Q1097 so parameter binding matches
        r = await c.get(
            f"{settings.metabase_base_url}/api/card/1097",
            headers={"x-api-key": settings.metabase_api_key},
        )
        r.raise_for_status()
        q1097 = r.json()

        template_tags = q1097["dataset_query"]["native"].get("template-tags", {})

        payload = {
            "name": "Invoice Report - Enhanced (with Privilege Program Name)",
            "description": (
                "Clone of Q1097 + privilege_program_name (joined via privilege_codes → "
                "privilege_programs) + price_per_kwh. Used by Auto Report System."
            ),
            "database_id": q1097["database_id"],
            "collection_id": q1097.get("collection_id"),
            "dataset_query": {
                "database": q1097["database_id"],
                "type": "native",
                "native": {
                    "query": ENHANCED_SQL,
                    "template-tags": template_tags,
                },
            },
            "display": "table",
            "visualization_settings": {},
        }

        # Update existing 1144 if present, otherwise create
        existing_id = 1144
        existing = await c.get(
            f"{settings.metabase_base_url}/api/card/{existing_id}",
            headers={"x-api-key": settings.metabase_api_key},
        )
        if existing.status_code == 200:
            r = await c.put(
                f"{settings.metabase_base_url}/api/card/{existing_id}",
                headers={
                    "x-api-key": settings.metabase_api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        else:
            r = await c.post(
                f"{settings.metabase_base_url}/api/card",
                headers={
                    "x-api-key": settings.metabase_api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if r.status_code >= 400:
            print(f"ERROR {r.status_code}: {r.text}", file=sys.stderr)
            sys.exit(1)
        data = r.json()
        print(f"Created question {data['id']}: {data['name']}")
        print(f"URL: {settings.metabase_base_url}/question/{data['id']}")


if __name__ == "__main__":
    asyncio.run(main())
