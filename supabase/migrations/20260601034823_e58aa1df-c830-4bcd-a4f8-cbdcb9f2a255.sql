
DO $$
DECLARE _key text;
BEGIN
  -- Reuse the same service_role_key value used by email infra if available; otherwise inject via app setting
  SELECT decrypted_secret INTO _key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  IF _key IS NULL THEN
    SELECT decrypted_secret INTO _key FROM vault.decrypted_secrets WHERE name = 'kubo_domain_cron_key' LIMIT 1;
  END IF;

  -- If we have a key, ensure it's also stored under our name
  IF _key IS NOT NULL THEN
    PERFORM vault.create_secret(_key, 'kubo_domain_cron_key', 'Service role key used by Kubo domain transfer cron')
    WHERE NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'kubo_domain_cron_key');
  END IF;
END $$;

-- Re-schedule with the right vault key name
SELECT cron.unschedule('kubo-domain-transfer-poll')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kubo-domain-transfer-poll');

SELECT cron.schedule(
  'kubo-domain-transfer-poll',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dlqmmubasyldcylhnqqd.supabase.co/functions/v1/domain-transfer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'kubo_domain_cron_key' LIMIT 1),
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
      )
    ),
    body := jsonb_build_object('action', 'cron_poll')
  );
  $$
);
