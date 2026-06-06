-- Set views to use security invoker mode (requires PG15+)
ALTER VIEW public.published_projects SET (security_invoker = on);
ALTER VIEW public.github_connections_safe SET (security_invoker = on);