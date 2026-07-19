
-- Remove permissive read policy that exposed every profile column (including
-- stripe_customer_id and referral_code) to all authenticated users.
DROP POLICY IF EXISTS "Authenticated can read public profile fields" ON public.profiles;

-- Publish only truly public fields through a view. RLS on the underlying
-- table still applies via security_invoker, so we grant SELECT on the view
-- and expose the whitelisted columns only.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, display_name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;
