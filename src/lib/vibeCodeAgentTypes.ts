// Shared types between the Vibe Code Agent UI and the `vibe-code-agent` edge function.

export type VibeStepKind =
  | "thinking"
  | "plan"
  | "read_file"
  | "edit_file"
  | "diff"
  | "commit"
  | "connector"
  | "message"
  | "error"
  | "done";

export type VibeStepStatus = "running" | "success" | "failed" | "skipped";

export interface VibeStep {
  id: string;
  kind: VibeStepKind;
  title: string;
  status: VibeStepStatus;
  detail?: string;
  path?: string;
  /** Unified diff preview (when the agent runs in dry-run mode). */
  diff?: string;
  /** Full proposed content, used when the user applies a previewed diff. */
  proposedContent?: string;
  /** Commit SHA produced by this step — enables per-step undo. */
  commitSha?: string;
  reverted?: boolean;
  startedAt: number;
  finishedAt?: number;
}

export interface VibeChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: VibeStep[];
  createdAt: number;
}

export type VibeAgentMode =
  /** Generates a plan and previews diffs without touching the repository. */
  | "preview"
  /** Generates a plan and commits the changes straight to GitHub. */
  | "apply";

export interface VibeAgentRequest {
  prompt: string;
  projectId?: string;
  mode: VibeAgentMode;
  /** Apply an already-previewed set of file writes. */
  apply?: Array<{ path: string; content: string }>;
  /** Revert a single commit produced by a previous step. */
  revertSha?: string;
}

export interface VibeConnectorState {
  slug: "github" | "supabase" | "stripe" | "ionos" | "mcp";
  label: string;
  description: string;
  connected: boolean;
  hint?: string;
}
