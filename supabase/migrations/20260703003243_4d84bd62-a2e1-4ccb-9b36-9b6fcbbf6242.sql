ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;