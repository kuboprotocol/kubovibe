import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Globe, Search, ArrowLeftRight, Link2, ServerCog, Loader2, Check, X, Sparkles, Plus, Trash2, Shield, Zap, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Domain = {
  id: string; domain_name: string; tld: string; source: string;
  status: string; ssl_status: string; expires_at: string | null;
  project_id: string | null; credits_spent: number; created_at: string;
  nameservers: string[] | null;
};
type SearchResult = { domain: string; tld: string; available: boolean | null; price_credits: number; note?: string; reason?: string };
type DnsRecord = { id: string; record_type: string; name: string; value: string; ttl: number; priority: number | null; ionos_record_id: string | null };

const RECORD_TYPES = ["A", "AAAA", "CNAME", "TXT", "MX", "SRV", "NS"] as const;

export default function DomainsPage() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("kubo_domains").select("*").order("created_at", { ascending: false });
    setDomains((data as Domain[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Premium gradient header */}
      <div className="border-b border-border/40 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
          </Button>
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30">
              <Globe className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-orbitron text-3xl font-bold tracking-tight">KUBO Domínios</h1>
              <p className="text-muted-foreground">Compre, transfira e publique com infraestrutura profissional.</p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="mine" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl bg-card/60 backdrop-blur border border-border/40">
            <TabsTrigger value="mine"><Globe className="w-4 h-4 mr-2" />Meus</TabsTrigger>
            <TabsTrigger value="buy"><Search className="w-4 h-4 mr-2" />Comprar</TabsTrigger>
            <TabsTrigger value="transfer"><ArrowLeftRight className="w-4 h-4 mr-2" />Transferir</TabsTrigger>
            <TabsTrigger value="connect"><Link2 className="w-4 h-4 mr-2" />Conectar</TabsTrigger>
            <TabsTrigger value="dns"><ServerCog className="w-4 h-4 mr-2" />DNS</TabsTrigger>
          </TabsList>

          <TabsContent value="mine"><MineTab domains={domains} loading={loading} onChange={load} /></TabsContent>
          <TabsContent value="buy"><BuyTab onPurchased={load} /></TabsContent>
          <TabsContent value="transfer"><TransferTab onTransferred={load} /></TabsContent>
          <TabsContent value="connect"><ConnectTab onConnected={load} /></TabsContent>
          <TabsContent value="dns"><DnsTab domains={domains} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    processing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return <Badge variant="outline" className={map[status] ?? "bg-muted text-muted-foreground"}>{status}</Badge>;
}

function MineTab({ domains, loading, onChange }: { domains: Domain[]; loading: boolean; onChange: () => void }) {
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!domains.length) {
    return (
      <Card className="border-dashed border-border/40 bg-card/40">
        <CardContent className="py-16 text-center">
          <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground/60" />
          <p className="text-muted-foreground mb-2">Nenhum domínio ainda.</p>
          <p className="text-sm text-muted-foreground/70">Vá em <strong>Comprar</strong> para registrar sua marca.</p>
        </CardContent>
      </Card>
    );
  }
  const remove = async (id: string) => {
    if (!confirm("Remover este domínio do painel Kubo? (Não cancela o registro)")) return;
    await supabase.from("kubo_domains").delete().eq("id", id);
    toast.success("Removido");
    onChange();
  };
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {domains.map((d) => (
        <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="group bg-card/60 backdrop-blur border-border/40 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="font-orbitron text-lg break-all">{d.domain_name}</CardTitle>
                  <CardDescription className="text-xs mt-1 uppercase tracking-wide">{d.source} · .{d.tld}</CardDescription>
                </div>
                <StatusBadge status={d.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-3.5 h-3.5" /> SSL: <span className="text-foreground">{d.ssl_status}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Zap className="w-3.5 h-3.5" /> Créditos: <span className="text-foreground">{d.credits_spent}</span>
              </div>
              <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => remove(d.id)}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function BuyTab({ onPurchased }: { onPurchased: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);

  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true); setResults([]);
    const { data, error } = await supabase.functions.invoke("domain-search", { body: { query } });
    setSearching(false);
    if (error) { toast.error(error.message); return; }
    setResults(data?.results ?? []);
    if (!data?.has_ionos) toast.warning("IONOS_API_KEY não configurada — disponibilidade indicativa.");
  };

  const buy = async (r: SearchResult) => {
    if (!confirm(`Confirmar registro de ${r.domain} por ${r.price_credits} créditos?`)) return;
    setBuying(r.domain);
    const { data, error } = await supabase.functions.invoke("domain-purchase", { body: { domain: r.domain } });
    setBuying(null);
    if (error) { toast.error(error.message); return; }
    if (data?.error) { toast.error(data.error); return; }
    toast.success(`✓ ${r.domain} registrado`);
    onPurchased();
  };

  return (
    <Card className="bg-card/60 backdrop-blur border-border/40">
      <CardHeader>
        <CardTitle className="font-orbitron flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Buscar domínio</CardTitle>
        <CardDescription>Sugestões geradas por IA + verificação em tempo real na IONOS.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="minhamarca ou minhamarca.com" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} className="bg-background/60" />
          <Button onClick={search} disabled={searching} className="bg-gradient-to-r from-primary to-purple-600">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
          </Button>
        </div>
        <div className="grid gap-2">
          {results.map((r) => (
            <motion.div key={r.domain} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/30 hover:border-primary/40 transition">
              <div className="flex items-center gap-3 min-w-0">
                {r.available === true && <Check className="w-5 h-5 text-emerald-400 shrink-0" />}
                {r.available === false && <X className="w-5 h-5 text-red-400 shrink-0" />}
                {r.available === null && <span className="w-5 h-5 rounded-full bg-muted shrink-0" title={r.note ?? r.reason} />}
                <div className="min-w-0">
                  <div className="font-mono text-sm truncate">{r.domain}</div>
                  <div className="text-xs text-muted-foreground">.{r.tld} · {r.price_credits} créditos</div>
                </div>
              </div>
              <Button size="sm" disabled={r.available === false || buying === r.domain} onClick={() => buy(r)} variant={r.available === true ? "default" : "secondary"}>
                {buying === r.domain ? <Loader2 className="w-4 h-4 animate-spin" /> : "Comprar"}
              </Button>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TransferTab({ onTransferred }: { onTransferred: () => void }) {
  const [domain, setDomain] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [registrar, setRegistrar] = useState("");
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("domain-transfer", {
      body: { action: "start", domain, auth_code: authCode, current_registrar: registrar },
    });
    setBusy(false);
    if (error || data?.error) { toast.error(error?.message ?? data.error); return; }
    toast.success("Transferência iniciada");
    setDomain(""); setAuthCode(""); setRegistrar("");
    onTransferred();
  };

  return (
    <Card className="bg-card/60 backdrop-blur border-border/40 max-w-2xl">
      <CardHeader>
        <CardTitle className="font-orbitron flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-primary" /> Transferir domínio</CardTitle>
        <CardDescription>Tempo médio: 5–7 dias. Você precisa do AUTH/EPP code do registrar atual.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div><Label>Domínio</Label><Input placeholder="minhaempresa.com" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
        <div><Label>AUTH / EPP Code</Label><Input placeholder="xxxx-xxxx-xxxx" value={authCode} onChange={(e) => setAuthCode(e.target.value)} /></div>
        <div><Label>Registrar atual (opcional)</Label><Input placeholder="GoDaddy, Registro.br…" value={registrar} onChange={(e) => setRegistrar(e.target.value)} /></div>
        <Button onClick={start} disabled={busy || !domain || !authCode} className="w-full bg-gradient-to-r from-primary to-purple-600">
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowLeftRight className="w-4 h-4 mr-2" />} Iniciar transferência
        </Button>
      </CardContent>
    </Card>
  );
}

function ConnectTab({ onConnected }: { onConnected: () => void }) {
  const [domain, setDomain] = useState("");
  const [ns, setNs] = useState("");
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    const nameservers = ns.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    const { data, error } = await supabase.functions.invoke("domain-connect", { body: { domain, nameservers } });
    setBusy(false);
    if (error || data?.error) { toast.error(error?.message ?? data.error); return; }
    toast.success("Domínio conectado");
    setDomain(""); setNs("");
    onConnected();
  };

  return (
    <Card className="bg-card/60 backdrop-blur border-border/40 max-w-2xl">
      <CardHeader>
        <CardTitle className="font-orbitron flex items-center gap-2"><Link2 className="w-5 h-5 text-primary" /> Conectar domínio existente</CardTitle>
        <CardDescription>Aponte os nameservers no seu registrar para usar o painel Kubo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div><Label>Domínio</Label><Input placeholder="meudominio.com" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
        <div>
          <Label>Nameservers (opcional)</Label>
          <Input placeholder="ns1.kubo.dev, ns2.kubo.dev" value={ns} onChange={(e) => setNs(e.target.value)} />
        </div>
        <Button onClick={connect} disabled={busy || !domain} className="w-full bg-gradient-to-r from-primary to-purple-600">
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />} Conectar
        </Button>
      </CardContent>
    </Card>
  );
}

function DnsTab({ domains }: { domains: Domain[] }) {
  const [selected, setSelected] = useState<string>("");
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ type: "A", name: "@", value: "", ttl: 3600, priority: "" });
  const [creating, setCreating] = useState(false);
  const selectedDomain = useMemo(() => domains.find((d) => d.id === selected), [domains, selected]);

  useEffect(() => { if (domains.length && !selected) setSelected(domains[0].id); }, [domains, selected]);

  const load = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("domain-dns", { body: { action: "list", domain_id: id } });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRecords(data?.records ?? []);
  };
  useEffect(() => { if (selected) load(selected); }, [selected]);

  const create = async () => {
    if (!form.value) { toast.error("Valor obrigatório"); return; }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("domain-dns", {
      body: { action: "create", domain_id: selected, record: { ...form, priority: form.priority ? Number(form.priority) : null } },
    });
    setCreating(false);
    if (error || data?.error) { toast.error(error?.message ?? data.error); return; }
    toast.success(data?.synced ? "Registro criado e sincronizado" : "Registro salvo (IONOS sem sync)");
    setForm({ type: "A", name: "@", value: "", ttl: 3600, priority: "" });
    load(selected);
  };

  const del = async (id: string) => {
    const { error } = await supabase.functions.invoke("domain-dns", { body: { action: "delete", domain_id: selected, record_id: id } });
    if (error) { toast.error(error.message); return; }
    toast.success("Removido");
    load(selected);
  };

  if (!domains.length) return <Card className="bg-card/60 border-border/40"><CardContent className="py-12 text-center text-muted-foreground">Você precisa de pelo menos um domínio para gerenciar DNS.</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card className="bg-card/60 backdrop-blur border-border/40">
        <CardHeader>
          <CardTitle className="font-orbitron text-lg">Editor DNS</CardTitle>
          <CardDescription>Gerencie registros A / AAAA / CNAME / TXT / MX / SRV / NS.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Domínio</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{domains.map((d) => <SelectItem key={d.id} value={d.id}>{d.domain_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3 rounded-lg bg-background/40 border border-border/30">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{RECORD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Nome</Label><Input className="h-9" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="md:col-span-2"><Label className="text-xs">Valor</Label><Input className="h-9" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.type === "A" ? "192.0.2.1" : form.type === "CNAME" ? "target.example.com" : ""} /></div>
            <div><Label className="text-xs">TTL</Label><Input className="h-9" type="number" value={form.ttl} onChange={(e) => setForm({ ...form, ttl: Number(e.target.value) })} /></div>
            <div className="flex items-end"><Button onClick={create} disabled={creating} className="w-full h-9">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Add</>}</Button></div>
          </div>

          {loading ? <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div> : (
            <div className="overflow-hidden rounded-lg border border-border/30">
              <table className="w-full text-sm">
                <thead className="bg-background/60"><tr className="text-left text-xs text-muted-foreground"><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Valor</th><th className="px-3 py-2">TTL</th><th></th></tr></thead>
                <tbody>{records.length ? records.map((r) => (
                  <tr key={r.id} className="border-t border-border/20 hover:bg-background/30">
                    <td className="px-3 py-2 font-mono text-xs"><Badge variant="outline">{r.record_type}</Badge></td>
                    <td className="px-3 py-2 font-mono">{r.name}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-xs">{r.value}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.ttl}s</td>
                    <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => del(r.id)} className="text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></Button></td>
                  </tr>
                )) : <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Sem registros para {selectedDomain?.domain_name}.</td></tr>}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
