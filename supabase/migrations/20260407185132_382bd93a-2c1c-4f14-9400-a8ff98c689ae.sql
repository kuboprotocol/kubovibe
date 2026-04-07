
CREATE TABLE public.ad_rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  reward_credits numeric NOT NULL DEFAULT 0.5,
  ad_type text NOT NULL DEFAULT 'unity_rewarded',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ad rewards" ON public.ad_rewards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ad rewards" ON public.ad_rewards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
