
CREATE TABLE public.gmail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  display_name text,
  avatar_url text,
  scope text NOT NULL DEFAULT '',
  refresh_token_ciphertext text NOT NULL,
  refresh_token_iv text NOT NULL,
  refresh_token_tag text NOT NULL,
  access_token_cache text,
  access_token_expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);

CREATE INDEX gmail_accounts_user_idx ON public.gmail_accounts (user_id);

ALTER TABLE public.gmail_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gmail owner select"
  ON public.gmail_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "gmail owner insert"
  ON public.gmail_accounts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gmail owner update"
  ON public.gmail_accounts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "gmail owner delete"
  ON public.gmail_accounts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "gmail service role all"
  ON public.gmail_accounts FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER gmail_accounts_touch
  BEFORE UPDATE ON public.gmail_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
