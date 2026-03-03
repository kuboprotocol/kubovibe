import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Send, Code, Eye, Loader2, Sparkles, RotateCcw, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { streamChat, type Msg } from '@/lib/streamChat'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

export default function BuilderPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')
  const [copied, setCopied] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const extractHtml = useCallback((text: string): string => {
    // Remove markdown code fences if present
    const fenceMatch = text.match(/```html?\s*\n?([\s\S]*?)```/)
    if (fenceMatch) return fenceMatch[1].trim()
    // Check if it starts with DOCTYPE or html tag
    const htmlMatch = text.match(/(<!DOCTYPE[\s\S]*<\/html>)/i)
    if (htmlMatch) return htmlMatch[1]
    return text
  }, [])

  const send = async () => {
    if (!input.trim() || isLoading) return

    const userMsg: Msg = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    let assistantSoFar = ''

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m))
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }]
      })
      // Extract and set HTML for preview
      const html = extractHtml(assistantSoFar)
      if (html.includes('<')) {
        setGeneratedCode(html)
      }
    }

    try {
      await streamChat({
        messages: newMessages,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setIsLoading(false),
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

  const suggestions = [
    'A task management app with drag & drop',
    'A weather dashboard with live data',
    'A landing page for a SaaS product',
    'A calculator app with modern UI',
  ]

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border z-20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-base font-display font-bold text-foreground">idealane builder</span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'code'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            Code
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Chat panel */}
        <div className="w-[380px] flex flex-col border-r border-border bg-card">
          {/* Messages */}
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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-secondary text-secondary-foreground rounded-2xl px-4 py-3 flex items-center gap-2 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="relative">
              <textarea
                ref={textareaRef}
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
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Preview / Code panel */}
        <div className="flex-1 relative bg-muted">
          <AnimatePresence mode="wait">
            {activeTab === 'preview' ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                {generatedCode ? (
                  <iframe
                    srcDoc={generatedCode}
                    className="w-full h-full border-0 bg-background"
                    sandbox="allow-scripts allow-forms allow-modals"
                    title="App Preview"
                  />
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
              <motion.div
                key="code"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col"
              >
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground">index.html</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs">
                      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
                <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-foreground bg-card">
                  <code>{generatedCode || '// Your generated code will appear here...'}</code>
                </pre>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating action */}
          {generatedCode && activeTab === 'preview' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-4 right-4 flex gap-2"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('code')}
                className="bg-card shadow-lg"
              >
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
