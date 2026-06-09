
-- Fix SECURITY DEFINER function access control - restrict triggers and sensitive functions

-- Revoke default public access (the '-' role) from trigger functions that should NOT be callable
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_creative_status_change() FROM PUBLIC;

-- Restrict get_creative_audit_logs to authenticated only (sensitive audit data)
REVOKE EXECUTE ON FUNCTION public.get_creative_audit_logs(text, text, uuid, text, text, text) FROM PUBLIC;

-- Restrict get_my_referral_code to authenticated only (personal data scoped to auth.uid)
REVOKE EXECUTE ON FUNCTION public.get_my_referral_code() FROM PUBLIC;

-- find_referrer_by_code can remain public as it only returns a UUID for referral lookups
-- This is similar to a public lookup function, but we'll keep it authenticated for now for consistency
REVOKE EXECUTE ON FUNCTION public.find_referrer_by_code(text) FROM PUBLIC;
