-- Report Summary templates — layout + formulas for the Excel Summary sheet.
--
-- Named `report_layout_templates` to avoid colliding with the orphan
-- `report_templates` scaffold in 10_schema.sql (unused, 0 rows).
--
-- Each template defines:
--   * params:           static knobs (tx_rate, vat_rate, wht_rate, per_evse_internet, ...)
--   * summary_layout:   ordered list of rows rendered in the Summary sheet.
--                       Each row can be {row, kind, label, note, value, fill, bold, border}.
--                       `value` is a formula string evaluated against a context
--                       containing live variables (revenue, electricity_cost,
--                       internet_cost, etax, share_rate, evse_count, vat_rate, ...).
--   * share_basis:      'gp' | 'revenue' | 'dealer'  — drives which totals feed
--                       the template context.
--
-- `code` is the stable identifier used by the dispatcher in excel_builder.
-- locations.report_layout_template_id overrides the group default.

CREATE TABLE IF NOT EXISTS report_layout_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    share_basis TEXT NOT NULL DEFAULT 'gp',      -- gp | revenue
    layout_style TEXT NOT NULL DEFAULT 'standard', -- standard | dealer
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary_layout JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_default_for_group TEXT UNIQUE,
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE report_layout_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON report_layout_templates;
CREATE POLICY "service_role_all" ON report_layout_templates FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS report_layout_template_id UUID REFERENCES report_layout_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_locations_report_layout_template_id ON locations(report_layout_template_id);


-- ─────────────────────────────────────────────────────────────────
-- Seed 3 built-in templates
-- ─────────────────────────────────────────────────────────────────

-- 1) Standard GP — the default for most groups (Sharge, showroom, etc.)
INSERT INTO report_layout_templates (code, name, description, share_basis, is_default_for_group, is_builtin, params, summary_layout)
VALUES (
    'standard_gp',
    'Standard GP',
    'Gross-profit-based share. Location gets share_rate of (revenue − fees − electricity − internet − etax).',
    'gp',
    NULL,
    true,
    '{"tx_rate": 0.0365, "vat_rate": 0.07, "transfer_fee": 30}'::jsonb,
    '[
      {"row": 2, "kind": "header", "label": "Revenue", "value": "revenue"},
      {"row": 4, "label": "Transaction Fee", "note": "({{pct(tx_rate, 2)}} of Revenue)", "value": "revenue * tx_rate"},
      {"row": 5, "label": "VAT", "note": "({{pct(vat_rate)}} of Transaction Fee)", "value": "revenue * tx_rate * vat_rate"},
      {"row": 6, "label": "Transfer", "value": "transfer_fee"},
      {"row": 7, "label": "Total Fee", "value": "revenue * tx_rate * (1 + vat_rate) + transfer_fee", "border": "bottom"},
      {"row": 9, "label": "Electricity Cost", "value": "electricity_cost", "fill": "yellow", "bold": true},
      {"row": 10, "label": "Internet Cost", "value": "internet_cost"},
      {"row": 11, "note": "Vat {{pct(vat_rate)}}", "value": "internet_cost * (1 + vat_rate)"},
      {"row": 12, "label": "Etax", "value": "etax"},
      {"row": 13, "label": "Etax (Include Vat)", "note": "Vat {{pct(vat_rate)}}", "value": "etax * (1 + vat_rate)"},
      {"row": 14, "label": "คงเหลือ", "value": "revenue - revenue*tx_rate*(1+vat_rate) - transfer_fee - electricity_cost - internet_cost*(1+vat_rate) - etax*(1+vat_rate)", "bold": true, "border": "bottom"},
      {"row": 16, "kind": "share", "label": "{{location_name}}", "note": "({{pct(share_rate)}} of Gross Profit VAT Incl.)", "value": "(revenue - revenue*tx_rate*(1+vat_rate) - transfer_fee - electricity_cost - internet_cost*(1+vat_rate) - etax*(1+vat_rate)) * share_rate"},
      {"row": 17, "kind": "share", "label": "VAT", "note": "({{pct(vat_rate)}} of Cash In)", "value": "location_share - location_share/(1+vat_rate)"},
      {"row": 18, "kind": "share", "note": "(Before VAT)", "value": "location_share/(1+vat_rate)"},
      {"row": 20, "kind": "net_gp", "label": "Net GP", "note": "(VAT Included)", "value": "location_share"}
    ]'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    share_basis = EXCLUDED.share_basis,
    params = EXCLUDED.params,
    summary_layout = EXCLUDED.summary_layout,
    updated_at = now();

