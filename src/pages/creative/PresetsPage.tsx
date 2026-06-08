import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Pencil, Trash2, Save, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [presets, setPresets] = useState<Preset[]>([]);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("creative_filter_presets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: sortDir === "asc" });
    if (err) {
      setError(err.message);
      toast.error(err.message);
    } else {
      setPresets((data as Preset[]) || []);
      setError(null);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, sortDir]);

  async function rename(id: string) {
    if (!editName.trim()) return;
    const { error } = await supabase
      .from("creative_filter_presets")
      .update({ name: editName.trim() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Preset renomeado");
    setEditingId(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este preset?")) return;
    const { error } = await supabase.from("creative_filter_presets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Preset removido");
    load();
  }

  const filtered = presets.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/creative")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold flex-1">Presets de Filtros</h1>
      </header>

      <div className="p-4 max-w-4xl mx-auto space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Buscar presets..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="outline" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}>
            Data {sortDir === "asc" ? "↑" : "↓"}
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Filtros</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
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
                      <Button variant="outline" size="sm" onClick={() => load()}>Tentar novamente</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && filtered.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum preset encontrado</TableCell></TableRow>
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
                  <TableCell className="text-right">
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
