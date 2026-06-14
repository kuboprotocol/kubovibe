import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Pencil, Trash2, Save, X, AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RetryIndicator } from "@/components/creative/RetryIndicator";


type Preset = {
  id: string;
  name: string;
  filters: any;
  created_at: string;
  updated_at: string;
};

export default function PresetsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: presets = [], isLoading: loading, error: queryError, refetch: load, failureCount } = useQuery({
    queryKey: ["filter-presets", user?.id, sortDir],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error: err } = await supabase
        .from("creative_filter_presets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: sortDir === "asc" });
      if (err) throw err;
      return (data as Preset[]) || [];
    },
    enabled: !!user,
    retry: 2,
  });

  const error = queryError ? (queryError as Error).message : null;


  async function rename(id: string) {
    if (!editName.trim()) return;
    const { error } = await supabase
      .from("creative_filter_presets")
      .update({ name: editName.trim() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Preset renamed");
    setEditingId(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this preset?")) return;
    const { error } = await supabase.from("creative_filter_presets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Preset removed");
    load();
  }

  const filtered = presets.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/creative")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold flex-1">Filter Presets</h1>
      </header>

      <div className="px-4 pt-4 max-w-4xl mx-auto">
        <RetryIndicator 
          failureCount={failureCount} 
          error={queryError as Error} 
          onRetry={() => load()} 
          isLoading={loading} 
        />
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Search presets..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="outline" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}>
            Data {sortDir === "asc" ? "↑" : "↓"}
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Filters</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              )}
              {!loading && error && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-destructive">
                      <AlertTriangle className="h-8 w-8" />
                      <p>{error}</p>
                      <Button variant="outline" size="sm" onClick={() => load()}>Try again</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && filtered.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No presets found</TableCell></TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id} data-testid="preset-row">
                  <TableCell>
                    {editingId === p.id ? (
                      <Input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") rename(p.id); if (e.key === "Escape") setEditingId(null); }}
                      />
                    ) : <span className="font-medium">{p.name}</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                    {Object.entries(p.filters || {}).map(([k, v]) => `${k}=${v}`).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-xs">{new Date(p.updated_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right flex gap-1 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const qs = new URLSearchParams(p.filters).toString();
                        navigate(`/creative/investigation?${qs}`);
                      }}
                      title="Apply filters"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {editingId === p.id ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => rename(p.id)}><Save className="h-4 w-4"/></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4"/></Button>
                      </>
                    ) : (
                      <>
                        <Button data-testid="preset-rename" size="sm" variant="ghost" onClick={() => { setEditingId(p.id); setEditName(p.name); }}>
                          <Pencil className="h-4 w-4"/>
                        </Button>
                        <Button data-testid="preset-delete" size="sm" variant="ghost" onClick={() => remove(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive"/>
                        </Button>
                      </>
                    )}
                  </TableCell>

                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
