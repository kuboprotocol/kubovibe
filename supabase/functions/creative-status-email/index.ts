import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { asset_id, status, user_id, tool, reason, execution_id } = await req.json();
    if (!user_id || !asset_id || !status) {
      return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400, headers: corsHeaders });
    }

    const [{ data: profile }, { data: prefs }, { data: branding }] = await Promise.all([
      supabase.from("profiles").select("email, display_name").eq("id", user_id).maybeSingle(),
      supabase.from("creative_notification_preferences").select("*").eq("user_id", user_id).maybeSingle(),
      supabase.from("creative_org_branding").select("*").maybeSingle(),
    ]);

    if (!profile?.email) {
      return new Response(JSON.stringify({ error: "no_email" }), { status: 400, headers: corsHeaders });
    }

    // Honor preferences (default = notify)
    if (status === "cancelled" && prefs && prefs.notify_cancel === false) {
      return new Response(JSON.stringify({ skipped: "notify_cancel_off" }), { headers: corsHeaders });
    }
    if ((status === "retrying" || status === "processing") && prefs && prefs.notify_retry === false) {
      return new Response(JSON.stringify({ skipped: "notify_retry_off" }), { headers: corsHeaders });
    }

    const orgName = (branding as any)?.org_name || "Kubo Vibe";
    const logoUrl = (branding as any)?.logo_url || "";
    const primaryColor = (branding as any)?.primary_color || "#C9941A";
    const siteUrl = Deno.env.get("SITE_URL") || "https://kubovibe.dev";
    const includeLink = !prefs || prefs.include_investigation_link !== false;

    const subjects: Record<string, string> = {
      failed: `❌ Falha na execução: ${tool}`,
      error: `❌ Erro na execução: ${tool}`,
      cancelled: `⚠️ Execução cancelada: ${tool}`,
      completed: `✅ Execução concluída: ${tool}`,
      retrying: `🔄 Reenfileirando: ${tool}`,
      processing: `🔄 Reenfileirando: ${tool}`,
    };
    const themeColors: Record<string, string> = {
      failed: "#ef4444", error: "#ef4444",
      cancelled: "#f59e0b", completed: "#10b981",
      retrying: "#3b82f6", processing: "#3b82f6",
    };
    const labels: Record<string, string> = {
      failed: "Falhou", error: "Erro", cancelled: "Cancelado",
      completed: "Concluído", retrying: "Reenfileirado", processing: "Reenfileirado",
    };

    const statusColor = themeColors[status] || primaryColor;
    const label = labels[status] || status;
    const investigateUrl = `${siteUrl}/creative/investigation?investigate=${asset_id}`;

    await supabase.rpc("enqueue_email", {
      queue_name: "auth_emails",
      payload: {
        to: profile.email,
        from: `${orgName} <noreply@kubovibe.dev>`,
        subject: subjects[status] || `Atualização: ${tool}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
            <div style="background:${statusColor};padding:20px;text-align:center;color:white">
              ${logoUrl ? `<img src="${logoUrl}" alt="${orgName}" style="max-height:40px;margin-bottom:10px"><br>` : ""}
              <h1 style="margin:0;font-size:20px">Atualização — Economia Criativa</h1>
            </div>
            <div style="padding:30px;line-height:1.6;color:#374151">
              <p>Olá${profile.display_name ? `, <strong>${profile.display_name}</strong>` : ""},</p>
              <p>A execução da ferramenta <strong>${tool}</strong> no painel ${orgName} foi atualizada.</p>
              <div style="background:#f9fafb;border-left:4px solid ${statusColor};padding:15px;margin:20px 0">
                <strong>Status:</strong> ${label}<br>
                <strong>Execução:</strong> <code style="font-size:12px">${execution_id ?? asset_id}</code>
                ${reason ? `<br><strong>Motivo:</strong> ${reason}` : ""}
              </div>
              ${includeLink ? `
                <div style="text-align:center;margin-top:30px">
                  <a href="${investigateUrl}" style="background:${primaryColor};color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold">Abrir investigação</a>
                </div>
                <p style="font-size:12px;color:#6b7280;margin-top:16px">Ou copie o link: <a href="${investigateUrl}">${investigateUrl}</a></p>
              ` : ""}
            </div>
            <div style="background:#f3f4f6;padding:15px;text-align:center;font-size:12px;color:#6b7280">
              ${orgName} &copy; 2026 — Gerencie suas preferências em ${siteUrl}/creative/notifications
            </div>
          </div>`,
        text: `Execução ${tool} (${execution_id ?? asset_id}) atualizada para ${label}. ${reason ? `Motivo: ${reason}. ` : ""}${includeLink ? `Investigar: ${investigateUrl}` : ""}`,
        purpose: "transactional",
        label: "creative_status_update",
        queued_at: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[creative-status-email]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
