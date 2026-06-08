// Edge function: skill-import-cancel
// Two modes:
//  - { action: "cancel-import", importId }  → marks skill_imports.cancel_requested=true,
//      sets status=failed if still pending, removes the underlying storage object.
//  - { action: "cancel-upload", storagePath } → just removes the in-flight storage object
//      (used when a local upload was aborted before the DB row was inserted).
// Admin-only (kuboprotocol@gmail.com), JWT validated in code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};


const BUCKET = "skill-uploads";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "missing_token" }, 401);

    // Validate JWT and get user
    const authClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "invalid_token" }, 401);
    const { data: roleData } = await authClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (action === "cancel-upload") {
      const storagePath = String(body?.storagePath ?? "");
      if (!storagePath) return json({ error: "missing_storagePath" }, 400);
      // Best-effort cleanup; ignore not-found
      const { error: rmErr } = await admin.storage.from(BUCKET).remove([storagePath]);
      return json({ ok: true, removed: !rmErr, error: rmErr?.message ?? null });
    }

    if (action === "cancel-import") {
      const importId = String(body?.importId ?? "");
      if (!importId) return json({ error: "missing_importId" }, 400);

      const { data: row, error: selErr } = await admin
        .from("skill_imports")
        .select("id, status, storage_path, logs")
        .eq("id", importId)
        .maybeSingle();
      if (selErr) return json({ error: selErr.message }, 500);
      if (!row) return json({ error: "not_found" }, 404);

      const nextStatus = row.status === "pending" ? "failed" : row.status;
      const logs = Array.isArray(row.logs) ? row.logs : [];
      logs.push({
        step: "cancel",
        level: "warn",
        message: "Cancelamento confirmado pelo endpoint",
        at: new Date().toISOString(),
      });

      const { error: updErr } = await admin
        .from("skill_imports")
        .update({
          cancel_requested: true,
          status: nextStatus,
          logs,
          notes: "Cancelado via endpoint /skill-import-cancel",
          progress: { step: "queued", percent: 0 },
        })
        .eq("id", importId);
      if (updErr) return json({ error: updErr.message }, 500);

      if (row.storage_path) {
        await admin.storage.from(BUCKET).remove([row.storage_path]);
      }
      return json({ ok: true, importId, status: nextStatus });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal_error";
    return json({ error: msg }, 500);
  }
});
