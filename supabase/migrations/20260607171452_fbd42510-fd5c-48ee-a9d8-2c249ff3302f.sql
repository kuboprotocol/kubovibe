-- Criar RPC seguro para log de atividade (substitui o insert direto do cliente)
CREATE OR REPLACE FUNCTION public.log_connector_activity(
  _connector_slug text,
  _event_type text,
  _message text,
  _status text DEFAULT 'info'::text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _id UUID;
  _user_id UUID := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.connector_activity_logs (
    user_id, connector_slug, event_type, message, status, metadata
  ) VALUES (
    _user_id, _connector_slug, _event_type, _message, _status, _metadata
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_connector_activity(text, text, text, text, jsonb) TO authenticated;
