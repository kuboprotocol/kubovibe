import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GitRepo {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  updated_at: string;
}

export interface GitFile {
  path: string;
  size: number;
  sha: string;
}

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

async function callGit<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("git", { body });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

/** Read/write access to the user's GitHub repository through the `/git` endpoint. */
export function useGitRepo() {
  const [repos, setRepos] = useState<GitRepo[]>([]);
  const [files, setFiles] = useState<GitFile[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  const loadRepos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callGit<{ repos: GitRepo[] }>({ action: "repos" });
      setRepos(res.repos);
      setConnected(true);
      return res.repos;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "failed";
      setConnected(msg !== "github_not_connected" ? null : false);
      if (msg !== "github_not_connected") toast.error("Could not load repositories");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTree = useCallback(async (repo: string, branch: string) => {
    setLoading(true);
    try {
      const res = await callGit<{ files: GitFile[] }>({ action: "tree", repo, branch });
      setFiles(res.files);
    } catch {
      toast.error("Could not load file tree");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCommits = useCallback(async (repo: string, branch: string) => {
    try {
      const res = await callGit<{ commits: GitCommit[] }>({ action: "commits", repo, branch });
      setCommits(res.commits);
    } catch {
      /* history is optional */
    }
  }, []);

  const readFile = useCallback(async (repo: string, branch: string, path: string) => {
    setLoading(true);
    try {
      return await callGit<{ path: string; sha: string; content: string }>({
        action: "read",
        repo,
        branch,
        path,
      });
    } catch {
      toast.error("Could not open file");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const commitFile = useCallback(
    async (repo: string, branch: string, path: string, content: string, message: string) => {
      setLoading(true);
      try {
        const res = await callGit<{ commit: { sha: string } }>({
          action: "commit",
          repo,
          branch,
          path,
          content,
          message,
        });
        toast.success(`Committed ${res.commit.sha?.slice(0, 7)}`);
        await loadCommits(repo, branch);
        return res.commit;
      } catch {
        toast.error("Commit failed");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [loadCommits],
  );

  return { repos, files, commits, loading, connected, loadRepos, loadTree, loadCommits, readFile, commitFile };
}
