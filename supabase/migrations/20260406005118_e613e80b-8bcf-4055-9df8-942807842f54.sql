ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS published_url text,
ADD COLUMN IF NOT EXISTS published_at timestamp with time zone;