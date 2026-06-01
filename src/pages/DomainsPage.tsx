import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Globe, Search, ArrowLeftRight, Link2, ServerCog, Loader2, Check, X, Sparkles, Plus, Trash2, Shield, Zap, ArrowLeft, RefreshCw, Terminal, KeyRound, Rocket, Info, Ban, Download, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Domain = {
  id: string; domain_name: string; tld: string; source: string;
  status: string; ssl_status: string; expires_at: string | null;
  project_id: string | null; credits_spent: number; created_at: string;
  nameservers: string[] | null;
};
type SearchResult = { domain: string; tld: string; available: boolean | null; price_credits: number; note?: string; reason?: string };
type DnsRecord = { id: string; record_type: string; name: string; value: string; ttl: number; priority: number | null; ionos_record_id: string | null };
type Transfer = {
  id: string; domain_name: string; status: string; status_message: string | null;
  ionos_transfer_id: string | null; current_registrar: string | null;
  started_at: string; completed_at: string | null; updated_at: string;
  notify_email: string | null; retry_count: number; next_retry_at: string | null;
  last_error: string | null; cancel_reason: string | null; cancel_requested_at: string | null;
};
type DebugLog = {
  id: string; event_type: string; status: string; message: string;
  metadata: any; created_at: string;
};

const RECORD_TYPES = ["A", "AAAA", "CNAME", "TXT", "MX", "SRV", "NS"] as const;

