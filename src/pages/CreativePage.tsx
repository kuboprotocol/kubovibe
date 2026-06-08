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
  Video, Music, BookOpen, Sparkles, Loader2, Coins, ArrowLeft, RotateCw, AlertTriangle, Upload,
  FileDown, History
} from "lucide-react";

type ToolKey = "dashboard" | "chat" | "nano_banana" | "downloader" | "clips" | "avatar" | "shorts" | "music" | "ebook" | "emo";

const TOOLS: { key: ToolKey; title: string; desc: string; icon: any; cost: string }[] = [
  { key: "chat", title: "Kubo Chat", desc: "Conversas, resumos, traduções, geração de textos", icon: MessageSquare, cost: "1 crédito/msg" },
  { key: "nano_banana", title: "Nano Banana", desc: "Criar e editar imagens com IA", icon: ImageIcon, cost: "1 crédito" },
  { key: "downloader", title: "Downloader Universal", desc: "YouTube, Instagram, TikTok, Facebook, Kwai", icon: Download, cost: "2 créditos" },
  { key: "clips", title: "Kubo Clips", desc: "Cortes virais automáticos de vídeos longos", icon: Scissors, cost: "1 crédito" },
  { key: "avatar", title: "Kubo Avatar AI", desc: "Avatares falantes com narração IA", icon: User2, cost: "2–4 créditos" },
  { key: "shorts", title: "Kubo Shorts", desc: "Vídeos curtos verticais a partir de texto", icon: Video, cost: "3 créditos" },
  { key: "music", title: "Kubo Music AI", desc: "Música original via Suno", icon: Music, cost: "1 crédito" },
  { key: "ebook", title: "Kubo Ebook AI", desc: "eBooks completos com capa e capítulos", icon: BookOpen, cost: "10 créditos" },
  { key: "emo", title: "Kubo EMO AI", desc: "Animação realista de fotos a partir de vídeo", icon: Sparkles, cost: "5 créditos" },
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
  emo: { fn: "emo-animate", build: (a) => ({ source_image: a.metadata?.source_image, driving_video: a.metadata?.driving_video }) },
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
  const [filter, setFilter] = useState<"all" | "queued" | "processing" | "completed" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorStack, setCursorStack] = useState<string[]>([]); // created_at cursors for prev navigation
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "reconnecting" | "offline">("connecting");
  const [selected, setSelected] = useState<any | null>(null);
  const [rerunning, setRerunning] = useState<string | null>(null);
  const [isBatchRetrying, setIsBatchRetrying] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showAuditExportOptions, setShowAuditExportOptions] = useState(false);
  const [exportColumns, setExportColumns] = useState<string[]>(["ID", "Tool", "Status", "Prompt", "Credits", "Created At", "Error Message"]);
  const alertedRef = useRef<{ low?: boolean; empty?: boolean }>({});
  const globalCooldown = useCooldown();
  const PAGE_SIZE = 20;
  const [showAuditSchedule, setShowAuditSchedule] = useState(false);
  const [auditEmail, setAuditEmail] = useState("");
  const [auditTime, setAuditTime] = useState("09:00");
  const [auditInterval, setAuditInterval] = useState(7);
  const [presets, setPresets] = useState<any[]>([]);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [exports, setExports] = useState<any[]>([]);
  const [exportLogs, setExportLogs] = useState<any[]>([]);
  const [showExportHistory, setShowExportHistory] = useState(false);
  const [selectedExport, setSelectedExport] = useState<any | null>(null);
  const [auditDateStart, setAuditDateStart] = useState("");
  const [auditDateEnd, setAuditDateEnd] = useState("");



  useEffect(() => {
    if (tool) setActive(tool as ToolKey);
  }, [tool]);

  // Cursor pagination: pass `before` (created_at) to fetch next page; null = first page.
  async function loadHistory(before: string | null = null) {
    if (!user) return;
    let q = supabase.from("creative_assets")
      .select("*", { count: "exact" })
      .eq("user_id", user.id);
    
    if (filter !== "all") {
      if (filter === "failed") {
        q = q.in("status", ["failed", "error"]);
      } else {
        q = q.eq("status", filter);
      }
    }

    if (searchQuery) {
      q = q.or(`prompt.ilike.%${searchQuery}%,tool.ilike.%${searchQuery}%,error_message.ilike.%${searchQuery}%`);
    }

    q = q.order("created_at", { ascending: sortOrder === "asc" })
      .limit(PAGE_SIZE + 1);
    
    if (before) {
      if (sortOrder === "desc") {
        q = q.lt("created_at", before);
      } else {
        q = q.gt("created_at", before);
      }
    }

    const { data, count } = await q;
    const rows = data ?? [];
    const hasMore = rows.length > PAGE_SIZE;
    const visible = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    setHistory(visible);
    setNextCursor(hasMore ? visible[visible.length - 1].created_at : null);
    setTotalCount(count ?? 0);
  }

  async function loadPresets() {
    if (!user) return;
    const { data: p } = await supabase.from("creative_filter_presets").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setPresets(p || []);
  }

  async function renamePreset(id: string, newName: string) {
    const { error } = await supabase.from("creative_filter_presets").update({ name: newName }).eq("id", id);
    if (!error) {
      toast.success("Preset renomeado");
      loadPresets();
    }
  }


  // Initial + refresh on user/active/filter change.
  // Save preferences
  useEffect(() => {
    if (!user) return;
    const savePrefs = async () => {
      await supabase.from("creative_user_settings").upsert({
        user_id: user.id,
        filter,
        search_query: searchQuery,
        sort_order: sortOrder
      });
    };
    const t = setTimeout(savePrefs, 2000);
    return () => clearTimeout(t);
  }, [user, filter, searchQuery, sortOrder]);

  // Load preferences, presets and exports
  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      // Prefs
      const { data: prefs } = await supabase.from("creative_user_settings").select("*").eq("user_id", user.id).single();
      if (prefs) {
        setFilter(prefs.filter as any);
        setSearchQuery(prefs.search_query);
        setSortOrder(prefs.sort_order as any);
      }
      
      // Presets
      const { data: p } = await supabase.from("creative_filter_presets").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setPresets(p || []);

      // Audit Schedule
      const { data: sch } = await supabase.from("creative_audit_schedules").select("*").eq("user_id", user.id).single();
      if (sch) {
        setAuditEmail(sch.email);
        setAuditTime(sch.schedule_time);
        setAuditInterval(sch.export_interval_days || 7);
      }

      // Export History
      const { data: ex } = await supabase.from("creative_export_history").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setExports(ex || []);

      // Alerts for failed exports
      const { data: logs } = await supabase.from("creative_export_logs")
        .select("*, creative_export_history(status)")
        .eq("user_id", user.id)
        .eq("level", "error")
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (logs && logs.length > 0) {
        setExportLogs(logs);
        const lastLog = logs[0];
        // Check if we already alerted in this session for the newest error
        const storageKey = `alerted_export_error_${lastLog.id}`;
        if (!sessionStorage.getItem(storageKey)) {
          toast.error("Falha em Job Agendado", {
            description: `${lastLog.message}. Clique para ver detalhes.`,
            action: { label: "Ver", onClick: () => setShowExportHistory(true) },
            duration: 8000
          });
          sessionStorage.setItem(storageKey, "true");
        }
      }
    };
    loadData();
  }, [user]);

  useEffect(() => {
    setCursorStack([]);
    setCurrentPage(1);
    loadHistory(null);
  }, [user, active, filter, searchQuery, sortOrder]);


  // Realtime with reconnect handling. Channel rebuilt on user change; status reflected in UI.
  const prevStatusRef = useRef<Record<string, string>>({});

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
        }, (payload) => {
          // Notification check
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const newItem = payload.new as any;
            const oldStatus = prevStatusRef.current[newItem.id];
            if (oldStatus && oldStatus !== newItem.status) {
              const statusMap: Record<string, string> = {
                queued: "em fila",
                processing: "processando",
                completed: "concluído",
                failed: "falhou",
                error: "erro",
                cancelled: "cancelado"
              };
              
              const toolTitle = TOOLS.find(t => t.key === newItem.tool)?.title || newItem.tool;
              toast.info(`Status atualizado: ${statusMap[newItem.status] || newItem.status}`, {
                description: `${toolTitle}: ${newItem.prompt?.slice(0, 40) || "Sem descrição"}...`,
                duration: 4000
              });

              // Send email notification for important status changes
              if (["failed", "error", "cancelled", "completed"].includes(newItem.status)) {
                authedFetch("creative-status-email", {
                  asset_id: newItem.id,
                  status: newItem.status,
                  user_id: user.id,
                  tool: toolTitle
                }).catch(console.error);
              }

              // Audit logging for real-time transitions
              console.log(`[Audit] Mudança de status detectada: Asset ${newItem.id}, De ${oldStatus} para ${newItem.status}, User ${user.id}, Time: ${new Date().toISOString()}`);
            }

            prevStatusRef.current[newItem.id] = newItem.status;
          }

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

  async function rerun(asset: any, isBatch = false) {
    const cfg = RERUN_MAP[asset.tool];
    if (!cfg) { 
      if (!isBatch) toast.error("Reexecução indisponível para esta ferramenta."); 
      return; 
    }
    const idemKey = `rerun:${asset.id}`;
    if (!isBatch) setRerunning(asset.id);
    try {
      const r = await authedFetch(cfg.fn, cfg.build(asset), idemKey);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { 
        if (!isBatch) handleFnError(d); 
        return false; 
      }
      if (d?.replayed) {
        if (!isBatch) toast.success("Reexecução idempotente (sem débito duplo)");
        console.log(`[Audit] Retry idempotente detectado: Asset ${asset.id}, Tool ${asset.tool}, User ${user?.id}`);
      } else {
        if (!isBatch) toast.success("Reexecutado com sucesso");
        console.log(`[Audit] Reprocessamento iniciado: Asset ${asset.id}, Tool ${asset.tool}, User ${user?.id}, Time: ${new Date().toISOString()}`);
      }
      return true;
    } catch (e: any) {
      if (!isBatch) toast.error(e?.message ?? "Falha ao reexecutar");
      return false;
    } finally {
      if (!isBatch) {
        setRerunning(null);
        refetch();
        const top = cursorStack.length === 0 ? null : cursorStack[cursorStack.length - 1];
        loadHistory(top);
        setSelected(null);
      }
    }
  }

  async function cancelExecution(assetId: string) {
    try {
      const { error } = await supabase
        .from("creative_assets")
        .update({ 
          status: "failed", 
          error_message: "Cancelado pelo usuário",
          metadata: { cancelled_at: new Date().toISOString() } 
        })
        .eq("id", assetId);
      
      if (error) throw error;
      toast.success("Execução cancelada");
      loadHistory(cursorStack.length === 0 ? null : cursorStack[cursorStack.length - 1]);
    } catch (e: any) {
      toast.error("Falha ao cancelar: " + e.message);
    }
  }

  async function batchRetryFailed() {
    const failed = history.filter(h => h.status === "failed" || h.status === "error");
    if (!failed.length) return;
    setIsBatchRetrying(true);
    let success = 0;
    
    // Log audit trail start
    console.log(`[Audit] Batch Retry iniciado por ${user?.id} as ${new Date().toISOString()}. Itens: ${failed.length}`);

    for (const asset of failed) {
      // Detailed audit before each item processing
      console.log(`[Audit] Reprocessando item (Batch): Asset ${asset.id}, Tool ${asset.tool}, User ${user?.id}, RequestTime: ${new Date().toISOString()}`);
      const ok = await rerun(asset, true);
      if (ok) success++;
    }
    
    setIsBatchRetrying(false);
    toast.success(`${success} itens reprocessados em lote.`);
    refetch();
    loadHistory(cursorStack.length === 0 ? null : cursorStack[cursorStack.length - 1]);
  }

  function exportHistory(format: "csv" | "json") {
    if (!history.length) return;
    const filename = `creative-history-${new Date().toISOString().split("T")[0]}.${format}`;
    let content = "";
    
    // Ensure filters are reflected: already reflected as 'history' state is populated via loadHistory(filter)
    
    if (format === "json") {
      const exportData = history.map(h => {
        const item: any = {};
        if (exportColumns.includes("ID")) item.id = h.id;
        if (exportColumns.includes("Tool")) item.tool = h.tool;
        if (exportColumns.includes("Status")) item.status = h.status;
        if (exportColumns.includes("Prompt")) item.prompt = h.prompt;
        if (exportColumns.includes("Credits")) item.credits_spent = h.credits_spent || 0;
        if (exportColumns.includes("Created At")) item.created_at = h.created_at;
        if (exportColumns.includes("Error Message")) item.error_message = h.error_message;
        return item;
      });
      content = JSON.stringify(exportData, null, 2);
    } else {
      const rows = history.map(h => {
        const row = [];
        if (exportColumns.includes("ID")) row.push(h.id);
        if (exportColumns.includes("Tool")) row.push(h.tool);
        if (exportColumns.includes("Status")) row.push(h.status);
        if (exportColumns.includes("Prompt")) row.push(`"${(h.prompt || "").replace(/"/g, '""')}"`);
        if (exportColumns.includes("Credits")) row.push(h.credits_spent || 0);
        if (exportColumns.includes("Created At")) row.push(h.created_at);
        if (exportColumns.includes("Error Message")) row.push(`"${(h.error_message || "").replace(/"/g, '""')}"`);
        return row.join(",");
      });
      content = [exportColumns.join(","), ...rows].join("\n");
    }

    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Histórico exportado (${exportColumns.length} colunas)`);
    setShowExportOptions(false);
  }
  async function exportAuditTrail(format: "csv" | "json") {
    if (!user) return;
    
    // Only items reprocessed in retry (rerun:...)
    const retryItems = history.filter(h => h.idempotency_key?.startsWith("rerun:"));
    if (!retryItems.length) {
      toast.info("Nenhum item reprocessado encontrado para exportar auditoria.");
      return;
    }

    const filename = `audit-trail-retry-${new Date().toISOString().split("T")[0]}.${format}`;
    let content = "";

    if (format === "json") {
      content = JSON.stringify(retryItems.map(h => ({
        id: h.id,
        tool: h.tool,
        user_id: h.user_id,
        timestamp: h.updated_at || h.created_at,
        idempotency_key: h.idempotency_key,
        status: h.status,
        error: h.error_message
      })), null, 2);
    } else {
      const header = "ID,Tool,UserID,Timestamp,IdempotencyKey,Status,Error";
      const rows = retryItems.map(h => [
        h.id,
        h.tool,
        h.user_id,
        h.updated_at || h.created_at,
        h.idempotency_key,
        h.status,
        `"${(h.error_message || "").replace(/"/g, '""')}"`
      ].join(","));
      content = [header, ...rows].join("\n");
    }

    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Trilha de auditoria (retry) exportada.");
    setShowAuditExportOptions(false);
  }

  async function scheduleAuditExport() {
    if (!user || !auditEmail || !auditTime) return;
    try {
      const { error } = await supabase.from("creative_audit_schedules").upsert({
        user_id: user.id,
        email: auditEmail,
        schedule_time: auditTime,
        export_interval_days: auditInterval,
        date_range_start: auditDateStart || null,
        date_range_end: auditDateEnd || null,
        is_active: true
      });
      if (error) throw error;
      toast.success("Exportação de auditoria agendada com sucesso!");
      setShowAuditSchedule(false);
    } catch (e: any) {
      toast.error("Falha ao agendar: " + e.message);
    }
  }

  async function cancelExport(id: string) {
    const { error } = await supabase.from("creative_export_history").update({ status: "failed", error_message: "Cancelado pelo usuário" }).eq("id", id);
    if (!error) {
      toast.info("Exportação cancelada");
      loadExportHistory();
    }
  }

  async function retryExport(id: string) {
    const { error } = await supabase.from("creative_export_history").update({ status: "queued", error_message: null }).eq("id", id);
    if (!error) {
      toast.success("Exportação reenfileirada");
      loadExportHistory();
    }
  }

  async function loadExportHistory() {
    if (!user) return;
    const { data } = await supabase.from("creative_export_history").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setExports(data || []);
  }

  // Polling for processing exports
  useEffect(() => {
    if (!user || exports.length === 0) return;
    const hasProcessing = exports.some(e => e.status === "processing" || e.status === "queued");
    if (!hasProcessing) return;

    const interval = setInterval(loadExportHistory, 3000);
    return () => clearInterval(interval);
  }, [user, exports]);


  async function savePreset() {
    if (!user || !newPresetName.trim()) return;
    try {
      const filters = { filter, searchQuery, sortOrder };
      const { data, error } = await supabase.from("creative_filter_presets").insert({
        user_id: user.id,
        name: newPresetName,
        filters
      }).select().single();
      
      if (error) throw error;
      setPresets([data, ...presets]);
      setNewPresetName("");
      setShowPresetDialog(false);
      toast.success(`Preset "${newPresetName}" salvo!`);
    } catch (e: any) {
      toast.error("Erro ao salvar preset: " + e.message);
    }
  }

  function applyPreset(p: any) {
    const f = p.filters;
    setFilter(f.filter || "all");
    setSearchQuery(f.searchQuery || "");
    setSortOrder(f.sortOrder || "desc");
    toast.success(`Preset "${p.name}" aplicado`);
  }

  async function deletePreset(id: string) {
    const { error } = await supabase.from("creative_filter_presets").delete().eq("id", id);
    if (!error) {
      setPresets(presets.filter(p => p.id !== id));
      toast.info("Preset removido");
    }
  }

  async function exportAuditTrailLegacy(format: "csv" | "json") {
    if (!user) return;
    const { data, error } = await supabase

      .from("creative_assets")
      .select("*")
      .eq("user_id", user.id)
      .like("idempotency_key", "rerun:%");

    if (error || !data || data.length === 0) {
      toast.error("Nenhuma trilha de auditoria para reprocessamentos encontrada.");
      return;
    }

    const filename = `creative-audit-trail-${new Date().toISOString().split("T")[0]}.${format}`;
    let content = "";

    const auditData = data.map(h => ({
      id: h.id,
      user_id: h.user_id,
      tool: h.tool,
      timestamp: h.created_at,
      updated_at: h.updated_at,
      idempotency_key: h.idempotency_key,
      status: h.status,
      credits_spent: h.credits_spent,
      event: "Batch/Single Retry Reprocess"
    }));

    if (format === "json") {
      content = JSON.stringify(auditData, null, 2);
    } else {
      const headers = ["ID", "User ID", "Tool", "Timestamp", "Updated At", "Idempotency Key", "Status", "Credits", "Event"];
      const rows = auditData.map(a => [
        a.id, a.user_id, a.tool, a.timestamp, a.updated_at, a.idempotency_key, a.status, a.credits_spent, a.event
      ].join(","));
      content = [headers.join(","), ...rows].join("\n");
    }

    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Trilha de auditoria exportada (${auditData.length} itens)`);
    setShowAuditExportOptions(false);
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
              filter={filter}
              setFilter={setFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              onPick={(k: ToolKey) => { setActive(k); navigate(`/creative/${k}`); }}
              onOpen={(a: any) => setSelected(a)}
              onRerun={rerun}
              onCancel={cancelExecution}
              onBatchRetry={batchRetryFailed}
              isBatchRetrying={isBatchRetrying}
              rerunningId={rerunning}
              pageIndex={cursorStack.length}
              pageSize={PAGE_SIZE}
              totalCount={totalCount}
              hasNext={!!nextCursor}
              hasPrev={cursorStack.length > 0}
              realtimeStatus={realtimeStatus}
              globalCooldown={globalCooldown}
              onNext={() => {
                if (!nextCursor) return;
                setCursorStack((s) => [...s, nextCursor]);
                setCurrentPage((p) => p + 1);
                loadHistory(nextCursor);
              }}
              onPrev={() => {
                setCursorStack((s) => {
                  const next = s.slice(0, -1);
                  setCurrentPage((p) => Math.max(1, p - 1));
                  loadHistory(next[next.length - 1] ?? null);
                  return next;
                });
              }}
              onExport={exportHistory}
              exportColumns={exportColumns}
              setExportColumns={setExportColumns}
              showExportOptions={showExportOptions}
              setShowExportOptions={setShowExportOptions}
              onAuditExport={exportAuditTrail}
              showAuditExportOptions={showAuditExportOptions}
              setShowAuditExportOptions={setShowAuditExportOptions}
              showAuditSchedule={showAuditSchedule}
              setShowAuditSchedule={setShowAuditSchedule}
              auditEmail={auditEmail}
              setAuditEmail={setAuditEmail}
              auditTime={auditTime}
              setAuditTime={setAuditTime}
              scheduleAuditExport={scheduleAuditExport}
              auditInterval={auditInterval}
              setAuditInterval={setAuditInterval}
              presets={presets}
              onApplyPreset={applyPreset}
              onDeletePreset={deletePreset}
              showPresetDialog={showPresetDialog}
              setShowPresetDialog={setShowPresetDialog}
              newPresetName={newPresetName}
              setNewPresetName={setNewPresetName}
              onSavePreset={savePreset}
              exports={exports}
              exportLogs={exportLogs}
              showExportHistory={showExportHistory}
              setShowExportHistory={setShowExportHistory}
              currentPage={currentPage}
              renamePreset={renamePreset}
              auditDateStart={auditDateStart}
              setAuditDateStart={setAuditDateStart}
              auditDateEnd={auditDateEnd}
              setAuditDateEnd={setAuditDateEnd}
              cancelExport={cancelExport}
              retryExport={retryExport}
              selectedExport={selectedExport}
              setSelectedExport={setSelectedExport}

              onReset={() => {
                setFilter("all");
                setSearchQuery("");
                setSortOrder("desc");
                setCurrentPage(1);
                setCursorStack([]);
                loadHistory(null);
                toast.info("Filtros redefinidos");
              }}
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
          <TabsContent value="emo"><EmoTool onDone={() => { refetch(); loadHistory(); }} /></TabsContent>
        </Tabs>
      </main>

      <AssetDetailDialog asset={selected} onClose={() => setSelected(null)} onRerun={rerun} onCancel={cancelExecution} rerunning={!!rerunning && rerunning === selected?.id} />
      <OrgBrandingDialog />
    </div>
  );
}

function OrgBrandingDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [branding, setBranding] = useState({ org_name: "", logo_url: "", primary_color: "#6366f1" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    const load = async () => {
      const { data } = await supabase.from("creative_org_branding").select("*").eq("user_id", user.id).single();
      if (data) setBranding({ org_name: data.org_name || "", logo_url: data.logo_url || "", primary_color: data.primary_color || "#6366f1" });
    };
    load();
  }, [user, open]);

  const save = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("creative_org_branding").upsert({ user_id: user.id, ...branding });
    setLoading(false);
    if (error) toast.error("Falha ao salvar branding: " + error.message);
    else { toast.success("Layout de e-mail atualizado!"); setOpen(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button 
        variant="ghost" 
        size="icon" 
        className="fixed bottom-4 right-4 h-10 w-10 rounded-full shadow-lg bg-card border border-border/40"
        onClick={() => setOpen(true)}
        title="Personalizar Layout de E-mail"
      >
        <Sparkles className="h-5 w-5 text-primary" />
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizar Layout de E-mail</DialogTitle>
          <DialogDescription>Personalize como as notificações de status aparecem para sua organização.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Nome da Organização</label>
            <Input value={branding.org_name} onChange={(e) => setBranding({ ...branding, org_name: e.target.value })} placeholder="Minha Org" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">URL do Logo</label>
            <Input value={branding.logo_url} onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Cor Principal</label>
            <div className="flex gap-2">
              <Input type="color" value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} className="w-12 h-10 p-1" />
              <Input value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} className="flex-1" />
            </div>
          </div>
          <Button onClick={save} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssetDetailDialog({ asset, onClose, onRerun, onCancel, rerunning }: { asset: any; onClose: () => void; onRerun: (a: any) => void; onCancel: (id: string) => void; rerunning: boolean }) {
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
          <DialogDescription className="flex items-center justify-between">
            <div>Status: <span className="font-mono">{asset.status}</span> · Créditos: <span className="font-mono">{asset.credits_spent ?? 0}</span></div>
            {asset.idempotency_key && <Badge variant="secondary" className="text-[9px] font-mono opacity-50">IDEM: {asset.idempotency_key.slice(0, 8)}</Badge>}
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
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Erro Detalhado</div>
              <Card className="p-3 border-destructive/40 bg-destructive/10 text-destructive text-xs font-mono whitespace-pre-wrap">
                {asset.error_message}
              </Card>
              <div className="text-[10px] text-muted-foreground italic">
                Ações sugeridas: verifique sua conexão, saldo de créditos ou tente reexecutar se for um erro temporário.
              </div>
            </div>
          )}
          {asset.metadata && Object.keys(asset.metadata).length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Metadata</div>
              <Card className="p-3"><pre className="text-xs whitespace-pre-wrap font-mono">{JSON.stringify(asset.metadata, null, 2)}</pre></Card>
            </div>
          )}

          <div className="pt-4 border-t border-border/40">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-2">
              <History className="h-3 w-3" /> Trilha de Auditoria
            </div>
            <div className="space-y-2 text-[11px] font-mono text-muted-foreground bg-muted/20 p-2 rounded">
              <div className="flex justify-between">
                <span>Evento: Criação</span>
                <span>{new Date(asset.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Ferramenta: {asset.tool}</span>
                <span>User ID: {asset.user_id?.slice(0, 8)}...</span>
              </div>
              {asset.idempotency_key && (
                <div className="flex flex-col gap-1 border-t border-border/20 pt-1 mt-1">
                  <div className="flex justify-between text-primary/80">
                    <span>Chave de Idempotência:</span>
                    <span>{asset.idempotency_key}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 bg-primary/5 rounded border border-primary/20 text-[10px] text-primary">
                    <RotateCw className="h-3 w-3" />
                    <span>Esta chave garante que tentativas duplicadas não cobrem créditos extras.</span>
                  </div>
                </div>
              )}
              {asset.status === "completed" && (
                <div className="flex justify-between text-green-500/80">
                  <span>Resultado: Sucesso (IDEM verificado)</span>
                  <span>{asset.updated_at ? new Date(asset.updated_at).toLocaleString() : "—"}</span>
                </div>
              )}
              {(asset.status === "failed" || asset.status === "error") && (
                <div className="flex justify-between text-destructive/80">
                  <span>Resultado: Falhou (Rastreável)</span>
                  <span>{asset.updated_at ? new Date(asset.updated_at).toLocaleString() : "—"}</span>
                </div>
              )}
            </div>
          </div>


          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            {(asset.status === "queued" || asset.status === "processing") && (
              <Button variant="destructive" onClick={() => { onCancel(asset.id); onClose(); }}>
                Cancelar
              </Button>
            )}
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


function Dashboard({ editsRemaining, subscription, history, filter, setFilter, searchQuery, setSearchQuery, sortOrder, setSortOrder, onPick, onOpen, onRerun, onCancel, onBatchRetry, isBatchRetrying, rerunningId, pageIndex, pageSize, totalCount, hasNext, hasPrev, realtimeStatus, globalCooldown, onNext, onPrev, onExport, exportColumns, setExportColumns, showExportOptions, setShowExportOptions, onAuditExport, showAuditExportOptions, setShowAuditExportOptions, showAuditSchedule, setShowAuditSchedule, auditEmail, setAuditEmail, auditTime, setAuditTime, scheduleAuditExport, onReset, currentPage, auditInterval, setAuditInterval, presets, onApplyPreset, onDeletePreset, showPresetDialog, setShowPresetDialog, newPresetName, setNewPresetName, onSavePreset, exports, exportLogs, showExportHistory, setShowExportHistory, renamePreset, auditDateStart, setAuditDateStart, auditDateEnd, setAuditDateEnd, cancelExport, retryExport, selectedExport, setSelectedExport }: any) {
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
          <div className="text-xs text-muted-foreground mt-3">Página {currentPage}</div>
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
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-lg font-bold">Histórico detalhado</h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={onReset}
            >
              <RotateCw className="h-3 w-3 mr-1" />
              Reiniciar
            </Button>
            <Dialog open={showPresetDialog} onOpenChange={setShowPresetDialog}>
              <Button size="sm" variant="ghost" className="h-8 text-[10px]" onClick={() => setShowPresetDialog(true)}>
                <Sparkles className="h-3 w-3 mr-1" />
                Presets
              </Button>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Presets de Filtros</DialogTitle>
                  <DialogDescription>Salve sua busca e ordenação atual para usar depois.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex gap-2">
                    <Input value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} placeholder="Nome do preset..." />
                    <Button onClick={onSavePreset} disabled={!newPresetName.trim()}>Salvar</Button>
                  </div>
                  <div className="space-y-2 border-t pt-4">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Seus Presets</label>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {presets.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhum salvo ainda.</p>}
                      {presets.map((p: any) => (
                        <div key={p.id} className="flex flex-col gap-2 bg-muted/30 p-3 rounded text-sm border border-border/20">
                          <div className="flex items-center justify-between">
                            <input 
                              className="bg-transparent border-none outline-none font-semibold focus:ring-0 p-0 h-auto" 
                              defaultValue={p.name}
                              onBlur={(e) => e.target.value !== p.name && renamePreset(p.id, e.target.value)}
                            />
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => onApplyPreset(p)}>Aplicar</Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onDeletePreset(p.id)}><AlertTriangle className="h-3 w-3" /></Button>
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex gap-2">
                             <span>Filtro: {p.filters?.filter || "all"}</span>
                             {p.filters?.searchQuery && <span>Busca: {p.filters.searchQuery}</span>}
                          </div>
                        </div>
                      ))}

                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <div className="relative flex-1 sm:w-48">
              <Input 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Buscar no histórico..." 
                className="h-8 text-xs pl-8"
              />
              <History className="h-3 w-3 absolute left-2.5 top-2.5 text-muted-foreground" />
            </div>
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-card border border-border/40 rounded px-2 py-1 h-8 text-xs outline-none focus:border-primary/50"
            >
              <option value="all">Todos os Status</option>
              <option value="queued">Em fila</option>
              <option value="processing">Processando</option>
              <option value="completed">Concluído</option>
              <option value="failed">Falhou</option>
            </select>
            <select 
              value={sortOrder} 
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="bg-card border border-border/40 rounded px-2 py-1 h-8 text-xs outline-none focus:border-primary/50"
            >
              <option value="desc">Mais recentes</option>
              <option value="asc">Mais antigos</option>
            </select>
            {globalCooldown > 0 && (
              <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Rate limit: {globalCooldown}s
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                realtimeStatus === "live" ? "bg-green-500 animate-pulse" :
                realtimeStatus === "reconnecting" ? "bg-yellow-500 animate-pulse" :
                realtimeStatus === "offline" ? "bg-destructive" : "bg-muted-foreground"
              }`} />
              {realtimeStatus === "live" ? "tempo real" :
               realtimeStatus === "reconnecting" ? "reconectando…" :
               realtimeStatus === "offline" ? "offline" : "conectando…"}
            </Badge>
            {history.some((h: any) => h.status === "failed" || h.status === "error") && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 text-[10px] gap-1.5 border-destructive/30 hover:bg-destructive/10" 
                onClick={onBatchRetry}
                disabled={isBatchRetrying}
              >
                {isBatchRetrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                Retry falhas
              </Button>
            )}
            <div className="flex items-center gap-1 ml-1 border-l pl-2 border-border/40">
              <Dialog open={showExportOptions} onOpenChange={setShowExportOptions}>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowExportOptions(true)} title="Opções de Exportação">
                  <FileDown className="h-3.5 w-3.5" />
                </Button>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Exportar Histórico</DialogTitle>
                    <DialogDescription>
                      Selecione as colunas e o formato para exportar os dados filtrados.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {["ID", "Tool", "Status", "Prompt", "Credits", "Created At", "Error Message"].map((col) => (
                        <div key={col} className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id={`col-${col}`} 
                            checked={exportColumns.includes(col)}
                            onChange={(e) => {
                              if (e.target.checked) setExportColumns([...exportColumns, col]);
                              else setExportColumns(exportColumns.filter((c: string) => c !== col));
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <label htmlFor={`col-${col}`} className="text-sm cursor-pointer">{col}</label>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1" onClick={() => onExport("csv")}>Exportar CSV</Button>
                      <Button className="flex-1" variant="outline" onClick={() => onExport("json")}>Exportar JSON</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={showAuditExportOptions} onOpenChange={setShowAuditExportOptions}>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={() => setShowAuditExportOptions(true)} title="Exportar Trilha de Auditoria (Reprocessamentos)">
                  <History className="h-3.5 w-3.5" />
                </Button>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Exportar Auditoria de Retry</DialogTitle>
                    <DialogDescription>
                      Exportar apenas itens que foram reprocessados via retry (audit trail).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1" onClick={() => onAuditExport("csv")}>Exportar CSV</Button>
                      <Button className="flex-1" variant="outline" onClick={() => onAuditExport("json")}>Exportar JSON</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={showAuditSchedule} onOpenChange={setShowAuditSchedule}>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500" onClick={() => setShowAuditSchedule(true)} title="Agendar Auditoria">
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Agendar Auditoria Automática</DialogTitle>
                    <DialogDescription>
                      Receba a trilha de auditoria (itens reprocessados) por e-mail periodicamente.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Início do Período</label>
                        <Input type="date" value={auditDateStart} onChange={(e) => setAuditDateStart(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Fim do Período</label>
                        <Input type="date" value={auditDateEnd} onChange={(e) => setAuditDateEnd(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">E-mail para envio</label>
                      <Input value={auditEmail} onChange={(e) => setAuditEmail(e.target.value)} placeholder="seu@email.com" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Horário (UTC)</label>
                      <Input type="time" value={auditTime} onChange={(e) => setAuditTime(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Intervalo (dias)</label>
                      <select 
                        value={auditInterval} 
                        onChange={(e) => setAuditInterval(Number(e.target.value))}
                        className="w-full bg-card border border-border/40 rounded px-3 py-2 text-sm outline-none focus:border-primary/50"
                      >
                        <option value={1}>Diário</option>
                        <option value={7}>Semanal (7 dias)</option>
                        <option value={15}>Quinzenal (15 dias)</option>
                        <option value={30}>Mensal (30 dias)</option>
                      </select>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        O job baixará apenas itens reprocessados (retry) dentro do período selecionado.
                      </p>
                    </div>
                    <Button className="w-full" onClick={scheduleAuditExport}>Agendar Exportação</Button>

                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={showExportHistory} onOpenChange={setShowExportHistory}>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-orange-500" onClick={() => setShowExportHistory(true)} title="Histórico de Downloads">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      Histórico de Exportações Agendadas
                      {exportLogs.length > 0 && <Badge variant="destructive" className="ml-2">{exportLogs.length} Alertas</Badge>}
                    </DialogTitle>
                    <DialogDescription>Acompanhe o status de geração dos seus arquivos de auditoria.</DialogDescription>
                  </DialogHeader>
                  
                  {exportLogs.length > 0 && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg space-y-2">
                      <h4 className="text-xs font-bold text-destructive uppercase flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3" /> Alertas de Falha Recentes
                      </h4>
                      {exportLogs.map((log: any) => (
                        <div key={log.id} className="text-[11px] text-destructive-foreground border-b border-destructive/20 pb-1 last:border-0">
                          <span className="font-semibold">{new Date(log.created_at).toLocaleDateString()}:</span> {log.message}
                          {log.details?.reason && <span className="block italic mt-0.5">Motivo: {log.details.reason}</span>}
                          {log.details?.export_id && (
                            <Button variant="link" className="p-0 h-auto text-[10px] text-destructive underline" onClick={() => setSelectedExport(exports.find(e => e.id === log.details.export_id))}>
                              Ver Exportação
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="py-4 space-y-3">
                    {exports.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum download gerado ainda.</p>}
                    {exports.map((ex: any) => (
                      <Card key={ex.id} className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors border-border/40 cursor-pointer" onClick={() => setSelectedExport(ex)}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={ex.status === "completed" ? "default" : ex.status === "failed" ? "destructive" : "secondary"} className="text-[9px]">
                              {ex.status === "processing" ? "gerando..." : ex.status}
                            </Badge>
                            <span className="text-xs font-semibold">{ex.format.toUpperCase()} · {ex.item_count || ex.included_count || 0} itens</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">
                            Período: {ex.period_start || ex.date_range_start ? new Date(ex.period_start || ex.date_range_start).toLocaleDateString() : "—"} até {ex.period_end || ex.date_range_end ? new Date(ex.period_end || ex.date_range_end).toLocaleDateString() : "—"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {ex.status === "failed" && (
                             <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); retryExport(ex.id); }} title="Reenfileirar">
                               <RotateCw className="h-3 w-3" />
                             </Button>
                          )}
                          {(ex.status === "processing" || ex.status === "queued") && (
                             <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); cancelExport(ex.id); }} title="Cancelar">
                               <AlertTriangle className="h-3 w-3" />
                             </Button>
                          )}
                          {ex.file_url && (
                            <Button size="sm" variant="outline" className="h-8 gap-1.5" asChild onClick={(e) => e.stopPropagation()}>
                              <a href={ex.file_url} download>
                                <Download className="h-3 w-3" /> Baixar
                              </a>
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Detalhes da Exportação */}
                  <Dialog open={!!selectedExport} onOpenChange={(o) => !o && setSelectedExport(null)}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Detalhes da Exportação</DialogTitle>
                        <DialogDescription>Informações detalhadas sobre o job de auditoria.</DialogDescription>
                      </DialogHeader>
                      {selectedExport && (
                        <div className="space-y-4 py-4 text-sm">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-[10px] uppercase text-muted-foreground">Status</div>
                              <Badge className="mt-1">{selectedExport.status}</Badge>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase text-muted-foreground">Formato</div>
                              <div className="font-mono mt-1">{selectedExport.format.toUpperCase()}</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase text-muted-foreground">Contagem de Itens</div>
                              <div className="font-mono mt-1">{selectedExport.included_count || selectedExport.item_count || 0}</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase text-muted-foreground">Tempo de Geração</div>
                              <div className="font-mono mt-1">
                                {selectedExport.generation_time_ms ? `${(selectedExport.generation_time_ms / 1000).toFixed(2)}s` : "—"}
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-muted-foreground mb-1">Execuções Incluídas</div>
                            <Card className="p-2 max-h-32 overflow-y-auto bg-muted/20">
                              {selectedExport.item_ids?.length > 0 ? (
                                <div className="space-y-1">
                                  {selectedExport.item_ids.map((id: string) => (
                                    <div key={id} className="text-[10px] font-mono border-b border-border/20 last:border-0 pb-1">{id}</div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs italic text-muted-foreground">Nenhuma execução listada.</span>
                              )}
                            </Card>
                          </div>
                          {selectedExport.error_message && (
                            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-xs font-mono">
                              {selectedExport.error_message}
                            </div>
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>

                </DialogContent>
              </Dialog>
            </div>
          </div>
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
                  {h.idempotency_key && h.status === "completed" && (
                    <div className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 animate-in fade-in zoom-in duration-300" title="Idempotência ativa: Créditos preservados">
                      <RotateCw className="h-2.5 w-2.5" />
                      <span className="hidden md:inline">IDEM</span>
                    </div>
                  )}
                  <Badge 
                    variant={h.status === "completed" ? "default" : h.status === "failed" || h.status === "error" ? "destructive" : "secondary"} 
                    className={`text-[10px] shrink-0 ${h.status === "processing" ? "animate-pulse" : ""}`}
                  >
                    {h.status === "processing" ? "processando" : 
                     h.status === "queued" ? "em fila" :
                     h.status === "completed" ? "concluído" : 
                     h.status === "failed" || h.status === "error" ? "falhou" : h.status}
                  </Badge>
                </button>
                <div className="flex gap-1 shrink-0">
                  {(h.status === "queued" || h.status === "processing") && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); onCancel(h.id); }}
                      aria-label="Cancelar"
                      title="Cancelar execução"
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={!RERUN_MAP[h.tool] || !!rerunningId}
                    onClick={(e) => { e.stopPropagation(); onRerun(h); }}
                    aria-label="Reexecutar"
                    title="Reexecutar (idempotente)"
                  >
                    {isRerunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>

        {(hasNext || hasPrev) && (
          <div className="flex items-center justify-between mt-3 text-sm">
            <div className="text-xs text-muted-foreground">
              Página {(pageIndex ?? 0) + 1} · {history.length} itens · {totalCount} no total
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!hasPrev} onClick={onPrev}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={!hasNext} onClick={onNext}>Próxima</Button>
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

function EmoTool({ onDone }: { onDone: () => void }) {
  const [sourceImage, setSourceImage] = useState("");
  const [drivingVideo, setDrivingVideo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileImgRef = useRef<HTMLInputElement>(null);
  const fileVidRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File, type: "image" | "video") => {
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || (type === "image" ? "jpg" : "mp4");
      const path = `uploads/emo/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("uploads").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("uploads").getPublicUrl(path);
      if (type === "image") setSourceImage(data.publicUrl);
      else setDrivingVideo(data.publicUrl);
      toast.success(`${type === "image" ? "Foto" : "Vídeo"} enviado com sucesso!`);
    } catch (e: any) {
      toast.error(`Falha no upload: ${e.message}`);
    }
  };

  async function run() {
    if (!sourceImage || !drivingVideo) {
      toast.error("Selecione uma foto e um vídeo de referência.");
      return;
    }
    setLoading(true); setResult(null);
    try {
      const r = await authedFetch("emo-animate", { source_image: sourceImage, driving_video: drivingVideo });
      const d = await r.json();
      if (!r.ok) handleFnError(d);
      else {
        setResult(d.video.startsWith("http") ? d.video : d.video); // The function should return a public URL
        onDone();
        toast.success("Animação concluída!");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Kubo EMO AI — Emotive Portrait Alive
        </h3>
        <Badge variant="secondary">5 créditos</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Gera animações extremamente realistas a partir de uma foto de rosto e um vídeo de referência.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Foto do Rosto (Source)</label>
          <div className="flex gap-2">
            <Input value={sourceImage} onChange={(e) => setSourceImage(e.target.value)} placeholder="URL da foto..." />
            <Button variant="outline" size="icon" onClick={() => fileImgRef.current?.click()}>
              <Upload className="h-4 w-4" />
            </Button>
            <input type="file" ref={fileImgRef} hidden accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "image")} />
          </div>
          {sourceImage && <img src={sourceImage} className="w-full h-32 object-cover rounded-lg border border-border" alt="Source" />}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vídeo de Referência (Driving)</label>
          <div className="flex gap-2">
            <Input value={drivingVideo} onChange={(e) => setDrivingVideo(e.target.value)} placeholder="URL do vídeo..." />
            <Button variant="outline" size="icon" onClick={() => fileVidRef.current?.click()}>
              <Upload className="h-4 w-4" />
            </Button>
            <input type="file" ref={fileVidRef} hidden accept="video/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "video")} />
          </div>
          {drivingVideo && <video src={drivingVideo} className="w-full h-32 object-cover rounded-lg border border-border" controls />}
        </div>
      </div>

      <Button onClick={run} disabled={loading || !sourceImage || !drivingVideo} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Video className="h-4 w-4 mr-2" />}
        Gerar Animação Realista
      </Button>

      {result && (
        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-primary">Resultado Final</label>
          <video src={result} controls className="w-full rounded-lg border-2 border-primary/20 shadow-lg shadow-primary/5" />
          <Button variant="outline" className="w-full" onClick={() => window.open(result, "_blank")}>
            <Download className="h-4 w-4 mr-2" />
            Baixar Vídeo
          </Button>
        </div>
      )}
    </Card>
  );
}
