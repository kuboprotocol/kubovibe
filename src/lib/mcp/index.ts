import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import createProjectTool from "./tools/create-project";
import listAgentJobsTool from "./tools/list-agent-jobs";
import creditSummaryTool from "./tools/credit-summary";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "kubo-vibe-dev",
  title: "KUBO VIBE DEV",
  version: "0.1.0",
  instructions:
    "Tools for KUBO VIBE DEV, an AI platform for generating web and Web3 apps. Use `list_projects` and `get_project` to inspect the user's projects, `create_project` to start a new one, `list_agent_jobs` to check AI agent runs, and `credit_summary` for credit balance and usage. All tools act as the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listProjectsTool,
    getProjectTool,
    createProjectTool,
    listAgentJobsTool,
    creditSummaryTool,
  ],
});
