-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Participants table
CREATE TABLE participants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  package_type      TEXT NOT NULL CHECK (package_type IN ('full', 'partial')),
  diet_type         TEXT,
  food_restrictions TEXT,

  lunch_day_1       BOOLEAN NOT NULL DEFAULT FALSE,
  lunch_day_1_at    TIMESTAMPTZ,
  lunch_day_2       BOOLEAN NOT NULL DEFAULT FALSE,
  lunch_day_2_at    TIMESTAMPTZ,
  lunch_day_3       BOOLEAN NOT NULL DEFAULT FALSE,
  lunch_day_3_at    TIMESTAMPTZ,
  lunch_day_4       BOOLEAN NOT NULL DEFAULT FALSE,
  lunch_day_4_at    TIMESTAMPTZ,
  lunch_day_5       BOOLEAN NOT NULL DEFAULT FALSE,
  lunch_day_5_at    TIMESTAMPTZ,
  lunch_day_6       BOOLEAN NOT NULL DEFAULT FALSE,
  lunch_day_6_at    TIMESTAMPTZ,

  arrival_kit       BOOLEAN NOT NULL DEFAULT FALSE,
  arrival_kit_at    TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event configuration (always single row, id=1)
CREATE TABLE event_config (
  id           INTEGER PRIMARY KEY DEFAULT 1,
  event_name   TEXT NOT NULL DEFAULT 'CMUDE',
  start_date   DATE NOT NULL
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_config ENABLE ROW LEVEL SECURITY;

-- Anon: read any participant by ID (scanner fetches one record at a time)
CREATE POLICY "anon_select" ON participants
  FOR SELECT TO anon
  USING (true);

-- Anon: update checkbox fields only (UUIDs are unguessable; idempotent booleans)
CREATE POLICY "anon_update" ON participants
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Authenticated (admin): full access to participants
CREATE POLICY "admin_all" ON participants
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon: read event config (needed to compute current lunch day)
CREATE POLICY "anon_read_config" ON event_config
  FOR SELECT TO anon
  USING (true);

-- Authenticated: full access to event config
CREATE POLICY "admin_config" ON event_config
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable Realtime for participants (run in Supabase dashboard or via CLI)
-- ALTER PUBLICATION supabase_realtime ADD TABLE participants;
