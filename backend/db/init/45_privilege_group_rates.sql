-- Per-group rate overrides for privilege configs.
-- Example: Mercedes Free charging has default share_rate=7.2/kWh, but when
-- used at Shell gas stations Sharge bills Mercedes at 9.0/kWh. That's a
-- (privilege='Mercedes Free charging', group='shell', rate=9.0) override.
--
-- Resolution: calc_revenue picks group_rates[privilege_id][location.group_name]
-- if present, otherwise falls back to privilege_configs.share_rate.
CREATE TABLE IF NOT EXISTS privilege_group_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    privilege_config_id UUID NOT NULL REFERENCES privilege_configs(id) ON DELETE CASCADE,
    group_name TEXT NOT NULL,         -- matches locations.group_name
    share_rate NUMERIC(10,4) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (privilege_config_id, group_name)
);

CREATE INDEX IF NOT EXISTS idx_pgr_privilege ON privilege_group_rates(privilege_config_id);
CREATE INDEX IF NOT EXISTS idx_pgr_group ON privilege_group_rates(group_name);

ALTER TABLE privilege_group_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON privilege_group_rates FOR ALL USING (true) WITH CHECK (true);
