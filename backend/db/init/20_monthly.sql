-- Run in Supabase SQL Editor

-- Monthly raw data snapshots
CREATE TABLE IF NOT EXISTS monthly_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year_month VARCHAR(7) NOT NULL,          -- e.g. '2026-03'
    question_id INT NOT NULL,                 -- Metabase question ID
    total_rows INT NOT NULL DEFAULT 0,
    file_path VARCHAR(512),                   -- local path to JSON file
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | fetching | completed | failed
    error_message TEXT,
    fetched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(year_month, question_id)
);

ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON monthly_snapshots FOR ALL USING (true) WITH CHECK (true);

-- Add report config fields to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS email_recipients TEXT[];      -- array of emails
ALTER TABLE locations ADD COLUMN IF NOT EXISTS transaction_fee_rate NUMERIC(6,4) DEFAULT 0.0365;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS location_share_rate NUMERIC(6,4) DEFAULT 0.40;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_report_enabled BOOLEAN DEFAULT false;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS electricity_cost NUMERIC(12,2) DEFAULT 0;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS internet_cost NUMERIC(12,2) DEFAULT 0;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS etax NUMERIC(12,2) DEFAULT 0;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS transfer_fee NUMERIC(12,2) DEFAULT 30;

-- Batch run tracking
CREATE TABLE IF NOT EXISTS batch_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_id UUID NOT NULL REFERENCES monthly_snapshots(id),
    year_month VARCHAR(7) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed
    total_locations INT DEFAULT 0,
    completed_locations INT DEFAULT 0,
    failed_locations INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE batch_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON batch_runs FOR ALL USING (true) WITH CHECK (true);

-- Individual location report within a batch
CREATE TABLE IF NOT EXISTS batch_run_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_run_id UUID NOT NULL REFERENCES batch_runs(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    location_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed | sent
    row_count INT DEFAULT 0,
    revenue NUMERIC(12,2),
    file_name VARCHAR(255),
    file_path VARCHAR(512),
    email_sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE batch_run_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON batch_run_items FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_batch_items_run ON batch_run_items(batch_run_id);
