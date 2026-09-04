import { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Send, Eye, Loader2, Copy, Check, Code, Film } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { streamChat, streamClone, type Msg } from '@/lib/streamChat'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import TemplateGallery, { type Template } from '@/components/builder/TemplateGallery'
import PromptAttachMenu from '@/components/landing/PromptAttachMenu'
import BuilderToolbar, { type DeviceFrame } from '@/components/builder/BuilderToolbar'
import CloneDialog from '@/components/builder/CloneDialog'
import AILoadingAnimation, { detectLanguage } from '@/components/builder/AILoadingAnimation'
import FilePreview from '@/components/builder/FilePreview'
import KuboFlowSelector, { autoDetectMode, type KuboFlowMode } from '@/components/builder/KuboFlowSelector'
import { uploadFile, validateFile, getAllAllowedTypes, type UploadedFile } from '@/lib/fileUpload'
import { Progress } from '@/components/ui/progress'
import logoImg from '@/assets/logo-kubovibe-3d.png'
import { subscribePreviewLogs, type PreviewLogEntry } from '@/lib/iframePreview'
import PreviewAuditPanel from '@/components/builder/PreviewAuditPanel'
import PreviewFrame from '@/components/builder/PreviewFrame'
import RunwayDialog from '@/components/runway/RunwayDialog'



const DEVICE_LS_KEY = 'kubo:previewDevice:v1'
function loadDevicePref(): { frame: DeviceFrame; landscape: boolean } {
  try {
    const raw = localStorage.getItem(DEVICE_LS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (p && typeof p === 'object') return { frame: p.frame || 'desktop', landscape: !!p.landscape }
    }
  } catch {}
  return { frame: 'desktop', landscape: false }
}

