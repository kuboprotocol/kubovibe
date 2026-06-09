
-- Fix SECURITY DEFINER function access control issues
-- Only authenticated users should access these functions with proper authorization checks

-- 1. Revoke EXECUTE from anon role for find_referrer_by_code
REVOKE EXECUTE ON FUNCTION public.find_referrer_by_code(text) FROM anon;

-- 2. Revoke EXECUTE from anon role for get_creative_audit_logs  
REVOKE EXECUTE ON FUNCTION public.get_creative_audit_logs(text, text, uuid, text, text, text) FROM anon;

-- 3. Revoke EXECUTE from anon role for get_my_referral_code
REVOKE EXECUTE ON FUNCTION public.get_my_referral_code() FROM anon;

-- For authenticated users, these are acceptable since:
-- - find_referrer_by_code: returns UUID only, safe to share (used for referral lookups)
-- - get_my_referral_code: scoped to auth.uid(), returns only the caller's own code
-- - get_creative_audit_logs: has owner checks in the function logic and is used by the app
