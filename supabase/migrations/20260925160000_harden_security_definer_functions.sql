-- Endurece funções SECURITY DEFINER apontadas pelo Security Advisor.

-- 1. apply_daily_credits: só o pg_cron ("apply-daily-credits", 03:00 UTC,
--    roda como dono) deve chamar. Antes qualquer visitante anônimo podia
--    disparar via /rest/v1/rpc/apply_daily_credits.
REVOKE EXECUTE ON FUNCTION public.apply_daily_credits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_daily_credits() TO service_role;

-- 2. get_my_referral_code: lê o código do próprio usuário (auth.uid());
--    para anônimos não faz sentido. Continua liberada para logados.
REVOKE EXECUTE ON FUNCTION public.get_my_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_code() TO authenticated, service_role;

-- 3. has_role(_role): usada nas policies de deployments/runtime_errors/
--    user_roles (todas TO authenticated) e pelo painel admin. Anônimo não
--    precisa.
REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated, service_role;

-- 4. has_role(_user_id, _role): as edge functions cloud-sessions e
--    push-notify chamam esta assinatura com o service role (não há
--    auth.uid() ali), mas ela não existia — a RPC falhava e nenhum admin
--    era reconhecido. Restrita ao service_role: recebe um user_id
--    arbitrário, então não pode ficar exposta a usuários.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO service_role;
