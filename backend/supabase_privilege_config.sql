-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS privilege_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discount_label VARCHAR(255) UNIQUE NOT NULL,   -- matches Metabase discount_label
    display_name VARCHAR(255) NOT NULL,            -- clean name for reports
    privilege_type VARCHAR(20) NOT NULL,           -- 'credit' | 'percent' | 'mixed'
    share_rate NUMERIC(10,4),                      -- NULL = use total_discount as-is, has value = kwh * share_rate
    notes TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE privilege_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON privilege_configs FOR ALL USING (true) WITH CHECK (true);

-- PERCENT (customer pays, discount is reduction)
INSERT INTO privilege_configs (discount_label, display_name, privilege_type) VALUES
('Platinum Tier Used', 'Platinum Tier', 'percent'),
('Gold Tier Used', 'Gold Tier', 'percent'),
('Silver Tier Used', 'Silver Tier', 'percent'),
('Unlock Gold Charging Rate Used', 'Unlock Gold Rate', 'percent'),
('PORSCHE Privilege Program Used', 'Porsche Privilege', 'percent'),
('Shell Platinum Used', 'Shell Platinum', 'percent'),
('PrivilegeShellGO+ Used', 'Shell GO+', 'percent'),
('Scandinavian Auto Used', 'Scandinavian Auto', 'percent'),
('KrungSri Wallet Used', 'KrungSri Wallet', 'percent'),
('LINE MAN Driver - สิทธิ์ชาร์จไฟฟ้าราคาพิเศษ Used', 'LINE MAN Driver', 'percent'),
('Grab Driver - สิทธิ์ชาร์จไฟฟ้าราคาพิเศษ Used', 'Grab Driver', 'percent')
ON CONFLICT (discount_label) DO NOTHING;

-- CREDIT (customer pays 0, share_rate NULL = use total_discount)
INSERT INTO privilege_configs (discount_label, display_name, privilege_type, share_rate) VALUES
('Shell x Hyundai Used', 'Shell x Hyundai', 'credit', NULL),
('Siri Campus Free Charging (BUS) Used', 'Siri Campus Bus', 'credit', NULL),
('HTAS credit balance  Used', 'HTAS Credit', 'credit', NULL),
('ABB CREDIT MEX25 Used', 'ABB Credit MEX25', 'credit', NULL),
('SHARGE Wallet Used', 'Sharge Wallet', 'credit', NULL),
('Mercedes Manufacturing group Used', 'Mercedes Mfg', 'credit', NULL),
('Thai prestige - Privilege Used', 'Thai Prestige', 'credit', NULL),
('Charging credit THB500 Used', 'Credit 500 THB', 'credit', NULL),
('Denza Dynasty Chiangmai Privilege Used', 'Denza Chiangmai', 'credit', NULL),
('Denza CAC Chonburi Privilege Used', 'Denza Chonburi', 'credit', NULL)
ON CONFLICT (discount_label) DO NOTHING;

-- MIXED (mostly credit, sometimes partial payment)
INSERT INTO privilege_configs (discount_label, display_name, privilege_type, share_rate) VALUES
('FGF Credit 30K Used', 'Friend get Friends 30K', 'mixed', NULL),
('Unlimited DC Charging Used', 'Mercedes Free charging', 'mixed', 6.40),
('THE ZEEKR PRIVILEGE PROGRAM Used', 'Zeekr Privilege', 'mixed', NULL),
('Shell Credit Balance Used', 'Shell Credit', 'mixed', NULL),
('Special credit 50K Used', 'Special Deal 50k', 'mixed', NULL),
('Special credit THB 5k (PORSCHE) Used', 'Porsche Credit 5K', 'mixed', NULL),
('Privilege 20K Used', 'Privilege 20K', 'mixed', NULL),
('SHARGE VALENTINE 26 Used', 'Sharge Valentine', 'mixed', NULL),
('Bangchak charging credit Used', 'Bangchak Credit', 'mixed', NULL),
('Porsche Wallet Used', 'Porsche Wallet', 'mixed', NULL)
ON CONFLICT (discount_label) DO NOTHING;
