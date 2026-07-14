import { useEffect, useRef, useState, useCallback } from 'react'
import { Maximize2, Minimize2, Camera, RotateCw, Lock, ZoomIn, ZoomOut, Loader2, AlertTriangle, FileCode2 } from 'lucide-react'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const loadTimeoutRef = useRef<number | null>(null)

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
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh} title="Recarregar">
          <RotateCw className="h-3 w-3" />
        </Button>
        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/60 border border-border/50 text-[11px] font-mono text-muted-foreground truncate">
          <Lock className="h-3 w-3 text-emerald-500 shrink-0" />
          <span className="truncate">{displayUrl}</span>
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
              key={previewKey}
              srcDoc={wrapPreviewHtml(generatedCode || '', { previewId })}
              className="w-full h-full border-0 block"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              title="App Preview"
              style={{
                backgroundColor: '#ffffff',
                ...(isDesktop ? {} : { borderRadius: '12px' }),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
