-- Enable Realtime on participants (idempotent: safe even though this was
-- already applied manually via `supabase db query` on 2026-07-07)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE participants;
  END IF;
END $$;