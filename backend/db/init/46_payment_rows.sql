-- Payment-centric raw rows (Q1145). Parallel to metabase_rows which holds the
-- older invoice-centric Q1144 shape. Once the payment flow is verified we can
-- drop the old table.
CREATE TABLE IF NOT EXISTS payment_rows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_id UUID NOT NULL REFERENCES monthly_snapshots(id) ON DELETE CASCADE,

    -- Payment primary
    payment_id UUID NOT NULL,
    payment_status TEXT,             -- 'paid' | 'refunded'
    refund_type TEXT,                -- 'full' | 'partial' | null
    payment_amount NUMERIC(14,2),
    refund_amount NUMERIC(14,2),
    net_amount NUMERIC(14,2),
    payment_provider TEXT,
    payment_transaction_id TEXT,
    refund_transaction_id TEXT,
    payment_created_bkk TIMESTAMPTZ,

    is_invoice_primary BOOLEAN,      -- true for one payment per invoice

    -- Invoice + session
    invoice_id UUID,
    invoice_status TEXT,
    organization_id UUID,
    etax_number TEXT,
    invoice_amount NUMERIC(14,2),
    total_discount NUMERIC(14,2),
    discount_label TEXT,
    reference_id TEXT,
    session_start_bkk TIMESTAMPTZ,
    session_end_bkk TIMESTAMPTZ,
    kwh NUMERIC(14,4),
    total_time NUMERIC(14,4),
    total_overtime NUMERIC(14,4),

    location_name TEXT,
    location_code TEXT,
    evse_name TEXT,
    user_email TEXT,
    privilege_program_name TEXT,
    vin TEXT,

    inserted_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_rows_snapshot ON payment_rows(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_payment_rows_location ON payment_rows(snapshot_id, location_name);
CREATE INDEX IF NOT EXISTS idx_payment_rows_invoice ON payment_rows(invoice_id);

ALTER TABLE payment_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON payment_rows FOR ALL USING (true) WITH CHECK (true);
