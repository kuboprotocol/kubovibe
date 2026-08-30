// Registers an APNs (or FCM) push token for the KUBO Mobile Agent, so the backend can
// notify the user when a remote build/deploy finishes while the app is backgrounded.
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, supaAdmin, sanitizeError } from "../_shared/creative.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await getUser(req.headers.get("Authorization"));
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const token = String((body as any).apns_token ?? "").trim();
    const platform = String((body as any).platform ?? "ios");
    const appVersion = (body as any).app_version ? String((body as any).app_version).slice(0, 32) : null;

    if (token.length < 16 || token.length > 512) return json({ error: "invalid_token" }, 400);
    if (!["ios", "ipados", "android"].includes(platform)) return json({ error: "invalid_platform" }, 400);

    const admin = supaAdmin();

    if (req.method === "DELETE" || (body as any).action === "unregister") {
      await admin.from("mobile_devices").delete().eq("user_id", user.id).eq("apns_token", token);
      return json({ ok: true, unregistered: true });
    }

    const { data, error } = await admin
      .from("mobile_devices")
      .upsert(
        { user_id: user.id, apns_token: token, platform, app_version: appVersion },
        { onConflict: "apns_token" },
      )
      .select("id, platform, created_at")
      .single();
    if (error) throw error;

    return json({ ok: true, device: data });
  } catch (err) {
    console.error("[devices-register]", err);
    return json({ error: sanitizeError(err) }, 500);
  }
});
