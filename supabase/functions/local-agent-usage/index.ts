import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const COSTS: Record<string, number> = {
  local_agent_chat: 1,
  local_agent_edit: 2,
  local_agent_run: 4,
  local_agent_terminal: 0,
  local_agent_git: 0,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    if (!(action in COSTS)) return json({ ok: false, error: "invalid action" }, 400);

    const amount = COSTS[action];
    if (amount === 0) return json({ ok: true, charged: 0, balance_after: null });

    const admin = createClient(url, service);
    const { data, error } = await admin.rpc("execute_atomic_credit_deduction", {
      _user_id: userData.user.id,
      _amount: amount,
      _reason: action,
      _category: "local_agent",
      _metadata: {
        source: "kubo-agent",
        project_id: body.project_id ?? null,
      },
      _idempotency_key: body.idempotency_key ?? null,
    });

    if (error) return json({ ok: false, error: error.message }, 400);

    const result = data as { ok?: boolean; balance_after?: number; error?: string } | null;
    if (result && result.ok === false) return json({ ok: false, error: result.error }, 402);

    return json({ ok: true, charged: amount, balance_after: result?.balance_after ?? null });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
