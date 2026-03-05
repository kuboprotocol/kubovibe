import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Send, Code, Eye, Loader2, Sparkles, Copy, Check, Save, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { streamChat, type Msg } from '@/lib/streamChat'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

export default function BuilderPage() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId?: string }>()
  const { user } = useAuth()

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')
  const [copied, setCopied] = useState(false)
  const [projectTitle, setProjectTitle] = useState('Untitled Project')
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(projectId || null)
  const [saving, setSaving] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load existing project
  useEffect(() => {
    if (projectId) {
      loadProject(projectId)
    }
  }, [projectId])

  const loadProject = async (id: string) => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      toast.error('Projeto não encontrado')
      navigate('/dashboard')
      return
    }

    setProjectTitle(data.title)
    setGeneratedCode(data.generated_code || '')
    setMessages((data.messages as Msg[]) || [])
    setCurrentProjectId(id)
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

    // Derive title from first user message
    const firstUserMsg = msgs.find(m => m.role === 'user')
    const title = firstUserMsg
      ? firstUserMsg.content.slice(0, 60)
      : 'Untitled Project'

    try {
      if (currentProjectId) {
        const { error } = await supabase
          .from('projects')
          .update({
            title,
            generated_code: code,
            messages: msgs as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentProjectId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            user_id: user.id,
            title,
            generated_code: code,
            messages: msgs as any,
          })
          .select('id')
          .single()

        if (error) throw error
        setCurrentProjectId(data.id)
        // Update URL without full reload
        window.history.replaceState(null, '', `/builder/${data.id}`)
      }
      setProjectTitle(title)
      toast.success('Projeto salvo!')
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || 'desconhecido'))
    } finally {
      setSaving(false)
    }
  }

  const send = async () => {
    if (!input.trim() || isLoading) return

    const userMsg: Msg = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    let assistantSoFar = ''
    let finalMessages = newMessages

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant') {
          const updated = prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m))
          finalMessages = updated
          return updated
        }
        const updated = [...prev, { role: 'assistant' as const, content: assistantSoFar }]
        finalMessages = updated
        return updated
      })
      const html = extractHtml(assistantSoFar)
      if (html.includes('<')) {
        setGeneratedCode(html)
      }
    }

    try {
      await streamChat({
        messages: newMessages,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => {
          setIsLoading(false)
          // Auto-save after generation completes
          const html = extractHtml(assistantSoFar)
          if (html.includes('<')) {
            saveProject(html, finalMessages)
          }
        },
        onError: (error) => {
          toast.error(error)
          setIsLoading(false)
        },
      })
    } catch (e) {
      console.error(e)
      toast.error('Failed to generate')
      setIsLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([generatedCode], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const suggestions = [
    'A task management app with drag & drop',
    'A weather dashboard with live data',
    'A landing page for a SaaS product',
    'A calculator app with modern UI',
  ]

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 glass glass-border z-20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="text-muted-foreground hover:text-foreground rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-5 w-px bg-border/50" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-display font-bold text-foreground truncate max-w-[200px]">
              {projectTitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-0.5">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                activeTab === 'preview'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                activeTab === 'code'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              Code
            </button>
          </div>

          {generatedCode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="text-xs rounded-xl"
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
              <Button
                variant="hero"
                size="sm"
                onClick={() => saveProject(generatedCode, messages)}
                disabled={saving}
                className="text-xs rounded-xl"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Save
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Chat panel */}
        <div className="w-[380px] flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center text-center pt-12 px-4"
              >
                <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-glow">
                  <Sparkles className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-display font-bold text-foreground text-lg mb-2">
                  What do you want to build?
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Describe your app and I'll generate it instantly.
                </p>
                <div className="w-full space-y-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'gradient-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none text-secondary-foreground [&_pre]:hidden [&_code]:hidden">
                      <ReactMarkdown>
                        {msg.content.replace(/```[\s\S]*?```/g, '').replace(/<[^>]*>/g, '').trim() || 'Generating your app...'}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </motion.div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-secondary text-secondary-foreground rounded-2xl px-4 py-3 flex items-center gap-2 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-border">
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your app..."
                rows={2}
                className="w-full resize-none bg-secondary rounded-xl px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
              />
              <Button
                size="icon"
                variant="hero"
                className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
                onClick={send}
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Preview / Code panel */}
        <div className="flex-1 relative bg-muted">
          <AnimatePresence mode="wait">
            {activeTab === 'preview' ? (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                {generatedCode ? (
                  <iframe srcDoc={generatedCode} className="w-full h-full border-0 bg-background" sandbox="allow-scripts allow-forms allow-modals" title="App Preview" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
                        <Eye className="h-8 w-8 text-accent-foreground" />
                      </div>
                      <p className="text-muted-foreground font-medium">Preview will appear here</p>
                      <p className="text-xs text-muted-foreground mt-1">Describe your app to start building</p>
                    </div>
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

          {generatedCode && activeTab === 'preview' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-4 right-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveTab('code')} className="bg-card shadow-lg">
                <Code className="h-3.5 w-3.5 mr-1.5" />
                View code
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
