import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, sanitizeError } from "../_shared/cors.ts";

const ALLOWED_ROLES = ["user", "moderator", "admin"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await caller.auth.getUser();
    const callerId = userData.user?.id;
    if (!callerId) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, service, { auth: { persistSession: false } });

    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin");
    if (!callerRoles || callerRoles.length === 0) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.display_name ?? "").trim() || email.split("@")[0];
    const role = ALLOWED_ROLES.includes(body.role) ? body.role : "user";
    const credits = Number.isFinite(Number(body.credits)) ? Math.max(0, Number(body.credits)) : 0;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "invalid_email" }, 400);

    const password = crypto.randomUUID().replace(/-/g, "") + "Aa1!";
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, created_by_admin: callerId },
    });
    if (createError || !created.user) return json({ error: createError?.message ?? "create_failed" }, 400);

    const newUserId = created.user.id;

    await admin.from("profiles").upsert({ id: newUserId, display_name: displayName }, { onConflict: "id" });
    await admin.from("user_roles").upsert({ user_id: newUserId, role }, { onConflict: "user_id,role" });

    if (credits > 0) {
      // Plan quota
      await admin.rpc("grant_credits", { p_user_id: newUserId, p_amount: credits });
      // Real ledger entry so the admin panels show the same numbers
      await admin.from("credit_transactions").insert({
        user_id: newUserId,
        delta: credits,
        balance_after: credits,
        reason: "admin_seed",
        category: "admin_grant",
        metadata: { created_by: callerId },
        idempotency_key: `admin-seed-${newUserId}`,
      });
    }


    return json({ user_id: newUserId, email, role, credits, temp_password: password });
  } catch (err) {
    return json({ error: sanitizeError(err) }, 500);
  }
});
