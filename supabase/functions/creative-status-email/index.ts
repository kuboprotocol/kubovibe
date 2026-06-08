import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  const { asset_id, status, user_id, tool } = await req.json();
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", user_id).single();
  
  if (!profile?.email) return new Response("No email found", { status: 400 });

  const subjects: Record<string, string> = {
    failed: `❌ Falha na Execução: ${tool}`,
    error: `❌ Erro na Execução: ${tool}`,
    cancelled: `⚠️ Execução Cancelada: ${tool}`,
    completed: `✅ Execução Concluída: ${tool}`
  };

  const themeColors: Record<string, string> = {
    failed: "#ef4444",
    error: "#ef4444",
    cancelled: "#f59e0b",
    completed: "#10b981"
  };

  const statusLabels: Record<string, string> = {
    failed: "Falhou",
    error: "Erro",
    cancelled: "Cancelado",
    completed: "Concluído"
  };

  const color = themeColors[status] || "#6366f1";
  const label = statusLabels[status] || status;

  await supabase.rpc("enqueue_email", {
    queue_name: "auth_emails",
    payload: {
      to: profile.email,
      from: "Kubo Vibe <noreply@kubovibe.dev>",
      subject: subjects[status] || `Atualização: ${tool}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="background-color: ${color}; padding: 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 20px;">Atualização de Status</h1>
          </div>
          <div style="padding: 30px; line-height: 1.6; color: #374151;">
            <p>Olá,</p>
            <p>A execução da ferramenta <strong>${tool}</strong> no painel Economia Criativa foi atualizada.</p>
            <div style="background-color: #f9fafb; border-left: 4px solid ${color}; padding: 15px; margin: 20px 0;">
              <strong>Status:</strong> ${label}<br>
              <strong>Asset ID:</strong> <code style="font-size: 12px;">${asset_id}</code>
            </div>
            <p>Você pode conferir todos os detalhes diretamente no seu painel.</p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://kubovibe.dev/creative" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver no Painel</a>
            </div>
          </div>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
            Kubo Vibe &copy; 2026 - Inteligência Artificial para Criadores
          </div>
        </div>
      `,
      text: `Execução ${tool} atualizada para ${label}. Asset ID: ${asset_id}`,
      purpose: "transactional",
      label: "creative_status_update",
      queued_at: new Date().toISOString()
    }
  });

  return new Response("Email enqueued", { status: 200, headers: { "Access-Control-Allow-Origin": "*" } });
});
