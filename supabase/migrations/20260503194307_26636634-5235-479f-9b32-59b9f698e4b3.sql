CREATE TABLE public.generated_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.orchestration_plans(id) ON DELETE SET NULL,
  standard TEXT NOT NULL DEFAULT 'erc20' CHECK (standard IN ('erc20','erc721','erc1155','custom')),
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 18 CHECK (decimals BETWEEN 0 AND 36),
  initial_supply NUMERIC NOT NULL DEFAULT 0,
  source_code TEXT NOT NULL,
  solidity_version TEXT NOT NULL DEFAULT '0.8.24',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own contracts" ON public.generated_contracts
  FOR SELECT USING (auth.uid() = user_id OR public.is_kubo_admin());
CREATE POLICY "Users insert own contracts" ON public.generated_contracts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own contracts" ON public.generated_contracts
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_generated_contracts_user ON public.generated_contracts (user_id, created_at DESC);
CREATE INDEX idx_generated_contracts_plan ON public.generated_contracts (plan_id);

ALTER TABLE public.orchestration_plans
  ADD COLUMN task_states JSONB NOT NULL DEFAULT '{}'::jsonb;