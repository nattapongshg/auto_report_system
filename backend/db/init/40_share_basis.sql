ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS share_basis TEXT NOT NULL DEFAULT 'gp'
  CHECK (share_basis IN ('gp', 'revenue'));

CREATE INDEX IF NOT EXISTS idx_locations_share_basis ON locations(share_basis);
