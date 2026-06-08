-- Revoke public execute on the trigger function to satisfy the linter
-- The system still has access to run it as a trigger.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
