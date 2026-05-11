import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Send, Eye, Loader2, Copy, Check, Code } from 'lucide-react'
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
import logoImg from '@/assets/logo-kubovibe.png'

const DEVICE_SIZES: Record<DeviceFrame, { w: number; h: number; label: string }> = {
  desktop: { w: 1440, h: 900, label: 'Desktop 1440×900' },
  tablet: { w: 768, h: 1024, label: 'Tablet 768×1024' },
  mobile: { w: 390, h: 844, label: 'Mobile 390×844' },
}

export default function BuilderPage() {
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
  const [isCloning, setIsCloning] = useState(false)
  const [deviceFrame, setDeviceFrame] = useState<DeviceFrame>('desktop')
  const [landscape, setLandscape] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
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
    if (!user) { toast.error('Faça login primeiro'); return }
    try {
      setUploadProgress(0)
      const uploaded = await uploadFile(file, user.id, setUploadProgress)
      setAttachedFiles(prev => [...prev, uploaded])
      const fmt = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      if (uploaded.originalSize > uploaded.size) {
        const saved = Math.round((1 - uploaded.size / uploaded.originalSize) * 100)
        toast.success(`"${file.name}" enviado!`, {
          description: `${fmt(uploaded.originalSize)} → ${fmt(uploaded.size)} (${saved}% menor)`,
        })
      } else {
        toast.success(`"${file.name}" enviado!`)
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro no upload')
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
      setShowLoading(true)
    }
    if (!isLoading && showLoading) {
      generationDoneRef.current = true
      const elapsed = Date.now() - loadingStartRef.current
      const remaining = MIN_LOADING_MS - elapsed
      if (remaining > 0) {
        const timeout = setTimeout(() => {
          setShowLoading(false)
          pendingSaveRef.current?.()
          pendingSaveRef.current = null
        }, remaining)
        return () => clearTimeout(timeout)
      } else {
        setShowLoading(false)
        pendingSaveRef.current?.()
        pendingSaveRef.current = null
      }
    }
  }, [isLoading])

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
          if (html.includes('<')) setGeneratedCode(html)
        }

        const detectedMode = autoDetectMode(initialPrompt)
        setFlowMode(detectedMode)

        streamChat({
          messages: [userMsg],
          mode: detectedMode,
          onDelta: (chunk) => upsertAssistant(chunk),
          onDone: () => { setIsLoading(false); const html = extractHtml(assistantSoFar); if (html.includes('<')) saveProject(html, finalMessages) },
          onError: (error) => { toast.error(error); setIsLoading(false) },
        }).catch((e) => { console.error(e); toast.error('Failed to generate'); setIsLoading(false) })

        setInput('')
      }, 100)
    }
  }, [initialPrompt, projectId, user])

  const loadProject = async (id: string) => {
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
    if (error || !data) { toast.error('Projeto não encontrado'); navigate('/dashboard'); return }
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
      toast.success('Projeto salvo!')
    } catch (err: any) { toast.error('Erro ao salvar: ' + (err.message || 'desconhecido')) }
    finally { setSaving(false) }
  }

  const send = async () => {
    if (!input.trim() || isLoading) return
    if (!subscription?.is_active) {
      toast.error('Você precisa de um plano ativo para editar.', {
        action: { label: 'Ver planos', onClick: () => navigate('/pricing') },
      })
      return
    }
    if (!canEdit) {
      toast('Suas 20 edições acabaram! 🔄', {
        description: 'Recarregue quando quiser para continuar criando.',
        action: { label: 'Recarregar', onClick: () => navigate('/pricing') },
      })
      return
    }
    await incrementEdit()
    // Build content with attached file URLs
    let content = input
    if (attachedFiles.length > 0) {
      const fileRefs = attachedFiles.map(f => `[${f.category}: ${f.name}](${f.url})`).join('\n')
      content = `${input}\n\nArquivos anexados:\n${fileRefs}`
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
      if (html.includes('<')) setGeneratedCode(html)
    }

    try {
      await streamChat({
        messages: newMessages,
        mode: flowMode,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => { setIsLoading(false); const html = extractHtml(assistantSoFar); if (html.includes('<')) saveProject(html, finalMessages) },
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
      toast.error('Você precisa de um plano ativo para clonar.', {
        action: { label: 'Ver planos', onClick: () => navigate('/pricing') },
      })
      return
    }
    if (!canEdit) {
      toast('Suas edições acabaram!', {
        action: { label: 'Recarregar', onClick: () => navigate('/pricing') },
      })
      return
    }
    await incrementEdit()
    setIsCloning(true)
    setShowCloneDialog(false)

    const cloneMsg: Msg = { role: 'user', content: `🔗 Clonar: ${url}` }
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
      if (html.includes('<')) setGeneratedCode(html)
    }

    try {
      await streamClone({
        url,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => {
          setIsLoading(false)
          setIsCloning(false)
          const html = extractHtml(assistantSoFar)
          if (html.includes('<')) saveProject(html, finalMessages)
          toast.success('Site clonado com sucesso! 🎉')
        },
        onError: (error) => {
          toast.error(error)
          setIsLoading(false)
          setIsCloning(false)
        },
      })
    } catch (e) {
      console.error(e)
      toast.error('Falha ao clonar o site')
      setIsLoading(false)
      setIsCloning(false)
    }
  }

  const handlePublish = async (): Promise<string | null> => {
    if (!user || !generatedCode) return null
    await saveProject(generatedCode, messages)
    const slug = projectTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)
    const pid = currentProjectId || 'draft'
    const url = `https://kubovibe.lovable.app/app/${pid}/${slug}`
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
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
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
      <div className="flex-1 flex min-h-0">
        {/* Chat panel */}
        <div
          className={`w-[380px] flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm relative transition-colors ${isDragging ? 'bg-primary/5' : ''}`}
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
                      <p>{msg.content.replace(/\n\nArquivos anexados:\n[\s\S]*$/, '')}</p>
                      {msg.content.includes('Arquivos anexados:') && (
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
                  toast.success('Referência adicionada')
                }}
              />
              <div className="relative flex-1">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Descreva o que você quer construir. Ex: 'app de delivery com pagamento via Pix e cripto'" rows={2}
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
                <Button size="icon" variant="hero" className="absolute right-2 bottom-2 h-8 w-8 rounded-lg" onClick={send} disabled={isLoading || !input.trim()}>
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Preview / Code panel */}
        <div className="flex-1 relative bg-muted">
          <AnimatePresence mode="wait">
            {activeTab === 'preview' ? (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-start justify-center overflow-auto relative">
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
                  (() => {
                    const size = DEVICE_SIZES[deviceFrame]
                    const isDesktop = deviceFrame === 'desktop'
                    const w = landscape && !isDesktop ? size.h : size.w
                    const h = landscape && !isDesktop ? size.w : size.h
                    return (
                  <div
                    className="relative"
                    style={{
                      width: isDesktop ? '100%' : `${w}px`,
                      height: isDesktop ? '100%' : `${h}px`,
                      maxWidth: '100%',
                      margin: isDesktop ? 0 : '24px auto',
                      ...(isDesktop ? {} : {
                        border: '8px solid hsl(var(--border))',
                        borderRadius: '24px',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                      }),
                    }}
                  >
                    {!isDesktop && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-background/80 backdrop-blur border border-border text-[10px] font-mono text-muted-foreground z-10">
                        {w}×{h}
                      </div>
                    )}
                    <iframe
                      key={previewKey}
                      srcDoc={(() => {
                        const code = generatedCode || ''
                        const hasDoctype = /<!doctype\s+html/i.test(code)
                        const hasHtmlTag = /<html[\s>]/i.test(code)
                        if (hasDoctype || hasHtmlTag) return code
                        return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:#ffffff;color:#111;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;min-height:100%}</style></head><body>${code}</body></html>`
                      })()}
                      className="w-full h-full border-0 block"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                      title="App Preview"
                      style={{
                        backgroundColor: '#ffffff',
                        ...(isDesktop ? {} : { borderRadius: '12px' }),
                      }}
                    />
                  </div>
                  )
                  })()
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
    </div>
  )
}
