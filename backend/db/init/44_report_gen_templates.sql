-- Saved "Report Generation" templates — pre-configured group + email mapping
-- so the operator can rerun the same batch each month with a single click.
CREATE TABLE IF NOT EXISTS report_gen_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    group_name TEXT,                  -- optional filter (e.g. 'showroom')
    location_ids UUID[] NOT NULL DEFAULT '{}',
    email_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {location_id: [emails]}
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE report_gen_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON report_gen_templates FOR ALL USING (true) WITH CHECK (true);
