// Shared types between the Vibe Code Agent UI and the `vibe-code-agent` edge function.

export type VibeStepKind =
  | "thinking"
  | "plan"
  | "estimate"
  | "read_file"
  | "edit_file"
  | "diff"
  | "commit"
  | "checkpoint"
  | "credits"
  | "connector"
  | "message"
  | "error"
  | "done";

export type VibeStepStatus = "running" | "success" | "failed" | "skipped";

export type VibeModelTier = "flash" | "pro";

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
  /** Persisted checkpoint id (vibe_checkpoints), enables timeline rollback. */
  checkpointId?: string;
  /** Model tier chosen by the DeepSeek router for this cycle. */
  tier?: VibeModelTier;
  estimatedCost?: number;
  creditsCharged?: number;
  balanceAfter?: number;
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
  /** Revert a single commit produced by a previous step (legacy). */
  revertSha?: string;
  /** Revert to a persisted checkpoint (preferred — powers the timeline UI). */
  revertCheckpointId?: string;
}

export interface VibeConnectorState {
  slug: "github" | "supabase" | "stripe" | "ionos" | "mcp";
  label: string;
  description: string;
  connected: boolean;
  hint?: string;
}

export interface VibeCheckpoint {
  id: string;
  project_repo: string;
  commit_sha: string;
  summary: string;
  files_changed: string[];
  credits_spent: number;
  model_used: VibeModelTier | null;
  reverted_checkpoint_id: string | null;
  created_at: string;
}

export interface VibeSandboxSession {
  id: string;
  project_repo: string;
  e2b_sandbox_id: string | null;
  preview_url: string | null;
  status: "starting" | "running" | "stopped" | "failed" | "timed_out";
  started_at: string;
  ended_at: string | null;
  credits_charged: number;
}
