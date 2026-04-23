"""Deploy Q1146: Location Master (ocpi_locations + aggregated evse/connector).

One row per location (status='open'), with evse + connector counts + booking
flags + pricing. Used by the auto-report system as the canonical location
source (replaces the manual 05_locations.sql seed over time).
"""
import asyncio
import sys

import httpx

from app.config import settings


LOCATION_SQL = """WITH evse_agg AS (
  SELECT
    e.location_id,
    COUNT(DISTINCT e.identifier) AS evse_count,
    COUNT(DISTINCT e.identifier) FILTER (WHERE e.is_enabled) AS evse_enabled_count,
    STRING_AGG(DISTINCT e.brand, ',') AS brands,
    BOOL_OR(e.supports_multi_connector) AS any_multi_connector
  FROM public.ocpi_evses e
  GROUP BY e.location_id
),
connector_agg AS (
  SELECT
    e.location_id,
    COUNT(c.*) AS connector_count,
    MAX(c.max_electric_power) AS max_connector_power,
    STRING_AGG(DISTINCT c.power_type, ',') AS power_types,
    STRING_AGG(DISTINCT c.standard, ',') AS connector_standards
  FROM public.ocpi_connectors c
  JOIN public.ocpi_evses e ON e.id = c.evse_id
  GROUP BY e.location_id
)
SELECT
  l.id AS location_id,
  l.station_code,
  l.name,
  l.name_th,
  l.status,
  l.location_type,
  l.city,
  l.state,
  l.postal_code,
  l.address,
  l.coordinates,
  l.public                 AS is_public,
  l.free                   AS is_free,
  l.requires_booking,
  l.enable_overtime,
  l.overtime_price::numeric / 100.0 AS overtime_price,
  l.idle_price::numeric / 100.0 AS idle_price,
  l.no_show_price::numeric / 100.0 AS no_show_price,
  l.max_booking_hours,
  l.kwh_price,
  l.kwh_peak_price,
  l.vat_percentage,
  l.time_zone,
  l.branch_code,
  l.issue_tax_invoice_type,
  l.operator_id,
  l.suboperator_id,
  l.owner_id,
  l.party_id,
  -- Aggregations
  COALESCE(ea.evse_count, 0)          AS evse_count,
  COALESCE(ea.evse_enabled_count, 0)  AS evse_enabled_count,
  ea.brands,
  ea.any_multi_connector,
  COALESCE(ca.connector_count, 0)     AS connector_count,
  ca.max_connector_power,
  ca.power_types,
  ca.connector_standards,
  l.created_at               AS location_created_at,
  l.last_updated             AS location_last_updated
FROM public.ocpi_locations l
LEFT JOIN evse_agg ea      ON ea.location_id = l.id
LEFT JOIN connector_agg ca ON ca.location_id = l.id
WHERE l.status = 'open'
ORDER BY l.name;
"""


async def main():
    async with httpx.AsyncClient(timeout=30) as c:
        # Use Q1144's database as template
        r = await c.get(
            f"{settings.metabase_base_url}/api/card/1144",
            headers={"x-api-key": settings.metabase_api_key},
        )
        r.raise_for_status()
        q = r.json()

        payload = {
            "name": "Location Master (Q1146)",
            "description": (
                "One row per open location with evse + connector counts, "
                "booking / overtime flags, pricing. Master source for the "
                "auto-report system's locations table."
            ),
            "database_id": q["database_id"],
            "collection_id": q.get("collection_id"),
            "dataset_query": {
                "database": q["database_id"],
                "type": "native",
                "native": {"query": LOCATION_SQL, "template-tags": {}},
            },
            "display": "table",
            "visualization_settings": {},
            "parameters": [],
        }

        existing_id = 1146
        existing = await c.get(
            f"{settings.metabase_base_url}/api/card/{existing_id}",
            headers={"x-api-key": settings.metabase_api_key},
        )
        if existing.status_code == 200:
            r = await c.put(
                f"{settings.metabase_base_url}/api/card/{existing_id}",
                headers={"x-api-key": settings.metabase_api_key, "Content-Type": "application/json"},
                json=payload,
            )
        else:
            r = await c.post(
                f"{settings.metabase_base_url}/api/card",
                headers={"x-api-key": settings.metabase_api_key, "Content-Type": "application/json"},
                json=payload,
            )
        if r.status_code >= 400:
            print(f"ERROR {r.status_code}: {r.text}", file=sys.stderr)
            sys.exit(1)
        data = r.json()
        print(f"Q1146: {data['id']}: {data['name']}")
        print(f"URL: {settings.metabase_base_url}/question/{data['id']}")


if __name__ == "__main__":
    asyncio.run(main())
