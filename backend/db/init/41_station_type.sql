ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS station_type TEXT;

CREATE INDEX IF NOT EXISTS idx_locations_station_type ON locations(station_type);
