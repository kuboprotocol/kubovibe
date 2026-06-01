-- 1) IONOS contracts (1 per Kubo user, on-demand)
CREATE TABLE public.kubo_ionos_contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  contract_id text NOT NULL UNIQUE,
  admin_id text,
  reseller_reference text NOT NULL,
  plan text NOT NULL DEFAULT 'starter',
  resource_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kubo_ionos_contracts TO authenticated;
GRANT ALL ON public.kubo_ionos_contracts TO service_role;
ALTER TABLE public.kubo_ionos_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own contract" ON public.kubo_ionos_contracts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages contracts" ON public.kubo_ionos_contracts FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 2) Domains
CREATE TABLE public.kubo_domains (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contract_id text,
  ionos_domain_id text,
  domain_name text NOT NULL,
  tld text NOT NULL,
  source text NOT NULL CHECK (source IN ('purchase','transfer','connect')),
  status text NOT NULL DEFAULT 'pending',
  auto_renew boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  nameservers text[] DEFAULT '{}',
  project_id uuid,
  ssl_status text NOT NULL DEFAULT 'pending',
  credits_spent integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain_name)
);
CREATE INDEX idx_kubo_domains_user ON public.kubo_domains(user_id);
CREATE INDEX idx_kubo_domains_project ON public.kubo_domains(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kubo_domains TO authenticated;
GRANT ALL ON public.kubo_domains TO service_role;
ALTER TABLE public.kubo_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own domains" ON public.kubo_domains FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own domains" ON public.kubo_domains FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own domains" ON public.kubo_domains FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own domains" ON public.kubo_domains FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages domains" ON public.kubo_domains FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 3) Transfers
CREATE TABLE public.kubo_domain_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  domain_id uuid REFERENCES public.kubo_domains(id) ON DELETE CASCADE,
  domain_name text NOT NULL,
  auth_code text NOT NULL,
  current_registrar text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validating','transferring','completed','failed')),
  status_message text,
  ionos_transfer_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kubo_transfers_user ON public.kubo_domain_transfers(user_id);
GRANT SELECT, INSERT ON public.kubo_domain_transfers TO authenticated;
GRANT ALL ON public.kubo_domain_transfers TO service_role;
ALTER TABLE public.kubo_domain_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transfers" ON public.kubo_domain_transfers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own transfers" ON public.kubo_domain_transfers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages transfers" ON public.kubo_domain_transfers FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 4) DNS records
CREATE TABLE public.kubo_dns_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id uuid NOT NULL REFERENCES public.kubo_domains(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('A','AAAA','CNAME','TXT','MX','SRV','NS')),
  name text NOT NULL,
  value text NOT NULL,
  ttl integer NOT NULL DEFAULT 3600,
  priority integer,
  ionos_record_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kubo_dns_domain ON public.kubo_dns_records(domain_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kubo_dns_records TO authenticated;
GRANT ALL ON public.kubo_dns_records TO service_role;
ALTER TABLE public.kubo_dns_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own dns" ON public.kubo_dns_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own dns" ON public.kubo_dns_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own dns" ON public.kubo_dns_records FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own dns" ON public.kubo_dns_records FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages dns" ON public.kubo_dns_records FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 5) updated_at triggers
CREATE TRIGGER trg_kubo_ionos_contracts_updated BEFORE UPDATE ON public.kubo_ionos_contracts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_kubo_domains_updated BEFORE UPDATE ON public.kubo_domains FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_kubo_domain_transfers_updated BEFORE UPDATE ON public.kubo_domain_transfers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_kubo_dns_records_updated BEFORE UPDATE ON public.kubo_dns_records FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();