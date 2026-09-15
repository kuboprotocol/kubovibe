// KUBO Vibe — Contact / Enterprise inquiry.
// Recebe o formulário único da pricing page (Enterprise, Suporte, Outro),
// grava em contact_requests, e envia os dois e-mails via Resend. O
// endereço de destino nunca é exposto ao client — vive só no secret
// CONTACT_INBOX_EMAIL, lido aqui no servidor.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REASON_LABEL: Record<string, string> = {
  enterprise: "Enterprise",
  support: "Suporte",
  other: "Outro assunto",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

async function sendResendEmail(apiKey: string, payload: Record<string, unknown>) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`resend_${r.status}:${txt.slice(0, 300)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));

    // Honeypot anti-spam: campo invisível no form; bots costumam preencher.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return json({ ok: true }); // finge sucesso pro bot, não processa nada
    }

    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const company = String(body.company ?? "").trim() || null;
    const reason = String(body.reason ?? "");
    const message = String(body.message ?? "").trim();
    const estimatedVolume = String(body.estimatedVolume ?? "").trim() || null;
    const teamSize = String(body.teamSize ?? "").trim() || null;

    if (!fullName || fullName.length > 200) return json({ ok: false, error: "invalid_name" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "invalid_email" }, 400);
    if (!(reason in REASON_LABEL)) return json({ ok: false, error: "invalid_reason" }, 400);
    if (!message || message.length > 5000) return json({ ok: false, error: "invalid_message" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Tenta associar a um usuário logado, se houver — não obrigatório.
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anon, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      userId = data.user?.id ?? null;
    }

    const { data: inserted, error: insertError } = await admin
      .from("contact_requests")
      .insert({
        user_id: userId,
        full_name: fullName,
        email,
        company,
        reason,
        message,
        estimated_volume: estimatedVolume,
        team_size: teamSize,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("[contact-request] insert_failed:", insertError);
      return json({ ok: false, error: "internal_server_error" }, 500);
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const inbox = Deno.env.get("CONTACT_INBOX_EMAIL");
    const fromAddress = Deno.env.get("CONTACT_FROM_EMAIL") ?? "contato@kubovibe.dev";

    if (!resendKey || !inbox) {
      // Não mascara: o lead JÁ está salvo no banco (não se perde), mas o
      // e-mail não pôde ser enviado — avisa no log pra alguém configurar.
      console.error("[contact-request] email_not_configured: faltam RESEND_API_KEY ou CONTACT_INBOX_EMAIL");
      return json({ ok: true, id: inserted.id, email_sent: false });
    }

    const reasonLabel = REASON_LABEL[reason];
    const extraRows =
      reason === "enterprise"
        ? `<tr><td><b>Volume estimado</b></td><td>${escapeHtml(estimatedVolume ?? "—")}</td></tr>
           <tr><td><b>Tamanho do time</b></td><td>${escapeHtml(teamSize ?? "—")}</td></tr>`
        : "";

    await sendResendEmail(resendKey, {
      from: `KUBO Vibe <${fromAddress}>`,
      to: [inbox],
      reply_to: email,
      subject: `[${reasonLabel}] Novo contato — ${fullName}`,
      html: `
        <table cellpadding="6">
          <tr><td><b>Nome</b></td><td>${escapeHtml(fullName)}</td></tr>
          <tr><td><b>E-mail</b></td><td>${escapeHtml(email)}</td></tr>
          <tr><td><b>Empresa</b></td><td>${escapeHtml(company ?? "—")}</td></tr>
          <tr><td><b>Motivo</b></td><td>${escapeHtml(reasonLabel)}</td></tr>
          ${extraRows}
          <tr><td><b>Mensagem</b></td><td>${escapeHtml(message).replace(/\n/g, "<br/>")}</td></tr>
        </table>
      `,
    });

    await sendResendEmail(resendKey, {
      from: `KUBO Vibe <${fromAddress}>`,
      to: [email],
      subject: "Recebemos sua mensagem — KUBO Vibe",
      html: `
        <p>Olá, ${escapeHtml(fullName)}!</p>
        <p>Recebemos sua mensagem sobre <b>${escapeHtml(reasonLabel)}</b> e nossa equipe vai
        responder em até 1 dia útil.</p>
        <p>Equipe KUBO Vibe</p>
      `,
    });

    return json({ ok: true, id: inserted.id, email_sent: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal_error";
    console.error("[contact-request]", message);
    return json({ ok: false, error: "internal_server_error" }, 500);
  }
});
