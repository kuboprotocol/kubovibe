import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const { user_id, email, audit_only_reprocessed } = await req.json();

  try {
    let query = supabase
      .from("creative_assets")
      .select("*")
      .eq("user_id", user_id);

    if (audit_only_reprocessed) {
      // Logic for reprocessed items: usually they have metadata.reprocessed = true or specific audit logs
      query = query.filter("metadata->reprocessed", "eq", "true");
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
       // Alert if no items to export
       await supabase.from("notifications").insert({
         user_id,
         title: "Exportação Falhou",
         message: "Nenhum item reprocessado encontrado para o job agendado.",
         type: "error"
       });
       return new Response("No items found", { status: 404 });
    }

    const content = JSON.stringify(data, null, 2);
    const fileName = `audit-export-${user_id}-${Date.now()}.json`;
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("exports")
      .upload(fileName, content, { contentType: "application/json" });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from("exports").getPublicUrl(fileName);

    // Send email with link
    await supabase.rpc("enqueue_email", {
      queue_name: "auth_emails",
      payload: {
        to: email,
        from: "Kubo Vibe <noreply@kubovibe.dev>",
        subject: "Relatório de Auditoria Agendado",
        html: `<p>Seu relatório está pronto: <a href="${publicUrl}">Download</a></p>`,
        purpose: "transactional"
      }
    });

    return new Response("Export successful", { status: 200 });
  } catch (err: any) {
    console.error(err);
    await supabase.from("notifications").insert({
      user_id,
      title: "Job de Exportação Falhou",
      message: `Erro ao exportar auditoria: ${err.message}`,
      type: "error"
    });
    return new Response(err.message, { status: 500 });
  }
});
