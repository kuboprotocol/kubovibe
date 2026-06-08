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


  useEffect(() => {
    if (tool) setActive(tool as ToolKey);
  }, [tool]);

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

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      const { data: prefs } = await supabase.from("creative_user_settings").select("*").eq("user_id", user.id).single();
      if (prefs) {
        setFilter(prefs.filter as any);
        setSearchQuery(prefs.search_query);
        setSortOrder(prefs.sort_order as any);
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
  }, [user, active, filter, searchQuery, sortOrder]);

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
      const r = await authedFetch(cfg.fn, cfg.build(asset), idemKey);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { 
        if (!isBatch) handleFnError(d); 
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
    if (!user) return;
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
      toast.error("Falha ao cancelar: " + e.message);
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

  function exportHistory(format: "csv" | "json") {
    if (!history.length) return;
    const filename = `creative-history-${new Date().toISOString().split("T")[0]}.${format}`;
    let content = "";
    if (format === "json") {
      content = JSON.stringify(history, null, 2);
    } else {
      const rows = history.map(h => exportColumns.map(c => h[c.toLowerCase().replace(/ /g, "_")] || "").join(","));
      content = [exportColumns.join(","), ...rows].join("\n");
    }
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Histórico exportado");
  }

  async function exportAuditTrail(format: "csv" | "json") {
    if (!user || !exportAuditLogs.length) {
      toast.info("Nenhum dado de auditoria para exportar.");
      return;
    }
    const filename = `creative-audit-trail-${new Date().toISOString().split("T")[0]}.${format}`;
    let content = "";
    if (format === "json") {
      content = JSON.stringify(exportAuditLogs, null, 2);
    } else {
      const headers = ["ID", "Action", "Created At", "User", "Details"];
      const rows = exportAuditLogs.map(log => [
        log.id,
        log.action || log.event_type,
        log.created_at,
        log.profiles?.email || log.user_id,
        JSON.stringify(log.details || log.metadata).replace(/"/g, '""')
      ].map(v => `"${v}"`).join(","));
      content = [headers.join(","), ...rows].join("\n");
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card p-4">
        <div className="container max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Economia Criativa Kubo
          </h1>
          <div className="flex items-center gap-4">
             <span className="font-mono text-sm font-bold">{editsRemaining} créditos</span>
          </div>
        </div>
      </header>
      <main className="container max-w-7xl mx-auto px-4 py-6">
        <Tabs value={active} onValueChange={(v) => { setActive(v as ToolKey); navigate(v === "dashboard" ? "/creative" : `/creative/${v}`); }}>
          <TabsContent value="dashboard">
             <div className="space-y-6">
               <div className="flex flex-wrap gap-4 items-end">
                 <div className="space-y-1">
                   <label className="text-xs font-medium text-muted-foreground">Filtro</label>
                   <select 
                    value={filter} 
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                   >
                     <option value="all">Todos os Status</option>
                     <option value="queued">Na Fila</option>
                     <option value="processing">Processando</option>
                     <option value="completed">Concluído</option>
                     <option value="failed">Falhou</option>
                   </select>
                 </div>
                 <div className="flex-1 min-w-[200px] space-y-1">
                   <label className="text-xs font-medium text-muted-foreground">Busca</label>
                   <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Prompt, ferramenta ou erro..." />
                 </div>
                 <Button variant="outline" onClick={() => { setFilter("all"); setSearchQuery(""); setSortOrder("desc"); }}>
                   Resetar
                 </Button>
               </div>

               <Card className="divide-y divide-border/40">
                  {history.map((h: any) => (
                    <div key={h.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                       <div className="space-y-1">
                         <div className="flex items-center gap-2">
                           <Badge variant={h.status === 'completed' ? 'default' : h.status === 'failed' ? 'destructive' : 'outline'}>
                             {h.status}
                           </Badge>
                           <span className="font-semibold">{h.tool}</span>
                         </div>
                         <p className="text-sm text-muted-foreground line-clamp-1">{h.prompt}</p>
                       </div>
                       <div className="flex gap-2">
                         <Button size="sm" variant="ghost" onClick={() => setSelectedAssetForInvestigation(h)}>
                           <History className="h-4 w-4 mr-2" /> Investigar
                         </Button>
                         {(h.status === 'queued' || h.status === 'processing') && (
                           <Button size="sm" variant="outline" onClick={() => cancelExecution(h.id)}>Cancelar</Button>
                         )}
                         {(h.status === 'failed' || h.status === 'error' || h.status === 'completed') && (
                           <Button size="sm" variant="secondary" disabled={rerunningId === h.id} onClick={() => rerun(h)}>
                             {rerunningId === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                           </Button>
                         )}
                       </div>
                    </div>
                  ))}
               </Card>

               {/* Investigation Modal */}
               <Dialog open={!!selectedAssetForInvestigation} onOpenChange={() => setSelectedAssetForInvestigation(null)}>
                 <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                   <DialogHeader>
                     <DialogTitle>Investigação de Execução</DialogTitle>
                     <DialogDescription>
                       Trilha de auditoria e logs detalhados para o asset {selectedAssetForInvestigation?.id}
                     </DialogDescription>
                   </DialogHeader>
                   
                   <div className="space-y-4">
                     <div className="flex flex-wrap gap-4 items-end bg-muted/50 p-4 rounded-lg">
                       <div className="flex-1 min-w-[200px] space-y-1">
                         <label className="text-xs font-medium text-muted-foreground">Filtrar Logs</label>
                         <Input 
                           value={investigationSearch} 
                           onChange={(e) => setInvestigationSearch(e.target.value)} 
                           placeholder="Buscar na trilha..." 
                         />
                       </div>
                       <div className="space-y-1">
                         <label className="text-xs font-medium text-muted-foreground">Início</label>
                         <Input 
                           type="date" 
                           value={investigationDateStart} 
                           onChange={(e) => setInvestigationDateStart(e.target.value)} 
                         />
                       </div>
                       <div className="space-y-1">
                         <label className="text-xs font-medium text-muted-foreground">Fim</label>
                         <Input 
                           type="date" 
                           value={investigationDateEnd} 
                           onChange={(e) => setInvestigationDateEnd(e.target.value)} 
                         />
                       </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Ordem</label>
                          <select 
                            value={auditSortOrder} 
                            onChange={(e) => setAuditSortOrder(e.target.value as any)}
                            className="flex h-10 w-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                          >
                            <option value="desc">Recentes</option>
                            <option value="asc">Antigos</option>
                          </select>
                        </div>
                        <div className="flex gap-2">

                         <Button variant="outline" size="sm" onClick={() => exportAuditTrail("csv")}>
                           <FileDown className="h-4 w-4 mr-2" /> CSV
                         </Button>
                         <Button variant="outline" size="sm" onClick={() => exportAuditTrail("json")}>
                           <FileDown className="h-4 w-4 mr-2" /> JSON
                         </Button>
                       </div>
                     </div>

                     <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left p-3 font-medium">Data</th>
                              <th className="text-left p-3 font-medium">Ação</th>
                              <th className="text-left p-3 font-medium">Usuário</th>
                              <th className="text-left p-3 font-medium">Detalhes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {isLoadingAudit ? (
                              <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
                            ) : paginatedAuditLogs.length === 0 ? (
                              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhum evento registrado.</td></tr>
                            ) : paginatedAuditLogs.map((log: any) => (

                              <tr key={log.id} className="hover:bg-muted/30">
                                <td className="p-3 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                                <td className="p-3">
                                  <Badge variant="outline" className="capitalize">{log.action || log.event_type}</Badge>
                                </td>
                                <td className="p-3">{log.profiles?.email || 'Sistema'}</td>
                                <td className="p-3 text-xs font-mono max-w-md truncate">
                                  {JSON.stringify(log.details || log.metadata)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                     </div>
                      
                      {exportAuditLogs.length > AUDIT_PAGE_SIZE && (
                        <div className="flex items-center justify-between py-2 border-t">
                          <span className="text-xs text-muted-foreground">Página {auditPage} de {Math.ceil(exportAuditLogs.length / AUDIT_PAGE_SIZE)}</span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" disabled={auditPage === 1} onClick={() => setAuditPage(p => p - 1)}>Anterior</Button>
                            <Button size="sm" variant="outline" disabled={auditPage >= Math.ceil(exportAuditLogs.length / AUDIT_PAGE_SIZE)} onClick={() => setAuditPage(p => p + 1)}>Próxima</Button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4 pt-4 border-t">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          Configurações de Notificação
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Notificar Cancelamentos</span>
                            <input type="checkbox" checked={notificationPrefs.notify_cancel} onChange={(e) => updateNotificationPrefs('notify_cancel', e.target.checked)} className="h-4 w-4" />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Notificar Retentativas</span>
                            <input type="checkbox" checked={notificationPrefs.notify_retry} onChange={(e) => updateNotificationPrefs('notify_retry', e.target.checked)} className="h-4 w-4" />
                          </div>
                          <div className="flex items-center justify-between md:col-span-2">
                            <span className="text-sm">Incluir link para investigação no e-mail</span>
                            <input type="checkbox" checked={notificationPrefs.include_investigation_link} onChange={(e) => updateNotificationPrefs('include_investigation_link', e.target.checked)} className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>

                 </DialogContent>
               </Dialog>
             </div>
          </TabsContent>
          <TabsContent value="chat">Kubo Chat...</TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
