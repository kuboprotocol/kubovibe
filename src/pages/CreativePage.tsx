import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  MessageSquare, Image as ImageIcon, Download, Scissors, User2,
  Video, Music, BookOpen, Sparkles, Loader2, Coins, ArrowLeft, RotateCw, AlertTriangle,
} from "lucide-react";

type ToolKey = "dashboard" | "chat" | "nano_banana" | "downloader" | "clips" | "avatar" | "shorts" | "music" | "ebook";

const TOOLS: { key: ToolKey; title: string; desc: string; icon: any; cost: string }[] = [
  { key: "chat", title: "Kubo Chat", desc: "Conversas, resumos, traduções, geração de textos", icon: MessageSquare, cost: "1 crédito/msg" },
  { key: "nano_banana", title: "Nano Banana", desc: "Criar e editar imagens com IA", icon: ImageIcon, cost: "1 crédito" },
  { key: "downloader", title: "Downloader Universal", desc: "YouTube, Instagram, TikTok, Facebook, Kwai", icon: Download, cost: "2 créditos" },
  { key: "clips", title: "Kubo Clips", desc: "Cortes virais automáticos de vídeos longos", icon: Scissors, cost: "1 crédito" },
  { key: "avatar", title: "Kubo Avatar AI", desc: "Avatares falantes com narração IA", icon: User2, cost: "2–4 créditos" },
  { key: "shorts", title: "Kubo Shorts", desc: "Vídeos curtos verticais a partir de texto", icon: Video, cost: "3 créditos" },
  { key: "music", title: "Kubo Music AI", desc: "Música original via Suno", icon: Music, cost: "1 crédito" },
  { key: "ebook", title: "Kubo Ebook AI", desc: "eBooks completos com capa e capítulos", icon: BookOpen, cost: "10 créditos" },
];

function fnUrl(name: string) {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
}

async function authedFetch(name: string, body: unknown, idempotencyKey?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  };
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;
  const r = await fetch(fnUrl(name), { method: "POST", headers, body: JSON.stringify(body) });
  return r;
}

// Dispatch table for re-execution from history
const RERUN_MAP: Record<string, { fn: string; build: (a: any) => any }> = {
  chat: { fn: "creative-chat", build: (a) => ({ messages: [{ role: "user", content: a.prompt }] }) },
  nano_banana: { fn: "creative-image", build: (a) => ({ prompt: a.prompt, size: a.metadata?.size }) },
  downloader: { fn: "creative-download", build: (a) => ({ url: a.metadata?.url ?? a.prompt, format: a.metadata?.format ?? "mp4" }) },
  clips: { fn: "creative-clips", build: (a) => ({ transcript: a.prompt, source_url: a.metadata?.source_url }) },
  avatar: { fn: "creative-video", build: (a) => ({ mode: "avatar", prompt: a.prompt, duration: a.metadata?.duration ?? 30 }) },
  shorts: { fn: "creative-video", build: (a) => ({ mode: "shorts", prompt: a.prompt, duration: 30 }) },
  music: { fn: "creative-music", build: (a) => ({ action: "generate", prompt: a.prompt, instrumental: a.metadata?.instrumental ?? false }) },
  ebook: { fn: "creative-ebook", build: (a) => ({ topic: a.prompt, chapters: a.metadata?.chapters ?? 5 }) },
};

