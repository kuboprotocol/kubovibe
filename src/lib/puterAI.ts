/**
 * Creative Router Integration (v2)
 * Primary orchestrator for KUBO Vibe Creative Panel.
 */
import { supabase } from "@/integrations/supabase/client";

export const CREATIVE_ROUTER_FN = "creative-router";

export async function creativeInvoke(tool: string, payload: any) {
  const { data, error } = await supabase.functions.invoke(CREATIVE_ROUTER_FN, {
    body: { tool, ...payload }
  });
  if (error) throw error;
  return data;
}

export const PUTER_MODELS = [
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B (Router)" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini (Router)" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (Router)" },
];
