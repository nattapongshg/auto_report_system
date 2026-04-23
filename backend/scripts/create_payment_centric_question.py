"""Deploy Q1145: payment-centric alternative to Q1144.

Run with VPN connected:
    cd backend && PYTHONPATH=. ./venv/Scripts/python.exe scripts/create_payment_centric_question.py


Current Q1144 aggregates per invoice (STRING_AGG of multiple payments).
Q1145 emits 1 row per `payments` record instead — clearer semantics for:
  - Refunds (full/partial explicit via refund_type + refund_amount_satang)
  - Payment-method swaps (old stripe refund + new credit paid = 2 rows)
  - Multi-source credit (each source = 1 row)

Columns (payment-level primary + invoice/session attached):
  payment_id, payment_status (paid|refunded), refund_type (full|partial|null),
  payment_amount, refund_amount, net_amount (= amount - refund),
  payment_provider, payment_transaction_id, refund_transaction_id,
  payment_created_bkk,
  invoice_id, invoice_status, etax_number, invoice_amount,
  organization_id, organization_name,
  session_start_bkk, session_end_bkk, reference_id, kwh,
  total_time, total_overtime,
  location_name, location_code, evse_name,
  user_email, privilege_program_name, vin,
  -- Attribution flags: use these when summing to avoid double-counting
  is_invoice_primary_payment   -- true for one payment per invoice (pick kwh/etax from this row only)
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
payments_in_period AS MATERIALIZED (
  SELECT
    p.id AS payment_id,
    p.invoice_id,
    p.amount,
    COALESCE(p.refund_amount_satang, 0) AS refund_amount_satang,
    p.payment_status,
    p.refund_type,
    p.transaction_id,
    p.refund_transaction_id,
    p.created_at,
    p.payment_method_id,
    p.user_id,
    ROW_NUMBER() OVER (PARTITION BY p.invoice_id ORDER BY p.created_at, p.id) AS rn
  FROM public.payments p
  CROSS JOIN params pa
  WHERE p.payment_status IN ('paid', 'refunded')
    AND p.created_at BETWEEN pa.start_utc AND pa.end_utc
),
-- Fleet-billed invoices have no payment record (billed monthly to the org).
-- Emit a synthetic "paid" row so the payment-centric flow still accounts for
-- their revenue.
org_synthetic_payments AS MATERIALIZED (
  SELECT
    i.id AS payment_id,          -- reuse invoice id (unique, no collision)
    i.id AS invoice_id,
    i.total_satang AS amount,
    0 AS refund_amount_satang,
    'paid' AS payment_status,
    NULL::varchar AS refund_type,
    NULL::varchar AS transaction_id,
    NULL::varchar AS refund_transaction_id,
    COALESCE(i.settled_at, i.created_at) AS created_at,
    NULL::uuid AS payment_method_id,
    NULL::uuid AS user_id,
    1 AS rn
  FROM public.invoices i
  CROSS JOIN params pa
  WHERE i.status = 'billed_to_organization'
    AND i.organization_id IS NOT NULL
    AND COALESCE(i.settled_at, i.created_at) BETWEEN pa.start_utc AND pa.end_utc
),
all_payments AS (
  SELECT * FROM payments_in_period
  UNION ALL
  SELECT * FROM org_synthetic_payments
),
invoice_ids AS MATERIALIZED (
  SELECT DISTINCT invoice_id FROM all_payments WHERE invoice_id IS NOT NULL
),
invoice_data AS MATERIALIZED (
  SELECT
    i.id,
    i.status,
    i.organization_id,
    i.invoice_number,
    i.settled_at,
    i.created_at,
    i.total_satang,
    i.total_discount_satang,
    COALESCE(dl.discount_label, '') AS discount_label
  FROM public.invoices i
  JOIN invoice_ids ii ON ii.invoice_id = i.id
  LEFT JOIN LATERAL (
    SELECT STRING_AGG(e.elem ->> 'label', ',' ORDER BY e.ord) AS discount_label
    FROM jsonb_array_elements(COALESCE(i.discounts, '[]'::jsonb))
      WITH ORDINALITY AS e(elem, ord)
  ) dl ON TRUE
),
session_data AS MATERIALIZED (
  SELECT os.invoice_id, os.reference_id, os.start_date_time, os.end_date_time,
         os.location_id, os.evse_id, os.user_id, os.kwh
  FROM public.ocpi_sessions os
  JOIN invoice_ids ii ON ii.invoice_id = os.invoice_id
),
cdr_data AS MATERIALIZED (
  SELECT c.invoice_id, c.total_time, c.total_overtime
  FROM public.ocpi_cdrs c
  JOIN invoice_ids ii ON ii.invoice_id = c.invoice_id
)
SELECT
  p.payment_id,
  p.payment_status,
  p.refund_type,
  (p.amount::float8 / 100.0) AS payment_amount,
  (p.refund_amount_satang::float8 / 100.0) AS refund_amount,
  ((p.amount - p.refund_amount_satang)::float8 / 100.0) AS net_amount,
  pm.provider AS payment_provider,
  p.transaction_id AS payment_transaction_id,
  p.refund_transaction_id,
  (p.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok') AS payment_created_bkk,

  -- Attribution flag: set only on the primary payment per invoice so
  -- aggregators can pick kwh / etax / total_time once per invoice.
  (p.rn = 1) AS is_invoice_primary,

  p.invoice_id,
  CASE
    WHEN i.organization_id IS NOT NULL THEN 'billed_to_organization'
    ELSE i.status
  END AS invoice_status,
  i.organization_id,
  i.invoice_number AS etax_number,
  (i.total_satang::float8 / 100.0) AS invoice_amount,
  (i.total_discount_satang::float8 / 100.0) AS total_discount,
  COALESCE(i.discount_label, '') AS discount_label,

  os.reference_id,
  (os.start_date_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok') AS session_start_bkk,
  (os.end_date_time   AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok') AS session_end_bkk,
  os.kwh,
  COALESCE(cdr.total_time, 0) AS total_time,
  COALESCE(cdr.total_overtime, 0) AS total_overtime,

  COALESCE(loc.name, 'Unknown')         AS location_name,
  COALESCE(loc.station_code, 'Unknown') AS location_code,
  COALESCE(evse.name, 'Unknown')        AS evse_name,
  COALESCE(u.email, 'Unknown')          AS user_email,

  pp.name AS privilege_program_name,
  LEFT(pc.vin, 17) AS vin

FROM all_payments p
LEFT JOIN public.payment_methods pm   ON pm.id = p.payment_method_id
LEFT JOIN public.privilege_programs pp ON pp.id = pm.privilege_program_id
LEFT JOIN public.privilege_codes    pc ON (pm.attributes #>> array['activation_code']) = pc.activation_code
LEFT JOIN invoice_data i              ON i.id = p.invoice_id
LEFT JOIN session_data os             ON os.invoice_id = p.invoice_id
LEFT JOIN cdr_data cdr                ON cdr.invoice_id = p.invoice_id
LEFT JOIN public.ocpi_locations loc   ON os.location_id = loc.id
LEFT JOIN public.ocpi_evses evse      ON os.evse_id = evse.id
LEFT JOIN public.users u              ON p.user_id = u.id
ORDER BY p.created_at DESC
"""


