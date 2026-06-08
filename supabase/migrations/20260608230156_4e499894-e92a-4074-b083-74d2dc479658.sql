CREATE TABLE IF NOT EXISTS public.creative_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  step TEXT NOT NULL,
  action TEXT NOT NULL,
  params JSONB,
  correlation_id TEXT,
  trace_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.creative_audit_trail TO authenticated;
GRANT ALL ON public.creative_audit_trail TO service_role;

ALTER TABLE public.creative_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit trail"
  ON public.creative_audit_trail FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audit trail"
  ON public.creative_audit_trail FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Ensure creative_assets has technical trace IDs
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'creative_assets' AND COLUMN_NAME = 'correlation_id') THEN
    ALTER TABLE public.creative_assets ADD COLUMN correlation_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'creative_assets' AND COLUMN_NAME = 'trace_id') THEN
    ALTER TABLE public.creative_assets ADD COLUMN trace_id TEXT;
  END IF;
END $$;
