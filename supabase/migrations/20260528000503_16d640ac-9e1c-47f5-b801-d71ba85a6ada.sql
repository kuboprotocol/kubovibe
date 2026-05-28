
-- 1) Audit reports: drop public storage policies
DROP POLICY IF EXISTS "Public can read audit reports" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload audit reports" ON storage.objects;

-- 2) Realtime channel policies for web3_connections and credit_transactions
CREATE POLICY "Users subscribe own web3_connections topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE ('web3_connections:user:' || (auth.uid())::text || '%')
  OR realtime.topic() NOT LIKE 'web3_connections:%'
);

CREATE POLICY "Users subscribe own credit_transactions topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE ('credit_transactions:user:' || (auth.uid())::text || '%')
  OR realtime.topic() NOT LIKE 'credit_transactions:%'
);

-- 3) GitHub OAuth state table (server-side nonce validation)
CREATE TABLE IF NOT EXISTS public.github_oauth_states (
  nonce text PRIMARY KEY,
  user_id uuid NOT NULL,
  return_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at timestamptz
);

GRANT ALL ON public.github_oauth_states TO service_role;
ALTER TABLE public.github_oauth_states ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: only service_role accesses this table.

-- 4) Hide referral_code column from regular users (service_role still has access)
REVOKE SELECT (referral_code) ON public.profiles FROM anon, authenticated;

-- 5) Restrict connect_products visibility to the creator
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.connect_products;
CREATE POLICY "Users can view own products"
ON public.connect_products
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);
