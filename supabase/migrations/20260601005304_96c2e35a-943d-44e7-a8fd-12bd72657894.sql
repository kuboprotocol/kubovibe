
ALTER TABLE public.skill_imports
  ADD COLUMN IF NOT EXISTS progress JSONB NOT NULL DEFAULT '{"step":"queued","percent":0}'::jsonb;

ALTER TABLE public.skill_imports REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'skill_imports'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.skill_imports';
  END IF;
END $$;
