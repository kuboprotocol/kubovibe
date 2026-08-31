import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "List projects",
  description: "List the signed-in user's KUBO Vibe projects, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many projects to return."),
    publishedOnly: z.boolean().default(false).describe("Only return published projects."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, publishedOnly }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("projects")
      .select("id,title,description,is_published,published_url,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (publishedOnly) query = query.eq("is_published", true);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { projects: data ?? [] },
    };
  },
});
