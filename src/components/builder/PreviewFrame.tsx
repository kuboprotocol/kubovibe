import { useEffect, useRef, useState, useCallback } from 'react'
import { Maximize2, Minimize2, Camera, RotateCw, Lock, ZoomIn, ZoomOut, Loader2, AlertTriangle, FileCode2, CheckCircle2, Snowflake, FileDown, GitCommit, History, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'
import { wrapPreviewHtml } from '@/lib/iframePreview'
import * as htmlToImage from 'html-to-image'
import type { DeviceFrame } from './BuilderToolbar'

const DEVICE_SIZES: Record<DeviceFrame, { w: number; h: number }> = {
  desktop: { w: 1440, h: 900 },
  tablet: { w: 768, h: 1024 },
  mobile: { w: 390, h: 844 },
}

const LS_KEY = 'kubo:previewSettings:v1'

interface PersistedSettings {
  zoom: number
  autoFit: boolean
}

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { zoom: 1, autoFit: true, ...JSON.parse(raw) }
  } catch {}
  return { zoom: 1, autoFit: true }
}

function saveSettings(s: PersistedSettings) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {}
}

function formatRelative(d: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (s < 5) return 'agora'
  if (s < 60) return `há ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60)
  return `há ${h}h`
}


interface PreviewFrameProps {
  generatedCode: string
  deviceFrame: DeviceFrame
  landscape: boolean
  previewKey: number
  previewId?: string
  onRefresh: () => void
  publishedUrl?: string | null
  projectTitle?: string
}

export default function PreviewFrame({
  generatedCode, deviceFrame, landscape, previewKey, onRefresh,
  previewId,
  publishedUrl, projectTitle,
}: PreviewFrameProps) {
  const initial = loadSettings()
  const [zoom, setZoom] = useState<number>(initial.zoom)
  const [autoFit, setAutoFit] = useState<boolean>(initial.autoFit)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [shooting, setShooting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [updatedFlash, setUpdatedFlash] = useState(false)
  const [canvasVersion, setCanvasVersion] = useState(0)
  const [renderedVersion, setRenderedVersion] = useState(0)
  const [frozen, setFrozen] = useState(false)
  const [lastRenderedAt, setLastRenderedAt] = useState<Date | null>(null)
  const [, forceTick] = useState(0)
  const [pinnedSnapshot, setPinnedSnapshot] = useState<{ id: string; code: string; ts: number } | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<Array<{ id: string; code: string; ts: number; version: number }>>(() => {
    try {
      const raw = localStorage.getItem('kubo:previewHistory:v1')
      if (raw) return JSON.parse(raw)
    } catch {}
    return []
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const loadTimeoutRef = useRef<number | null>(null)
  const reloadDebounceRef = useRef<number | null>(null)
  const lastReloadAtRef = useRef<number>(0)
  const flashTimerRef = useRef<number | null>(null)
  const heartbeatRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)

  // When a historical snapshot is pinned, the iframe renders that code instead of live
  const effectiveCode = pinnedSnapshot ? pinnedSnapshot.code : generatedCode
  const isViewingHistory = !!pinnedSnapshot

  // Short deterministic hash of the currently displayed code (snapshot id)
  const snapshotId = (() => {
    const s = effectiveCode || ''
    let h = 5381
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
    return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8)
  })()
  const inSync = !isViewingHistory && status === 'ready' && renderedVersion >= canvasVersion && !frozen

  const isDesktop = deviceFrame === 'desktop'
  const base = DEVICE_SIZES[deviceFrame]
  const w = landscape && !isDesktop ? base.h : base.w
  const h = landscape && !isDesktop ? base.w : base.h

  // Persist settings
  useEffect(() => { saveSettings({ zoom, autoFit }) }, [zoom, autoFit])

  // Auto-fit zoom to container
  useEffect(() => {
    if (!autoFit || isDesktop) return
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      const padding = 80
      const availW = el.clientWidth - padding
      const availH = el.clientHeight - padding
      const fit = Math.min(availW / w, availH / h, 1)
      setZoom(Math.max(0.25, Math.min(1, +fit.toFixed(2))))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [autoFit, w, h, isDesktop])

  // Track fullscreen state
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Track iframe load lifecycle: loading spinner, timeout error, runtime errors
  useEffect(() => {
    if (!effectiveCode || !effectiveCode.trim()) {
      setStatus('idle')
      setErrorMsg(null)
      setErrorDetail(null)
      return
    }
    setStatus('loading')
    setErrorMsg(null)
    setErrorDetail(null)
    const iframe = iframeRef.current
    if (!iframe) return

    const clearTimer = () => {
      if (loadTimeoutRef.current) {
        window.clearTimeout(loadTimeoutRef.current)
        loadTimeoutRef.current = null
      }
    }

    const triggerUpdatedFlash = () => {
      setUpdatedFlash(true)
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setUpdatedFlash(false), 1800)
    }

    const onLoad = () => {
      clearTimer()
      setStatus('ready')
      setFrozen(false)
      setRenderedVersion(canvasVersion)
      setLastRenderedAt(new Date())
      triggerUpdatedFlash()
      // Push into history only when rendering LIVE code (not when browsing history)
      if (!isViewingHistory) {
        setHistory((prev) => {
          if (prev[0]?.id === snapshotId) return prev
          const next = [
            { id: snapshotId, code: effectiveCode, ts: Date.now(), version: canvasVersion },
            ...prev,
          ].slice(0, 10)
          try { localStorage.setItem('kubo:previewHistory:v1', JSON.stringify(next)) } catch {}
          return next
        })
      }
      // Freeze/hang detection via rAF heartbeat (best-effort, same-origin only)
      try {
        const win = iframe.contentWindow as any
        if (win && typeof win.requestAnimationFrame === 'function') {
          lastTickRef.current = Date.now()
          if (heartbeatRef.current) window.clearInterval(heartbeatRef.current)
          heartbeatRef.current = window.setInterval(() => {
            try {
              win.requestAnimationFrame(() => { lastTickRef.current = Date.now() })
            } catch {}
            const gap = Date.now() - lastTickRef.current
            setFrozen(gap > 5000)
          }, 2000)
        }
      } catch {}
      // Hook runtime errors inside iframe
      try {
        const win = iframe.contentWindow
        if (win) {
          win.addEventListener('error', (ev: ErrorEvent) => {
            setStatus('error')
            setErrorMsg(ev.message || 'Runtime error')
            setErrorDetail(
              [ev.filename, ev.lineno && `line ${ev.lineno}`, ev.colno && `col ${ev.colno}`]
                .filter(Boolean).join(' · ') || null,
            )
          })
          win.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
            setStatus('error')
            const reason: any = (ev as any).reason
            setErrorMsg(String(reason?.message || reason || 'Promise rejected'))
            setErrorDetail(reason?.stack ? String(reason.stack).split('\n')[1]?.trim() || null : null)
          })
        }
      } catch (e: any) {
        // Cross-origin — non-fatal
        console.debug('[Preview] cannot attach iframe listeners:', e?.message)
      }
    }
    const onError = (ev: Event) => {
      clearTimer()
      setStatus('error')
      setErrorMsg('Failed to load preview')
      setErrorDetail((ev as any)?.message || 'Network or sandbox error')
    }

    iframe.addEventListener('load', onLoad)
    iframe.addEventListener('error', onError)
    loadTimeoutRef.current = window.setTimeout(() => {
      setStatus((s) => (s === 'loading' ? 'error' : s))
      setErrorMsg((m) => m || 'Load timeout')
      setErrorDetail((d) => d || 'Preview took longer than 15s to load')
    }, 15000)

    return () => {
      clearTimer()
      if (heartbeatRef.current) { window.clearInterval(heartbeatRef.current); heartbeatRef.current = null }
      iframe.removeEventListener('load', onLoad)
      iframe.removeEventListener('error', onError)
    }
  }, [effectiveCode, previewKey, reloadNonce, canvasVersion, isViewingHistory, snapshotId])

  // Manual reprocess — remount iframe + notify parent. Enforces a 1.2s cooldown
  // to prevent excessive re-renders (spam-click, held shortcut, etc.).
  const REPROCESS_COOLDOWN_MS = 1200
  const reprocess = useCallback(() => {
    const since = Date.now() - lastReloadAtRef.current
    if (since < REPROCESS_COOLDOWN_MS) {
      const wait = Math.ceil((REPROCESS_COOLDOWN_MS - since) / 100) / 10
      toast('Aguarde para reprocessar', { description: `Cooldown ativo (${wait}s)` })
      return
    }
    lastReloadAtRef.current = Date.now()
    setReloadNonce((n) => n + 1)
    onRefresh()
  }, [onRefresh])

  // Keyboard shortcut: Ctrl/Cmd + Shift + R → reprocessar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        reprocess()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reprocess])

  // Tick every 10s to refresh the relative "há Xs" label
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 10000)
    return () => window.clearInterval(id)
  }, [])

  // Auto-reload on external canvas/save events, throttled + debounced
  useEffect(() => {
    const schedule = () => {
      setCanvasVersion((v) => v + 1)
      if (reloadDebounceRef.current) window.clearTimeout(reloadDebounceRef.current)
      reloadDebounceRef.current = window.setTimeout(() => {
        if (Date.now() - lastReloadAtRef.current < 1000) return
        lastReloadAtRef.current = Date.now()
        setReloadNonce((n) => n + 1)
      }, 400)
    }
    window.addEventListener('kubo:canvas:updated', schedule)
    window.addEventListener('kubo:canvas:saved', schedule)
    window.addEventListener('kubo:preview:reload', schedule)
    return () => {
      if (reloadDebounceRef.current) window.clearTimeout(reloadDebounceRef.current)
      window.removeEventListener('kubo:canvas:updated', schedule)
      window.removeEventListener('kubo:canvas:saved', schedule)
      window.removeEventListener('kubo:preview:reload', schedule)
    }
  }, [])

  // Bump canvas version whenever the code prop changes externally
  useEffect(() => { setCanvasVersion((v) => v + 1) }, [generatedCode])

  useEffect(() => () => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current)
  }, [])

  // Build & download an error report as JSON
  const exportErrorReport = useCallback(() => {
    const report = {
      generatedAt: new Date().toISOString(),
      snapshotId,
      canvasVersion,
      renderedVersion,
      inSync,
      frozen,
      status,
      errorMsg,
      errorDetail,
      device: deviceFrame,
      landscape,
      viewport: { w, h },
      previewId: previewId || null,
      projectTitle: projectTitle || null,
      publishedUrl: publishedUrl || null,
      userAgent: navigator.userAgent,
      pageUrl: window.location.href,
      codeLength: (generatedCode || '').length,
      codeExcerpt: (generatedCode || '').slice(0, 2000),
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `preview-error-${snapshotId}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Relatório de erro exportado')
  }, [snapshotId, canvasVersion, renderedVersion, inSync, frozen, status, errorMsg, errorDetail, deviceFrame, landscape, w, h, previewId, projectTitle, publishedUrl, generatedCode])


  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) await el.requestFullscreen()
      else await document.exitFullscreen()
    } catch (e) {
      toast.error('Não foi possível entrar em tela cheia')
    }
  }, [])

  const captureDataUrl = useCallback(async (): Promise<string | null> => {
    const iframe = iframeRef.current
    if (!iframe) return null
    const doc = iframe.contentDocument
    const body = doc?.documentElement
    if (!doc || !body) return null
    return await htmlToImage.toPng(body as unknown as HTMLElement, {
      width: w, height: h, pixelRatio: 2, backgroundColor: '#ffffff',
    })
  }, [w, h])

  const takeScreenshot = useCallback(async (opts: { silent?: boolean; suffix?: string; download?: boolean } = {}) => {
    setShooting(true)
    try {
      const dataUrl = await captureDataUrl()
      if (!dataUrl) throw new Error('Sem acesso ao iframe')
      if (opts.download !== false) {
        const a = document.createElement('a')
        const slug = (projectTitle || 'preview').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'preview'
        const suffix = opts.suffix ? `-${opts.suffix}` : ''
        a.download = `${slug}-${deviceFrame}-${w}x${h}${suffix}.png`
        a.href = dataUrl
        a.click()
      }
      if (!opts.silent) toast.success('Screenshot salva')
      else if (opts.download !== false) toast('Auto-screenshot capturada', { description: opts.suffix })
      return dataUrl
    } catch (e: any) {
      if (!opts.silent) toast.error('Falha ao capturar: ' + (e?.message || 'erro'))
      return null
    } finally {
      setShooting(false)
    }
  }, [captureDataUrl, deviceFrame, projectTitle, w, h])

  // Listen for auto-screenshot requests from the audit panel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      takeScreenshot({ silent: true, suffix: 'auto-error' + (detail.reason ? '-' + String(detail.reason).slice(0,30).replace(/[^a-z0-9]+/gi,'-') : '') })
    }
    window.addEventListener('kubo:preview:auto-screenshot', handler as EventListener)
    return () => window.removeEventListener('kubo:preview:auto-screenshot', handler as EventListener)
  }, [takeScreenshot])

  // Expose capture API for bundle export
  useEffect(() => {
    ;(window as any).__kuboCapturePreview = async () => {
      const url = await captureDataUrl()
      return url ? { dataUrl: url, width: w, height: h, device: deviceFrame } : null
    }
    return () => { try { delete (window as any).__kuboCapturePreview } catch {} }
  }, [captureDataUrl, w, h, deviceFrame])

  const displayUrl = publishedUrl || (typeof window !== 'undefined'
    ? `${window.location.origin}/builder-preview`
    : '/builder-preview')

  return (
    <div ref={containerRef} className="absolute inset-0 flex flex-col bg-muted overflow-hidden">
      {/* Fixed address bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-card/95 backdrop-blur border-b border-border shrink-0 z-10">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={reprocess}
          title="Reprocessar prévia (Ctrl/Cmd+Shift+R)"
        >
          <RotateCw className={`h-3 w-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
        </Button>
        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/60 border border-border/50 text-[11px] font-mono text-muted-foreground truncate">
          <Lock className="h-3 w-3 text-emerald-500 shrink-0" />
          <span className="truncate">{displayUrl}</span>

          {/* Snapshot id + version */}
          <span
            className="ml-2 flex items-center gap-1 text-[10px] text-muted-foreground/80 shrink-0"
            title={`Snapshot ${snapshotId} · canvas v${canvasVersion} · rendered v${renderedVersion}`}
          >
            <GitCommit className="h-3 w-3" />
            <span>#{snapshotId}</span>
            <span className="opacity-60">v{renderedVersion}/{canvasVersion}</span>
          </span>

          {/* Live status pill */}
          {status === 'loading' && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-primary shrink-0">
              <Loader2 className="h-3 w-3 animate-spin" /> loading
            </span>
          )}
          {status === 'ready' && frozen && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-500 shrink-0">
              <Snowflake className="h-3 w-3" /> travado
            </span>
          )}
          {status === 'ready' && !frozen && inSync && (
            <span className={`ml-auto flex items-center gap-1 text-[10px] text-emerald-500 shrink-0 ${updatedFlash ? 'animate-in fade-in slide-in-from-right-2' : ''}`}>
              <CheckCircle2 className="h-3 w-3" /> em sincronia
            </span>
          )}
          {status === 'ready' && !frozen && !inSync && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-500 shrink-0">
              <AlertTriangle className="h-3 w-3" /> desatualizada
            </span>
          )}
          {status === 'error' && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-destructive shrink-0">
              <AlertTriangle className="h-3 w-3" /> erro
            </span>
          )}

          {/* Last completed render timestamp */}
          {lastRenderedAt && (
            <span
              className="ml-2 text-[10px] text-muted-foreground/70 shrink-0 tabular-nums"
              title={`Último render concluído em ${lastRenderedAt.toLocaleString()}`}
            >
              · {lastRenderedAt.toLocaleTimeString()} ({formatRelative(lastRenderedAt)})
            </span>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/60 border border-border/50">
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => { setAutoFit(false); setZoom(z => Math.max(0.25, +(z - 0.1).toFixed(2))) }}
            title="Diminuir zoom"
          >
            <ZoomOut className="h-3 w-3" />
          </button>
          <div className="w-24">
            <Slider
              value={[Math.round(zoom * 100)]}
              min={25} max={200} step={5}
              onValueChange={(v) => { setAutoFit(false); setZoom(v[0] / 100) }}
            />
          </div>
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => { setAutoFit(false); setZoom(z => Math.min(2, +(z + 0.1).toFixed(2))) }}
            title="Aumentar zoom"
          >
            <ZoomIn className="h-3 w-3" />
          </button>
          <span className="text-[10px] font-mono text-muted-foreground w-9 text-right">{Math.round(zoom * 100)}%</span>
          <button
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${autoFit ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setAutoFit(a => !a)}
            title="Ajustar automaticamente"
          >
            Fit
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1.5 px-2 text-[10px] font-medium"
          onClick={reprocess}
          disabled={status === 'loading' || !generatedCode}
          title="Reprocessar prévia com o último snapshot"
        >
          <RotateCw className={`h-3 w-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
          Reprocessar
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => takeScreenshot()} disabled={shooting || !generatedCode} title="Capturar screenshot">
          <Camera className={`h-3 w-3 ${shooting ? 'animate-pulse' : ''}`} />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleFullscreen} title={isFullscreen ? 'Sair de tela cheia' : 'Tela cheia'}>
          {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        </Button>
      </div>

      {/* Stage */}
      <div ref={stageRef} className="flex-1 overflow-auto flex items-start justify-center p-6">
        <div
          style={{
            width: isDesktop ? '100%' : `${w}px`,
            height: isDesktop ? '100%' : `${h}px`,
            transform: isDesktop ? undefined : `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 120ms ease-out',
          }}
          className="relative"
        >
          {!isDesktop && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-background/80 backdrop-blur border border-border text-[10px] font-mono text-muted-foreground z-10 whitespace-nowrap">
              {w}×{h} · {Math.round(zoom * 100)}%
            </div>
          )}
          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              backgroundColor: '#ffffff', // always keep the preview surface white — avoids perceived "black screen" in dark theme
              ...(isDesktop ? {} : {
                border: '8px solid hsl(var(--border))',
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }),
            }}
          >
            <iframe
              ref={iframeRef}
              key={`${previewKey}-${reloadNonce}`}
              srcDoc={wrapPreviewHtml(effectiveCode || '', { previewId })}
              className="w-full h-full border-0 block"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              title="App Preview"
              style={{
                backgroundColor: '#ffffff',
                ...(isDesktop ? {} : { borderRadius: '12px' }),
              }}
            />

            {/* Empty state */}
            {status === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 text-center p-6">
                <FileCode2 className="h-10 w-10 text-muted-foreground/60" />
                <div className="text-sm font-medium text-foreground">Nenhuma prévia ainda</div>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Gere ou cole código no builder para ver o resultado aqui.
                </p>
              </div>
            )}

            {/* Loading state */}
            {status === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <div className="text-xs font-medium text-muted-foreground">Carregando prévia…</div>
              </div>
            )}

            {/* Error state */}
            {status === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 text-center p-6">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div className="text-sm font-semibold text-foreground">Falha ao carregar a prévia</div>
                <p className="text-xs text-muted-foreground max-w-sm break-words">
                  {errorMsg || 'Ocorreu um erro inesperado ao renderizar o preview.'}
                </p>
                {errorDetail && (
                  <code className="text-[10px] font-mono text-muted-foreground/80 bg-muted/60 px-2 py-1 rounded max-w-sm truncate" title={errorDetail}>
                    {errorDetail}
                  </code>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
                  <Button size="sm" variant="outline" onClick={reprocess} className="gap-2">
                    <RotateCw className="h-3 w-3" /> Tentar novamente
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const payload = `[${snapshotId} v${renderedVersion}/${canvasVersion}] ${errorMsg || ''}${errorDetail ? '\n' + errorDetail : ''}`
                      navigator.clipboard.writeText(payload).then(() => toast.success('Erro copiado'))
                    }}
                    className="text-xs"
                  >
                    Copiar erro
                  </Button>
                  <Button size="sm" variant="ghost" onClick={exportErrorReport} className="text-xs gap-1.5">
                    <FileDown className="h-3 w-3" /> Exportar relatório
                  </Button>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground/60 mt-1">
                  snapshot #{snapshotId} · v{renderedVersion}/{canvasVersion}
                </div>
              </div>
            )}

            {/* Frozen / hang overlay (non-blocking) */}
            {status === 'ready' && frozen && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 backdrop-blur text-[11px] font-medium text-amber-600 dark:text-amber-400 shadow-lg z-20">
                <Snowflake className="h-3.5 w-3.5" />
                Iframe travado — sem frames há mais de 5s
                <button
                  onClick={reprocess}
                  className="ml-1 underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300"
                >
                  reprocessar
                </button>
                <button
                  onClick={exportErrorReport}
                  className="underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300"
                >
                  exportar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
