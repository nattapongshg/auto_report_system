-- CA (Customer Account) on locations — links a station to its PEA/MEA meter.
-- MEA CAs tend to look like '000017187221' (12 digits, leading zeros);
-- PEA CAs like '020027426719'. Kept as TEXT to preserve leading zeros.
ALTER TABLE locations ADD COLUMN IF NOT EXISTS ca TEXT;
CREATE INDEX IF NOT EXISTS idx_locations_ca ON locations(ca);

-- Parsed PEA/MEA bills. One row per (provider, CA, year_month).
CREATE TABLE IF NOT EXISTS electricity_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL CHECK (provider IN ('mea','pea')),
    ca TEXT NOT NULL,
    year_month TEXT NOT NULL,          -- '2026-03' (billing period)
    kwh NUMERIC(14,2),
    amount NUMERIC(14,2),              -- pre-VAT electricity base (incl Ft)
    vat NUMERIC(14,2),
    total NUMERIC(14,2) NOT NULL,      -- VAT-inclusive — what the report uses
    invoice_no TEXT,
    bill_date DATE,                    -- Proc Date / issue date
    raw JSONB,                         -- original row for audit / debugging
    source_file TEXT,                  -- uploaded filename
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (provider, ca, year_month)
);

CREATE INDEX IF NOT EXISTS idx_electricity_bills_ca_ym ON electricity_bills(ca, year_month);
CREATE INDEX IF NOT EXISTS idx_electricity_bills_ym ON electricity_bills(year_month);

ALTER TABLE electricity_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON electricity_bills FOR ALL USING (true) WITH CHECK (true);
