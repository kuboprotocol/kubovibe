import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Zap, 
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FileDown,
  Eye,
  Info,
  Settings2,
  Check,
  Save,
  Trash2,
  FileSpreadsheet,
  Copy,
  Download,
  FileText,
  Keyboard,
  Upload,
  AlertTriangle,
  FileCode
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

interface SkillExecution {
  id: string;
  skill_slug: string;
  skill_name: string;
  status: string;
  input: any;
  output: any;
  error_message: string | null;
  credits_charged: number;
  duration_ms: number | null;
  created_at: string;
}

export function SkillExecutionsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [executions, setExecutions] = useState<SkillExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters & Search
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "all");
  const [skillFilter, setSkillFilter] = useState<string>(searchParams.get("skill") || "all");
  const [dateStart, setDateStart] = useState(searchParams.get("start") || "");
  const [dateEnd, setDateEnd] = useState(searchParams.get("end") || "");
  
  // Pagination & Sorting
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">((searchParams.get("sort") as "asc" | "desc") || "desc");
  const pageSize = 10;
  
  // Details Modal
  const [selectedEx, setSelectedEx] = useState<SkillExecution | null>(null);
  const [logPage, setLogPage] = useState(1);
  const logPageSize = 50;
  
  // Available skills for filter
  const [availableSkills, setAvailableSkills] = useState<{slug: string, name: string}[]>([]);

  // Presets
  const [presets, setPresets] = useState<{ id: string, name: string, filters: any, sorting: any, created_at?: string }[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editPresetName, setEditPresetName] = useState("");
  const [presetSearch, setPresetSearch] = useState("");
  const [presetSort, setPresetSort] = useState<"name" | "recent">("name");
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);
  
  // Import/Export Presets
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);
  const [importHistory, setImportHistory] = useState<{ timestamp: string, status: "success" | "partial" | "error", message: string, errors?: string[] }[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importValidationResults, setImportValidationResults] = useState<{ valid: boolean, errors: string[], preview: any[] } | null>(null);
  const [mergeOption, setMergeOption] = useState<"create" | "merge">("create");

  // OpenHoster/Nano Banano States
  const [openHosterError, setOpenHosterError] = useState<{
    message: string;
    details?: string;
    backend_status?: number;
    stack?: string;
  } | null>(null);

  // Export Configuration
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    "id", "skill_name", "status", "credits_charged", "duration_ms", "created_at", "error_message"
  ]);

  const availableColumns = [
    { id: "id", label: "ID da Execução" },
    { id: "skill_name", label: "Nome da Skill" },
    { id: "skill_slug", label: "Slug da Skill" },
    { id: "status", label: "Status" },
    { id: "credits_charged", label: "Créditos" },
    { id: "duration_ms", label: "Duração (ms)" },
    { id: "created_at", label: "Data/Hora" },
    { id: "error_message", label: "Erro" },
    { id: "input", label: "Entrada (JSON)" },
    { id: "output", label: "Saída (JSON)" },
  ];



  useEffect(() => {
    fetchAvailableSkills();
    loadPresets();

    // Suporte para o "Nano Banano" via URL (OpenHoster)
    const urlParams = new URLSearchParams(window.location.search);
    const provider = urlParams.get("provider");
    const tool = urlParams.get("tool");

    if (provider === "openhoster" && tool === "nano_banano") {
      setSkillFilter("nano_banana");
    } else if (provider === "openhoster" || tool === "nano_banano") {
      // Fallback: Se um dos dois estiver presente, tenta forçar o filtro mas avisa o erro
      setSkillFilter("nano_banana");
      setOpenHosterError({
        message: "Link incompleto para OpenHoster",
        details: `Parâmetros detectados: provider=${provider || 'ausente'}, tool=${tool || 'ausente'}. O link ideal deve conter ambos.`
      });
      toast.warning("Link incompleto detectado. Aplicando fallback para Nano Banano.");
    }
  }, []);



  // Update URL params when filters change
  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (statusFilter !== "all") params.status = statusFilter;
    if (skillFilter !== "all") params.skill = skillFilter;
    if (dateStart) params.start = dateStart;
    if (dateEnd) params.end = dateEnd;
    if (page > 1) params.page = String(page);
    if (sortOrder !== "desc") params.sort = sortOrder;
    
    // Suporte para o "Nano Banano" via URL (OpenHoster)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("provider") === "openhoster" && urlParams.get("tool") === "nano_banano") {
      setSkillFilter("nano_banana");
    }

    setSearchParams(params, { replace: true });
  }, [search, statusFilter, skillFilter, dateStart, dateEnd, page, sortOrder]);

  const loadPresets = async () => {
    try {
      const { data, error } = await supabase
        .from("filter_presets")
        .select("*")
        .order("name");
      
      if (error) throw error;
      setPresets(data || []);
    } catch (e) {
      console.error("Error loading presets from DB, falling back to local", e);
      const saved = localStorage.getItem("skill_history_presets");
      if (saved) {
        const localPresets = JSON.parse(saved).map((p: any) => ({
          ...p,
          filters: p.config,
          sorting: { column: "created_at", direction: p.config?.sortOrder || "desc" }
        }));
        setPresets(localPresets);
      }
    }
  };

  const savePreset = async () => {
    if (!newPresetName) {
      toast.error("Dê um nome ao seu preset.");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const filters = { search, statusFilter, skillFilter, dateStart, dateEnd };
      const sorting = { column: "created_at", direction: sortOrder };

      const { data, error } = await supabase
        .from("filter_presets")
        .insert({
          user_id: userData.user.id,
          name: newPresetName,
          filters,
          sorting
        })
        .select()
        .single();

      if (error) throw error;
      
      setPresets(prev => [...prev, data]);
      setNewPresetName("");
      setIsSavingPreset(false);
      toast.success("Preset salvo!");
    } catch (error) {
      console.error("Error saving preset:", error);
      toast.error("Erro ao salvar preset no banco.");
    }
  };

  const applyPreset = (preset: any) => {
    setSearch(preset.filters.search || "");
    setStatusFilter(preset.filters.statusFilter || "all");
    setSkillFilter(preset.filters.skillFilter || "all");
    setDateStart(preset.filters.dateStart || "");
    setDateEnd(preset.filters.dateEnd || "");
    setSortOrder(preset.sorting?.direction || "desc");
    setPage(1);
    toast.info(`Preset "${preset.name}" aplicado.`);
  };

  const deletePreset = async (id: string) => {
    try {
      const { error } = await supabase
        .from("filter_presets")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      setPresets(prev => prev.filter(p => p.id !== id));
      toast.success("Preset removido.");
    } catch (error) {
      console.error("Error deleting preset:", error);
      toast.error("Erro ao remover preset.");
    }
  };

  const updatePreset = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from("filter_presets")
        .update({ name })
        .eq("id", id);
      
      if (error) throw error;
      setPresets(prev => prev.map(p => p.id === id ? { ...p, name } : p));
      setEditingPresetId(null);
      toast.success("Preset renomeado.");
    } catch (error) {
      console.error("Error updating preset:", error);
      toast.error("Erro ao renomear preset.");
    }
  };

  const exportPresets = (selectedOnly = false) => {
    const toExport = selectedOnly 
      ? presets.filter(p => selectedPresetIds.includes(p.id))
      : presets;

    if (toExport.length === 0) {
      toast.error(selectedOnly ? "Selecione ao menos um preset para exportar." : "Nenhum preset para exportar.");
      return;
    }

    const exportData = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      presets: toExport.map(p => ({
        name: p.name,
        filters: p.filters,
        sorting: p.sorting
      }))
    };

    const data = JSON.stringify(exportData, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `presets_history_${selectedOnly ? 'selected_' : ''}${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${toExport.length} presets exportados com sucesso!`);
  };

  const validatePresetFile = async (file: File) => {
    try {
      const text = await file.text();
      let imported;
      try {
        imported = JSON.parse(text);
      } catch (e) {
        return { valid: false, errors: ["Arquivo JSON malformado."], preview: [] };
      }

      // Handle both legacy array and new versioned object
      const presetsList = Array.isArray(imported) ? imported : (imported.presets || []);
      
      if (!Array.isArray(presetsList)) {
        return { valid: false, errors: ["O arquivo deve conter uma lista de presets."], preview: [] };
      }

      const errors: string[] = [];
      const validPresets: any[] = [];

      presetsList.forEach((p, index) => {
        const itemErrors: string[] = [];
        if (!p.name) itemErrors.push(`Preset #${index + 1}: Nome ausente.`);
        if (!p.filters) itemErrors.push(`Preset #${index + 1}: Filtros ausentes.`);
        
        if (itemErrors.length > 0) {
          errors.push(...itemErrors);
        } else {
          validPresets.push(p);
        }
      });

      return { valid: validPresets.length > 0, errors, preview: validPresets };
    } catch (e) {
      return { valid: false, errors: ["Erro ao ler o arquivo."], preview: [] };
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const results = await validatePresetFile(file);
    setImportValidationResults(results);
    setIsImportModalOpen(true);
    e.target.value = "";
  };

  const executeImport = async () => {
    if (!importValidationResults || importValidationResults.preview.length === 0) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      let acceptedCount = 0;
      let updatedCount = 0;
      const errors: string[] = [];

      for (const p of importValidationResults.preview) {
        try {
          // Check for conflict if merge is selected
          const existing = mergeOption === "merge" 
            ? presets.find(ex => ex.name === p.name || ex.name === `${p.name} (Importado)`)
            : null;

          if (existing) {
            const { error } = await supabase
              .from("filter_presets")
              .update({
                filters: p.filters,
                sorting: p.sorting || { column: "created_at", direction: "desc" }
              })
              .eq("id", existing.id);
            if (error) throw error;
            updatedCount++;
          } else {
            const { error } = await supabase.from("filter_presets").insert({
              user_id: userData.user.id,
              name: mergeOption === "merge" ? p.name : `${p.name} (Importado)`,
              filters: p.filters,
              sorting: p.sorting || { column: "created_at", direction: "desc" }
            });
            if (error) throw error;
            acceptedCount++;
          }
        } catch (err: any) {
          errors.push(`Erro ao importar "${p.name}": ${err.message || 'Erro desconhecido'}`);
        }
      }

      const totalHandled = acceptedCount + updatedCount;
      const status = errors.length === 0 ? "success" : (totalHandled > 0 ? "partial" : "error");
      const message = `${acceptedCount} criados, ${updatedCount} atualizados, ${errors.length} erros.`;
      
      setImportHistory(prev => [{
        timestamp: new Date().toISOString(),
        status,
        message,
        errors: errors.length > 0 ? errors : undefined
      }, ...prev]);

      await loadPresets();
      setIsImportModalOpen(false);
      setImportValidationResults(null);
      
      if (status === "success") toast.success("Importação concluída!");
      else if (status === "partial") toast.warning("Importação concluída com alguns avisos.");
      else toast.error("Falha na importação.");

    } catch (error) {
      console.error("Error executing import:", error);
      toast.error("Erro crítico na importação.");
    }
  };

  const downloadTemplate = () => {
    const template = {
      version: "1.0.0",
      presets: [
        {
          name: "Exemplo: Sucessos Recentes",
          filters: {
            search: "",
            statusFilter: "succeeded",
            skillFilter: "all",
            dateStart: "",
            dateEnd: ""
          },
          sorting: {
            column: "created_at",
            direction: "desc"
          }
        }
      ]
    };
    const data = JSON.stringify(template, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `template_presets_v1.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.info("Template v1 baixado.");
  };

  const filteredPresets = useMemo(() => {
    let result = [...presets];
    if (presetSearch) {
      result = result.filter(p => p.name.toLowerCase().includes(presetSearch.toLowerCase()));
    }
    if (presetSort === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Logic for "recent" depends on if we have updated_at or created_at in the interface
      // Since it's from DB, we can assume alphabetical for now if not present, but usually we have it.
      // @ts-ignore
      result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    return result;
  }, [presets, presetSearch, presetSort]);

  const duplicatePreset = async (preset: any) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("filter_presets")
        .insert({
          user_id: userData.user.id,
          name: `${preset.name} (Cópia)`,
          filters: preset.filters,
          sorting: preset.sorting
        })
        .select()
        .single();

      if (error) throw error;
      setPresets(prev => [...prev, data]);
      toast.success("Preset duplicado!");
    } catch (error) {
      console.error("Error duplicating preset:", error);
      toast.error("Erro ao duplicar preset.");
    }
  };

  const downloadDetailsAsTxt = (ex: SkillExecution) => {
    const content = `
=========================================
DETALHES DA EXECUÇÃO - SKILL HISTORY
=========================================
ID: ${ex.id}
SKILL: ${ex.skill_name} (${ex.skill_slug})
DATA: ${new Date(ex.created_at).toLocaleString()}
STATUS: ${ex.status.toUpperCase()}
CRÉDITOS: ${ex.credits_charged}c
DURAÇÃO: ${ex.duration_ms || 0}ms

${ex.error_message ? `!!! ERRO DE EXECUÇÃO !!!\n${ex.error_message}\n` : ""}

-----------------------------------------
PARÂMETROS DE ENTRADA (INPUT):
-----------------------------------------
${JSON.stringify(ex.input, null, 2)}

-----------------------------------------
RESULTADO GERADO (OUTPUT):
-----------------------------------------
${JSON.stringify(ex.output, null, 2)}
=========================================
    `;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `execution_${ex.id.slice(0, 8)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Keyboard Shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Navigate between executions if modal is open
    if (selectedEx) {
      const currentIndex = executions.findIndex(ex => ex.id === selectedEx.id);
      
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        setSelectedEx(executions[currentIndex - 1]);
        setLogPage(1);
      } else if (e.key === "ArrowRight" && currentIndex < executions.length - 1) {
        setSelectedEx(executions[currentIndex + 1]);
        setLogPage(1);
      } else if (e.key === "Escape") {
        setSelectedEx(null);
      } else if (e.key === "p") {
        // Toggle log pages with 'p'
        const jsonStr = JSON.stringify(selectedEx.output, null, 2);
        const totalLines = jsonStr.split('\n').length;
        if (totalLines > logPageSize) {
          setLogPage(prev => (prev * logPageSize >= totalLines ? 1 : prev + 1));
        }
      }
      return;
    }

    // Open first execution with 'Enter' or 'o' when list is focused (simplified for now)
    if (e.key === "Enter" && executions.length > 0 && !selectedEx) {
      setSelectedEx(executions[0]);
    }
  }, [selectedEx, executions, logPage]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setPage(1);
    fetchExecutions();
  }, [search, statusFilter, skillFilter, dateStart, dateEnd, sortOrder]);

  useEffect(() => {
    fetchExecutions();
  }, [page]);

  async function fetchAvailableSkills() {
    const { data } = await supabase
      .from("skill_executions")
      .select("skill_slug, skill_name")
      .order("skill_name");
    
    if (data) {
      const unique = Array.from(new Set(data.map(s => s.skill_slug))).map(slug => {
        return {
          slug,
          name: data.find(s => s.skill_slug === slug)?.skill_name || slug
        };
      });
      setAvailableSkills(unique);
    }
  }

  async function fetchExecutions() {
    setLoading(true);
    try {
      let query = supabase
        .from("skill_executions")
        .select("*", { count: "exact" });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      if (skillFilter !== "all") {
        query = query.eq("skill_slug", skillFilter);
      }
      
      if (search) {
        query = query.or(`skill_name.ilike.%${search}%,skill_slug.ilike.%${search}%,error_message.ilike.%${search}%`);
      }
      
      if (dateStart) {
        query = query.gte("created_at", new Date(dateStart).toISOString());
      }
      
      if (dateEnd) {
        // Set to end of day
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order("created_at", { ascending: sortOrder === "asc" })
        .range(from, to);

      if (error) throw error;
      setExecutions(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching executions:", error);
      toast.error("Erro ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }

  const handleExport = () => {
    if (executions.length === 0) {
      toast.error("Não há dados para exportar.");
      return;
    }

    const headers = selectedColumns.map(colId => 
      availableColumns.find(c => c.id === colId)?.label || colId
    );

    const dataRows = executions.map(ex => {
      const row: any = {};
      selectedColumns.forEach(colId => {
        const label = availableColumns.find(c => c.id === colId)?.label || colId;
        const val = (ex as any)[colId];
        if (val === null || val === undefined) {
          row[label] = "";
        } else if (typeof val === 'object') {
          row[label] = JSON.stringify(val);
        } else if (colId === 'created_at') {
          row[label] = new Date(val).toLocaleString();
        } else {
          row[label] = val;
        }
      });
      return row;
    });

    if (exportFormat === "csv") {
      const csvContent = [
        headers.join(","),
        ...dataRows.map(row => 
          headers.map(h => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(",")
        )
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `historico_skills_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(dataRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Histórico");
      XLSX.writeFile(workbook, `historico_skills_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    toast.success("Exportação concluída!");
    setIsExportModalOpen(false);
  };



  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Filters & Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Buscar</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Skill ou erro..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/50 h-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 bg-background/50">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="succeeded">Sucesso</SelectItem>
              <SelectItem value="failed">Falha</SelectItem>
              <SelectItem value="processing">Processando</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Habilidade</label>
          <Select value={skillFilter} onValueChange={setSkillFilter}>
            <SelectTrigger className="h-9 bg-background/50">
              <SelectValue placeholder="Skill" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Skills</SelectItem>
              {availableSkills.map(s => (
                <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Datas</label>
            <div className="flex gap-2">
              <Input 
                type="date" 
                value={dateStart} 
                onChange={(e) => setDateStart(e.target.value)}
                className="h-9 bg-background/50 text-[10px] px-2"
              />
              <Input 
                type="date" 
                value={dateEnd} 
                onChange={(e) => setDateEnd(e.target.value)}
                className="h-9 bg-background/50 text-[10px] px-2"
              />
            </div>
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-9 w-9 shrink-0"
            onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
            title="Ordenar por data"
          >
            <ArrowUpDown className={cn("h-4 w-4", sortOrder === "asc" && "text-primary")} />
          </Button>
          <Button 
            variant="secondary" 
            size="icon" 
            className="h-9 w-9 shrink-0"
            onClick={() => setIsExportModalOpen(true)}
            title="Exportar Histórico"
          >
            <FileSpreadsheet className="h-4 w-4" />
          </Button>

          <Popover open={isSavingPreset} onOpenChange={setIsSavingPreset}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Salvar Filtros">
                <Save className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider">Salvar Filtros</h4>
                <Input 
                  placeholder="Nome do preset..." 
                  value={newPresetName} 
                  onChange={e => setNewPresetName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" className="w-full h-8" onClick={savePreset}>Salvar Preset</Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button 
            variant="outline" 
            size="icon" 
            className="h-9 w-9 shrink-0" 
            title="Gerenciar Presets"
            onClick={() => setIsPresetsModalOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>

          {presets.length > 0 && (
            <Select onValueChange={(v) => {
              const p = presets.find(p => p.id === v);
              if (p) applyPreset(p);
            }}>
              <SelectTrigger className="h-9 w-32 bg-background/50">
                <SelectValue placeholder="Presets" />
              </SelectTrigger>
              <SelectContent>
                {presets.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>


      {/* Export Configuration Modal */}
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Configurar Exportação
            </DialogTitle>
            <DialogDescription>
              Selecione o formato e as colunas desejadas.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Formato do Arquivo</label>
              <div className="flex gap-4">
                <Button 
                  variant={exportFormat === "csv" ? "default" : "outline"} 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setExportFormat("csv")}
                >
                  <FileDown className="h-4 w-4 mr-2" /> CSV
                </Button>
                <Button 
                  variant={exportFormat === "xlsx" ? "default" : "outline"} 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setExportFormat("xlsx")}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> XLSX (Excel)
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Colunas</label>
              <div className="grid grid-cols-2 gap-4">
                {availableColumns.map((col) => (
                  <div key={col.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`col-${col.id}`} 
                      checked={selectedColumns.includes(col.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedColumns(prev => [...prev, col.id]);
                        } else {
                          setSelectedColumns(prev => prev.filter(id => id !== col.id));
                        }
                      }}
                    />
                    <label 
                      htmlFor={`col-${col.id}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {col.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="sm:justify-between gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedColumns(availableColumns.map(c => c.id))}
            >
              Selecionar Todas
            </Button>
            <Button type="button" onClick={handleExport} className="min-w-[120px]">
              Baixar Arquivo
            </Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Presets Management Modal */}
      <Dialog open={isPresetsModalOpen} onOpenChange={setIsPresetsModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Gerenciar Presets de Filtros
            </DialogTitle>
            <DialogDescription>
              Organize seus filtros salvos para acesso rápido. {selectedPresetIds.length > 0 && `(${selectedPresetIds.length} selecionados)`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar preset..." 
                  value={presetSearch}
                  onChange={e => setPresetSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <Select value={presetSort} onValueChange={(v: any) => setPresetSort(v)}>
                <SelectTrigger className="h-9 w-32 text-xs">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nome (A-Z)</SelectItem>
                  <SelectItem value="recent">Mais Recentes</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 border-l pl-2">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={downloadTemplate} title="Baixar Template (JSON)">
                  <FileCode className="h-4 w-4 text-sky-400" />
                </Button>
                <Button 
                  variant={selectedPresetIds.length > 0 ? "default" : "outline"} 
                  size="icon" 
                  className="h-9 w-9" 
                  onClick={() => exportPresets(selectedPresetIds.length > 0)} 
                  title={selectedPresetIds.length > 0 ? "Exportar Selecionados" : "Exportar Todos"}
                >
                  <Upload className="h-4 w-4 rotate-180" />
                </Button>
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".json" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={handleImportFileChange}
                    title="Importar Presets (JSON)"
                  />
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Download className="h-4 w-4 rotate-180" />
                  </Button>
                </div>
              </div>
            </div>

            {importHistory.length > 0 && (
              <div className="bg-muted/30 p-2 rounded-lg border border-border/50 max-h-24 overflow-y-auto">
                <h5 className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Histórico de Importação</h5>
                {importHistory.map((h, i) => (
                  <div key={i} className="text-[10px] flex items-center justify-between py-1 border-b last:border-0">
                    <span className={cn(
                      "font-medium",
                      h.status === "success" ? "text-green-500" : h.status === "partial" ? "text-yellow-500" : "text-destructive"
                    )}>{h.message}</span>
                    <span className="opacity-60">{new Date(h.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="py-2 space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
              {filteredPresets.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {presetSearch ? "Nenhum preset encontrado para esta busca." : "Nenhum preset salvo ainda."}
                </p>
              ) : (
                filteredPresets.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 group">
                    <Checkbox 
                      checked={selectedPresetIds.includes(p.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedPresetIds(prev => [...prev, p.id]);
                        else setSelectedPresetIds(prev => prev.filter(id => id !== p.id));
                      }}
                      className="h-4 w-4"
                    />
                    
                    {editingPresetId === p.id ? (
                      <div className="flex-1 flex gap-2">
                        <Input 
                          value={editPresetName} 
                          onChange={e => setEditPresetName(e.target.value)}
                          className="h-8 text-xs"
                          autoFocus
                        />
                        <Button size="icon" className="h-8 w-8" onClick={() => updatePreset(p.id, editPresetName)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingPresetId(null)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <p className="text-sm font-bold">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground opacity-70">
                            {Object.entries(p.filters).filter(([_, v]) => v && v !== 'all').map(([k, v]) => `${k}: ${v}`).join(', ') || 'Sem filtros específicos'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary"
                            onClick={() => applyPreset(p)}
                            title="Aplicar"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => { setEditingPresetId(p.id); setEditPresetName(p.name); }}
                            title="Renomear"
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-sky-400 hover:bg-sky-400/10"
                            onClick={() => duplicatePreset(p)}
                            title="Duplicar"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive opacity-50 hover:opacity-100"
                            onClick={() => setPresetToDelete(p.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Validation & Merge Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-sky-500" />
              Validar Importação
            </DialogTitle>
            <DialogDescription>
              Revise os presets antes de importar para o seu ambiente.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {importValidationResults?.errors && importValidationResults.errors.length > 0 && (
              <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                <h5 className="text-[10px] font-bold text-destructive uppercase mb-2">Campos Inválidos / Erros</h5>
                <ul className="text-[10px] text-destructive/80 space-y-1">
                  {importValidationResults.errors.map((err, i) => <li key={i} className="flex gap-2">• {err}</li>)}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Conflitos de Nome</label>
              <Select value={mergeOption} onValueChange={(v: any) => setMergeOption(v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">Criar novos (adicionar "Importado")</SelectItem>
                  <SelectItem value="merge">Mesclar (atualizar existentes)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Preview ({importValidationResults?.preview?.length || 0})</label>
              <div className="bg-muted/50 p-2 rounded-lg border border-border/50 max-h-32 overflow-y-auto text-[10px] space-y-1">
                {importValidationResults?.preview?.map((p, i) => (
                  <div key={i} className="flex justify-between opacity-80">
                    <span>{p.name}</span>
                    <span className="font-mono text-[8px]">{Object.keys(p.filters).length} filtros</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setIsImportModalOpen(false); setImportValidationResults(null); }}>Cancelar</Button>
            <Button 
              disabled={!importValidationResults?.valid || importValidationResults.preview.length === 0} 
              onClick={executeImport}
            >
              Confirmar Importação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!presetToDelete} onOpenChange={(open) => !open && setPresetToDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este preset? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setPresetToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { if (presetToDelete) { deletePreset(presetToDelete); setPresetToDelete(null); } }}>
              Excluir Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-20">
            <Clock className="w-8 h-8 animate-spin mx-auto text-primary/40 mb-2" />
            <p className="text-sm text-muted-foreground">Carregando execuções...</p>
          </div>
        ) : executions.length === 0 ? (
          <div className="bg-muted/10 border border-dashed rounded-xl py-20 text-center">
            <Info className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma execução encontrada.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              {executions.map((ex) => (
                <Card 
                  key={ex.id} 
                  className="overflow-hidden border-primary/10 hover:border-primary/30 transition-all cursor-pointer group shadow-none hover:shadow-lg hover:shadow-primary/5"
                  onClick={() => setSelectedEx(ex)}
                >
                  <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/5 group-hover:bg-primary/10 transition-colors">
                        <Zap className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-bold font-orbitron">
                            {ex.skill_name || ex.skill_slug}
                          </CardTitle>
                          <Badge variant="outline" className="text-[9px] h-4 py-0 px-1 font-mono opacity-60">
                            {ex.id.slice(0, 8)}
                          </Badge>
                        </div>
                        <CardDescription className="text-[10px] flex items-center gap-2 mt-0.5">
                          <CalendarIcon className="w-3 h-3" />
                          {new Date(ex.created_at).toLocaleString()}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <div className="text-[10px] font-bold text-primary">{ex.credits_charged}c</div>
                        <div className="text-[9px] text-muted-foreground opacity-60">créditos</div>
                      </div>
                      <div className="h-8 w-px bg-border/50 mx-1 hidden sm:block" />
                      {ex.status === "succeeded" || ex.status === "completed" ? (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20 transition-colors">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Sucesso
                        </Badge>
                      ) : ex.status === "failed" ? (
                        <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                          <XCircle className="w-3 h-3 mr-1" /> Falha
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="animate-pulse">
                          <Clock className="w-3 h-3 mr-1" /> {ex.status}
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 pt-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                  Página {page} de {totalPages} ({totalCount} registros)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 px-3"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-8 px-3"
                  >
                    Próximo <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Details Modal */}
      <Dialog open={!!selectedEx} onOpenChange={(open) => { if (!open) { setSelectedEx(null); setLogPage(1); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="font-orbitron text-xl">
                  Detalhes da Execução
                </DialogTitle>
                <DialogDescription className="text-xs uppercase tracking-widest font-bold opacity-60">
                  ID: {selectedEx?.id}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 text-[10px] uppercase font-bold"
                onClick={() => downloadDetailsAsTxt(selectedEx)}
              >
                <Download className="w-3.5 h-3.5" /> Exportar TXT
              </Button>
              <div className="p-1.5 bg-muted/50 rounded-lg" title="Use as setas ← → para navegar e 'P' para alternar páginas de logs">
                <Keyboard className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </DialogHeader>

          {selectedEx && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block mb-1">Status</span>
                  <div className="flex items-center gap-2">
                    {selectedEx.status === "succeeded" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-xs font-bold capitalize">{selectedEx.status}</span>
                  </div>
                </div>
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block mb-1">Créditos</span>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-primary" />
                    <span className="text-xs font-bold">{selectedEx.credits_charged}c</span>
                  </div>
                </div>
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block mb-1">Duração</span>
                  <span className="text-xs font-bold font-mono">{selectedEx.duration_ms || 0}ms</span>
                </div>
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block mb-1">Data</span>
                  <span className="text-[10px] font-bold">{new Date(selectedEx.created_at).toLocaleString()}</span>
                </div>
              </div>

              {selectedEx.error_message && (
                <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-destructive uppercase block mb-2">Erro de Execução</span>
                  <p className="text-sm font-medium text-destructive/90">{selectedEx.error_message}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                      <ArrowUpDown className="w-3 h-3 rotate-90" /> Parâmetros de Entrada
                    </h4>
                  </div>
                  <div className="relative group">
                    <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl border border-white/5 text-[11px] font-mono overflow-auto max-h-64 scrollbar-hide italic">
                      {JSON.stringify(selectedEx.input, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold uppercase text-primary tracking-widest flex items-center gap-2">
                      <Zap className="w-3 h-3" /> Resultado Gerado
                    </h4>
                  </div>
                  <div className={cn(
                    "bg-slate-950 p-4 rounded-xl border border-primary/20 min-h-[100px] overflow-hidden",
                    selectedEx.status === "failed" && "border-destructive/30"
                  )}>
                    {selectedEx.output?.url ? (
                      <div className="flex flex-col items-center justify-center py-6 gap-3">
                        <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none px-4 py-1">
                          Arquivo de Mídia Disponível
                        </Badge>
                        <a 
                          href={selectedEx.output.url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex items-center gap-2 text-sm font-bold text-primary hover:underline bg-primary/10 px-4 py-2 rounded-lg"
                        >
                          <FileDown className="w-4 h-4" />
                          Abrir Link Original
                        </a>
                      </div>
                    ) : (
                      <pre className={cn(
                        "text-[11px] font-mono overflow-auto max-h-96 scrollbar-hide",
                        selectedEx.status === "failed" ? "text-rose-400" : "text-sky-300"
                      )}>
                        {(() => {
                          const jsonStr = JSON.stringify(selectedEx.output, null, 2);
                          const lines = jsonStr.split('\n');
                          const totalLines = lines.length;
                          const visibleLines = lines.slice((logPage - 1) * logPageSize, logPage * logPageSize);
                          return (
                            <>
                              {visibleLines.join('\n')}
                              {totalLines > logPageSize && (
                                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] text-muted-foreground">
                                  <span>Mostrando {visibleLines.length} de {totalLines} linhas</span>
                                  <div className="flex gap-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 text-[10px]" 
                                      disabled={logPage === 1}
                                      onClick={() => setLogPage(p => p - 1)}
                                    >Anterior</Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 text-[10px]" 
                                      disabled={logPage * logPageSize >= totalLines}
                                      onClick={() => setLogPage(p => p + 1)}
                                    >Próximo</Button>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </pre>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
