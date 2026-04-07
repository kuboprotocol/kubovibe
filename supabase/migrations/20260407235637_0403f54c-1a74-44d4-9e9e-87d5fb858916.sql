CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ref_code text;
  _referrer_id uuid;
  _referrer_email text;
  _referred_name text;
  _supabase_url text;
  _service_key text;
BEGIN
  _ref_code := substr(NEW.id::text, 1, 8);
  _referred_name := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email);

  INSERT INTO public.profiles (id, display_name, referral_code)
  VALUES (NEW.id, _referred_name, _ref_code);

  _ref_code := NEW.raw_user_meta_data->>'referral_code';
  IF _ref_code IS NOT NULL AND _ref_code != '' THEN
    SELECT id INTO _referrer_id FROM public.profiles WHERE referral_code = _ref_code;
    IF _referrer_id IS NOT NULL AND _referrer_id != NEW.id THEN
      INSERT INTO public.referrals (referrer_id, referred_id, credits_awarded)
      VALUES (_referrer_id, NEW.id, 100);

      UPDATE public.subscriptions
      SET edits_limit = edits_limit + 100, updated_at = now()
      WHERE user_id = _referrer_id AND is_active = true;

      BEGIN
        SELECT email INTO _referrer_email FROM auth.users WHERE id = _referrer_id;
        IF _referrer_email IS NOT NULL THEN
          _supabase_url := current_setting('app.settings.supabase_url', true);
          _service_key := current_setting('app.settings.service_role_key', true);
          IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
            PERFORM net.http_post(
              url := _supabase_url || '/functions/v1/send-transactional-email',
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || _service_key
              ),
              body := jsonb_build_object(
                'templateName', 'referral-notification',
                'recipientEmail', _referrer_email,
                'idempotencyKey', 'referral-' || _referrer_id || '-' || NEW.id,
                'templateData', jsonb_build_object(
                  'referredName', _referred_name,
                  'creditsEarned', 100
                )
              )
            );
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to send referral notification: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;