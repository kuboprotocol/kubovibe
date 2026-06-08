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

  await supabase.rpc("enqueue_email", {
    queue_name: "auth_emails",
    payload: {
      to: profile.email,
      from: "Kubo Vibe <noreply@kubovibe.dev>",
      subject: `Atualização de Execução: ${tool}`,
      html: `<h1>Execução ${tool}</h1><p>Status atualizado para: <b>${status}</b></p>`,
      text: `Execução ${tool} atualizada para ${status}`,
      purpose: "transactional",
      label: "creative_status_update",
      queued_at: new Date().toISOString()
    }
  });

  return new Response("Email enqueued", { status: 200, headers: { "Access-Control-Allow-Origin": "*" } });
});
