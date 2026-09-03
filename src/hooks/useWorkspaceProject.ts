import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared workspace state between the Vibe Code desktop UI and the iOS/iPadOS
 * mobile client (/m). Both surfaces read and write the same active project,
 * repository and branch, so editor, chat and Git history stay in sync.
 */
export interface WorkspaceState {
  projectId: string;
  repo: string;
  branch: string;
  /** Currently open file path, shared between the mobile client and the desktop editor. */
  file: string;
}

export interface WorkspaceProjectRow {
  id: string;
  title: string;
}

const STORAGE_KEY = "kubo:workspace:v1";
const SYNC_EVENT = "kubo:workspace:changed";
const DEFAULT_STATE: WorkspaceState = { projectId: "", repo: "", branch: "main", file: "" };

function readStored(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
    return {
      projectId: parsed.projectId ?? "",
      repo: parsed.repo ?? "",
      branch: parsed.branch || "main",
      file: parsed.file ?? "",
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function readFromUrl(): Partial<WorkspaceState> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const next: Partial<WorkspaceState> = {};
  const project = params.get("project");
  const repo = params.get("repo");
  const branch = params.get("branch");
  const file = params.get("file");
  if (project) next.projectId = project;
  if (repo) next.repo = repo;
  if (branch) next.branch = branch;
  if (file) next.file = file;
  return next;
}

function persist(state: WorkspaceState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — in-memory state still works */
  }
  window.dispatchEvent(new CustomEvent<WorkspaceState>(SYNC_EVENT, { detail: state }));
}

function workspaceQuery(state: WorkspaceState): string {
  const params = new URLSearchParams();
  if (state.projectId) params.set("project", state.projectId);
  if (state.repo) params.set("repo", state.repo);
  if (state.branch) params.set("branch", state.branch);
  if (state.file) params.set("file", state.file);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Deep link that opens the exact same workspace in the mobile client. */
export function mobileWorkspaceLink(state: WorkspaceState): string {
  return `/m${workspaceQuery(state)}`;
}

/** Deep link that opens the exact same project, branch and file in the desktop editor. */
export function desktopWorkspaceLink(state: WorkspaceState): string {
  return `/vibe-code${workspaceQuery(state)}`;
}

export function useWorkspaceProject() {
  const [state, setState] = useState<WorkspaceState>(() => ({ ...readStored(), ...readFromUrl() }));
  const [projects, setProjects] = useState<WorkspaceProjectRow[]>([]);

  // Keep every open surface (tabs, mobile webview, desktop wrapper) aligned.
  useEffect(() => {
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceState>).detail;
      if (detail) setState(detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setState(readStored());
    };
    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((patch: Partial<WorkspaceState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      if (
        next.projectId === prev.projectId &&
        next.repo === prev.repo &&
        next.branch === prev.branch &&
        next.file === prev.file
      ) {
        return prev;
      }
      persist(next);
      return next;
    });
  }, []);

  const loadProjects = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("id,title")
      .order("updated_at", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as WorkspaceProjectRow[];
    setProjects(rows);
    setState((prev) => {
      if (prev.projectId || !rows[0]) return prev;
      const next = { ...prev, projectId: rows[0].id };
      persist(next);
      return next;
    });
    return rows;
  }, []);

  return {
    ...state,
    projects,
    loadProjects,
    setProjectId: (projectId: string) => update({ projectId }),
    setRepo: (repo: string) => update({ repo }),
    setBranch: (branch: string) => update({ branch }),
    setFile: (file: string) => update({ file }),
    update,
    mobileLink: mobileWorkspaceLink(state),
    desktopLink: desktopWorkspaceLink(state),
  };
}
