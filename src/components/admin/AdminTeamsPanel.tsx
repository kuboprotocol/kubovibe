import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Loader2, RefreshCw, Search, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ROLES = ["user", "moderator", "admin"] as const;

interface TeamRow {
  id: string;
  name: string;
  roles: string[];
  projects: { id: string; name: string }[];
  balance: number;
  spent: number;
  activeSessions: number;
  minutes: number;
  byCategory: Record<string, number>;
}

export default function AdminTeamsPanel() {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("user");
  const [newCredits, setNewCredits] = useState("25");
  const [creating, setCreating] = useState(false);


  const load = async () => {
    setBusy(true);
    const [profiles, roles, projects, tx, sessions] = await Promise.all([
      supabase.from("profiles").select("id, display_name, created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("projects").select("id, title, user_id").order("created_at", { ascending: false }).limit(2000),
      supabase.from("credit_transactions").select("user_id, delta, balance_after, category, created_at").order("created_at", { ascending: false }).limit(5000),
      supabase.from("cloud_sessions").select("user_id, status, billed_minutes"),
    ]);

    const roleMap = new Map<string, string[]>();
    (roles.data ?? []).forEach((r) => roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]));

    const projectMap = new Map<string, { id: string; name: string }[]>();
    (projects.data ?? []).forEach((p) => {
      if (!p.user_id) return;
      projectMap.set(p.user_id, [...(projectMap.get(p.user_id) ?? []), { id: p.id, name: p.title ?? "Untitled" }]);
    });

    const balance = new Map<string, number>();
    const byCategory = new Map<string, Record<string, number>>();
    const spent = new Map<string, number>();
    (tx.data ?? []).forEach((t) => {
      if (!balance.has(t.user_id)) balance.set(t.user_id, Number(t.balance_after ?? 0));
      if (Number(t.delta) < 0) {
        const amount = Math.abs(Number(t.delta));
        spent.set(t.user_id, (spent.get(t.user_id) ?? 0) + amount);
        const cat = t.category || "general";
        const bucket = byCategory.get(t.user_id) ?? {};
        bucket[cat] = (bucket[cat] ?? 0) + amount;
        byCategory.set(t.user_id, bucket);
      }
    });

    const active = new Map<string, number>();
    const minutes = new Map<string, number>();
    (sessions.data ?? []).forEach((s) => {
      if (["running", "starting", "idle"].includes(s.status)) active.set(s.user_id, (active.get(s.user_id) ?? 0) + 1);
      minutes.set(s.user_id, (minutes.get(s.user_id) ?? 0) + Number(s.billed_minutes ?? 0));
    });

    setRows(
      (profiles.data ?? []).map((p) => ({
        id: p.id,
        name: p.display_name || p.id.slice(0, 8),
        roles: roleMap.get(p.id) ?? ["user"],
        projects: projectMap.get(p.id) ?? [],
        balance: balance.get(p.id) ?? 0,
        spent: spent.get(p.id) ?? 0,
        activeSessions: active.get(p.id) ?? 0,
        minutes: minutes.get(p.id) ?? 0,
        byCategory: byCategory.get(p.id) ?? {},
      })),
    );
    setBusy(false);
  };

  const createAccount = async () => {
    if (!newEmail.trim()) {
      toast.error("Informe um e-mail");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: newEmail.trim(),
          display_name: newName.trim(),
          role: newRole,
          credits: Number(newCredits) || 0,
        },
      });
      const payload = data as { temp_password?: string; error?: string } | null;
      if (error || payload?.error) {
        toast.error(payload?.error ?? error?.message ?? "Falha ao criar conta");
        return;
      }
      toast.success(`Conta criada. Senha temporária: ${payload?.temp_password ?? "-"}`, { duration: 15000 });
      setNewEmail("");
      setNewName("");
      await load();
    } finally {
      setCreating(false);
    }
  };

  const assignRole = async (userId: string, role: string) => {

    const { error: delError } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delError) {
      toast.error(delError.message);
      return;
    }
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Role updated to ${role}`);
    setRows((prev) => prev.map((r) => (r.id === userId ? { ...r, roles: [role] } : r)));
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.id.includes(q) ||
        r.roles.join(",").includes(q) ||
        r.projects.some((p) => p.name.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const totals = useMemo(
    () => ({
      teams: rows.length,
      projects: rows.reduce((a, r) => a + r.projects.length, 0),
      active: rows.reduce((a, r) => a + r.activeSessions, 0),
      spent: rows.reduce((a, r) => a + r.spent, 0),
    }),
    [rows],
  );

  return (
    <div className="space-y-6 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-orbitron text-lg font-bold">Teams</h2>
            <p className="text-sm text-muted-foreground">Accounts, projects, credits and active cloud sessions.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>


        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create test account</CardTitle>
            <CardDescription>Creates a real account with role and starting credits, billed on the same ledger.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-5">
            <Input placeholder="email@team.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Input placeholder="Display name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" min={0} placeholder="Credits" value={newCredits} onChange={(e) => setNewCredits(e.target.value)} />
            <Button onClick={() => void createAccount()} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create account
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-4">

          {[
            { label: "Accounts", value: totals.teams, icon: Building2 },
            { label: "Projects", value: totals.projects, icon: Building2 },
            { label: "Active sessions", value: totals.active, icon: Zap },
            { label: "Credits spent", value: totals.spent.toFixed(1), icon: Zap },
          ].map((c) => (
            <Card key={c.label}>
              <CardHeader className="pb-2">
                <CardDescription>{c.label}</CardDescription>
                <CardTitle className="text-2xl">{c.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All accounts</CardTitle>
            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by account, project, id or role"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{r.id.slice(0, 8)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Select value={r.roles[0] ?? "user"} onValueChange={(v) => void assignRole(r.id, v)}>
                      <SelectTrigger className="h-7 w-[120px] text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role} className="text-xs">
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">Balance</span>
                    <span className="font-semibold">{r.balance.toFixed(1)}</span>
                    <span className="text-muted-foreground">Spent</span>
                    <span className="font-semibold">{r.spent.toFixed(1)}</span>
                    <span className="text-muted-foreground">Minutes</span>
                    <span className="font-semibold">{r.minutes}</span>
                    {r.activeSessions > 0 ? (
                      <Badge className="border-emerald-500/30 bg-transparent text-emerald-400">{r.activeSessions} active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">idle</Badge>
                    )}
                  </div>
                </div>
                {Object.keys(r.byCategory).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {Object.entries(r.byCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amount]) => (
                        <span key={cat} className="rounded border border-border/60 px-2 py-0.5">
                          {cat}: <span className="font-semibold text-foreground">{amount.toFixed(1)}</span>
                        </span>
                      ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-1">
                  {r.projects.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No projects</span>
                  ) : (
                    r.projects.slice(0, 12).map((p) => (
                      <Badge key={p.id} variant="secondary" className="text-[10px]">
                        {p.name}
                      </Badge>
                    ))
                  )}
                  {r.projects.length > 12 && (
                    <span className="text-xs text-muted-foreground">+{r.projects.length - 12} more</span>
                  )}
                </div>
              </div>
            ))}
            {!busy && filtered.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No accounts found.</p>
            )}
          </CardContent>
        </Card>
    </div>

  );
}