-- 2) Revenue share — Sharge (internal) locations. Simpler: share_rate of (revenue − internet).
INSERT INTO report_layout_templates (code, name, description, share_basis, is_default_for_group, is_builtin, params, summary_layout)
VALUES (
    'revenue_share',
    'Revenue Share',
    'Revenue-basis share. Location gets share_rate of (revenue − internet incl. VAT).',
    'revenue',
    'showroom',
    true,
    '{"vat_rate": 0.07}'::jsonb,
    '[
      {"row": 2, "kind": "header", "label": "Revenue", "value": "revenue"},
      {"row": 10, "label": "Internet Cost", "value": "internet_cost"},
      {"row": 11, "note": "Vat {{pct(vat_rate)}}", "value": "internet_cost * (1 + vat_rate)"},
      {"row": 16, "kind": "share", "label": "{{location_name}}", "note": "({{pct(share_rate)}} of Revenue)", "value": "(revenue - internet_cost*(1+vat_rate)) * share_rate"},
      {"row": 17, "kind": "share", "label": "VAT", "note": "({{pct(vat_rate)}} of Cash In)", "value": "location_share - location_share/(1+vat_rate)"},
      {"row": 18, "kind": "share", "note": "(Before VAT)", "value": "location_share/(1+vat_rate)"},
      {"row": 20, "kind": "net_gp", "label": "Net GP", "note": "(VAT Included)", "value": "location_share"}
    ]'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    share_basis = EXCLUDED.share_basis,
    params = EXCLUDED.params,
    summary_layout = EXCLUDED.summary_layout,
    updated_at = now();

-- 3) Dealer settlement — showroom_new_model (inverted share: location_share_rate = dealer's cut).
INSERT INTO report_layout_templates (code, name, description, share_basis, layout_style, is_default_for_group, is_builtin, params, summary_layout)
VALUES (
    'dealer_new_model',
    'Dealer Settlement (New Model)',
    'Dealer-settlement layout (revenue basis). share_rate = dealer cut; Sharge gets (1 − share_rate). Adds WHT both directions.',
    'revenue',
    'dealer',
    'showroom_new_model',
    true,
    '{"vat_rate": 0.07, "wht_rate": 0.03}'::jsonb,
    '[
      {"row": 2, "kind": "dealer_header", "label": "Total Revenue", "note": "Include VAT", "value": "revenue"},
      {"row": 4, "kind": "section", "label": "Expense"},
      {"row": 5, "label": "Net Revenue SHARGE", "note": "{{pct(sharge_rate)}} Top line revenue", "value": "revenue * sharge_rate"},
      {"row": 6, "label": "VAT", "note": "{{pct(vat_rate)}} of Revenue SHARGE", "value": "revenue*sharge_rate - revenue*sharge_rate/(1+vat_rate)"},
      {"row": 7, "label": "Revenue SHARGE", "note": "Before VAT", "value": "revenue*sharge_rate/(1+vat_rate)", "fill": "yellow", "bold": true},
      {"row": 8, "label": "Etax service fee", "value": "etax"},
      {"row": 9, "label": "Etax service fee (Vat)", "note": "{{pct(vat_rate)}} of etax service fee", "value": "etax * vat_rate"},
      {"row": 10, "label": "Internet", "note": "{{evse_count}} Sims", "value": "internet_cost"},
      {"row": 11, "label": "Internet (Vat)", "note": "Vat {{pct(vat_rate)}} for sims", "value": "internet_cost * vat_rate"},
      {"row": 12, "label": "Total Payment to SHARGE", "value": "revenue*sharge_rate + etax + etax*vat_rate + internet_cost + internet_cost*vat_rate", "fill": "orange", "bold": true},
      {"row": 14, "kind": "dealer_header", "label": "Revenue Dealer (Dealer invoice SHARGE) Include VAT", "value": "revenue"},
      {"row": 15, "label": "WHT(Sharge=>Dealer)", "value": "(revenue/(1+vat_rate)) * wht_rate"},
      {"row": 16, "label": "Sharge Fee (Include VAT)", "value": "total_payment_to_sharge"},
      {"row": 17, "label": "WHT(Dealer=>Sharge)", "value": "(total_payment_to_sharge/(1+vat_rate)) * wht_rate"},
      {"row": 18, "label": "ค่าใช้จ่าย Sharge หัก Dealer", "value": "total_payment_to_sharge - (total_payment_to_sharge/(1+vat_rate))*wht_rate"},
      {"row": 19, "label": "Total Payment to Dealer", "value": "revenue - (total_payment_to_sharge - (total_payment_to_sharge/(1+vat_rate))*wht_rate) - (revenue/(1+vat_rate))*wht_rate", "fill": "yellow", "bold": true},
      {"row": 22, "label": "Revenue Dealer", "note": "Include VAT", "value": "revenue"},
      {"row": 23, "label": "Electricity Usage (Include VAT)", "value": "electricity_cost"},
      {"row": 24, "label": "Net Profit Dealer", "value": "total_payment_to_dealer - electricity_cost", "fill": "orange", "bold": true}
    ]'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    share_basis = EXCLUDED.share_basis,
    params = EXCLUDED.params,
    summary_layout = EXCLUDED.summary_layout,
    updated_at = now();
