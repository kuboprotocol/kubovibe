import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_project",
  title: "Get project",
  description:
    "Fetch one of the signed-in user's projects by id, optionally including its generated code.",
  inputSchema: {
    projectId: z.string().uuid().describe("The project id."),
    includeCode: z.boolean().default(false).describe("Include the generated source code."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ projectId, includeCode }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const columns = includeCode
      ? "id,title,description,is_published,published_url,created_at,updated_at,generated_code"
      : "id,title,description,is_published,published_url,created_at,updated_at";

    const { data, error } = await supabase
      .from("projects")
      .select(columns)
      .eq("id", projectId)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Project not found" }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { project: data },
    };
  },
});
