
-- Extensions for scheduled sync
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- OAuth state nonce table (server-side CSRF/replay protection)
CREATE TABLE public.gmail_oauth_states (
  nonce TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  origin TEXT NOT NULL,
  return_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at TIMESTAMPTZ
);

-- Auth-only writes via service role; no client access needed
GRANT ALL ON public.gmail_oauth_states TO service_role;

ALTER TABLE public.gmail_oauth_states ENABLE ROW LEVEL SECURITY;

-- No policy => clients cannot read/write; service_role bypasses RLS.

CREATE INDEX idx_gmail_oauth_states_expires ON public.gmail_oauth_states(expires_at);
