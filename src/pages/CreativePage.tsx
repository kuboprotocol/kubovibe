import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  MessageSquare, Image as ImageIcon, Download, Scissors, User2,
  Video, Music, BookOpen, Sparkles, Loader2, Coins, ArrowLeft, RotateCw, AlertTriangle, Upload,
  FileDown, History, Check, Search, ArrowRight, Settings2, X, AlertCircle
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { ManusLauncher } from "@/components/creative/ManusLauncher";
import { CreativeToolInterface } from "@/components/creative/CreativeToolInterface";

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

const cooldowns = new Map<string, number>(); 
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
  const debouncedSearch = useDebounce(searchQuery, 600);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "reconnecting" | "offline">("connecting");
  const [selected, setSelected] = useState<any | null>(null);
  const [rerunningId, setRerunningId] = useState<string | null>(null);
  const [isBatchRetrying, setIsBatchRetrying] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showAuditExportOptions, setShowAuditExportOptions] = useState(false);
  const [exportColumns, setExportColumns] = useState<string[]>(["ID", "Tool", "Status", "Prompt", "Credits", "Created At", "Error Message", "Config"]);
  const alertedRef = useRef<{ low?: boolean; empty?: boolean }>({});
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{ 
    step: string; 
    message: string; 
    correlationId?: string; 
    traceId?: string; 
    stack?: string;
    originalAction?: () => void 
  } | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [simulationMode, setSimulationMode] = useState<"none" | "selection" | "config" | "execution">("none");
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

  const logAuditAction = useCallback(async (step: string, action: string, params: any = {}, correlationId?: string, traceId?: string) => {
    if (!user) return;
    try {
      await supabase.from("creative_audit_trail").insert({
        user_id: user.id,
        step,
        action,
        params,
        correlation_id: correlationId,
        trace_id: traceId
      });
    } catch (e) {
      console.error("Failed to log audit trail:", e);
    }
  }, [user]);
  const [selectedAssetForInvestigation, setSelectedAssetForInvestigation] = useState<any | null>(null);
  const [investigationSearch, setInvestigationSearch] = useState("");
  const [investigationDateStart, setInvestigationDateStart] = useState("");
  const [investigationDateEnd, setInvestigationDateEnd] = useState("");
  const [exportAuditLogs, setExportAuditLogs] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditSortOrder, setAuditSortOrder] = useState<"desc" | "asc">("desc");
  const [notificationPrefs, setNotificationPrefs] = useState({
    notify_cancel: true,
    notify_retry: true,
    include_investigation_link: true
  });
  const [selectedTimezone, setSelectedTimezone] = useState("UTC");



  useEffect(() => {
    if (tool) setActive(tool as ToolKey);
  }, [tool]);

  async function loadHistory(before: string | null = null) {
    if (!user) return;
    if (simulationMode === "selection") {
      setIsLoadingHistory(true);
      setTimeout(() => {
        setIsLoadingHistory(false);
        const cId = crypto.randomUUID().slice(0, 8);
        logAuditAction("Selection", "load_history_failed_simulated", { before }, cId);
        setErrorState({
          step: "Seleção (Simulado)",
          message: "Simulação de falha no carregamento do histórico.",
          correlationId: cId,
          originalAction: () => loadHistory(before)
        });
      }, 1000);
      return;
    }
    setIsLoadingHistory(true);
    await logAuditAction("Selection", "load_history_start", { before });
    try {
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

      if (debouncedSearch) {
        q = q.or(`prompt.ilike.%${debouncedSearch}%,tool.ilike.%${debouncedSearch}%,error_message.ilike.%${debouncedSearch}%`);
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
    } catch (e: any) {
      console.error("[CreativePanel:Selection] history_load_failed", { error: e.message, userId: user.id });
      setErrorState({
        step: "Seleção (Histórico)",
        message: "Não foi possível carregar seu histórico de criações.",
        originalAction: () => loadHistory(before)
      });
    } finally {
      setIsLoadingHistory(false);
    }
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

  useEffect(() => {
    if (!user) return;
    const savePrefs = async () => {
      await supabase.from("creative_user_settings").upsert({
        user_id: user.id,
        filter,
        search_query: debouncedSearch,
        sort_order: sortOrder,
        timezone: selectedTimezone
      });
    };
    const t = setTimeout(savePrefs, 2000);
    return () => clearTimeout(t);
  }, [user, filter, debouncedSearch, sortOrder, selectedTimezone]);



  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      const { data: prefs } = await supabase.from("creative_user_settings").select("*").eq("user_id", user.id).single();
      if (prefs) {
        setFilter(prefs.filter as any);
        setSearchQuery(prefs.search_query);
        setSortOrder(prefs.sort_order as any);
        if (prefs.timezone) setSelectedTimezone(prefs.timezone);
      }

      
      const { data: p } = await supabase.from("creative_filter_presets").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setPresets(p || []);

      const { data: sch } = await supabase.from("creative_audit_schedules").select("*").eq("user_id", user.id).single();
      if (sch) {
        setAuditEmail(sch.email);
        setAuditTime(sch.schedule_time);
        setAuditInterval(sch.export_interval_days || 7);
      }

      const { data: nPrefs } = await supabase.from("creative_notification_preferences").select("*").eq("user_id", user.id).single();
      if (nPrefs) {
        setNotificationPrefs({
          notify_cancel: nPrefs.notify_cancel,
          notify_retry: nPrefs.notify_retry,
          include_investigation_link: nPrefs.include_investigation_link
        });
      }
      loadExportHistory();
      
      const { data: logs } = await supabase.from("creative_export_logs")
        .select("*, creative_export_history(status)")
        .eq("user_id", user.id)
        .eq("level", "error")
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (logs && logs.length > 0) {
        setExportLogs(logs);
      }
    };
    loadData();
  }, [user]);

  useEffect(() => {
    setCursorStack([]);
    setCurrentPage(1);
    loadHistory(null);
  }, [user, active, filter, debouncedSearch, sortOrder]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const investigateId = params.get("investigate");
    if (investigateId && history.length > 0) {
      const asset = history.find(h => h.id === investigateId);
      if (asset) setSelectedAssetForInvestigation(asset);
    }
  }, [history]);

  async function rerun(asset: any, isBatch = false) {
    const cfg = RERUN_MAP[asset.tool];
    if (!cfg) { 
      if (!isBatch) toast.error("Reexecução indisponível para esta ferramenta."); 
      return; 
    }
    const attempt = (asset.retry_count || 0) + 1;
    const idemKey = `rerun:${asset.id}:${attempt}`;
    if (!isBatch) setRerunningId(asset.id);
    try {
      if (simulationMode === "execution") {
        const cId = crypto.randomUUID().slice(0, 8);
        await logAuditAction("Execution", "rerun_failed_simulated", { assetId: asset.id }, cId);
        throw new Error("Falha simulada na execução");
      }
      const r = await authedFetch(cfg.fn, cfg.build(asset), idemKey);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { 
        const cId = r.headers.get("x-correlation-id") || undefined;
        const tId = r.headers.get("x-trace-id") || undefined;
        console.error("[CreativePanel:Execution] tool_retry_failed", { 
          assetId: asset.id, 
          error: d.error, 
          correlationId: cId,
          traceId: tId 
        });
        if (!isBatch) {
          setErrorState({
            step: "Execução (Retry)",
            message: d.error || "Erro ao tentar reexecutar a ferramenta.",
            correlationId: cId,
            traceId: tId,
            stack: d.stack || "Nenhum stack trace disponível",
            originalAction: () => rerun(asset, isBatch)
          });
          handleFnError(d); 
        }
        return false; 
      }
      
      if (!isBatch && user) {
        await supabase.from("creative_audit_logs").insert({
          user_id: user.id,
          asset_id: asset.id,
          event_type: 'retry',
          tool: asset.tool,
          metadata: { attempt }
        });
        
        // Notify via email for retry
        await authedFetch("creative-status-email", {
          asset_id: asset.id,
          status: "retrying",
          user_id: user.id,
          tool: asset.tool,
          reason: "Reiniciado manualmente"
        });
      }
      
      return true;
    } catch (e: any) {
      console.error("[CreativePanel:Execution] tool_retry_exception", { assetId: asset.id, error: e.message, stack: e.stack });
      if (!isBatch) toast.error(e?.message ?? "Falha ao reexecutar");
      return false;
    } finally {
      if (!isBatch) {
        setRerunningId(null);
        refetch();
        loadHistory(cursorStack.length === 0 ? null : cursorStack[cursorStack.length - 1]);
        setSelected(null);
      }
    }
  }

  async function cancelExecution(assetId: string) {
    if (!user || isCancelling) return;
    setIsCancelling(assetId);
    try {
      const asset = history.find(h => h.id === assetId);
      const { error } = await supabase
        .from("creative_assets")
        .update({ 
          status: "failed", 
          error_message: "Cancelado pelo usuário", 
          cancelled_by: user.id,
          metadata: { ...asset?.metadata, cancelled_at: new Date().toISOString() } 
        })
        .eq("id", assetId);
      
      if (error) throw error;
      
      await supabase.from("creative_audit_logs").insert({
        user_id: user.id,
        asset_id: assetId,
        event_type: 'cancel',
        tool: asset?.tool,
        metadata: { reason: "Cancelado via UI" }
      });

      // Notify via email for cancellation
      await authedFetch("creative-status-email", {
        asset_id: assetId,
        status: "cancelled",
        user_id: user.id,
        tool: asset?.tool,
        reason: "Cancelado manualmente"
      });

      toast.success("Execução cancelada");
      loadHistory(cursorStack.length === 0 ? null : cursorStack[cursorStack.length - 1]);
    } catch (e: any) {
      console.error("[CreativePanel:Execution] cancel_failed", { assetId, error: e.message, userId: user.id });
      toast.error("Falha ao cancelar: " + e.message);
    } finally {
      setIsCancelling(null);
    }
  }

  async function batchRetryFailed() {
    const failed = history.filter(h => h.status === "failed" || h.status === "error");
    if (!failed.length || !user) return;
    setIsBatchRetrying(true);
    let success = 0;
    for (const asset of failed) {
      const ok = await rerun(asset, true);
      if (ok) {
        success++;
        await supabase.from("creative_audit_logs").insert({
          user_id: user.id,
          asset_id: asset.id,
          event_type: 'retry',
          tool: asset.tool,
          metadata: { batch: true, attempt: (asset.retry_count || 0) + 1 }
        });
      }
    }
    setIsBatchRetrying(false);
    toast.success(`${success} itens reprocessados em lote.`);
    refetch();
    loadHistory(cursorStack.length === 0 ? null : cursorStack[cursorStack.length - 1]);
  }

  async function exportStepReport(step: "Selection" | "Configuration" | "Execution") {
    if (!history.length || !user) return;
    setIsExporting(true);
    try {
      const timestamp = new Date().toLocaleString('sv-SE', { timeZone: selectedTimezone }).replace(/[: ]/g, '-');
      const correlationId = crypto.randomUUID().slice(0, 8);
      const filename = `creative-${step.toLowerCase()}-report-${correlationId}-${timestamp}.json`;
      
      let filteredHistory = [...history];
      if (step === "Execution") {
        filteredHistory = history.filter(h => h.status === "processing" || h.status === "completed" || h.status === "failed");
      }

      const report = {
        meta: {
          step,
          generated_at: new Date().toISOString(),
          user_id: user.id,
          correlation_id: correlationId
        },
        logs: filteredHistory.map(h => ({
          asset_id: h.id,
          tool: h.tool,
          status: h.status,
          error: h.error_message,
          config: h.metadata,
          correlation_id: h.metadata?.correlation_id || correlationId,
          timestamp: h.created_at
        }))
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Relatório de ${step} exportado`);
    } catch (e) {
      toast.error("Erro na exportação");
    } finally {
      setIsExporting(false);
    }
  }

  async function exportFullPanelReport(format: "json" | "csv" = "json") {
    if (!history.length || !user) return;
    setIsExporting(true);
    try {
      const timestamp = new Date().toLocaleString('sv-SE', { timeZone: selectedTimezone }).replace(/[: ]/g, '-');
      const correlationId = crypto.randomUUID().slice(0, 8);
      const filename = `creative-panel-full-report-${correlationId}-${timestamp}.${format}`;
      
      const reportData = history.map(h => ({
        id: h.id,
        tool: h.tool,
        status: h.status,
        prompt: h.prompt,
        error: h.error_message,
        created_at: h.created_at,
        metadata: h.metadata,
        retry_count: h.retry_count,
        correlation_id: h.metadata?.correlation_id,
        trace_id: h.metadata?.trace_id
      }));

      if (format === "json") {
        const report = {
          meta: {
            generated_at: new Date().toISOString(),
            timezone: selectedTimezone,
            user_id: user.id,
            total_items: totalCount,
            correlation_id: correlationId
          },
          steps: {
            selection: { status: "active", items_count: history.length },
            configuration: { status: active === "dashboard" ? "pending" : "active", current_tool: active },
            execution: { 
              status: history.some(h => h.status === "processing") ? "active" : "idle",
              processing_count: history.filter(h => h.status === "processing").length
            }
          },
          history: reportData
        };
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      } else {
        const headers = ["ID", "Tool", "Status", "Prompt", "Error", "CreatedAt", "RetryCount", "CorrelationID"];
        const rows = reportData.map(d => [d.id, d.tool, d.status, d.prompt, d.error, d.created_at, d.retry_count, d.correlation_id]);
        const csvContent = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`Relatório completo (${format.toUpperCase()}) exportado`);
    } catch (e: any) {
      toast.error("Falha ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  }

  async function exportHistory(format: "csv" | "json") {
    if (!history.length || !user) return;
    setIsExporting(true);
    try {
      const timestamp = new Date().toLocaleString('sv-SE', { timeZone: selectedTimezone }).replace(/[: ]/g, '-');
      const correlationId = crypto.randomUUID().slice(0, 8);
      const filename = `creative-history-${correlationId}-${timestamp}.${format}`;
      let content = "";
      
      const tzHeader = `Timezone applied: ${selectedTimezone}\n`;

      if (format === "json") {
        content = JSON.stringify({ 
          metadata: { 
            timezone: selectedTimezone, 
            generated_at: new Date().toISOString(),
            user_id: user.id
          }, 
          data: history 
        }, null, 2);
      } else {
        const headers = exportColumns.join(",");
        const rows = history.map(h => exportColumns.map(c => {
          let val = h[c.toLowerCase().replace(/ /g, "_")];
          if (c === "Config") val = JSON.stringify(h.metadata || {});
          if (c === "Created At") val = new Date(val).toLocaleString('sv-SE', { timeZone: selectedTimezone });
          return `"${String(val ?? "").replace(/"/g, '""')}"`;
        }).join(","));
        content = tzHeader + headers + "\n" + rows.join("\n");
      }
      
      const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      await supabase.from("creative_audit_logs").insert({
        user_id: user.id,
        event_type: 'export',
        metadata: { format, filename, correlationId, columns: exportColumns }
      });
      
      toast.success("Relatório exportado com sucesso!");
    } catch (e: any) {
      toast.error("Falha ao exportar relatório: " + e.message);
      // System logging for errors
      console.error("[CreativePanel Export Error]", { error: e, userId: user.id });
    } finally {
      setIsExporting(false);
    }
  }


  async function exportAuditTrail(format: "csv" | "json") {
    if (!user || !exportAuditLogs.length) {
      toast.info("Nenhum dado de auditoria para exportar.");
      return;
    }
    const timestamp = new Date().toLocaleString('sv-SE', { timeZone: selectedTimezone }).replace(/[: ]/g, '-');
    const correlationId = crypto.randomUUID().slice(0, 8);
    const filename = `creative-audit-trail-${correlationId}-${timestamp}.${format}`;
    let content = "";
    
    const tzHeader = `Timezone applied: ${selectedTimezone}\n`;

    if (format === "json") {
      content = JSON.stringify({ metadata: { timezone: selectedTimezone, generated_at: new Date().toISOString() }, data: exportAuditLogs }, null, 2);
    } else {
      const headers = ["ID", "Action", "Created At", "User", "Details"];
      const rows = exportAuditLogs.map(log => [
        log.id,
        log.action || log.event_type,
        new Date(log.created_at).toLocaleString('pt-BR', { timeZone: selectedTimezone }),
        log.profiles?.email || log.user_id,
        JSON.stringify(log.details || log.metadata).replace(/"/g, '""')
      ].map(v => `"${v}"`).join(","));
      content = tzHeader + [headers.join(","), ...rows].join("\n");
    }

    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Trilha de auditoria exportada");
  }

  async function scheduleAuditExport() {
    if (!user || !auditEmail || !auditTime) return;
    try {
      const { error } = await supabase.from("creative_audit_schedules").upsert({
        user_id: user.id,
        email: auditEmail,
        schedule_time: auditTime,
        export_interval_days: auditInterval,
        is_active: true
      });
      if (error) throw error;
      toast.success("Exportação de auditoria agendada!");
      setShowAuditSchedule(false);
    } catch (e: any) {
      toast.error("Falha ao agendar: " + e.message);
    }
  }

  async function cancelExport(id: string) {
    if (!user) return;
    const { error } = await supabase.from("creative_export_history").update({ status: "failed", error_message: "Cancelado pelo usuário", cancelled_at: new Date().toISOString(), cancelled_by: user.id }).eq("id", id);
    if (!error) {
      await supabase.from("creative_export_audit_log").insert({ export_id: id, user_id: user.id, action: 'cancel', details: { reason: "Cancelado via UI" } });
      toast.info("Exportação cancelada");
      loadExportHistory();
    }
  }

  async function retryExport(id: string) {
    if (!user) return;
    const exportToRetry = exports.find(e => e.id === id);
    const { error } = await supabase.from("creative_export_history").update({ 
      status: "queued", 
      error_message: null,
      retry_count: (exportToRetry?.retry_count || 0) + 1,
      last_retry_at: new Date().toISOString()
    }).eq("id", id);
    
    if (!error) {
      await supabase.from("creative_export_audit_log").insert({
        export_id: id,
        user_id: user.id,
        action: 'retry',
        details: { attempt: (exportToRetry?.retry_count || 0) + 1 }
      });
      toast.success("Exportação reenfileirada");
      loadExportHistory();
    }
  }

  async function loadExportHistory() {
    if (!user) return;
    const { data } = await supabase.from("creative_export_history").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setExports(data || []);
  }

  async function loadInvestigationLogs(exportId: string) {
    if (!user) return;
    setIsLoadingAudit(true);
    try {
      const isExport = !!selectedAssetForInvestigation.asset_id || (selectedAssetForInvestigation.id && selectedAssetForInvestigation.user_id && !selectedAssetForInvestigation.tool);
      const auditTable = isExport ? "creative_export_audit_log" : "creative_audit_logs";
      const idField = isExport ? "export_id" : "asset_id";
      
      const { data, error } = await supabase.rpc('get_creative_audit_logs', {
        p_table: auditTable,
        p_id_field: idField,
        p_id_value: exportId,
        p_search: investigationSearch || null,
        p_start_date: investigationDateStart || null,
        p_end_date: investigationDateEnd || null
      });
      
      if (error) throw error;
      
      let sorted = [...((data as any[]) || [])];
      sorted.sort((a, b) => {
        const da = new Date(a.created_at).getTime();
        const db = new Date(b.created_at).getTime();
        return auditSortOrder === 'desc' ? db - da : da - db;
      });
      
      setExportAuditLogs(sorted);
    } catch (e: any) {
      toast.error("Erro ao carregar logs: " + e.message);
    } finally {
      setIsLoadingAudit(false);
    }
  }

  const AUDIT_PAGE_SIZE = 10;
  const paginatedAuditLogs = useMemo(() => {
    const start = (auditPage - 1) * AUDIT_PAGE_SIZE;
    return exportAuditLogs.slice(start, start + AUDIT_PAGE_SIZE);
  }, [exportAuditLogs, auditPage]);

  async function updateNotificationPrefs(key: string, val: boolean) {
    if (!user) return;
    const newPrefs = { ...notificationPrefs, [key]: val };
    setNotificationPrefs(newPrefs);
    const { error } = await supabase.from("creative_notification_preferences").upsert({
      user_id: user.id,
      ...newPrefs
    });
    if (error) toast.error("Falha ao salvar preferências");
  }


  useEffect(() => {
    if (selectedExport) {
      loadInvestigationLogs(selectedExport.id);
    }
  }, [selectedExport, investigationSearch, investigationDateStart, investigationDateEnd, auditSortOrder]);

  async function savePreset() {
    if (!user || !newPresetName.trim()) return;
    try {
      const filters = { filter, searchQuery, sortOrder };
      const { data, error } = await supabase.from("creative_filter_presets").insert({ user_id: user.id, name: newPresetName, filters }).select().single();
      if (error) throw error;
      const savedPreset: any = data;
      setPresets([savedPreset, ...presets]);
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4 border-border/40">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Acesso Restrito</h2>
          <p className="text-muted-foreground text-sm">Você precisa estar autenticado para acessar o painel de Economia Criativa.</p>
          <Button onClick={() => navigate("/auth")} className="w-full">Ir para Login</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card p-4">
        <div className="container max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Economia Criativa Kubo
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/creative/investigation")}>
              <AlertTriangle className="h-4 w-4 mr-1" /> Investigação
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/creative/presets")}>Presets</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/creative/notifications")}>Notificações</Button>
            <span className="font-mono text-sm font-bold ml-2">{editsRemaining} créditos</span>
            <div className="flex items-center gap-1 ml-4 border-l border-border/40 pl-4">
              <label className="text-[10px] font-bold uppercase text-muted-foreground mr-1">Simular Falha:</label>
              <select 
                value={simulationMode} 
                onChange={(e) => setSimulationMode(e.target.value as any)}
                className="bg-muted text-[10px] rounded px-1 py-0.5 border-none outline-none focus:ring-0"
              >
                <option value="none">OFF</option>
                <option value="selection">Seleção</option>
                <option value="config">Config</option>
                <option value="execution">Execução</option>
              </select>
            </div>
          </div>

        </div>
      </header>
      <main className="container max-w-7xl mx-auto px-4 py-6">
        {errorState && (
          <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/30 animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertCircle className="h-5 w-5" />
            <div className="flex-1 ml-3">
              <AlertTitle className="font-bold">Erro na etapa: {errorState.step}</AlertTitle>
              <AlertDescription className="mt-1">
                <p>{errorState.message}</p>
                {(errorState.correlationId || errorState.traceId) && (
                  <div className="mt-2 text-[10px] font-mono opacity-70 space-y-0.5">
                    {errorState.correlationId && <p>CorrelationID: {errorState.correlationId}</p>}
                    {errorState.traceId && <p>TraceID: {errorState.traceId}</p>}
                  </div>
                )}
                <div className="mt-4 flex gap-3">
                  {errorState.originalAction && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="bg-background/50 hover:bg-background border-destructive/20 text-destructive"
                      onClick={() => {
                        const action = errorState.originalAction;
                        setErrorState(null);
                        action?.();
                      }}
                    >
                      <RotateCw className="h-3.5 w-3.5 mr-2" /> Tentar Novamente
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="hover:bg-destructive/5"
                    onClick={() => setShowErrorModal(true)}
                  >
                    Ver Detalhes
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="hover:bg-destructive/5"
                    onClick={() => setErrorState(null)}
                  >
                    Fechar
                  </Button>
                </div>
              </AlertDescription>
            </div>
          </Alert>
        )}

        <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
          <DialogContent className="max-w-2xl bg-card border-border/40">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" /> Detalhes do Erro
              </DialogTitle>
              <DialogDescription>
                Informações técnicas para suporte e depuração.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold">Etapa</p>
                  <p className="font-semibold">{errorState?.step}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold">Mensagem</p>
                  <p className="text-foreground/80">{errorState?.message}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold">Correlation ID</p>
                  <p className="font-mono text-xs">{errorState?.correlationId || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold">Trace ID</p>
                  <p className="font-mono text-xs">{errorState?.traceId || "N/A"}</p>
                </div>
              </div>
              {errorState?.stack && (
                <div className="space-y-1 mt-4">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold">Stack Trace</p>
                  <pre className="p-3 bg-muted/50 rounded-lg text-[10px] font-mono overflow-auto max-h-[200px] border border-border/20">
                    {errorState.stack}
                  </pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Progress Bar Flow */}
        <div className="max-w-2xl mx-auto mb-10 space-y-6">
          <div className="flex justify-between items-center relative">
            <div className="absolute top-5 left-0 w-full h-0.5 bg-muted -z-10" />
            {[
              { label: "Seleção", icon: Search },
              { label: "Configuração", icon: Settings2 },
              { label: "Execução", icon: Loader2 }
            ].map((step, i) => {
              const stepNum = i + 1;
              const isDashboard = active === "dashboard";
              
              // Status logic
              const hasProcessing = history.some(h => (h.status === "processing" || h.status === "queued"));
              
              let currentStep = 1;
              if (!isDashboard) currentStep = 2;
              if (hasProcessing) currentStep = 3;

              const isCompleted = stepNum < currentStep;
              const isActive = stepNum === currentStep;
              const Icon = step.icon;

              return (
                <div key={step.label} className="flex flex-col items-center gap-2 bg-background px-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 z-10 ${
                    isCompleted ? "bg-primary border-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.4)]" :
                    isActive ? "border-primary text-primary bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.25)]" :
                    "border-muted text-muted-foreground bg-background"
                  }`}>
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className={`h-5 w-5 ${isActive ? "animate-pulse" : ""}`} />}
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? "text-primary" : "text-muted-foreground/60"}`}>
                      {step.label}
                    </span>
                    {isActive && (
                      <Badge variant="outline" className="text-[8px] h-4 mt-1 border-primary/30 text-primary px-1.5 py-0 leading-none">
                        {currentStep === 1 ? "INÍCIO" : currentStep === 2 ? "PRÓXIMO" : "AO VIVO"}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {(() => {
            const isDashboard = active === "dashboard";
            const hasProcessing = history.some(h => (h.status === "processing" || h.status === "queued"));
            let currentStep = 1;
            if (!isDashboard) currentStep = 2;
            if (hasProcessing) currentStep = 3;
            
            return (
              <div className="space-y-2">
                <div className="flex justify-between items-end mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                    <span className="text-xs font-bold text-foreground/80 uppercase tracking-tighter">
                      Fluxo de Habilidades
                    </span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {Math.round((currentStep / 3) * 100)}%
                  </span>
                </div>
                <Progress value={(currentStep / 3) * 100} className="h-2 bg-muted/30" />
              </div>
            );
          })()}
        </div>

        <Tabs value={active} onValueChange={(v) => { setActive(v as ToolKey); navigate(v === "dashboard" ? "/creative" : `/creative/${v}`); }}>
          <TabsContent value="dashboard">
             <div className="space-y-6">
               <ManusLauncher setActive={(k) => { setActive(k as ToolKey); navigate(k === "dashboard" ? "/creative" : `/creative/${k}`); }} />
               
               <div className="pt-6 border-t border-border/40">
                 <div className="flex flex-wrap gap-4 items-end mb-4">
                   <div className="space-y-1">
                     <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                     <select 
                      value={filter} 
                      onChange={(e) => setFilter(e.target.value as any)}
                      className="flex h-10 w-[180px] rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                     >
                       <option value="all">Todos os Status</option>
                       <option value="queued">Na Fila</option>
                       <option value="processing">Processando</option>
                       <option value="completed">Concluído</option>
                       <option value="failed">Falhou</option>
                     </select>
                   </div>
                   <div className="flex-1 min-w-[200px] space-y-1">
                     <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Busca</label>
                     <div className="relative">
                       <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        placeholder="Prompt, ferramenta ou erro..." 
                        className="pl-9 bg-background/50"
                       />
                     </div>
                   </div>
                    <div className="flex gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase">Fuso Horário</label>
                        <select 
                          value={selectedTimezone} 
                          onChange={(e) => setSelectedTimezone(e.target.value)}
                          className="flex h-10 w-[120px] rounded-md border border-input bg-background/50 px-2 py-2 text-xs"
                        >
                          <option value="UTC">UTC</option>
                          <option value="America/Sao_Paulo">Brasília (BRT)</option>
                          <option value="Europe/London">Londres (GMT)</option>
                          <option value="America/New_York">NY (EST)</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => { setFilter("all"); setSearchQuery(""); setSortOrder("desc"); setSelectedTimezone("UTC"); }}
                          disabled={isLoadingHistory}
                        >
                          Resetar
                        </Button>
                        <Button 
                          variant="secondary" 
                          onClick={() => exportFullPanelReport("json")}
                          disabled={isExporting || history.length === 0}
                          title="Exportar tudo em JSON"
                        >
                          {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                          JSON Full
                        </Button>
                        <div className="flex gap-1">
                          {["Selection", "Configuration", "Execution"].map((step) => (
                            <Button 
                              key={step}
                              variant="ghost" 
                              size="sm"
                              className="text-[10px] h-8"
                              onClick={() => exportStepReport(step as any)}
                              disabled={isExporting}
                            >
                              {step[0]}
                            </Button>
                          ))}
                        </div>
                      </div>

                     {filter === "failed" && history.some(h => h.status === "failed") && (
                       <Button variant="secondary" onClick={batchRetryFailed} disabled={isBatchRetrying}>
                         {isBatchRetrying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCw className="h-4 w-4 mr-2" />}
                         Reprocessar Falhas
                       </Button>
                     )}
                   </div>
                 </div>

                 <Card className="overflow-hidden border-border/40 bg-card/40 backdrop-blur">
                    <div className="divide-y divide-border/20">
                      {isLoadingHistory ? (
                        <div className="p-10 flex flex-col items-center justify-center text-muted-foreground gap-3">
                          <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
                          <p className="text-sm font-medium">Carregando histórico...</p>
                        </div>
                      ) : history.length === 0 ? (
                        <div className="p-10 text-center text-muted-foreground">
                          <p>Nenhum item encontrado.</p>
                        </div>
                      ) : history.map((h: any) => (
                        <div key={h.id} className="p-4 flex flex-wrap items-center justify-between gap-4 transition hover:bg-muted/30">
                           <div className="flex items-start gap-4 flex-1 min-w-[300px]">
                             <div className={`p-2 rounded-xl bg-background/60 border border-border/40`}>
                               {(() => {
                                 const toolInfo = TOOLS.find(t => t.key === h.tool);
                                 const Icon = toolInfo?.icon || Sparkles;
                                 return <Icon className="h-5 w-5 text-foreground/70" />;
                               })()}
                             </div>
                             <div className="space-y-1">
                               <div className="flex items-center gap-2">
                                 <Badge variant={h.status === 'completed' ? 'default' : h.status === 'failed' ? 'destructive' : 'outline'} className="capitalize">
                                   {h.status}
                                 </Badge>
                                 <span className="font-semibold text-sm">{TOOLS.find(t => t.key === h.tool)?.title || h.tool}</span>
                                 <span className="text-[10px] text-muted-foreground font-mono">{new Date(h.created_at).toLocaleString()}</span>
                               </div>
                               <p className="text-sm text-foreground/80 line-clamp-1 italic">"{h.prompt || "Sem prompt"}"</p>
                               {h.error_message && (
                                 <p className="text-[10px] text-destructive flex items-center gap-1">
                                   <AlertTriangle className="h-3 w-3" /> {h.error_message}
                                 </p>
                               )}
                             </div>
                           </div>
                           <div className="flex items-center gap-2">
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/creative/investigation?investigate=${h.id}`)}>
                                <History className="h-4 w-4 mr-2" /> Investigar
                              </Button>
                             {(h.status === 'queued' || h.status === 'processing') && (
                               <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-destructive hover:bg-destructive/10" 
                                onClick={() => cancelExecution(h.id)}
                                disabled={isCancelling === h.id}
                               >
                                 {isCancelling === h.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />} 
                                 Cancelar
                               </Button>
                             )}
                             {(h.status === 'failed' || h.status === 'error' || h.status === 'completed') && (
                               <Button size="sm" variant="secondary" disabled={rerunningId === h.id} onClick={() => rerun(h)}>
                                 {rerunningId === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                               </Button>
                             )}
                           </div>
                        </div>
                      ))}
                    </div>
                 </Card>
               </div>
             </div>
          </TabsContent>
          
          {TOOLS.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              <div className="space-y-6">
                <Button variant="ghost" size="sm" onClick={() => { setActive("dashboard"); navigate("/creative"); }} className="mb-2">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Painel
                </Button>
                <CreativeToolInterface 
                  toolKey={t.key as any} 
                  onSuccess={() => {
                    setActive("dashboard");
                    navigate("/creative");
                    loadHistory(null);
                  }} 
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
