RIF_url TEXT,                    -- uploaded electricity bill image

    -- Preview numbers (calculated after submit, before approve)
    preview_rows INT,
    preview_revenue NUMERIC(12,2),
    preview_kwh NUMERIC(12,2),
    preview_gp NUMERIC(12,2),
    preview_share NUMERIC(12,2),

    -- Output (after generate)
    file_name VARCHAR(255),
    file_path VARCHAR(512),
    file_size_bytes BIGINT,

    -- Email
    email_sent_at TIMESTAMPTZ,
    email_error TEXT,

    -- Audit
    submitted_by TEXT,
    submitted_at TIMESTAMPTZ,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    UNIQUE(snapshot_id, location_id)
);

ALTER TABLE monthly_location_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON monthly_location_inputs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_mli_snapshot ON monthly_location_inputs(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_mli_status ON monthly_location_inputs(status);
