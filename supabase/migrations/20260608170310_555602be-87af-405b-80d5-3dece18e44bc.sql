CREATE TABLE public.creative_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_cancel BOOLEAN NOT NULL DEFAULT true,
  notify_retry BOOLEAN NOT NULL DEFAULT true,
  include_investigation_link BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_notification_preferences TO authenticated;
GRANT ALL ON public.creative_notification_preferences TO service_role;

ALTER TABLE public.creative_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notification preferences"
  ON public.creative_notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_creative_notification_preferences_updated_at
BEFORE UPDATE ON public.creative_notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
