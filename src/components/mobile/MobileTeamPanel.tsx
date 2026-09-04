import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Coins, FolderGit2, Cloud, Hammer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface TeamSnapshot {
  balance: number;
  spent: number;
  byCategory: Record<string, number>;
  minutes: number;
  activeSessions: number;
  projects: { id: string; name: string }[];
  builds: { id: string; kind: string; status: string; credits: number; created_at: string }[];
}

const EMPTY: TeamSnapshot = {
  balance: 0,
  spent: 0,
  byCategory: {},
  minutes: 0,
  activeSessions: 0,
  projects: [],
  builds: [],
};

/**
 * Account-scoped mirror of /admin/teams. RLS already limits every query to the
 * signed-in account, so a team sees its own projects, credits and sessions
 * without any admin role.
 */
export default function MobileTeamPanel() {
  const { user } = useAuth();
  const [data, setData] = useState<TeamSnapshot>(EMPTY);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const [projects, tx, sessions, builds] = await Promise.all([
      supabase.from("projects").select("id, title, created_at").order("created_at", { ascending: false }).limit(50),
      supabase
        .from("credit_transactions")
        .select("delta, balance_after, category, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("cloud_sessions").select("status, billed_minutes"),
      supabase
        .from("session_builds")
        .select("id, kind, status, credits, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const rows = tx.data ?? [];
    const byCategory: Record<string, number> = {};
    let spent = 0;
    rows.forEach((t) => {
      const delta = Number(t.delta ?? 0);
      if (delta >= 0) return;
      const amount = Math.abs(delta);
      spent += amount;
      const cat = t.category || "general";
      byCategory[cat] = (byCategory[cat] ?? 0) + amount;
    });

    setData({
      balance: Number(rows[0]?.balance_after ?? 0),
      spent,
      byCategory,
      minutes: (sessions.data ?? []).reduce((sum, s) => sum + Number(s.billed_minutes ?? 0), 0),
      activeSessions: (sessions.data ?? []).filter((s) => ["running", "starting", "idle"].includes(s.status)).length,
      projects: (projects.data ?? []).map((p) => ({ id: p.id, name: p.title ?? "Untitled" })),
      builds: (builds.data ?? []).map((b) => ({
        id: b.id,
        kind: b.kind,
        status: b.status,
        credits: Number(b.credits ?? 0),
        created_at: b.created_at,
      })),
    });
    setBusy(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(
    () => Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]),
    [data.byCategory],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-orbitron text-sm font-bold tracking-wide">Team overview</h2>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => void load()} disabled={busy}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <p className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
            <Coins className="h-3 w-3" /> Balance
          </p>
          <p className="font-orbitron text-lg">{data.balance}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Credits spent</p>
          <p className="font-orbitron text-lg">{data.spent}</p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
            <Cloud className="h-3 w-3" /> Active sessions
          </p>
          <p className="font-orbitron text-lg">{data.activeSessions}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Container minutes</p>
          <p className="font-orbitron text-lg">{data.minutes}</p>
        </Card>
      </div>

      <Card className="p-3">
        <p className="mb-2 text-[10px] uppercase text-muted-foreground">Spend by category</p>
        {categories.length === 0 ? (
          <p className="text-xs text-muted-foreground">No usage recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {categories.map(([cat, amount]) => (
              <div key={cat} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{cat}</span>
                <span className="font-mono">{amount}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-3">
        <p className="mb-2 flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
          <FolderGit2 className="h-3 w-3" /> Projects ({data.projects.length})
        </p>
        {data.projects.length === 0 ? (
          <p className="text-xs text-muted-foreground">No projects yet.</p>
        ) : (
          <div className="space-y-1">
            {data.projects.slice(0, 12).map((p) => (
              <div key={p.id} className="truncate text-xs">
                {p.name}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-3">
        <p className="mb-2 flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
          <Hammer className="h-3 w-3" /> Recent builds
        </p>
        {data.builds.length === 0 ? (
          <p className="text-xs text-muted-foreground">No builds yet.</p>
        ) : (
          <div className="space-y-1">
            {data.builds.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-muted-foreground">
                  {new Date(b.created_at).toLocaleString()} · {b.kind}
                </span>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[9px] uppercase">
                    {b.status}
                  </Badge>
                  <span className="font-mono">{b.credits}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