const BuilderPage = forwardRef<HTMLDivElement, any>((props, ref) => {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId?: string }>()
  const location = useLocation()
  const { user } = useAuth()
  const { subscription, canEdit, editsRemaining, incrementEdit } = useSubscription()
  const initialPrompt = (location.state as any)?.initialPrompt as string | undefined

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')
  const [copied, setCopied] = useState(false)
  const [projectTitle, setProjectTitle] = useState('Untitled Project')
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(projectId || null)
  const [saving, setSaving] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [showRunway, setShowRunway] = useState(false)
  const [isCloning, setIsCloning] = useState(false)
  const _devicePref = loadDevicePref()
  const [deviceFrame, setDeviceFrame] = useState<DeviceFrame>(_devicePref.frame)
  const [landscape, setLandscape] = useState(_devicePref.landscape)
  useEffect(() => {
    try { localStorage.setItem(DEVICE_LS_KEY, JSON.stringify({ frame: deviceFrame, landscape })) } catch {}
  }, [deviceFrame, landscape])
  const [previewLogs, setPreviewLogs] = useState<PreviewLogEntry[]>([])
  const [previewKey, setPreviewKey] = useState(0)
  const previewId = `builder:${currentProjectId ?? 'draft'}`
  // Subscribe to runtime errors / console messages from the iframe
  useEffect(() => {
    return subscribePreviewLogs((entry) => {
      setPreviewLogs((prev) => {
        const next = [...prev, entry]
        return next.length > 500 ? next.slice(-500) : next
      })
    }, { previewId })
  }, [previewId])
  // Reset logs whenever the preview is reloaded or the code changes
  useEffect(() => { setPreviewLogs([]) }, [previewKey, currentProjectId])
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([])
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [isPublished, setIsPublished] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [flowMode, setFlowMode] = useState<KuboFlowMode>('flow')
  const [autoDetectedMode, setAutoDetectedMode] = useState(false)
  const manualModeRef = useRef(false)

  const userPlan = subscription?.plan || 'free'

  // Auto-detect mode as user types (unless manually overridden)
  // Clamp to highest allowed mode for current plan
  useEffect(() => {
    if (manualModeRef.current || !input.trim()) return
    let detected = autoDetectMode(input)
    const plan = userPlan.toLowerCase()
    // Downgrade if locked
    if (detected === 'ship' && !['ultra'].includes(plan)) detected = ['pro', 'starter'].includes(plan) ? 'think' : 'flow'
    if (detected === 'think' && !['pro', 'ultra', 'starter'].includes(plan)) detected = 'flow'
    if (detected !== flowMode) {
      setFlowMode(detected)
      setAutoDetectedMode(true)
    }
  }, [input])

  const handleModeChange = (mode: KuboFlowMode) => {
    manualModeRef.current = true
    setAutoDetectedMode(false)
    setFlowMode(mode)
    // Reset manual flag after 10s so auto-detect resumes
    setTimeout(() => { manualModeRef.current = false }, 10000)
  }

  const handleFileUpload = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) { toast.error(validationError); return }
    if (!user) { toast.error('Please log in first'); return }
    try {
      setUploadProgress(0)
      const uploaded = await uploadFile(file, user.id, setUploadProgress)
      setAttachedFiles(prev => [...prev, uploaded])
      const fmt = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      if (uploaded.originalSize > uploaded.size) {
        const saved = Math.round((1 - uploaded.size / uploaded.originalSize) * 100)
        toast.success(`"${file.name}" uploaded!`, {
          description: `${fmt(uploaded.originalSize)} → ${fmt(uploaded.size)} (${saved}% smaller)`,
        })
      } else {
        toast.success(`"${file.name}" uploaded!`)
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload error')
    } finally {
      setUploadProgress(null)
    }
  }, [user])

  // Minimum loading duration: 8 seconds (reduced from 95s — users were
  // seeing a "black screen" because the overlay sat on top of the empty
  // preview long after generation completed). The Ready CTA inside the
  // animation lets users skip immediately when generation finishes early.
  const MIN_LOADING_MS = 8_000
  const loadingStartRef = useRef<number>(0)
  const [showLoading, setShowLoading] = useState(false)
  const generationDoneRef = useRef(false)
  const pendingSaveRef = useRef<(() => void) | null>(null)
  const pendingPreviewHtmlRef = useRef('')

  const queuePreviewHtml = useCallback((html: string) => {
    if (!html.includes('<')) return
    pendingPreviewHtmlRef.current = html
  }, [])

  const flushPreviewHtml = useCallback(() => {
    const nextHtml = pendingPreviewHtmlRef.current
    if (!nextHtml || nextHtml === generatedCode) return
    setGeneratedCode(nextHtml)
  }, [generatedCode])

  // Detect chat language from user messages
  const chatLanguage = useMemo(() => {
    const userMessages = messages.filter(m => m.role === 'user')
    if (userMessages.length === 0) return 'pt'
    const lastMsg = userMessages[userMessages.length - 1].content
    return detectLanguage(lastMsg)
  }, [messages])

  // When isLoading becomes true, start the minimum timer
  useEffect(() => {
    if (isLoading && !showLoading) {
      loadingStartRef.current = Date.now()
      generationDoneRef.current = false
      pendingSaveRef.current = null
      pendingPreviewHtmlRef.current = ''
      setShowLoading(true)
    }
    if (!isLoading && showLoading) {
      generationDoneRef.current = true
      const elapsed = Date.now() - loadingStartRef.current
      const remaining = MIN_LOADING_MS - elapsed
      if (remaining > 0) {
        const timeout = setTimeout(() => {
          flushPreviewHtml()
          setShowLoading(false)
          pendingSaveRef.current?.()
          pendingSaveRef.current = null
        }, remaining)
        return () => clearTimeout(timeout)
      } else {
        flushPreviewHtml()
        setShowLoading(false)
        pendingSaveRef.current?.()
        pendingSaveRef.current = null
      }
    }
  }, [flushPreviewHtml, isLoading, showLoading])

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (projectId) loadProject(projectId)
  }, [projectId])

  const hasSentInitialPrompt = useRef(false)
  useEffect(() => {
    if (initialPrompt && !hasSentInitialPrompt.current && !projectId && user) {
      hasSentInitialPrompt.current = true
      setInput(initialPrompt)
      setTimeout(() => {
        const userMsg: Msg = { role: 'user', content: initialPrompt }
        setMessages([userMsg])
        setIsLoading(true)
        let assistantSoFar = ''
        let finalMessages = [userMsg]

        const upsertAssistant = (chunk: string) => {
          assistantSoFar += chunk
          setMessages(prev => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const updated = prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m))
              finalMessages = updated; return updated
            }
            const updated = [...prev, { role: 'assistant' as const, content: assistantSoFar }]
            finalMessages = updated; return updated
          })
          const html = extractHtml(assistantSoFar)
          queuePreviewHtml(html)
        }

        const detectedMode = autoDetectMode(initialPrompt)
        setFlowMode(detectedMode)

        streamChat({
          messages: [userMsg],
          mode: detectedMode,
          onDelta: (chunk) => upsertAssistant(chunk),
          onDone: () => { const html = extractHtml(assistantSoFar); queuePreviewHtml(html); setIsLoading(false); if (html.includes('<')) saveProject(html, finalMessages) },
          onError: (error) => { toast.error(error); setIsLoading(false) },
        }).catch((e) => { console.error(e); toast.error('Failed to generate'); setIsLoading(false) })

        setInput('')
      }, 100)
    }
  }, [initialPrompt, projectId, user])

  const loadProject = async (id: string) => {
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
    if (error || !data) { toast.error('Project not found'); navigate('/dashboard'); return }
    setProjectTitle(data.title)
    setGeneratedCode(data.generated_code || '')
    setMessages((data.messages as Msg[]) || [])
    setCurrentProjectId(id)
    setIsPublished((data as any).is_published || false)
    setPublishedUrl((data as any).published_url || null)
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const extractHtml = useCallback((text: string): string => {
    const fenceMatch = text.match(/```html?\s*\n?([\s\S]*?)```/)
    if (fenceMatch) return fenceMatch[1].trim()
    const htmlMatch = text.match(/(<!DOCTYPE[\s\S]*<\/html>)/i)
    if (htmlMatch) return htmlMatch[1]
    return text
  }, [])

  const saveProject = async (code: string, msgs: Msg[]) => {
    if (!user) return
    setSaving(true)
    const firstUserMsg = msgs.find(m => m.role === 'user')
    const title = firstUserMsg ? firstUserMsg.content.slice(0, 60) : 'Untitled Project'
    try {
      if (currentProjectId) {
        const { error } = await supabase.from('projects').update({ title, generated_code: code, messages: msgs as any, updated_at: new Date().toISOString() }).eq('id', currentProjectId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('projects').insert({ user_id: user.id, title, generated_code: code, messages: msgs as any }).select('id').single()
        if (error) throw error
        setCurrentProjectId(data.id)
        window.history.replaceState(null, '', `/builder/${data.id}`)
      }
      setProjectTitle(title)
      toast.success('Project saved!')
    } catch (err: any) { toast.error('Error saving: ' + (err.message || 'unknown')) }
    finally { setSaving(false) }
  }

  const send = async () => {
    if (!input.trim() || isLoading) return
    if (!subscription?.is_active) {
      toast.error('You need an active plan to edit.', {
        action: { label: 'View plans', onClick: () => navigate('/pricing') },
      })
      return
    }
    if (!canEdit) {
      toast('Your 20 edits are used up! 🔄', {
        description: 'Reload whenever you want to keep creating.',
        action: { label: 'Reload', onClick: () => navigate('/pricing') },
      })
      return
    }
    await incrementEdit()
    // Build content with attached file URLs
    let content = input
    if (attachedFiles.length > 0) {
      const fileRefs = attachedFiles.map(f => `[${f.category}: ${f.name}](${f.url})`).join('\n')
      content = `${input}\n\nAttached files:\n${fileRefs}`
    }
    const userMsg: Msg = { role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages); setInput(''); setAttachedFiles([]); setIsLoading(true)
    let assistantSoFar = ''
    let finalMessages = newMessages

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant') {
          const updated = prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m))
          finalMessages = updated; return updated
        }
        const updated = [...prev, { role: 'assistant' as const, content: assistantSoFar }]
        finalMessages = updated; return updated
      })
      const html = extractHtml(assistantSoFar)
      queuePreviewHtml(html)
    }

    try {
      await streamChat({
        messages: newMessages,
        mode: flowMode,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => { const html = extractHtml(assistantSoFar); queuePreviewHtml(html); setIsLoading(false); if (html.includes('<')) saveProject(html, finalMessages) },
        onError: (error) => { toast.error(error); setIsLoading(false) },
      })
    } catch (e) { console.error(e); toast.error('Failed to generate'); setIsLoading(false) }
  }

  const handleCopy = () => { navigator.clipboard.writeText(generatedCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const handleDownload = () => {
    const blob = new Blob([generatedCode], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`; a.click(); URL.revokeObjectURL(url)
  }

  const handleTemplateSelect = (template: Template) => { setShowTemplates(false); setInput(template.prompt) }

  const handleClone = async (url: string) => {
    if (!subscription?.is_active) {
      toast.error('You need an active plan to clone.', {
        action: { label: 'View plans', onClick: () => navigate('/pricing') },
      })
      return
    }
    if (!canEdit) {
      toast('Your edits are used up!', {
        action: { label: 'Reload', onClick: () => navigate('/pricing') },
      })
      return
    }
    await incrementEdit()
    setIsCloning(true)
    setShowCloneDialog(false)

    const cloneMsg: Msg = { role: 'user', content: `🔗 Clone: ${url}` }
    const newMessages = [...messages, cloneMsg]
    setMessages(newMessages)
    setIsLoading(true)

    let assistantSoFar = ''
    let finalMessages = newMessages

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant') {
          const updated = prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m))
          finalMessages = updated; return updated
        }
        const updated = [...prev, { role: 'assistant' as const, content: assistantSoFar }]
        finalMessages = updated; return updated
      })
      const html = extractHtml(assistantSoFar)
      queuePreviewHtml(html)
    }

    try {
      await streamClone({
        url,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => {
          const html = extractHtml(assistantSoFar)
          queuePreviewHtml(html)
          setIsLoading(false)
          setIsCloning(false)
          if (html.includes('<')) saveProject(html, finalMessages)
          toast.success('Site cloned successfully! 🎉')
        },
        onError: (error) => {
          toast.error(error)
          setIsLoading(false)
          setIsCloning(false)
        },
      })
    } catch (e) {
      console.error(e)
      toast.error('Failed to clone the site')
      setIsLoading(false)
      setIsCloning(false)
    }
  }

  const handlePublish = async (): Promise<string | null> => {
    if (!user || !generatedCode) return null
    await saveProject(generatedCode, messages)
    const slug = projectTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)
    const pid = currentProjectId || 'draft'
    const url = `https://kubovibe.dev/app/${pid}/${slug}`
    const { error } = await supabase.from('projects').update({
      is_published: true,
      published_url: url,
      published_at: new Date().toISOString(),
    } as any).eq('id', pid)
    if (!error) {
      setIsPublished(true)
      setPublishedUrl(url)
      return url
    }
    return null
  }

  const suggestions = [
    'A task management app with drag & drop',
    'A weather dashboard with live data',
    'A landing page for a SaaS product',
    'A calculator app with modern UI',
  ]

  return (
    <div ref={ref} className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Toolbar */}
      <BuilderToolbar
        projectTitle={projectTitle}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        deviceFrame={deviceFrame}
        onDeviceFrameChange={(f) => { setDeviceFrame(f); if (f === 'desktop') setLandscape(false) }}
        landscape={landscape}
        onToggleLandscape={() => setLandscape(l => !l)}
        onRefreshPreview={() => setPreviewKey(k => k + 1)}
        onSave={() => saveProject(generatedCode, messages)}
        onDownload={handleDownload}
        onShowTemplates={() => setShowTemplates(true)}
        onCloneSite={() => setShowCloneDialog(true)}
        onPublish={handlePublish}
        saving={saving}
        hasCode={!!generatedCode}
        editsRemaining={editsRemaining}
        isSubscribed={!!subscription?.is_active}
        generatedCode={generatedCode}
        isPublished={isPublished}
        publishedUrl={publishedUrl}
      />

      {/* Main content */}
      <div className="flex min-h-0 min-w-0 flex-1">
        {/* Chat panel */}
        <div
          className={`relative flex w-[min(380px,42vw)] min-w-[300px] shrink-0 flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm transition-colors ${isDragging ? 'bg-primary/5' : ''}`}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }}
          onDrop={(e) => {
            e.preventDefault(); e.stopPropagation(); setIsDragging(false)
            const files = Array.from(e.dataTransfer.files)
            files.forEach(handleFileUpload)
          }}
        >
          {isDragging && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg pointer-events-none">
              <div className="text-center">
                <p className="text-primary font-medium text-sm">Solte o arquivo aqui</p>
                <p className="text-muted-foreground text-xs mt-1">Imagem, vídeo, áudio, PDF, DOC, ZIP</p>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center pt-12 px-4">
                <img src={logoImg} alt="KUBO VIBE" className="h-12 mb-4" />
                <h3 className="font-display font-bold text-foreground text-lg mb-2">What do you want to build?</h3>
                <p className="text-sm text-muted-foreground mb-6">Describe your app and I'll generate it instantly.</p>
                <div className="w-full space-y-2">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => setInput(s)} className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors border border-border/30">
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user' ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none text-secondary-foreground [&_pre]:hidden [&_code]:hidden">
                      <ReactMarkdown>{msg.content.replace(/```[\s\S]*?```/g, '').replace(/<[^>]*>/g, '').trim() || 'Generating your app...'}</ReactMarkdown>
                    </div>
                  ) : (
                    <div>
                      <p>{msg.content.replace(/\n\nAttached files:\n[\s\S]*$/, '')}</p>
                      {msg.content.includes('Attached files:') && (
                        <div className="mt-2 space-y-1">
                          {msg.content
                            .match(/\[(\w+): ([^\]]+)\]\(([^)]+)\)/g)
                            ?.map((match, j) => {
                              const parts = match.match(/\[(\w+): ([^\]]+)\]\(([^)]+)\)/)
                              if (!parts) return null
                              const [, category, name, url] = parts
                              return (
                                <FilePreview
                                  key={j}
                                  file={{
                                    url,
                                    name,
                                    size: 0,
                                    originalSize: 0,
                                    mimeType: '',
                                    category: category as any,
                                    path: '',
                                  }}
                                  compact
                                />
                              )
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-secondary text-secondary-foreground rounded-2xl px-4 py-3 flex items-center gap-2 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-border space-y-2">
            {/* KUBO FLOW AI Mode Selector */}
            <div className="flex items-center justify-between px-1">
              <KuboFlowSelector mode={flowMode} onChange={handleModeChange} autoDetected={autoDetectedMode} userPlan={userPlan} />
              <span className="text-[10px] text-muted-foreground font-display tracking-widest">KUBO FLOW AI</span>
            </div>
            {uploadProgress !== null && (
              <div className="flex items-center gap-2 px-1">
                <Progress value={uploadProgress} className="h-1.5 flex-1" />
                <span className="text-[10px] text-muted-foreground">{uploadProgress}%</span>
              </div>
            )}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-1">
                {attachedFiles.map((f, i) => (
                  <FilePreview key={i} file={f} compact />
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <PromptAttachMenu
                onAttachFile={handleFileUpload}
                onScreenshot={() => toast.info('Screenshot functionality coming soon')}
                onAddReference={(url) => {
                  setInput(prev => prev + `\n[Reference: ${url}]`)
                  toast.success('Reference added')
                }}
              />
              <div className="relative flex-1">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe what you want to build. E.g., 'delivery app with Pix and crypto payment'" rows={2}
                  className="w-full resize-none bg-secondary rounded-xl px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  onPaste={(e) => {
                    const items = Array.from(e.clipboardData.items)
                    const imageItem = items.find(item => item.type.startsWith('image/'))
                    if (imageItem) {
                      e.preventDefault()
                      const file = imageItem.getAsFile()
                      if (file) handleFileUpload(file)
                    }
                  }} />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-12 bottom-2 h-8 w-8 rounded-lg text-primary hover:text-primary"
                  onClick={() => setShowRunway(true)}
                  title="RunwayML — Generate video/image (28 credits)"
                >
                  <Film className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="hero" className="absolute right-2 bottom-2 h-8 w-8 rounded-lg" onClick={send} disabled={isLoading || !input.trim()}>
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Preview / Code panel */}
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-muted">
          <AnimatePresence mode="wait">
            {activeTab === 'preview' ? (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex h-full w-full min-h-0 min-w-0 overflow-hidden">
                {/* Loading overlay — sits on top of everything */}
                {showLoading && (
                  <div className="absolute inset-0 z-20">
                    <AILoadingAnimation
                      isVisible={showLoading}
                      chatLanguage={chatLanguage}
                      isReady={!isLoading && !!generatedCode}
                      onSkip={() => {
                        setShowLoading(false)
                        pendingSaveRef.current?.()
                        pendingSaveRef.current = null
                      }}
                    />
                  </div>
                )}
              {generatedCode && !showLoading ? (
                  <PreviewFrame
                    generatedCode={generatedCode}
                    deviceFrame={deviceFrame}
                    landscape={landscape}
                    previewKey={previewKey}
                    previewId={previewId}
                    onRefresh={() => setPreviewKey(k => k + 1)}
                    publishedUrl={publishedUrl}
                    projectTitle={projectTitle}
                  />
                ) : !showLoading ? (
                  <div className="flex items-center justify-center h-full w-full relative">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="text-center"
                    >
                      <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
                        <Eye className="h-8 w-8 text-accent-foreground" />
                      </div>
                      <p className="text-muted-foreground font-medium">Preview will appear here</p>
                      <p className="text-xs text-muted-foreground mt-1">Describe your app to start building</p>
                    </motion.div>
                  </div>
                ) : null}
              </motion.div>
            ) : (
              <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground">index.html</span>
                  <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs">
                    {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-foreground bg-card">
                  <code>{generatedCode || '// Your generated code will appear here...'}</code>
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
          {activeTab === 'preview' && generatedCode && (
            <PreviewAuditPanel
              logs={previewLogs}
              onClear={() => setPreviewLogs([])}
              defaultOpen={previewLogs.some(l => ['error','exception','rejection'].includes(l.kind))}
              onAutoScreenshot={(reason) => window.dispatchEvent(new CustomEvent('kubo:preview:auto-screenshot', { detail: { reason } }))}
            />
          )}
        </div>
      </div>

      <AnimatePresence>
        {showTemplates && <TemplateGallery onSelect={handleTemplateSelect} onClose={() => setShowTemplates(false)} />}
      </AnimatePresence>

      <CloneDialog
        open={showCloneDialog}
        onOpenChange={setShowCloneDialog}
        onClone={handleClone}
        isCloning={isCloning}
      />

      <RunwayDialog
        open={showRunway}
        onOpenChange={setShowRunway}
        onResult={(url) => {
          // Insert the generated asset URL into the prompt for the AI to consume.
          setInput((prev) => `${prev}${prev ? "\n" : ""}[runway asset]: ${url}`)
        }}
      />
    </div>
  )
})

export default BuilderPage
