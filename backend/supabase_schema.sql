-- Run this in Supabase Dashboard > SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Templates
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    definition JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Jobs
CREATE TABLE IF NOT EXISTS report_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES report_templates(id),
    trigger_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    manual_inputs JSONB,
    parameters JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INT DEFAULT 0 NOT NULL,
    max_retries INT DEFAULT 3 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Artifacts
CREATE TABLE IF NOT EXISTS report_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES report_jobs(id),
    s3_bucket VARCHAR(255),
    s3_key VARCHAR(512),
    file_name VARCHAR(255),
    file_size_bytes BIGINT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Deliveries
CREATE TABLE IF NOT EXISTS report_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES report_jobs(id),
    recipient_email VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ses_message_id VARCHAR(255),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status ON report_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_template ON report_jobs(template_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_job ON report_deliveries(job_id);

-- Enable RLS (Row Level Security) but allow service_role full access
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_deliveries ENABLE ROW LEVEL SECURITY;

-- Policies: service_role can do everything
CREATE POLICY "service_role_all" ON report_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON report_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON report_artifacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON report_deliveries FOR ALL USING (true) WITH CHECK (true);
