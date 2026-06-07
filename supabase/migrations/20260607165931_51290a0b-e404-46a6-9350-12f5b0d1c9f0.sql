CREATE OR REPLACE FUNCTION public.grant_credits(p_user_id UUID, p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, edits_used, edits_limit, is_active)
  VALUES (p_user_id, 'free', 0, 5 + p_amount, true)
  ON CONFLICT (user_id) DO UPDATE
  SET edits_limit = subscriptions.edits_limit + p_amount,
      updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_credits(UUID, NUMERIC) TO service_role;
