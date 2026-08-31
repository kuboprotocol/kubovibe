import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_agent_jobs",
  title: "List agent jobs",
  description:
    "List the signed-in user's recent AI agent jobs with status, credits charged and errors.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many jobs to return."),
    status: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Filter by status, e.g. pending, running, completed, failed."),
    agentSlug: z.string().trim().min(1).optional().describe("Filter by agent slug."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status, agentSlug }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("agent_jobs")
      .select(
        "id,agent_slug,status,credits_charged,duration_ms,error_message,created_at,completed_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) query = query.eq("status", status);
    if (agentSlug) query = query.eq("agent_slug", agentSlug);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { jobs: data ?? [] },
    };
  },
});
