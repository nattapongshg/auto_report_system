"""Create Metabase question V2: includes billed_to_organization + org name + RFID."""

import httpx
import json

NEW_SQL = """
WITH params AS (
  SELECT
    ({{PaidDate_start}}::timestamp AT TIME ZONE 'Asia/Bangkok' AT TIME ZONE 'UTC') AS start_utc,
    ({{PaidDate_end}}  ::timestamp AT TIME ZONE 'Asia/Bangkok' AT TIME ZONE 'UTC') AS end_utc
),

invoice_data AS MATERIALIZED (
  SELECT
    i.id AS invoice_id,
    i.status,
    i.invoice_number,
    i.settled_at,
    i.created_at AS invoice_created_at,
    i.total_satang,
    i.total_discount_satang,
    i.total_refund_satang,
    i.organization_id,
    COALESCE(dl.discount_label, '') AS discount_label
  FROM public.invoices i
  CROSS JOIN params p
  LEFT JOIN LATERAL (
    SELECT STRING_AGG(e.elem ->> 'label', ',' ORDER BY e.ord) AS discount_label
    FROM jsonb_array_elements(COALESCE(i.discounts, '[]'::jsonb)) WITH ORDINALITY AS e(elem, ord)
  ) dl ON TRUE
  WHERE (
    (i.status IN ('settled', 'refunded') AND i.organization_id IS NULL AND i.settled_at BETWEEN p.start_utc AND p.end_utc)
    OR
    (i.status = 'billed_to_organization' AND i.organization_id IS NOT NULL AND i.created_at BETWEEN p.start_utc AND p.end_utc)
  )
),

payments_agg AS MATERIALIZED (
  SELECT
    p.invoice_id,
    COALESCE(STRING_AGG(p.payment_status, ',') FILTER (WHERE pm.provider IN ('stripe', 'sharge-wallet') AND p.payment_status IN ('paid', 'refunded')), '') AS payment_status,
    COALESCE(STRING_AGG(pm.provider, ',') FILTER (WHERE pm.provider IN ('stripe', 'sharge-wallet') AND p.payment_status IN ('paid', 'refunded')), '') AS payment_provider,
    COALESCE(STRING_AGG(p.transaction_id, ',') FILTER (WHERE pm.provider IN ('stripe', 'sharge-wallet') AND p.payment_status IN ('paid', 'refunded')), '') AS payment_transaction_id,
    (COALESCE(SUM(p.amount) FILTER (WHERE pm.provider IN ('stripe', 'sharge-wallet') AND p.payment_status IN ('paid', 'refunded')), 0)::float8 / 100.0) AS payment_amount,
    COALESCE(STRING_AGG(pm.provider, ',') FILTER (WHERE pm.provider IN ('sharge', 'sharge-points', 'shell', 'sharge-tier') AND p.payment_status = 'paid'), '') AS discount_provider,
    COALESCE(STRING_AGG(p.payment_status, ',') FILTER (WHERE pm.provider IN ('sharge', 'sharge-points', 'shell', 'sharge-tier') AND p.payment_status = 'paid'), '') AS discount_status,
    COALESCE(STRING_AGG(LEFT(pc.vin, 17), ',') FILTER (WHERE pm.provider IN ('sharge', 'sharge-points', 'shell', 'sharge-tier') AND p.payment_status = 'paid' AND pc.vin IS NOT NULL), '') AS vin_list
  FROM invoice_data i
  JOIN public.payments p ON p.invoice_id = i.invoice_id
  JOIN public.payment_methods pm ON pm.id = p.payment_method_id
  LEFT JOIN public.privilege_codes pc ON (pm.attributes #>> array['activation_code']) = pc.activation_code
  WHERE (pm.provider IN ('stripe', 'sharge-wallet') AND p.payment_status IN ('paid', 'refunded'))
     OR (pm.provider IN ('sharge', 'sharge-points', 'shell', 'sharge-tier') AND p.payment_status = 'paid')
  GROUP BY p.invoice_id
),

sessions_for_invoices AS MATERIALIZED (
  SELECT os.invoice_id, os.reference_id, os.start_date_time, os.end_date_time,
         os.location_id, os.evse_id, os.user_id, os.kwh, os.token_id
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
  COALESCE(i.settled_at, i.invoice_created_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok' AS paid_date_bkk,
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
  COALESCE(p.payment_amount, 0) AS payment_amount,
  COALESCE(p.payment_status, '') AS payment_status,
  COALESCE(p.payment_provider, '') AS payment_provider,
  COALESCE(p.payment_transaction_id, '') AS payment_transaction_id,
  COALESCE(i.discount_label, '') AS discount_label,
  COALESCE(p.discount_provider, '') AS discount_provider,
  COALESCE(p.discount_status, '') AS discount_status,
  COALESCE(p.vin_list, '') AS vin,
  COALESCE(org.name, '') AS organization_name,
  COALESCE(tok.visual_number, '') AS rfid_number
FROM invoice_data i
LEFT JOIN sessions_for_invoices os ON os.invoice_id = i.invoice_id
LEFT JOIN payments_agg p ON p.invoice_id = i.invoice_id
LEFT JOIN public.ocpi_locations loc ON os.location_id = loc.id
LEFT JOIN public.ocpi_evses evse ON os.evse_id = evse.id
LEFT JOIN public.users u ON os.user_id = u.id
LEFT JOIN cdr_for_invoices cdr ON cdr.invoice_id = i.invoice_id
LEFT JOIN public.organizations org ON i.organization_id = org.id
LEFT JOIN public.ocpi_tokens tok ON os.token_id = tok.id
ORDER BY COALESCE(i.settled_at, i.invoice_created_at) DESC
"""

resp = httpx.post(
    "https://metabase.shargethailand.com/api/card",
    headers={
        "x-api-key": "mb_Jjbvm8WJpf6+oSMIyFs+ovlFI3IAX+pcqV4c4IGzzFk=",
        "Content-Type": "application/json",
    },
    json={
        "name": "Invoice Report - V2 (with Fleet/Org)",
        "description": "Extended: includes billed_to_organization, org name, RFID visual number. Use PaidDate filters.",
        "dataset_query": {
            "database": 33,
            "type": "native",
            "native": {
                "query": NEW_SQL,
                "template-tags": {
                    "PaidDate_start": {
                        "type": "date",
                        "name": "PaidDate_start",
                        "id": "c12f9d8e-0a17-4b88-ba59-7d1dbecffbf1",
                        "display-name": "Paid Date Start",
                    },
                    "PaidDate_end": {
                        "type": "date",
                        "name": "PaidDate_end",
                        "id": "4f81f0f4-658f-413d-8343-576d0b31b6d4",
                        "display-name": "Paid Date End",
                    },
                },
            },
        },
        "display": "table",
        "visualization_settings": {},
        "collection_id": None,
    },
    timeout=30,
)

result = resp.json()
if "id" in result:
    print(f"Created question #{result['id']}: {result['name']}")
    print(f"URL: https://metabase.shargethailand.com/question/{result['id']}")
else:
    print(f"Error: {json.dumps(result, indent=2)[:500]}")
