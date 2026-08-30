import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const { user_id, email, start_date, end_date } = await req.json();

  try {
    let query = supabase
      .from("creative_audit_logs")
      .select("*, creative_assets(*)")
      .eq("user_id", user_id);

    if (start_date) query = query.gte("created_at", start_date);
    if (end_date) query = query.lte("created_at", end_date);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    if (!data || data.length === 0) {
       await supabase.from("notifications").insert({
         user_id,
         title: "Exportação de Auditoria Vazia",
         message: "Nenhum evento de auditoria encontrado para o período selecionado.",
         type: "warning"
       });
       return new Response("No items found", { status: 200 });
    }

    const content = JSON.stringify(data, null, 2);
    const fileName = `audit-trail-${user_id}-${Date.now()}.json`;
    
    // Ensure bucket exists or handle error
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("exports")
      .upload(fileName, content, { contentType: "application/json" });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from("exports").getPublicUrl(fileName);

    // Send email through Lovable's managed email API
    const html = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h2>Sua Trilha de Auditoria está pronta</h2>
            <p>O arquivo JSON contendo a trilha de auditoria detalhada para o período solicitado foi gerado com sucesso.</p>
            <p><strong>Itens incluídos:</strong> ${data.length}</p>
            <div style="margin-top: 30px;">
              <a href="${publicUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Baixar Arquivo</a>
            </div>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">Este link expira em breve.</p>
          </div>
        `;
    const text = `Sua trilha de auditoria está pronta (${data.length} itens). Baixe em: ${publicUrl}`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    try {
      await sendLovableEmail(
        {
          to: email,
          from: `Kubo Vibe <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: "Trilha de Auditoria Detalhada",
          html,
          text,
          purpose: "transactional",
          label: "creative_audit_export",
          idempotency_key: `audit-export-${fileName}`,
        },
        { apiKey, sendUrl: Deno.env.get("LOVABLE_SEND_URL") }
      );
    } catch (error) {
      if (error instanceof EmailAPIError && error.code === "recipient_suppressed") {
        await logEmailSend(supabase, {
          templateName: "creative_audit_export",
          recipientEmail: email,
          status: "suppressed",
        });
        return new Response("Export successful (recipient suppressed)", { status: 200 });
      }
      await logEmailSend(supabase, {
        templateName: "creative_audit_export",
        recipientEmail: email,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    await logEmailSend(supabase, {
      templateName: "creative_audit_export",
      recipientEmail: email,
      status: "sent",
    });


    return new Response("Export successful", { status: 200 });
  } catch (err: any) {
    console.error(err);
    await supabase.from("notifications").insert({
      user_id,
      title: "Falha na Exportação de Auditoria",
      message: `Erro ao gerar trilha de auditoria: ${err.message}`,
      type: "error"
    });
    return new Response(err.message, { status: 500 });
  }
});