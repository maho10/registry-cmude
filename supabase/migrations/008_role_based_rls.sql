-- Replace anon-key access and blanket-authenticated access with role-scoped
-- policies. Roles are read from the Supabase Auth JWT's app_metadata.role
-- claim (set via the admin API when creating accounts — never user-settable).
--
-- 'admin'   — full CRUD on participants and event_config (admin dashboard).
-- 'scanner' — read one participant + update lunch/kit fields, and read
--             event_config (to compute today's phase). Same scope the old
--             anon policies had — this is a shared login for scan stations,
--             not per-person accountability.
--
-- Anon access is removed entirely: the public anon key must no longer be
-- able to touch participant data directly, since scan login is meant to be
-- the actual gate, not just a UI-level nicety.

DROP POLICY IF EXISTS "anon_select" ON participants;
DROP POLICY IF EXISTS "anon_update" ON participants;
DROP POLICY IF EXISTS "admin_all" ON participants;
DROP POLICY IF EXISTS "anon_read_config" ON event_config;
DROP POLICY IF EXISTS "admin_config" ON event_config;

CREATE POLICY "admin_all" ON participants
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "scanner_select" ON participants
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'scanner');

CREATE POLICY "scanner_update" ON participants
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'scanner')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'scanner');

CREATE POLICY "admin_config" ON event_config
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "scanner_read_config" ON event_config
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'scanner');
