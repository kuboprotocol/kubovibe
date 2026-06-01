
-- 1) Update status check to include 'cancelled'
ALTER TABLE public.kubo_domain_transfers DROP CONSTRAINT IF EXISTS kubo_domain_transfers_status_check;
ALTER TABLE public.kubo_domain_transfers ADD CONSTRAINT kubo_domain_transfers_status_check
  CHECK (status = ANY (ARRAY['pending','validating','transferring','completed','failed','cancelled']));

-- 2) New columns
ALTER TABLE public.kubo_domain_transfers
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS notify_email text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_notified_status text;

CREATE INDEX IF NOT EXISTS idx_kubo_transfers_active_poll
  ON public.kubo_domain_transfers (next_retry_at)
  WHERE status IN ('pending','validating','transferring');

-- 3) Audit events table
CREATE TABLE IF NOT EXISTS public.kubo_domain_transfer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.kubo_domain_transfers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kubo_domain_transfer_events TO authenticated;
GRANT ALL ON public.kubo_domain_transfer_events TO service_role;

ALTER TABLE public.kubo_domain_transfer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transfer events" ON public.kubo_domain_transfer_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role manages transfer events" ON public.kubo_domain_transfer_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_transfer_events_transfer ON public.kubo_domain_transfer_events (transfer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_events_user ON public.kubo_domain_transfer_events (user_id, created_at DESC);
