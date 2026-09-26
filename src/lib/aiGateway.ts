import { supabase } from "@/integrations/supabase/client";

/**
 * Cliente do KUBO AI Gateway (edge function `ai-gateway`).
 *
 * O app informa o TIPO de tarefa; o gateway escolhe o modelo mais barato que
 * resolve, aplica cache e registra a execução no painel Agent Activity.
 */
export const AI_TASKS = [
  "chat",
  "classify",
  "docs",
  "marketing",
  "code",
  "debug",
  "plan",
  "architecture",
  "complex",
] as const;
export type AiTask = (typeof AI_TASKS)[number];

export const AI_TASK_LABEL: Record<AiTask, string> = {
  chat: "Conversa",
  classify: "Classificação",
  docs: "Documentação",
  marketing: "Marketing",
  code: "Código",
  debug: "Debug",
  plan: "Planejamento",
  architecture: "Arquitetura",
  complex: "Tarefa complexa",
};

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiGatewayRequest {
  task?: AiTask;
  prompt?: string;
  system?: string;
  messages?: AiMessage[];
  projectId?: string;
  json?: boolean;
  tier?: "flash" | "pro";
  noCache?: boolean;
}

export interface AiGatewayResponse {
  content: string;
  task: AiTask;
  tier: "flash" | "pro";
  provider: string;
  model: string;
  cached: boolean;
  usage: { prompt_tokens?: number; completion_tokens?: number } | null;
  cost_usd: number;
  duration_ms: number;
  run_id: string | null;
}

export async function callAiGateway(req: AiGatewayRequest): Promise<AiGatewayResponse> {
  const { data, error } = await supabase.functions.invoke<AiGatewayResponse>("ai-gateway", {
    body: {
      task: req.task,
      prompt: req.prompt,
      system: req.system,
      messages: req.messages,
      project_id: req.projectId,
      json: req.json,
      tier: req.tier,
      no_cache: req.noCache,
    },
  });
  if (error) throw error;
  if (!data) throw new Error("ai_gateway_empty_response");
  return data;
}

export interface AiGatewayRun {
  id: string;
  project_id: string | null;
  task_kind: string;
  tier: string | null;
  provider: string | null;
  model: string | null;
  cached: boolean;
  status: "ok" | "error";
  error: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number;
  duration_ms: number | null;
  created_at: string;
}

export interface RunTotals {
  runs: number;
  errors: number;
  cacheHits: number;
  tokens: number;
  costUsd: number;
  proShare: number;
}

export function summarizeRuns(runs: AiGatewayRun[]): RunTotals {
  const ok = runs.filter((r) => r.status === "ok");
  const pro = ok.filter((r) => r.tier === "pro").length;
  return {
    runs: runs.length,
    errors: runs.length - ok.length,
    cacheHits: ok.filter((r) => r.cached).length,
    tokens: ok.reduce((n, r) => n + (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0), 0),
    costUsd: Math.round(ok.reduce((n, r) => n + Number(r.cost_usd ?? 0), 0) * 1e6) / 1e6,
    proShare: ok.length ? pro / ok.length : 0,
  };
}
