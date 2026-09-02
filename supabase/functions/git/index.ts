// KUBO Git endpoint — repository access for the iOS/iPadOS Mobile Agent.
// The device never holds a GitHub token: every call is proxied here using the
// encrypted connection stored for the signed-in user.
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, supaAdmin, sanitizeError } from "../_shared/creative.ts";
import { decryptSecret } from "../_shared/connectorCrypto.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function gh(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "KuboVibeMobileAgent",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`github_error_${res.status}`);
  return data;
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await getUser(req.headers.get("Authorization"));
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const action = String((body as Record<string, unknown>).action ?? "repos");

    const admin = supaAdmin();
    const { data: connection } = await admin
      .from("github_connections")
      .select("access_token_ciphertext, access_token_iv, access_token_tag")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!connection) return json({ error: "github_not_connected" }, 404);

    const token = await decryptSecret({
      ciphertext: connection.access_token_ciphertext,
      iv: connection.access_token_iv,
      tag: connection.access_token_tag,
    });

    const repo = String((body as Record<string, unknown>).repo ?? "");
    const branch = String((body as Record<string, unknown>).branch ?? "main");
    const needsRepo = action !== "repos";
    if (needsRepo && !REPO_RE.test(repo)) return json({ error: "invalid_repo" }, 400);

    // ---------- repos ----------
    if (action === "repos") {
      const repos = await gh(token, "/user/repos?sort=updated&per_page=50&affiliation=owner");
      return json({
        repos: (repos as any[]).map((r) => ({
          id: r.id,
          name: r.name,
          full_name: r.full_name,
          default_branch: r.default_branch,
          private: r.private,
          updated_at: r.updated_at,
        })),
      });
    }

    // ---------- branches ----------
    if (action === "branches") {
      const branches = await gh(token, `/repos/${repo}/branches?per_page=50`);
      return json({ branches: (branches as any[]).map((b) => ({ name: b.name, sha: b.commit?.sha })) });
    }

    // ---------- tree ----------
    if (action === "tree") {
      const tree = await gh(token, `/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
      const files = ((tree as any).tree ?? [])
        .filter((n: any) => n.type === "blob")
        .slice(0, 500)
        .map((n: any) => ({ path: n.path, size: n.size, sha: n.sha }));
      return json({ files, truncated: (tree as any).truncated ?? false });
    }

    // ---------- read ----------
    if (action === "read") {
      const path = String((body as Record<string, unknown>).path ?? "");
      if (!path || path.includes("..")) return json({ error: "invalid_path" }, 400);
      const file = await gh(
        token,
        `/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`,
      );
      const content = (file as any).encoding === "base64"
        ? new TextDecoder().decode(Uint8Array.from(atob((file as any).content.replace(/\n/g, "")), (c) => c.charCodeAt(0)))
        : String((file as any).content ?? "");
      return json({ path, sha: (file as any).sha, content });
    }

    // ---------- commits (history) ----------
    if (action === "commits") {
      const commits = await gh(token, `/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=20`);
      return json({
        commits: (commits as any[]).map((c) => ({
          sha: c.sha,
          message: c.commit?.message,
          author: c.commit?.author?.name,
          date: c.commit?.author?.date,
        })),
      });
    }

    // ---------- commit (write a file) ----------
    if (action === "commit") {
      const path = String((body as Record<string, unknown>).path ?? "");
      const content = String((body as Record<string, unknown>).content ?? "");
      const message = String((body as Record<string, unknown>).message ?? "chore: update from KUBO Mobile Agent");
      if (!path || path.includes("..")) return json({ error: "invalid_path" }, 400);

      const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(content)));
      const apiPath = `/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;

      let sha: string | undefined;
      try {
        const existing = await gh(token, `${apiPath}?ref=${encodeURIComponent(branch)}`);
        sha = (existing as any).sha;
      } catch {
        sha = undefined; // new file
      }

      const result = await gh(token, apiPath, {
        method: "PUT",
        body: JSON.stringify({ message, content: encoded, branch, sha }),
      });

      return json({ ok: true, commit: { sha: (result as any).commit?.sha, path } });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    console.error("[git]", err);
    return json({ error: sanitizeError(err) }, 500);
  }
});