export default function DomainsPage() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [d, t] = await Promise.all([
      supabase.from("kubo_domains").select("*").order("created_at", { ascending: false }),
      supabase.from("kubo_domain_transfers").select("*").order("started_at", { ascending: false }),
    ]);
    setDomains((d.data as Domain[]) ?? []);
    setTransfers((t.data as Transfer[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const showOnboarding = !loading && domains.length === 0 && transfers.length === 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
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

      <div className="container mx-auto px-4 py-8 space-y-6">
        {showOnboarding && <OnboardingBanner />}

        <Tabs defaultValue={showOnboarding ? "buy" : "mine"} className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full max-w-4xl bg-card/60 backdrop-blur border border-border/40">
            <TabsTrigger value="mine"><Globe className="w-4 h-4 mr-2" />Meus</TabsTrigger>
            <TabsTrigger value="buy"><Search className="w-4 h-4 mr-2" />Comprar</TabsTrigger>
            <TabsTrigger value="transfer"><ArrowLeftRight className="w-4 h-4 mr-2" />Transferir</TabsTrigger>
            <TabsTrigger value="connect"><Link2 className="w-4 h-4 mr-2" />Conectar</TabsTrigger>
            <TabsTrigger value="dns"><ServerCog className="w-4 h-4 mr-2" />DNS</TabsTrigger>
            <TabsTrigger value="debug"><Terminal className="w-4 h-4 mr-2" />Debug</TabsTrigger>
          </TabsList>

          <TabsContent value="mine"><MineTab domains={domains} loading={loading} onChange={load} /></TabsContent>
          <TabsContent value="buy"><BuyTab onPurchased={load} /></TabsContent>
          <TabsContent value="transfer"><TransferTab transfers={transfers} onTransferred={load} /></TabsContent>
          <TabsContent value="connect"><ConnectTab onConnected={load} /></TabsContent>
          <TabsContent value="dns"><DnsTab domains={domains} /></TabsContent>
          <TabsContent value="debug"><DebugTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OnboardingBanner() {
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-card/40 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-orbitron flex items-center gap-2"><Rocket className="w-5 h-5 text-primary" /> Bem-vindo aos Domínios KUBO</CardTitle>
          <CardDescription>Tudo o que você precisa para colocar sua marca no ar — usando créditos KUBO.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <Step icon={<Search className="w-5 h-5" />} title="1. Buscar" body="Encontre nomes via IA + verificação IONOS em tempo real." />
          <Step icon={<Zap className="w-5 h-5" />} title="2. Pagar em créditos" body="Débito atômico — se algo falhar, seus créditos são preservados." />
          <Step icon={<Shield className="w-5 h-5" />} title="3. SSL + DNS auto" body="Certificado provisionado e editor DNS pronto para uso." />
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-background/40 border border-border/30">
      <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{body}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    processing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    validating: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    transferring: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
    error: "bg-red-500/15 text-red-400 border-red-500/30",
    success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    info: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  };
  return <Badge variant="outline" className={map[status] ?? "bg-muted text-muted-foreground"}>{status}</Badge>;
}

function MineTab({ domains, loading, onChange }: { domains: Domain[]; loading: boolean; onChange: () => void }) {
  const [toDelete, setToDelete] = useState<Domain | null>(null);
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
  const remove = async () => {
    if (!toDelete) return;
    await supabase.from("kubo_domains").delete().eq("id", toDelete.id);
    toast.success("Removido");
    setToDelete(null);
    onChange();
  };
  return (
    <>
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
                <div className="flex items-center gap-2 text-muted-foreground"><Shield className="w-3.5 h-3.5" /> SSL: <span className="text-foreground">{d.ssl_status}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Zap className="w-3.5 h-3.5" /> Créditos: <span className="text-foreground">{d.credits_spent}</span></div>
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => setToDelete(d)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {toDelete?.domain_name} do painel?</AlertDialogTitle>
            <AlertDialogDescription>Isto remove apenas do painel KUBO. O registro do domínio na IONOS não é cancelado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function BuyTab({ onPurchased }: { onPurchased: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [confirmBuy, setConfirmBuy] = useState<SearchResult | null>(null);

  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true); setResults([]);
    const { data, error } = await supabase.functions.invoke("domain-search", { body: { query } });
    setSearching(false);
    if (error) { toast.error(error.message); return; }
    setResults(data?.results ?? []);
    if (!data?.has_ionos) toast.warning("IONOS não configurada — disponibilidade indicativa.");
  };

  const doBuy = async () => {
    if (!confirmBuy) return;
    const r = confirmBuy;
    setConfirmBuy(null);
    setBuying(r.domain);
    const { data, error } = await supabase.functions.invoke("domain-purchase", { body: { domain: r.domain } });
    setBuying(null);
    if (error) { toast.error(error.message); return; }
    if (data?.error) { toast.error(data.error); return; }
    toast.success(`✓ ${r.domain} registrado · saldo: ${data?.balance_after ?? "?"}`);
    onPurchased();
  };

  return (
    <>
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
                <Button size="sm" disabled={r.available === false || buying === r.domain} onClick={() => setConfirmBuy(r)} variant={r.available === true ? "default" : "secondary"}>
                  {buying === r.domain ? <Loader2 className="w-4 h-4 animate-spin" /> : "Comprar"}
                </Button>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmBuy} onOpenChange={(o) => !o && setConfirmBuy(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-orbitron">Confirmar registro</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Você está prestes a registrar:</p>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <div className="font-mono text-lg text-foreground">{confirmBuy?.domain}</div>
                  <div className="text-sm text-muted-foreground mt-1">.{confirmBuy?.tld} · <span className="text-primary font-semibold">{confirmBuy?.price_credits} créditos</span></div>
                </div>
                <p className="text-xs">O débito é atômico e idempotente. Em caso de falha pós-débito, abra um ticket para reembolso.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doBuy} className="bg-gradient-to-r from-primary to-purple-600">Confirmar e pagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const TLD_TRANSFER_CREDITS: Record<string, number> = {
  com: 15, "com.br": 25, net: 16, org: 16, dev: 18, app: 22,
  io: 50, ai: 80, co: 30, xyz: 8, tech: 20, store: 25, online: 18,
};
function tldOf(d: string) {
  const parts = d.toLowerCase().split(".");
  if (parts.length >= 3 && parts[parts.length - 2] === "com" && parts[parts.length - 1] === "br") return "com.br";
  return parts[parts.length - 1] ?? "com";
}

function TransferTab({ transfers, onTransferred }: { transfers: Transfer[]; onTransferred: () => void }) {
  const [domain, setDomain] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [registrar, setRegistrar] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const tld = domain.includes(".") ? tldOf(domain) : null;
  const price = tld ? (TLD_TRANSFER_CREDITS[tld] ?? 20) : 20;

  const start = async () => {
    setConfirm(false);
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("domain-transfer", {
      body: { action: "start", domain, auth_code: authCode, current_registrar: registrar },
    });
    setBusy(false);
    if (error || data?.error) { toast.error(error?.message ?? data.error); return; }
    toast.success(`Transferência iniciada · saldo: ${data?.balance_after ?? "?"}`);
    setDomain(""); setAuthCode(""); setRegistrar("");
    onTransferred();
  };

  const refresh = async (id: string) => {
    setRefreshing(id);
    const { data, error } = await supabase.functions.invoke("domain-transfer", { body: { action: "status", transfer_id: id } });
    setRefreshing(null);
    if (error || data?.error) { toast.error(error?.message ?? data.error); return; }
    toast.success(`Status: ${data?.transfer?.status ?? "?"}`);
    onTransferred();
  };

  const canSubmit = !!domain && authCode.length >= 4 && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain);

  return (
    <div className="space-y-6">
      <Card className="bg-card/60 backdrop-blur border-border/40 max-w-2xl">
        <CardHeader>
          <CardTitle className="font-orbitron flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-primary" /> Transferir domínio</CardTitle>
          <CardDescription>Tempo médio: 5–7 dias. Você precisa do AUTH/EPP code do registrar atual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Domínio</Label><Input placeholder="minhaempresa.com" value={domain} onChange={(e) => setDomain(e.target.value.toLowerCase())} /></div>
          <div><Label>AUTH / EPP Code</Label><Input placeholder="xxxx-xxxx-xxxx" value={authCode} onChange={(e) => setAuthCode(e.target.value)} /></div>
          <div><Label>Registrar atual (opcional)</Label><Input placeholder="GoDaddy, Registro.br…" value={registrar} onChange={(e) => setRegistrar(e.target.value)} /></div>
          {tld && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 rounded bg-background/40 border border-border/30">
              <Info className="w-4 h-4 text-primary" /> Custo estimado: <span className="text-primary font-semibold">{price} créditos</span>
            </div>
          )}
          <Button onClick={() => setConfirm(true)} disabled={busy || !canSubmit} className="w-full bg-gradient-to-r from-primary to-purple-600">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowLeftRight className="w-4 h-4 mr-2" />} Iniciar transferência
          </Button>
        </CardContent>
      </Card>

      {transfers.length > 0 && (
        <Card className="bg-card/60 backdrop-blur border-border/40">
          <CardHeader>
            <CardTitle className="font-orbitron text-lg">Transferências</CardTitle>
            <CardDescription>Acompanhe o progresso e atualize o status manualmente quando precisar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {transfers.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background/40 border border-border/30">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm">{t.domain_name}</span>
                    <StatusBadge status={t.status} />
                    {t.current_registrar && <span className="text-xs text-muted-foreground">de {t.current_registrar}</span>}
                  </div>
                  {t.status_message && <div className="text-xs text-muted-foreground mt-1 truncate">{t.status_message}</div>}
                  <div className="text-xs text-muted-foreground/70 mt-0.5">Iniciado {new Date(t.started_at).toLocaleString("pt-BR")}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => refresh(t.id)} disabled={refreshing === t.id}>
                  {refreshing === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span className="ml-1 hidden sm:inline">Atualizar</span>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-orbitron">Confirmar transferência</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Você vai iniciar a transferência de:</p>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <div className="font-mono text-lg text-foreground">{domain}</div>
                  <div className="text-sm text-muted-foreground mt-1">Custo: <span className="text-primary font-semibold">{price} créditos</span></div>
                </div>
                <p className="text-xs">Os créditos são debitados agora. Se a IONOS rejeitar, o status ficará <code>failed</code> e você pode abrir um ticket de reembolso.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={start} className="bg-gradient-to-r from-primary to-purple-600">Confirmar e iniciar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
        <div><Label>Nameservers (opcional)</Label><Input placeholder="ns1.kubo.dev, ns2.kubo.dev" value={ns} onChange={(e) => setNs(e.target.value)} /></div>
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

function DebugTab() {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("connector_activity_logs")
      .select("id, event_type, status, message, metadata, created_at")
      .eq("connector_slug", "ionos")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs((data as DebugLog[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <Card className="bg-card/60 backdrop-blur border-border/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-orbitron flex items-center gap-2"><Terminal className="w-5 h-5 text-primary" /> Debug logs IONOS</CardTitle>
            <CardDescription>Últimos 100 eventos: busca, compra, transferência, status.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>
        ) : !logs.length ? (
          <div className="py-12 text-center text-muted-foreground">
            <KeyRound className="w-10 h-10 mx-auto mb-3 opacity-50" />
            Sem eventos ainda. Tente uma busca ou compra para gerar logs.
          </div>
        ) : (
          <div className="space-y-1.5 font-mono text-xs">
            {logs.map((l) => (
              <div key={l.id} className="border border-border/30 rounded bg-background/30">
                <button onClick={() => setExpanded(expanded === l.id ? null : l.id)} className="w-full text-left p-2 flex items-center gap-2 hover:bg-background/50 transition">
                  <span className="text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleTimeString("pt-BR")}</span>
                  <StatusBadge status={l.status} />
                  <span className="text-muted-foreground shrink-0">[{l.event_type}]</span>
                  <span className="text-foreground truncate flex-1">{l.message}</span>
                </button>
                {expanded === l.id && (
                  <pre className="p-3 border-t border-border/30 bg-background/60 overflow-x-auto text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
                    {JSON.stringify(l.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
