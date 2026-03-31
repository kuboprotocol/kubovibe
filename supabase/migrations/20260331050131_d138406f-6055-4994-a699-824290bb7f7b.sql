-- Table to map platform users to their Stripe Connected Accounts
CREATE TABLE public.connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_account_id text NOT NULL UNIQUE,
  display_name text,
  contact_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connected accounts"
  ON public.connected_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connected accounts"
  ON public.connected_accounts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connected accounts"
  ON public.connected_accounts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Table for platform-level products linked to connected accounts
CREATE TABLE public.connect_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id text NOT NULL UNIQUE,
  stripe_price_id text,
  connected_account_id text NOT NULL,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.connect_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products"
  ON public.connect_products FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON public.connect_products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);