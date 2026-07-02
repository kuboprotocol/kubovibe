CREATE TABLE IF NOT EXISTS public.ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_shown_at timestamptz NOT NULL DEFAULT now(),
  ad_type text NOT NULL DEFAULT 'interstitial',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, ad_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_impressions TO authenticated;
GRANT ALL ON public.ad_impressions TO service_role;
ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own ad impressions" ON public.ad_impressions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ad impressions" ON public.ad_impressions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ad impressions" ON public.ad_impressions FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS partnership_agreement_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_daily_credit_at timestamptz,
  ADD COLUMN IF NOT EXISTS signup_credits_granted boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.plan_config (
  plan text PRIMARY KEY,
  display_name text NOT NULL,
  price_usd numeric(10,2) NOT NULL DEFAULT 0,
  daily_credits numeric(10,2) NOT NULL DEFAULT 0,
  signup_credits numeric(10,2) NOT NULL DEFAULT 0,
  ad_frequency_hours integer,
  partnership_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_config TO anon, authenticated;
GRANT ALL ON public.plan_config TO service_role;
ALTER TABLE public.plan_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read plan_config" ON public.plan_config FOR SELECT USING (true);

INSERT INTO public.plan_config (plan, display_name, price_usd, daily_credits, signup_credits, ad_frequency_hours, partnership_required) VALUES
  ('free',       'Free',        0.00,   0,    5,   6,    false),
  ('starter',    'Starter',     4.99,   5,    0,   12,   false),
  ('pro',        'Pro',         19.99,  5,    0,   24,   false),
  ('premium_1',  'Premium 1',   49.99,  5,    0,   168,  false),
  ('premium_2',  'Premium 2',   79.99,  5,    0,   168,  false),
  ('business_1', 'Business 1',  99.99,  12,   0,   NULL, true),
  ('business_2', 'Business 2',  199.99, 50,   0,   NULL, true),
  ('business_3', 'Business 3',  299.99, 200,  0,   NULL, true),
  ('business_4', 'Business 4',  399.99, 400,  0,   NULL, true),
  ('business_5', 'Business 5',  499.99, 600,  0,   NULL, true),
  ('business_6', 'Business 6',  599.99, 800,  0,   NULL, true),
  ('business_7', 'Business 7',  699.99, 1000, 0,   NULL, true),
  ('enterprise', 'Enterprise',  0.00,   1200, 0,   NULL, true),
  ('beta',       'Beta',        0.00,   5,    0,   NULL, false)
ON CONFLICT (plan) DO UPDATE SET
  display_name=EXCLUDED.display_name, price_usd=EXCLUDED.price_usd,
  daily_credits=EXCLUDED.daily_credits, signup_credits=EXCLUDED.signup_credits,
  ad_frequency_hours=EXCLUDED.ad_frequency_hours, partnership_required=EXCLUDED.partnership_required;