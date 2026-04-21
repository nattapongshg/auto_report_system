-- Report Schedules: auto-generate + send reports on a recurring day-of-month
CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location_ids UUID[] NOT NULL DEFAULT '{}',
    trigger_day INT NOT NULL CHECK (trigger_day BETWEEN 1 AND 28),
    is_active BOOLEAN DEFAULT true NOT NULL,

    -- Run tracking
    last_run_at TIMESTAMPTZ,
    last_run_status TEXT,          -- 'success' | 'partial' | 'failed'
    last_run_detail JSONB,          -- {sent: N, failed: M, skipped: K, errors: [...]}

    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON report_schedules FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_schedule_active_day ON report_schedules(is_active, trigger_day);
