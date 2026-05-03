CREATE TABLE public.contract_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contract_id UUID NOT NULL REFERENCES public.generated_contracts(id) ON DELETE CASCADE,
  network TEXT NOT NULL DEFAULT 'sepolia',
  chain_id INTEGER NOT NULL DEFAULT 11155111,
  contract_address TEXT NOT NULL,
  deployer_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  block_number BIGINT,
  gas_used TEXT,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  abi JSONB NOT NULL DEFAULT '[]'::jsonb,
  explorer_url TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own deployments" ON public.contract_deployments
  FOR SELECT USING (auth.uid() = user_id OR public.is_kubo_admin());
CREATE POLICY "Users insert own deployments" ON public.contract_deployments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_contract_deployments_contract ON public.contract_deployments(contract_id);
CREATE INDEX idx_contract_deployments_user ON public.contract_deployments(user_id);