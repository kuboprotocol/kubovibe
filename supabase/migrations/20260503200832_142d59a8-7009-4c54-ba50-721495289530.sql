-- Funções de fila pgmq: usadas só pelo backend (service_role)
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- Trigger handler — nunca chamado diretamente
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Helpers admin: só admin signed-in pode chamar via RPC, anon não
REVOKE EXECUTE ON FUNCTION public.admin_clear_connector_run(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_connector_runs(text, integer) FROM PUBLIC, anon;

-- is_kubo_admin é usado em policies RLS — precisa estar executável por authenticated;
-- mas anon não deve poder chamar via RPC.
REVOKE EXECUTE ON FUNCTION public.is_kubo_admin() FROM PUBLIC, anon;