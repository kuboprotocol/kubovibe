
-- Add referral_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- Backfill existing profiles with referral codes
UPDATE public.profiles SET referral_code = substr(id::text, 1, 8) WHERE referral_code IS NULL;

-- Create referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL UNIQUE,
  credits_awarded numeric NOT NULL DEFAULT 100,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id);

CREATE POLICY "System can insert referrals" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = referred_id);

-- Update handle_new_user to generate referral_code and process referral
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ref_code text;
  _referrer_id uuid;
BEGIN
  -- Generate referral code from user id
  _ref_code := substr(NEW.id::text, 1, 8);

  -- Create profile
  INSERT INTO public.profiles (id, display_name, referral_code)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), _ref_code);

  -- Process referral if ref code was provided
  _ref_code := NEW.raw_user_meta_data->>'referral_code';
  IF _ref_code IS NOT NULL AND _ref_code != '' THEN
    SELECT id INTO _referrer_id FROM public.profiles WHERE referral_code = _ref_code;
    IF _referrer_id IS NOT NULL AND _referrer_id != NEW.id THEN
      -- Record referral
      INSERT INTO public.referrals (referrer_id, referred_id, credits_awarded)
      VALUES (_referrer_id, NEW.id, 100);
      -- Credit the referrer
      UPDATE public.subscriptions
      SET edits_limit = edits_limit + 100, updated_at = now()
      WHERE user_id = _referrer_id AND is_active = true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
