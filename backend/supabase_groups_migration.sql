-- Location groups for consolidated group reports
ALTER TABLE locations ADD COLUMN IF NOT EXISTS group_name TEXT;
CREATE INDEX IF NOT EXISTS idx_locations_group_name ON locations(group_name);

-- Track group report sends (parallel to monthly_location_inputs but for groups)
CREATE TABLE IF NOT EXISTS group_report_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES monthly_snapshots(id) ON DELETE CASCADE,
    group_name TEXT NOT NULL,
    year_month TEXT NOT NULL,

    -- Aggregate inputs (user-entered at send time)
    electricity_cost NUMERIC(12,2),
    internet_cost NUMERIC(12,2),
    etax NUMERIC(12,2),
    bill_image_urls TEXT[],           -- array of uploaded bill images

    -- Preview aggregates (computed across all locations in group)
    preview_rows INT,
    preview_revenue NUMERIC(14,2),
    preview_kwh NUMERIC(14,2),
    preview_gp NUMERIC(14,2),
    preview_share NUMERIC(14,2),
    location_count INT,

    status TEXT DEFAULT 'pending' NOT NULL,  -- pending | generating | sent | failed

    file_name VARCHAR(255),
    file_path VARCHAR(512),
    file_size_bytes BIGINT,

    email_sent_at TIMESTAMPTZ,
    email_error TEXT,

    submitted_by TEXT,
    submitted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    UNIQUE(snapshot_id, group_name)
);

ALTER TABLE group_report_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON group_report_inputs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_gri_snapshot ON group_report_inputs(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_gri_status ON group_report_inputs(status);
