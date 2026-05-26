// Quantum Game Engine — NPC dialogue/decision AI via Lovable AI Gateway.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

interface NPCRequest {
  npcId: string;
  npcPersona: string;
  playerInput: string;
  memory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  worldState?: Record<string, unknown>;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as NPCRequest;
    if (!body?.npcPersona || !body?.playerInput) {
      return new Response(JSON.stringify({ error: 'npcPersona and playerInput required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Você é um NPC dentro do Kubo Quantum Game Engine.
Persona: ${body.npcPersona}
NPC ID: ${body.npcId}
Mundo: ${JSON.stringify(body.worldState ?? {})}

Regras:
- Mantenha consistência de personalidade e memória.
- Responda em no máximo 2 frases curtas.
- Quando apropriado, devolva uma ação JSON ao final no formato: <action>{"type":"move|trade|attack|emote","payload":{...}}</action>
- Linguagem do jogador (mantenha o mesmo idioma).`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(body.memory ?? []),
      { role: 'user', content: body.playerInput },
    ];

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 200,
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: 'credits_required' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI gateway error: ${resp.status} ${t}`);
    }

    const data = await resp.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    const actionMatch = content.match(/<action>([\s\S]*?)<\/action>/);
    let action: unknown = null;
    if (actionMatch) {
      try { action = JSON.parse(actionMatch[1]); } catch { /* ignore */ }
    }
    const dialogue = content.replace(/<action>[\s\S]*?<\/action>/g, '').trim();

    return new Response(JSON.stringify({ dialogue, action, npcId: body.npcId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[game-npc-ai]', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
