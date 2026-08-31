import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "credit_summary",
  title: "Credit summary",
  description:
    "Return the signed-in user's latest credit balance and their most recent credit transactions.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many transactions to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("credit_transactions")
      .select("id,delta,balance_after,category,reason,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const transactions = data ?? [];
    const balance = transactions[0]?.balance_after ?? null;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ balance, transactions }, null, 2),
        },
      ],
      structuredContent: { balance, transactions },
    };
  },
});
