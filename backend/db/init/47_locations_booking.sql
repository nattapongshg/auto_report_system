-- Extend `locations` with booking/overtime flags + Metabase master fields.
-- `requires_booking`, `enable_overtime`, etc. mirror ocpi_locations columns
-- so the report builder can conditionally show Booking Cost / Overtime Cost.
ALTER TABLE locations ADD COLUMN IF NOT EXISTS requires_booking BOOLEAN DEFAULT false;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS enable_overtime BOOLEAN DEFAULT false;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS overtime_price NUMERIC(12,2);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS idle_price NUMERIC(12,2);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS kwh_price NUMERIC(10,4);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS location_type TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS evse_count INTEGER;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS connector_count INTEGER;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS max_connector_power INTEGER;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS brands TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS power_types TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS operator_id UUID;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS ocpi_location_id UUID;  -- source id

CREATE INDEX IF NOT EXISTS idx_locations_requires_booking ON locations(requires_booking) WHERE requires_booking;
CREATE INDEX IF NOT EXISTS idx_locations_ocpi_id ON locations(ocpi_location_id);
