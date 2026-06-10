CREATE TABLE public.skill_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_slug TEXT NOT NULL,
  skill_name TEXT,
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'succeeded', 'failed'
  error_message TEXT,
  credits_charged INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_executions TO authenticated;
GRANT ALL ON public.skill_executions TO service_role;

-- RLS
ALTER TABLE public.skill_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own skill executions"
  ON public.skill_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own skill executions"
  ON public.skill_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all skill executions"
  ON public.skill_executions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indices for performance
CREATE INDEX idx_skill_executions_user_id ON public.skill_executions(user_id);
CREATE INDEX idx_skill_executions_skill_slug ON public.skill_executions(skill_slug);
CREATE INDEX idx_skill_executions_created_at ON public.skill_executions(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_skill_executions_updated_at
    BEFORE UPDATE ON public.skill_executions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();