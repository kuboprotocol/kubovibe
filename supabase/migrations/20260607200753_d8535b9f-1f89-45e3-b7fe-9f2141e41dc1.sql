-- Revoga execução pública padrão
REVOKE EXECUTE ON FUNCTION public.execute_job_action(UUID, TEXT, UUID, TEXT) FROM PUBLIC;

-- Configura search_path seguro e mantém permissões apenas para usuários autenticados e service_role
ALTER FUNCTION public.execute_job_action(UUID, TEXT, UUID, TEXT) SET search_path = public;

GRANT EXECUTE ON FUNCTION public.execute_job_action(UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_job_action(UUID, TEXT, UUID, TEXT) TO service_role;