async def main():
    async with httpx.AsyncClient(timeout=30) as c:
        # Get template from Q1144 so parameter binding matches
        r = await c.get(
            f"{settings.metabase_base_url}/api/card/1144",
            headers={"x-api-key": settings.metabase_api_key},
        )
        r.raise_for_status()
        q1144 = r.json()
        template_tags = q1144["dataset_query"]["native"].get("template-tags", {})

        payload = {
            "name": "Invoice Report - Payment Centric (Q1145)",
            "description": (
                "Payment-level alternative to Q1144. 1 row per payment record "
                "instead of per invoice. Explicit refund_type (full/partial), "
                "net_amount, is_invoice_primary flag for kwh/etax attribution."
            ),
            "database_id": q1144["database_id"],
            "collection_id": q1144.get("collection_id"),
            "dataset_query": {
                "database": q1144["database_id"],
                "type": "native",
                "native": {
                    "query": ENHANCED_SQL,
                    "template-tags": template_tags,
                },
            },
            "display": "table",
            "visualization_settings": {},
            "parameters": q1144.get("parameters", []),
        }

        # Update existing Q1145 if present, otherwise create
        existing_id = 1145
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
        print(f"Q1145: {data['id']}: {data['name']}")
        print(f"URL: {settings.metabase_base_url}/question/{data['id']}")


if __name__ == "__main__":
    asyncio.run(main())
