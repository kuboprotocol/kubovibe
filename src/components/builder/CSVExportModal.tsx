import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Download, AlertTriangle, Check, X, ListFilter } from 'lucide-react';
import { toast } from 'sonner';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PreviewLogEntry {
  id: string;
  ts: number;
  kind: string;
  message: string;
  source?: string;
  line?: number;
  col?: number;
  method?: string;
  status?: number;
  url?: string;
  duration?: number;
  stack?: string;
}

interface CSVExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: PreviewLogEntry[];
}

const ALL_COLUMNS = [
  { id: 'ts', label: 'Timestamp (ms)' },
  { id: 'iso', label: 'Data (ISO)' },
  { id: 'kind', label: 'Tipo' },
  { id: 'message', label: 'Mensagem' },
  { id: 'source', label: 'Fonte' },
  { id: 'line', label: 'Linha' },
  { id: 'col', label: 'Coluna' },
  { id: 'method', label: 'Método' },
  { id: 'status', label: 'Status' },
  { id: 'url', label: 'URL' },
  { id: 'duration', label: 'Duração (ms)' },
  { id: 'stack', label: 'Stack Trace' },
];

const LS_KEY_COLS = 'kubo:audit:export:columns';
const LS_KEY_ORDER = 'kubo:audit:export:order';
const LS_KEY_DATE_FMT = 'kubo:audit:export:dateFmt';

interface SortableItemProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function SortableColumnItem({ id, label, checked, onCheckedChange }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-2 bg-background border rounded-md mb-2 group"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
      </div>
      <Checkbox 
        id={`col-${id}`} 
        checked={checked} 
        onCheckedChange={(v) => onCheckedChange(!!v)} 
      />
      <Label htmlFor={`col-${id}`} className="text-sm font-medium flex-1 cursor-pointer">
        {label}
      </Label>
    </div>
  );
}

export default function CSVExportModal({ open, onOpenChange, logs }: CSVExportModalProps) {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_COLS);
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set(ALL_COLUMNS.map(c => c.id));
  });

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_ORDER);
      if (saved) return JSON.parse(saved);
    } catch {}
    return ALL_COLUMNS.map(c => c.id);
  });

  const [dateFormat, setDateFormat] = useState<'ISO' | 'DD/MM/AAAA'>('ISO');
  const [previewLimit, setPreviewLimit] = useState(5);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    localStorage.setItem(LS_KEY_COLS, JSON.stringify([...selectedColumns]));
    localStorage.setItem(LS_KEY_ORDER, JSON.stringify(columnOrder));
    localStorage.setItem(LS_KEY_DATE_FMT, dateFormat);
  }, [selectedColumns, columnOrder, dateFormat]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSelectAll = () => setSelectedColumns(new Set(ALL_COLUMNS.map(c => c.id)));
  const handleClearAll = () => setSelectedColumns(new Set());

  const csvEscape = (v: unknown): string => {
    if (v === undefined || v === null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  };

  const formatDate = (ts: number) => {
    if (dateFormat === 'ISO') return new Date(ts).toISOString();
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const previewData = useMemo(() => {
    const activeCols = columnOrder.filter(id => selectedColumns.has(id));
    const header = activeCols.map(id => ALL_COLUMNS.find(c => c.id === id)?.label || id);
    
    const rows = logs.slice(0, previewLimit).map(log => {
      return activeCols.map(colId => {
        if (colId === 'iso') return formatDate(log.ts);
        return (log as any)[colId] ?? '';
      });
    });

    return { header, rows };
  }, [logs, selectedColumns, columnOrder, dateFormat, previewLimit]);

  const handleDownload = () => {
    if (logs.length === 0) {
      toast.error('Nenhum registro para exportar');
      return;
    }
    if (selectedColumns.size === 0) {
      toast.error('Selecione pelo menos uma coluna');
      return;
    }

    const activeCols = columnOrder.filter(id => selectedColumns.has(id));
    const header = activeCols.map(id => ALL_COLUMNS.find(c => c.id === id)?.label || id);
    
    const rows = logs.map(log => {
      return activeCols.map(colId => {
        let val = (log as any)[colId] ?? '';
        if (colId === 'iso') val = formatDate(log.ts);
        return csvEscape(val);
      }).join(',');
    });

    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit-log-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Download iniciado!');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> Exportar Log de Auditoria para CSV
          </DialogTitle>
          <DialogDescription>
            Configure as colunas e o formato do arquivo antes de baixar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden min-h-0">
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Colunas e Ordem</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={handleSelectAll}>Selecionar Tudo</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={handleClearAll}>Limpar</Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 pr-4">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={columnOrder}
                  strategy={verticalListSortingStrategy}
                >
                  {columnOrder.map((id) => (
                    <SortableColumnItem 
                      key={id} 
                      id={id} 
                      label={ALL_COLUMNS.find(c => c.id === id)?.label || id}
                      checked={selectedColumns.has(id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedColumns);
                        if (checked) next.add(id); else next.delete(id);
                        setSelectedColumns(next);
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </ScrollArea>
          </div>

          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Configurações e Pré-visualização</Label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Data:</span>
                <Select value={dateFormat} onValueChange={(v: any) => setDateFormat(v)}>
                  <SelectTrigger className="h-7 w-28 text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ISO">ISO 8601</SelectItem>
                    <SelectItem value="DD/MM/AAAA">Brasileiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 overflow-hidden border rounded-lg bg-muted/20 flex flex-col">
              <div className="p-2 border-b bg-muted/40 flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <ListFilter className="h-3 w-3" /> Visualizando {Math.min(previewLimit, logs.length)} de {logs.length} linhas
                </span>
                {logs.length > previewLimit && (
                  <Button variant="ghost" size="sm" className="h-6 text-[9px]" onClick={() => setPreviewLimit(prev => prev + 5)}>
                    Carregar Mais
                  </Button>
                )}
              </div>
              <div className="flex-1 overflow-auto p-0">
                <table className="w-full text-[10px] border-collapse">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr>
                      {previewData.header.map((h, i) => (
                        <th key={i} className="px-2 py-1.5 text-left border-b font-bold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={previewData.header.length || 1} className="p-8 text-center italic text-muted-foreground">
                          Nenhuma coluna selecionada ou nenhum registro encontrado.
                        </td>
                      </tr>
                    ) : (
                      previewData.rows.map((row, ri) => (
                        <tr key={ri} className="border-b last:border-0 hover:bg-muted/30">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={String(cell)}>
                              {String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {logs.length === 0 && (
              <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-600 text-[11px] animate-pulse">
                <AlertTriangle className="h-4 w-4" />
                <span>Aviso: 0 registros encontrados com os filtros atuais.</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 pt-4 border-t mt-4">
          <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground">
            {logs.length > 0 && <Check className="h-3 w-3 text-emerald-500" />}
            {logs.length} registros prontos para exportação
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleDownload} disabled={logs.length === 0 || selectedColumns.size === 0}>
            <Download className="h-4 w-4 mr-2" /> Confirmar Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
