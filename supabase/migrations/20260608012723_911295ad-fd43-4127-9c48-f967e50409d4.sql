-- 1. Restore public wrappers as SECURITY INVOKER
-- These call the hardened logic in the 'internal' schema.

CREATE OR REPLACE FUNCTION public.is_kubo_admin()
 RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS 
$$ SELECT internal.is_kubo_admin(); $$;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
 RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS 
$$ SELECT internal.is_admin(p_user_id); $$;

CREATE OR REPLACE FUNCTION public.execute_atomic_credit_deduction(_user_id uuid, _amount integer, _reason text, _category text DEFAULT 'general'::text, _metadata jsonb DEFAULT '{}'::jsonb, _idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS 
$$ SELECT internal.execute_atomic_credit_deduction(_user_id, _amount, _reason, _category, _metadata, _idempotency_key); $$;

CREATE OR REPLACE FUNCTION public.bump_rate_limit(_bucket text, _user uuid, _window_seconds integer)
 RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS 
$$ SELECT internal.bump_rate_limit(_bucket, _user, _window_seconds); $$;

CREATE OR REPLACE FUNCTION public.log_security_audit(_action text, _resource_type text, _resource_id text DEFAULT NULL::text, _job_id text DEFAULT NULL::text, _request_id text DEFAULT NULL::text, _ip inet DEFAULT NULL::inet, _user_agent text DEFAULT NULL::text, _success boolean DEFAULT true, _error_message text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb, _actor_user_id uuid DEFAULT NULL::uuid, _actor_role text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS 
$$ SELECT internal.log_security_audit(_action, _resource_type, _resource_id, _job_id, _request_id, _ip, _user_agent, _success, _error_message, _metadata, _actor_user_id, _actor_role); $$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS 
$$ SELECT internal.enqueue_email(queue_name, payload); $$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS 
$$ SELECT internal.delete_email(queue_name, message_id); $$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS 
$$ SELECT internal.move_to_dlq(source_queue, dlq_name, message_id, payload); $$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb) LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS 
$$ SELECT * FROM internal.read_email_batch(queue_name, batch_size, vt); $$;

CREATE OR REPLACE FUNCTION public.grant_credits(p_user_id uuid, p_amount numeric)
 RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS 
$$ SELECT internal.grant_credits(p_user_id, p_amount); $$;

CREATE OR REPLACE FUNCTION public.admin_list_connector_runs(_connector_slug text, _limit integer DEFAULT 50)
 RETURNS TABLE(run_id text, run_label text, event_count bigint, started_at timestamp with time zone, user_id uuid, is_mine boolean) LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS 
$$ SELECT * FROM internal.admin_list_connector_runs(_connector_slug, _limit); $$;

CREATE OR REPLACE FUNCTION public.admin_clear_connector_run(_connector_slug text, _run_id text)
 RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS 
$$ SELECT internal.admin_clear_connector_run(_connector_slug, _run_id); $$;

-- 2. Grant EXECUTE to authenticated and service_role for these wrappers
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
