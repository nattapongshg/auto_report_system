-- Monthly location inputs — per-location entries tied to a snapshot.
CREATE TABLE IF NOT EXISTS monthly_location_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES monthly_snapshots(id) ON DELETE CASCADE,
    location_id UUID NOT NULL,
    location_name TEXT NOT NULL,
    year_month TEXT NOT NULL,

    status TEXT DEFAULT 'pending' NOT NULL,  -- pending | generating | sent | failed

    -- Costs entered by user
    electricity_cost NUMERIC(12,2),
    internet_cost NUMERIC(12,2),
    etax NUMERIC(12,2),
    bill_image_url TEXT,

    -- Preview numbers (calculated at save)
    preview_rows INT,
    preview_revenue NUMERIC(12,2),
    preview_kwh NUMERIC(12,2),
    preview_gp NUMERIC(12,2),
    preview_share NUMERIC(12,2),

    -- Output
    file_name VARCHAR(255),
    file_path VARCHAR(512),
    file_size_bytes BIGINT,

    email_sent_at TIMESTAMPTZ,
    email_error TEXT,

    submitted_by TEXT,
    submitted_at TIMESTAMPTZ,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    UNIQUE(snapshot_id, location_id)
);

ALTER TABLE monthly_location_inputs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON monthly_location_inputs;
CREATE POLICY "service_role_all" ON monthly_location_inputs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_mli_snapshot ON monthly_location_inputs(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_mli_status ON monthly_location_inputs(status);
