export async function fetchTelemetryProxy(resource: RequestInfo, init?: RequestInit) {
  const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : (resource as Request).url;
  if (!url.includes('/api/pwa/telemetry')) {
    return fetch(resource, init);
  }

  // Local telemetry mock handler: will try to resolve session and return stored events.
  try {
    const { supabase } = await import("../integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // @ts-ignore - runtime-only
    const { getTelemetryEvents, clearTelemetry } = await import('../utils/pwaTelemetry');
    const events = getTelemetryEvents();

    if (init?.method === 'DELETE') {
      clearTelemetry();
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response(JSON.stringify(events), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Telemetry proxy failed' , detail: String(err)}), { status: 500 });
  }
}
