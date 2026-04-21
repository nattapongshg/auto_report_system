-- Migration: privilege_configs keyed by privilege_program_name (from Q1144)
-- Previously keyed by discount_label (Q1097's wallet_name + " Used")

ALTER TABLE privilege_configs
  ADD COLUMN IF NOT EXISTS privilege_program_name TEXT;

-- Allow lookup both ways during transition
CREATE UNIQUE INDEX IF NOT EXISTS uniq_privilege_program_name
  ON privilege_configs (privilege_program_name)
  WHERE privilege_program_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_privilege_program_name_active
  ON privilege_configs (privilege_program_name, is_active);

-- discount_label may contain multiple privilege programs (1:N).
-- Drop the old unique constraint if it exists; keep the column as an optional hint.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'privilege_configs_discount_label_key'
  ) THEN
    ALTER TABLE privilege_configs
      DROP CONSTRAINT privilege_configs_discount_label_key;
  END IF;
END $$;