// In-memory cooldown registry (per tool) populated when an edge fn returns 429.
const cooldowns = new Map<string, number>(); // tool -> epoch ms when usable again
const cooldownListeners = new Set<() => void>();
function setCooldown(tool: string, seconds: number) {
  cooldowns.set(tool, Date.now() + seconds * 1000);
  cooldownListeners.forEach((cb) => cb());
}
function useCooldown(tool?: string) {
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force((x) => x + 1);
    cooldownListeners.add(cb);
    const t = setInterval(cb, 1000);
    return () => { cooldownListeners.delete(cb); clearInterval(t); };
  }, []);
  if (!tool) {
    let max = 0;
    for (const [, until] of cooldowns) max = Math.max(max, until - Date.now());
    return Math.max(0, Math.ceil(max / 1000));
  }
  const until = cooldowns.get(tool) ?? 0;
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function parseRetryAfter(errStr: unknown): { tool?: string; seconds: number } | null {
  if (typeof errStr !== "string") return null;
  // shape: "rate_limit_exceeded:<tool>:<max>/<windowSeconds>s"
  const m = errStr.match(/rate_limit_exceeded:([^:]+):\d+\/(\d+)s/);
  if (!m) return null;
  return { tool: m[1], seconds: Number(m[2]) };
}

function handleFnError(d: any, fallback = "Erro") {
  const msg = d?.error || fallback;
  const rl = parseRetryAfter(msg);
  if (rl) {
    setCooldown(rl.tool ?? "global", rl.seconds);
    toast.error(`Limite atingido — aguarde ${rl.seconds}s`, {
      description: rl.tool ? `Ferramenta: ${rl.tool}` : undefined,
    });
  } else if (typeof msg === "string" && msg.includes("insufficient_credits")) {
    toast.error("Créditos insuficientes para esta ação.");
  } else {
    toast.error(typeof msg === "string" ? msg : fallback);
  }
}

