ALTER TABLE public.session_builds
  ADD COLUMN IF NOT EXISTS arch TEXT NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web';

CREATE INDEX IF NOT EXISTS idx_session_builds_arch ON public.session_builds(arch, created_at DESC);