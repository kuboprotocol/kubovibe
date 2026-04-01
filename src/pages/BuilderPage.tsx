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
import logoImg from '@/assets/logo-kubovibe.png'

const DEVICE_WIDTHS: Record<DeviceFrame, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
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
  const [previewKey, setPreviewKey] = useState(0)

  // Minimum loading duration: 95 seconds (1:35)
  const MIN_LOADING_MS = 95_000
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

        streamChat({
          messages: [userMsg],
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
    const userMsg: Msg = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages); setInput(''); setIsLoading(true)
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
        onDeviceFrameChange={setDeviceFrame}
        onRefreshPreview={() => setPreviewKey(k => k + 1)}
        onSave={() => saveProject(generatedCode, messages)}
        onDownload={handleDownload}
        onShowTemplates={() => setShowTemplates(true)}
        onCloneSite={() => setShowCloneDialog(true)}
        saving={saving}
        hasCode={!!generatedCode}
        editsRemaining={editsRemaining}
        isSubscribed={!!subscription?.is_active}
        generatedCode={generatedCode}
      />

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Chat panel */}
        <div className="w-[380px] flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm">
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
                  ) : msg.content}
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

          <div className="p-3 border-t border-border">
            <div className="flex items-end gap-2">
              <PromptAttachMenu
                onAttachFile={(file) => {
                  setInput(prev => prev + `\n[Attached: ${file.name}]`)
                  toast.success(`Arquivo "${file.name}" anexado`)
                }}
                onScreenshot={() => toast.info('Screenshot functionality coming soon')}
                onAddReference={(url) => {
                  setInput(prev => prev + `\n[Reference: ${url}]`)
                  toast.success('Referência adicionada')
                }}
              />
              <div className="relative flex-1">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe your app..." rows={2}
                  className="w-full resize-none bg-secondary rounded-xl px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
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
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-start justify-center overflow-auto">
              {generatedCode ? (
                  <div
                    className="w-full h-full"
                    style={{
                      ...(deviceFrame !== 'desktop' ? {
                        maxWidth: deviceFrame === 'tablet' ? 768 : 390,
                        maxHeight: deviceFrame === 'tablet' ? 1024 : 844,
                        margin: '0 auto',
                        border: '8px solid hsl(var(--border))',
                        borderRadius: '24px',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                      } : {}),
                    }}
                  >
                    <iframe
                      key={previewKey}
                      srcDoc={generatedCode}
                      className="w-full h-full border-0 bg-background"
                      sandbox="allow-scripts"
                      title="App Preview"
                      style={deviceFrame !== 'desktop' ? { borderRadius: '12px' } : {}}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full w-full relative">
                    <AILoadingAnimation isVisible={showLoading} chatLanguage={chatLanguage} />
                    {!showLoading && !isLoading && (
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
                    )}
                  </div>
                )}
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
