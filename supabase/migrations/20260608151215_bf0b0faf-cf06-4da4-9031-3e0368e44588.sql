ALTER TABLE public.creative_assets ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users;
ALTER TABLE public.creative_assets ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.creative_assets ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.notify_creative_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status IN ('completed', 'failed', 'cancelled', 'error')) THEN
    PERFORM
      net.http_post(
        url := (SELECT value FROM settings WHERE key = 'supabase_url') || '/functions/v1/creative-status-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM settings WHERE key = 'service_role_key')
        ),
        body := jsonb_build_object(
          'asset_id', NEW.id,
          'user_id', NEW.user_id,
          'status', NEW.status,
          'tool', NEW.tool
        )
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_creative_status_change ON public.creative_assets;
CREATE TRIGGER on_creative_status_change
  AFTER UPDATE OF status ON public.creative_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_creative_status_change();
