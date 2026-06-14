// KUBO Game AI Architect — Lovable AI powered game-design copilot.
// Takes a natural-language pitch and returns a structured AAA blueprint
// (lore, gameplay loop, ECS scene, code scaffolding) + a streamed
// human-readable design doc. Uses tool-calling for the JSON blueprint and
// then streams a director-style narration on top.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM = `You are the KUBO Game AI Architect — a AAA game director,
engine architect and technical artist. You design complete, production-ready
games inside the KUBO Quantum Engine (Three.js + ECS + WebGPU + VR).
Always think modular, scalable, and shippable. Never produce stubs.

Output rules:
1) FIRST call the tool build_game_blueprint with a complete JSON spec.
2) THEN write a director-style design doc (markdown) explaining the vision,
   pillars, world, gameplay loop, art direction, monetization, roadmap.
Never invent secrets, network calls, or unsafe shaders.`;

const TOOL = {
  type: "function",
  function: {
    name: "build_game_blueprint",
    description: "Full structured blueprint for a KUBO Quantum Engine game.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        genre: { type: "string" },
        dimension: { type: "string", enum: ["2D", "3D", "VR", "Hybrid"] },
        pillars: { type: "array", items: { type: "string" } },
        lore: { type: "string" },
        gameplay_loop: { type: "array", items: { type: "string" } },
        mechanics: { type: "array", items: { type: "string" } },
        art_direction: { type: "string" },
        soundtrack: { type: "string" },
        monetization: { type: "string" },
        scene: {
          type: "object",
          properties: {
            seed: { type: "integer" },
            ambient: { type: "string" },
            entities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  kind: { type: "string", enum: ["player", "npc", "enemy", "prop", "portal"] },
                  name: { type: "string" },
                  persona: { type: "string" },
                  position: {
                    type: "object",
                    properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } },
                    required: ["x", "y", "z"], additionalProperties: false,
                  },
                  color: { type: "string" },
                },
                required: ["kind", "name", "position"],
                additionalProperties: false,
              },
            },
          },
          required: ["seed", "ambient", "entities"],
          additionalProperties: false,
        },
        roadmap: { type: "array", items: { type: "string" } },
      },
      required: ["title", "genre", "dimension", "pillars", "lore",
        "gameplay_loop", "mechanics", "art_direction", "scene", "roadmap"],
      additionalProperties: false,
    },
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "missing_lovable_api_key" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = req.headers.get("Authorization") ?? "";
  const supa = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userErr } = await supa.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { prompt?: string; model?: string } = {};
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const prompt = (body.prompt ?? "").trim();
  if (prompt.length < 4 || prompt.length > 4000) {
    return new Response(JSON.stringify({ error: "prompt_length" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const model = body.model ?? "google/gemini-2.5-flash";

  // 1) Structured blueprint via tool-calling
  const planResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Design this game and return ONLY the tool call:\n\n${prompt}` },
      ],
      tools: [TOOL],
      tool_choice: { type: "function", function: { name: "build_game_blueprint" } },
    }),
  });

  if (planResp.status === 429) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (planResp.status === 402) {
    return new Response(JSON.stringify({ error: "credits_required" }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!planResp.ok) {
    const t = await planResp.text();
    console.error("ai blueprint error", planResp.status, t.slice(0, 400));
    return new Response(JSON.stringify({ error: "ai_gateway_error" }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const planJson = await planResp.json();
  const call = planJson?.choices?.[0]?.message?.tool_calls?.[0];
  let blueprint: Record<string, unknown> = {};
  try { blueprint = JSON.parse(call?.function?.arguments ?? "{}"); }
  catch { blueprint = {}; }

  // 2) Director's design doc (non-streamed for simplicity + reliability)
  const docResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Write the director's design doc in markdown for this pitch:\n\n${prompt}\n\nReference the blueprint:\n${JSON.stringify(blueprint).slice(0, 4000)}` },
      ],
    }),
  });
  const docJson = await docResp.json().catch(() => ({}));
  const designDoc = docJson?.choices?.[0]?.message?.content ?? "";

  return new Response(JSON.stringify({ blueprint, designDoc, model }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