export default function CreativePage() {
  const { tool } = useParams<{ tool?: ToolKey }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, editsRemaining, refetch } = useSubscription();
  const [active, setActive] = useState<ToolKey>((tool as ToolKey) || "dashboard");
  const [history, setHistory] = useState<any[]>([]);
  const [cursorStack, setCursorStack] = useState<string[]>([]); // created_at cursors for prev navigation
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "reconnecting" | "offline">("connecting");
  const [selected, setSelected] = useState<any | null>(null);
  const [rerunning, setRerunning] = useState<string | null>(null);
  const alertedRef = useRef<{ low?: boolean; empty?: boolean }>({});
  const globalCooldown = useCooldown();
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (tool) setActive(tool as ToolKey);
  }, [tool]);

  // Cursor pagination: pass `before` (created_at) to fetch next page; null = first page.
  async function loadHistory(before: string | null = null) {
    if (!user) return;
    let q = supabase.from("creative_assets")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1); // fetch one extra to detect "has next"
    if (before) q = q.lt("created_at", before);
    const { data, count } = await q;
    const rows = data ?? [];
    const hasMore = rows.length > PAGE_SIZE;
    const visible = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    setHistory(visible);
    setNextCursor(hasMore ? visible[visible.length - 1].created_at : null);
    setTotalCount(count ?? 0);
  }

  // Initial + refresh on user/active change.
  useEffect(() => {
    setCursorStack([]);
    loadHistory(null);
  }, [user, active]);

  // Realtime with reconnect handling. Channel rebuilt on user change; status reflected in UI.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let channel = supabase.channel(`creative-assets-${user.id}`);
    const subscribe = () => {
      channel
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "creative_assets",
          filter: `user_id=eq.${user.id}`,
        }, () => {
          // refresh current page (top if no cursor, otherwise the page we're on)
          const top = cursorStack.length === 0 ? null : cursorStack[cursorStack.length - 1];
          loadHistory(top);
        })
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            setRealtimeStatus((prev) => {
              if (prev === "reconnecting") {
                // resync after reconnect
                const top = cursorStack.length === 0 ? null : cursorStack[cursorStack.length - 1];
                loadHistory(top);
              }
              return "live";
            });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setRealtimeStatus("reconnecting");
            // tear down and retry with backoff
            supabase.removeChannel(channel);
            setTimeout(() => {
              if (cancelled) return;
              channel = supabase.channel(`creative-assets-${user.id}`);
              subscribe();
            }, 2000);
          } else if (status === "CLOSED") {
            setRealtimeStatus("offline");
          }
        });
    };
    subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user]);

  // Balance alerts
  useEffect(() => {
    if (editsRemaining === null || editsRemaining === undefined) return;
    if (editsRemaining <= 0 && !alertedRef.current.empty) {
      alertedRef.current.empty = true;
      toast.error("Saldo zerado", { description: "Você ficou sem créditos. Recarregue para continuar." });
    } else if (editsRemaining > 0 && editsRemaining <= 10 && !alertedRef.current.low) {
      alertedRef.current.low = true;
      toast.warning(`Saldo baixo: ${editsRemaining} créditos`, { description: "Considere recarregar antes de gerações pesadas." });
    }
    if (editsRemaining > 10) alertedRef.current = {};
  }, [editsRemaining]);

  const balanceTone =
    (editsRemaining ?? 0) <= 0 ? "bg-destructive/15 border-destructive/40 text-destructive" :
    (editsRemaining ?? 0) <= 10 ? "bg-yellow-500/10 border-yellow-500/40 text-yellow-600 dark:text-yellow-400" :
    "bg-primary/10 border-primary/30";

  async function rerun(asset: any) {
    const cfg = RERUN_MAP[asset.tool];
    if (!cfg) { toast.error("Reexecução indisponível para esta ferramenta."); return; }
    const idemKey = `rerun:${asset.id}`;
    setRerunning(asset.id);
    try {
      const r = await authedFetch(cfg.fn, cfg.build(asset), idemKey);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { handleFnError(d); return; }
      toast.success(d?.replayed ? "Reexecução idempotente (sem débito duplo)" : "Reexecutado com sucesso");
      refetch();
      const top = cursorStack.length === 0 ? null : cursorStack[cursorStack.length - 1];
      loadHistory(top);
      setSelected(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao reexecutar");
    } finally {
      setRerunning(null);
    }
  }


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-card/30 backdrop-blur sticky top-0 z-30">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Economia Criativa Kubo
              </h1>
              <p className="text-xs text-muted-foreground">8 ferramentas IA em um só painel</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${balanceTone}`}>
            {(editsRemaining ?? 0) <= 10 ? <AlertTriangle className="h-4 w-4" /> : <Coins className="h-4 w-4 text-primary" />}
            <span className="font-mono text-sm font-bold">{editsRemaining}</span>
            <span className="text-xs opacity-80">créditos</span>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6">
        <Tabs value={active} onValueChange={(v) => { setActive(v as ToolKey); navigate(v === "dashboard" ? "/creative" : `/creative/${v}`); }}>
          <TabsList className="flex flex-wrap h-auto justify-start gap-1 mb-6 bg-card/50 p-1">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            {TOOLS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                <t.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.title.replace("Kubo ", "")}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard
              editsRemaining={editsRemaining}
              subscription={subscription}
              history={history}
              onPick={(k: ToolKey) => { setActive(k); navigate(`/creative/${k}`); }}
              onOpen={(a: any) => setSelected(a)}
              onRerun={rerun}
              rerunningId={rerunning}
              page={page}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </TabsContent>


          <TabsContent value="chat"><ChatTool onDone={() => { refetch(); loadHistory(); }} /></TabsContent>
          <TabsContent value="nano_banana"><ImageTool onDone={() => { refetch(); loadHistory(); }} /></TabsContent>
          <TabsContent value="downloader"><DownloaderTool onDone={() => { refetch(); loadHistory(); }} /></TabsContent>
          <TabsContent value="clips"><ClipsTool onDone={() => { refetch(); loadHistory(); }} /></TabsContent>
          <TabsContent value="avatar"><AvatarTool onDone={() => { refetch(); loadHistory(); }} /></TabsContent>
          <TabsContent value="shorts"><ShortsTool onDone={() => { refetch(); loadHistory(); }} /></TabsContent>
          <TabsContent value="music"><MusicTool onDone={() => { refetch(); loadHistory(); }} /></TabsContent>
          <TabsContent value="ebook"><EbookTool onDone={() => { refetch(); loadHistory(); }} /></TabsContent>
        </Tabs>
      </main>

      <AssetDetailDialog asset={selected} onClose={() => setSelected(null)} onRerun={rerun} rerunning={!!rerunning && rerunning === selected?.id} />
    </div>
  );
}

function AssetDetailDialog({ asset, onClose, onRerun, rerunning }: { asset: any; onClose: () => void; onRerun: (a: any) => void; rerunning: boolean }) {
  const open = !!asset;
  if (!asset) return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent />
    </Dialog>
  );
  const canRerun = !!RERUN_MAP[asset.tool];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{asset.tool}</Badge>
            <span className="text-sm font-normal text-muted-foreground">
              {new Date(asset.created_at).toLocaleString("pt-BR")}
            </span>
          </DialogTitle>
          <DialogDescription>
            Status: <span className="font-mono">{asset.status}</span> · Créditos: <span className="font-mono">{asset.credits_spent ?? 0}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {asset.prompt && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Prompt</div>
              <Card className="p-3 whitespace-pre-wrap bg-muted/30">{asset.prompt}</Card>
            </div>
          )}
          {asset.output_url && (asset.tool === "nano_banana" ? (
            <img src={asset.output_url} alt="output" className="rounded-lg border border-border max-w-full" />
          ) : asset.tool === "music" ? (
            <audio src={asset.output_url} controls className="w-full" />
          ) : (
            <a href={asset.output_url} target="_blank" rel="noreferrer" className="text-primary underline break-all">{asset.output_url}</a>
          ))}
          {asset.output_text && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Saída</div>
              <Card className="p-3 max-h-64 overflow-y-auto"><pre className="text-xs whitespace-pre-wrap font-sans">{asset.output_text}</pre></Card>
            </div>
          )}
          {asset.error_message && (
            <Card className="p-3 border-destructive/40 bg-destructive/10 text-destructive text-xs">{asset.error_message}</Card>
          )}
          {asset.metadata && Object.keys(asset.metadata).length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Metadata</div>
              <Card className="p-3"><pre className="text-xs whitespace-pre-wrap font-mono">{JSON.stringify(asset.metadata, null, 2)}</pre></Card>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            <Button onClick={() => onRerun(asset)} disabled={!canRerun || rerunning}>
              {rerunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCw className="h-4 w-4 mr-2" />}
              Reexecutar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function Dashboard({ editsRemaining, subscription, history, onPick, onOpen, onRerun, rerunningId, page, totalCount, pageSize, onPageChange }: any) {
  const lowBalance = (editsRemaining ?? 0) <= 10;
  return (
    <div className="space-y-6">
      {lowBalance && (
        <Card className={`p-4 flex items-start gap-3 border ${(editsRemaining ?? 0) <= 0 ? "border-destructive/40 bg-destructive/10" : "border-yellow-500/40 bg-yellow-500/10"}`}>
          <AlertTriangle className={`h-5 w-5 mt-0.5 ${(editsRemaining ?? 0) <= 0 ? "text-destructive" : "text-yellow-600 dark:text-yellow-400"}`} />
          <div className="flex-1">
            <div className="font-semibold text-sm">
              {(editsRemaining ?? 0) <= 0 ? "Saldo zerado" : `Saldo baixo: ${editsRemaining} créditos`}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ferramentas pesadas (Ebook=10, Shorts=3, Avatar=2–4) podem ficar indisponíveis.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => window.location.assign("/pricing")}>Recarregar</Button>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 bg-gradient-to-br from-primary/10 to-card border-primary/30">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Saldo de Créditos</div>
          <div className="text-4xl font-bold mt-2 font-mono">{editsRemaining}</div>
          <Badge variant="outline" className="mt-3">{subscription?.plan ?? "free"}</Badge>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Gerações totais</div>
          <div className="text-4xl font-bold mt-2 font-mono">{totalCount ?? history.length}</div>
          <div className="text-xs text-muted-foreground mt-3">Página {(page ?? 0) + 1}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Créditos usados (página)</div>
          <div className="text-4xl font-mono font-bold mt-2">{history.reduce((s: number, x: any) => s + (x.credits_spent ?? 0), 0)}</div>
          <div className="text-xs text-muted-foreground mt-3">Soma dos itens visíveis</div>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">Ferramentas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TOOLS.map((t) => (
            <button key={t.key} onClick={() => onPick(t.key)} className="text-left">
              <Card className="p-4 h-full hover:border-primary/50 hover:bg-card/80 transition-all cursor-pointer group">
                <t.icon className="h-6 w-6 text-primary mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-semibold text-sm">{t.title}</div>
                <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
                <Badge variant="secondary" className="mt-3 text-[10px]">{t.cost}</Badge>
              </Card>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Histórico detalhado</h2>
          <Badge variant="outline" className="text-[10px]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
            tempo real
          </Badge>
        </div>
        <Card className="divide-y divide-border/40">
          {history.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma geração nesta página.</div>
          )}
          {history.map((h: any) => {
            const isRerunning = rerunningId === h.id;
            return (
              <div key={h.id} className="p-3 flex items-center gap-3 text-sm hover:bg-muted/30 transition-colors">
                <button onClick={() => onOpen(h)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <Badge variant="outline" className="capitalize shrink-0">{h.tool}</Badge>
                  <div className="flex-1 truncate text-muted-foreground">{h.prompt || h.metadata?.title || h.output_url || "—"}</div>
                  <div className="text-xs text-muted-foreground hidden sm:block whitespace-nowrap">{new Date(h.created_at).toLocaleString("pt-BR")}</div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{h.credits_spent ?? 0}c</Badge>
                  <Badge variant={h.status === "completed" ? "default" : h.status === "error" ? "destructive" : "secondary"} className="text-[10px] shrink-0">{h.status}</Badge>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 h-8 w-8"
                  disabled={!RERUN_MAP[h.tool] || !!rerunningId}
                  onClick={(e) => { e.stopPropagation(); onRerun(h); }}
                  aria-label="Reexecutar"
                  title="Reexecutar (idempotente)"
                >
                  {isRerunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                </Button>
              </div>
            );
          })}
        </Card>

        {totalCount > pageSize && (
          <div className="flex items-center justify-between mt-3 text-sm">
            <div className="text-xs text-muted-foreground">
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} de {totalCount}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * pageSize >= totalCount} onClick={() => onPageChange(page + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------ Tools ------------------ */

function ChatTool({ onDone }: { onDone: () => void }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user" as const, content: input };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(fnUrl("creative-chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ messages: next }),
      });
      if (!r.ok || !r.body) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error || "Falha no chat");
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "", acc = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") continue;
          try {
            const p = JSON.parse(j);
            const delta = p.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages((m) => m.map((mm, idx) => idx === m.length - 1 ? { ...mm, content: acc } : mm));
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }

  return (
    <Card className="flex flex-col h-[70vh]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && <div className="text-center text-muted-foreground text-sm py-12">Comece uma conversa com o Kubo Chat.</div>}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.content || "…"}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-border/40 p-3 flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Pergunte algo…" disabled={loading} />
        <Button onClick={send} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}</Button>
      </div>
    </Card>
  );
}

function ImageTool({ onDone }: { onDone: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  async function run() {
    if (!prompt) return;
    setLoading(true); setUrl(null);
    const r = await authedFetch("creative-image", { prompt });
    const d = await r.json();
    if (!r.ok) handleFnError(d); else { setUrl(d.image_url); onDone(); }
    setLoading(false);
  }

  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-bold flex items-center gap-2"><ImageIcon className="h-5 w-5 text-primary" />Nano Banana</h3>
      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Descreva a imagem..." rows={3} />
      <Button onClick={run} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}Gerar (1 crédito)</Button>
      {url && <img src={url} alt="Resultado" className="rounded-lg w-full max-w-lg border border-border" />}
    </Card>
  );
}

function DownloaderTool({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<"mp4" | "mp3">("mp4");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    if (!url) return;
    setLoading(true); setResult(null);
    const r = await authedFetch("creative-download", { url, format });
    const d = await r.json();
    if (!r.ok) handleFnError(d); else { setResult(d.download_url); onDone(); }
    setLoading(false);
  }

  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-bold flex items-center gap-2"><Download className="h-5 w-5 text-primary" />Downloader Universal</h3>
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole o link do YouTube/Instagram/TikTok..." />
      <div className="flex gap-2">
        <Button variant={format === "mp4" ? "default" : "outline"} size="sm" onClick={() => setFormat("mp4")}>MP4</Button>
        <Button variant={format === "mp3" ? "default" : "outline"} size="sm" onClick={() => setFormat("mp3")}>MP3</Button>
      </div>
      <Button onClick={run} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Baixar (2 créditos)</Button>
      {result && <a href={result} target="_blank" rel="noreferrer" className="text-primary underline text-sm break-all">{result}</a>}
    </Card>
  );
}

function ClipsTool({ onDone }: { onDone: () => void }) {
  const [transcript, setTranscript] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [clips, setClips] = useState<any[]>([]);
  async function run() {
    setLoading(true); setClips([]);
    const r = await authedFetch("creative-clips", { transcript, source_url: sourceUrl });
    const d = await r.json();
    if (!r.ok) handleFnError(d); else { setClips(d.clips || []); onDone(); }
    setLoading(false);
  }
  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-bold flex items-center gap-2"><Scissors className="h-5 w-5 text-primary" />Kubo Clips</h3>
      <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="URL do vídeo (opcional)" />
      <Textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Cole o transcript ou descrição do vídeo..." rows={5} />
      <Button onClick={run} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Identificar cortes (1 crédito)</Button>
      <div className="space-y-2">
        {clips.map((c, i) => (
          <Card key={i} className="p-3">
            <div className="text-xs text-muted-foreground font-mono">{c.start} → {c.end}</div>
            <div className="font-semibold text-sm">{c.title}</div>
            <div className="text-xs text-muted-foreground">{c.hook}</div>
          </Card>
        ))}
      </div>
    </Card>
  );
}

function AvatarTool({ onDone }: { onDone: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<30 | 60>(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  async function run() {
    setLoading(true); setResult(null);
    const r = await authedFetch("creative-video", { mode: "avatar", prompt, duration });
    const d = await r.json();
    if (!r.ok) handleFnError(d); else { setResult(d); onDone(); }
    setLoading(false);
  }
  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-bold flex items-center gap-2"><User2 className="h-5 w-5 text-primary" />Kubo Avatar AI</h3>
      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="O que o avatar deve falar?" rows={3} />
      <div className="flex gap-2">
        <Button variant={duration === 30 ? "default" : "outline"} size="sm" onClick={() => setDuration(30)}>30s (2 créditos)</Button>
        <Button variant={duration === 60 ? "default" : "outline"} size="sm" onClick={() => setDuration(60)}>60s (4 créditos)</Button>
      </div>
      <Button onClick={run} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Gerar avatar</Button>
      {result && <RenderResult r={result} />}
    </Card>
  );
}

function ShortsTool({ onDone }: { onDone: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  async function run() {
    setLoading(true); setResult(null);
    const r = await authedFetch("creative-video", { mode: "shorts", prompt, duration: 30 });
    const d = await r.json();
    if (!r.ok) handleFnError(d); else { setResult(d); onDone(); }
    setLoading(false);
  }
  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-bold flex items-center gap-2"><Video className="h-5 w-5 text-primary" />Kubo Shorts</h3>
      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ideia para o vídeo curto vertical..." rows={3} />
      <Button onClick={run} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Gerar Shorts (3 créditos)</Button>
      {result && <RenderResult r={result} />}
    </Card>
  );
}

function MusicTool({ onDone }: { onDone: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<{ task_id: string; asset_id: string } | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [polling, setPolling] = useState(false);

  async function generate() {
    setLoading(true); setItems([]); setTask(null);
    const r = await authedFetch("creative-music", { action: "generate", prompt, instrumental });
    const d = await r.json();
    if (!r.ok) { handleFnError(d); setLoading(false); return; }
    setTask({ task_id: d.task_id, asset_id: d.asset_id });
    onDone();
    setLoading(false);
    setPolling(true);
  }

  useEffect(() => {
    if (!task || !polling) return;
    const i = setInterval(async () => {
      const r = await authedFetch("creative-music", { action: "status", task_id: task.task_id, asset_id: task.asset_id });
      const d = await r.json();
      if (d.items?.length > 0) {
        setItems(d.items);
        setPolling(false);
        clearInterval(i);
      }
    }, 6000);
    return () => clearInterval(i);
  }, [task, polling]);

  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-bold flex items-center gap-2"><Music className="h-5 w-5 text-primary" />Kubo Music AI</h3>
      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Descreva o estilo e tema da música..." rows={3} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} />Instrumental</label>
      <Button onClick={generate} disabled={loading || polling}>{(loading || polling) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{polling ? "Gerando música…" : "Gerar (1 crédito)"}</Button>
      {polling && <p className="text-xs text-muted-foreground">A Suno leva 30–90s. Você pode navegar em outras abas.</p>}
      <div className="space-y-2">
        {items.map((it, i) => (
          <Card key={i} className="p-3 space-y-2">
            <div className="font-semibold text-sm">{it.title || `Faixa ${i + 1}`}</div>
            {it.audioUrl && <audio src={it.audioUrl} controls className="w-full" />}
          </Card>
        ))}
      </div>
    </Card>
  );
}

function EbookTool({ onDone }: { onDone: () => void }) {
  const [topic, setTopic] = useState("");
  const [chapters, setChapters] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  async function run() {
    setLoading(true); setResult(null);
    const r = await authedFetch("creative-ebook", { topic, chapters });
    const d = await r.json();
    if (!r.ok) handleFnError(d); else { setResult(d); onDone(); }
    setLoading(false);
  }
  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-bold flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />Kubo Ebook AI</h3>
      <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tema do eBook" />
      <Input type="number" min={3} max={12} value={chapters} onChange={(e) => setChapters(Number(e.target.value))} placeholder="Capítulos" />
      <Button onClick={run} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Gerar eBook (10 créditos)</Button>
      {result && (
        <div className="space-y-3">
          {result.cover && <img src={result.cover} alt="Capa" className="rounded-lg w-48 border border-border" />}
          <h4 className="font-bold text-lg">{result.title}</h4>
          <Card className="p-4 max-h-[400px] overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap font-sans">{result.content}</pre>
          </Card>
        </div>
      )}
    </Card>
  );
}

function RenderResult({ r }: { r: any }) {
  return (
    <Card className="p-4 space-y-2 bg-muted/30">
      {r.cover && <img src={r.cover} alt="Thumb" className="rounded-lg w-48 border border-border" />}
      {r.script && (
        <>
          <div className="text-xs font-semibold text-muted-foreground uppercase">Roteiro</div>
          <pre className="text-xs whitespace-pre-wrap font-sans max-h-60 overflow-y-auto">{r.script}</pre>
        </>
      )}
      {r.note && <p className="text-xs text-muted-foreground italic">{r.note}</p>}
    </Card>
  );
}
