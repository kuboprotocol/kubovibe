import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface UserRow {
  id: string;
  name: string;
  roles: string[];
  balance: number;
  spent: number;
  activeSessions: number;
  minutes: number;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setBusy(true);
    const [profiles, roles, tx, sessions] = await Promise.all([
      supabase.from("profiles").select("id, display_name, created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("credit_transactions").select("user_id, delta, balance_after, created_at").order("created_at", { ascending: false }).limit(5000),
      supabase.from("cloud_sessions").select("user_id, status, billed_minutes"),
    ]);

    const roleMap = new Map<string, string[]>();
    (roles.data ?? []).forEach((r) => {
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
    });

    const balance = new Map<string, number>();
    const spent = new Map<string, number>();
    (tx.data ?? []).forEach((t) => {
      if (!balance.has(t.user_id)) balance.set(t.user_id, Number(t.balance_after ?? 0));
      if (Number(t.delta) < 0) spent.set(t.user_id, (spent.get(t.user_id) ?? 0) + Math.abs(Number(t.delta)));
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
        balance: balance.get(p.id) ?? 0,
        spent: spent.get(p.id) ?? 0,
        activeSessions: active.get(p.id) ?? 0,
        minutes: minutes.get(p.id) ?? 0,
        createdAt: p.created_at,
      })),
    );
    setBusy(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.id.includes(q) || r.roles.join(",").includes(q));
  }, [rows, search]);

  const totals = useMemo(
    () => ({
      users: rows.length,
      active: rows.reduce((a, r) => a + r.activeSessions, 0),
      spent: rows.reduce((a, r) => a + r.spent, 0),
    }),
    [rows],
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link to="/admin" aria-label="Back to admin">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="font-orbitron text-2xl font-bold">Users</h1>
              <p className="text-sm text-muted-foreground">Roles, remaining credits and active cloud sessions.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Users", value: totals.users, icon: Users },
            { label: "Active sessions", value: totals.active, icon: ShieldCheck },
            { label: "Credits spent", value: totals.spent.toFixed(1), icon: ShieldCheck },
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
            <CardTitle className="text-base">All users</CardTitle>
            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by name, id or role" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">User</th>
                  <th>Roles</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">Spent</th>
                  <th className="text-right">Minutes</th>
                  <th className="text-right">Active</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="py-2">
                      <div className="font-medium">{r.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{r.id.slice(0, 8)}</div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {r.roles.map((role) => (
                          <Badge key={role} variant="outline" className="text-[10px]">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="text-right">{r.balance.toFixed(1)}</td>
                    <td className="text-right">{r.spent.toFixed(1)}</td>
                    <td className="text-right">{r.minutes}</td>
                    <td className="text-right">
                      {r.activeSessions > 0 ? (
                        <Badge className="border-emerald-500/30 bg-transparent text-emerald-400">{r.activeSessions}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!busy && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
