-- Raw Metabase snapshot rows — one table replaces the per-month JSON files.
-- Each row = one invoice/session pulled from Q1144.

CREATE TABLE IF NOT EXISTS metabase_rows (
    id BIGSERIAL PRIMARY KEY,
    snapshot_id UUID NOT NULL REFERENCES monthly_snapshots(id) ON DELETE CASCADE,

    -- Q1144 columns (order matches the question's SELECT)
    invoice_id UUID,
    invoice_status TEXT,
    etax_number TEXT,
    reference_id TEXT,
    session_start_bkk TIMESTAMPTZ,
    session_end_bkk TIMESTAMPTZ,
    paid_date_bkk TIMESTAMPTZ,
    user_email TEXT,
    location_name TEXT,
    location_code TEXT,
    evse_name TEXT,
    kwh NUMERIC(14, 4),
    total_time NUMERIC(10, 4),
    total_overtime NUMERIC(10, 4),
    total_overtime_cost NUMERIC(12, 2),
    invoice_amount NUMERIC(14, 2),
    total_discount NUMERIC(14, 2),
    total_refund NUMERIC(14, 2),
    price_per_kwh NUMERIC(10, 4),
    payment_amount NUMERIC(14, 2),
    payment_status TEXT,
    payment_provider TEXT,
    payment_transaction_id TEXT,
    discount_label TEXT,
    privilege_program_name TEXT,
    discount_provider TEXT,
    discount_status TEXT,
    vin TEXT,

    inserted_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE metabase_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON metabase_rows;
CREATE POLICY "service_role_all" ON metabase_rows FOR ALL USING (true) WITH CHECK (true);

-- Hot paths: always filter by snapshot, then optionally by location + kwh
CREATE INDEX IF NOT EXISTS idx_metabase_snapshot ON metabase_rows(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_metabase_snapshot_location
    ON metabase_rows(snapshot_id, location_name);
CREATE INDEX IF NOT EXISTS idx_metabase_snapshot_kwh
    ON metabase_rows(snapshot_id) WHERE kwh > 0;
