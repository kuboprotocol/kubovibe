CREATE TABLE public.orchestration_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('web2_app','web3_app','hybrid')),
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  stack JSONB NOT NULL DEFAULT '{}'::jsonb,
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orchestration_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own plans"
  ON public.orchestration_plans FOR SELECT
  USING (auth.uid() = user_id OR public.is_kubo_admin());

CREATE POLICY "Users insert own plans"
  ON public.orchestration_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own plans"
  ON public.orchestration_plans FOR UPDATE
  USING (auth.uid() = user_id OR public.is_kubo_admin());

CREATE INDEX idx_orchestration_plans_user_created
  ON public.orchestration_plans (user_id, created_at DESC);