// Gerencia os tokens de longa duração do KUBO Local Agent.
//   GET    → lista as chaves do usuário (sem o hash)
//   POST   → cria uma chave; o texto puro volta UMA vez nesta resposta
//   DELETE → revoga (?id=<uuid>)
// Chamado pelo site com a sessão normal do usuário (verify_jwt = true).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const MAX_ACTIVE_KEYS = 10;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return "kubo_la_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ ok: false, error: "unauthorized" }, 401);
    const userId = userData.user.id;
    const admin = createClient(url, service);

    if (req.method === "GET") {
      const { data, error } = await admin
        .from("local_agent_keys")
        .select("id,name,key_prefix,created_at,last_used_at,revoked_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true, keys: data ?? [] });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const name = String(body.name ?? "Local Agent").trim().slice(0, 60) || "Local Agent";

      const { count } = await admin
        .from("local_agent_keys")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("revoked_at", null);
      if ((count ?? 0) >= MAX_ACTIVE_KEYS) {
        return json({ ok: false, error: `limite de ${MAX_ACTIVE_KEYS} tokens ativos — revogue um antes` }, 400);
      }

      const key = newKey();
      const { data, error } = await admin
        .from("local_agent_keys")
        .insert({ user_id: userId, name, key_prefix: key.slice(0, 14), key_hash: await sha256Hex(key) })
        .select("id,name,key_prefix,created_at")
        .single();
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true, key, record: data });
    }

    if (req.method === "DELETE") {
      const id = new URL(req.url).searchParams.get("id");
      if (!id) return json({ ok: false, error: "missing id" }, 400);
      const { error } = await admin
        .from("local_agent_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
        .is("revoked_at", null);
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ ok: false, error: "method not allowed" }, 405);
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
