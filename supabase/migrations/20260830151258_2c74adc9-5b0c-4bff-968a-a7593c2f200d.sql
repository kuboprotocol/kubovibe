DO $$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'handle_new_user';

  IF def IS NULL THEN
    RAISE NOTICE 'handle_new_user not found; nothing to update';
    RETURN;
  END IF;

  IF position('/functions/v1/send-transactional-email' in def) > 0 THEN
    def := replace(def, '/functions/v1/send-transactional-email', '/functions/v1/send-referral-notification');
    EXECUTE def;
  END IF;
END $$;