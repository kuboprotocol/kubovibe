-- Rate limiting simples para edge functions (contador por user/janela)
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  bucket_key text NOT NULL,
  user_id uuid,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON public.rate_limit_counters(window_start);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages rate limits"
  ON public.rate_limit_counters FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Função: incrementa contador na janela atual e retorna o total
-- Uso: SELECT public.bump_rate_limit('github_auth', '<uid>', 60) -> int
CREATE OR REPLACE FUNCTION public.bump_rate_limit(_bucket text, _user uuid, _window_seconds int)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window timestamptz;
  _count int;
BEGIN
  _window := date_trunc('second', now()) - (extract(epoch from now())::int % _window_seconds) * interval '1 second';
  INSERT INTO public.rate_limit_counters (bucket_key, user_id, window_start, count)
  VALUES (_bucket, _user, _window, 1)
  ON CONFLICT (bucket_key, user_id, window_start)
  DO UPDATE SET count = public.rate_limit_counters.count + 1
  RETURNING count INTO _count;
  -- limpa janelas antigas oportunisticamente
  DELETE FROM public.rate_limit_counters WHERE window_start < now() - interval '1 hour';
  RETURN _count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, int) FROM PUBLIC, anon, authenticated;