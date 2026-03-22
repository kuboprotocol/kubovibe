import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  ChevronDown,
  ArrowLeft,
  Send,
  MessageSquare,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import logoImg from '@/assets/logo-kubovibe.png'

/* ───────── Expanded FAQ ───────── */
const faqCategories = [
  {
    category: 'General',
    items: [
      {
        q: 'What is KUBO VIBE?',
        a: 'KUBO VIBE is an AI-powered application builder that lets you create professional apps, websites, games, and tools — no coding required. Just describe what you want in plain language.',
      },
      {
        q: 'Does it work for any type of business?',
        a: 'Yes! Whether you run a restaurant, consulting firm, e-commerce store, or anything else, KUBO VIBE adapts to your needs and generates tailored solutions.',
      },
      {
        q: "What if I don't know exactly what I want?",
        a: 'No problem! Just describe your idea in a few words and our AI will suggest designs, layouts, and features to get you started.',
      },
    ],
  },
  {
    category: 'Account & Billing',
    items: [
      {
        q: 'How do I create an account?',
        a: 'Click "Get started" on the homepage, enter your email and a password, then verify your email address. You\'ll be ready to build in seconds.',
      },
      {
        q: 'What does the free plan include?',
        a: 'The free plan includes credits to generate and iterate on your projects, access to templates, and community sharing. Upgrade anytime for more edits and premium features.',
      },
      {
        q: 'How do I upgrade my plan?',
        a: 'Go to the Pricing page and choose the plan that fits your needs. Payment is processed securely and your credits are available instantly.',
      },
      {
        q: 'Can I cancel my subscription?',
        a: 'Yes, you can cancel at any time from your profile settings. You\'ll keep access until the end of your billing period.',
      },
    ],
  },
  {
    category: 'Building & Editing',
    items: [
      {
        q: 'Do I need technical knowledge?',
        a: 'Not at all. KUBO VIBE is designed to be used by anyone. Just describe what you want in plain language and the AI handles the rest.',
      },
      {
        q: 'Can I edit what is created?',
        a: 'Absolutely! You can edit everything — text, images, colors, layout, pages — just by talking naturally to the AI in the builder chat.',
      },
      {
        q: 'Can I export my code?',
        a: 'Yes. All code generated through the platform belongs to you. You can download it and use it anywhere you like.',
      },
      {
        q: 'What types of apps can I build?',
        a: 'You can build landing pages, e-commerce stores, dashboards, 2D games, casino apps, social media clones, portfolios, and much more.',
      },
    ],
  },
  {
    category: 'Technical Support',
    items: [
      {
        q: 'The AI generated something wrong. What should I do?',
        a: 'Simply describe the issue in the builder chat and ask the AI to fix it. You can also start fresh from a template. If the problem persists, submit a support ticket below.',
      },
      {
        q: 'My project is not loading. What can I do?',
        a: 'Try refreshing the page or clearing your browser cache. If the issue continues, make sure you have a stable internet connection and try again. Contact support if needed.',
      },
      {
        q: 'Is my data secure?',
        a: 'Yes. All project data is encrypted at rest and in transit. We follow industry-standard security practices. Read more in our Privacy Policy.',
      },
    ],
  },
]

/* ───────── Status helpers ───────── */
function statusBadge(status: string) {
  switch (status) {
    case 'open':
      return (
        <Badge variant="outline" className="border-primary/40 text-primary gap-1 text-xs">
          <Clock className="h-3 w-3" /> Open
        </Badge>
      )
    case 'resolved':
      return (
        <Badge variant="outline" className="border-green-500/40 text-green-400 gap-1 text-xs">
          <CheckCircle2 className="h-3 w-3" /> Resolved
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {status}
        </Badge>
      )
  }
}

/* ───────── Page ───────── */
export default function SupportPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  // Form state
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  // Tickets state
  const [tickets, setTickets] = useState<any[]>([])
  const [ticketsLoaded, setTicketsLoaded] = useState(false)
  const [loadingTickets, setLoadingTickets] = useState(false)

  async function loadTickets() {
    if (!user) return
    setLoadingTickets(true)
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) {
      setTickets(data)
    }
    setTicketsLoaded(true)
    setLoadingTickets(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) {
      toast.error('Please log in to submit a support ticket.')
      return
    }
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in all fields.')
      return
    }
    if (subject.length > 200) {
      toast.error('Subject must be under 200 characters.')
      return
    }
    if (message.length > 2000) {
      toast.error('Message must be under 2000 characters.')
      return
    }

    setSending(true)
    const { error } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      subject: subject.trim(),
      message: message.trim(),
    })
    setSending(false)

    if (error) {
      toast.error('Failed to submit ticket. Please try again.')
      return
    }

    toast.success('Support ticket submitted successfully!')
    setSubject('')
    setMessage('')
    // Refresh ticket list if already loaded
    if (ticketsLoaded) loadTickets()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass glass-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logoImg} alt="KUBO VIBE" className="h-7" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-20">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-3">
            Support Center
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Find answers to common questions or reach out to our team. We're here to help.
          </p>
        </motion.div>

        {/* FAQ Section */}
        <section>
          <h2 className="text-2xl font-display font-bold text-foreground mb-8 text-center">
            Frequently Asked Questions
          </h2>

          <div className="space-y-10">
            {faqCategories.map((cat) => (
              <div key={cat.category}>
                <h3 className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">
                  {cat.category}
                </h3>
                <div className="space-y-2">
                  {cat.items.map((faq, i) => {
                    const key = `${cat.category}-${i}`
                    return (
                      <div
                        key={key}
                        className="border border-border rounded-xl overflow-hidden bg-card"
                      >
                        <button
                          onClick={() => setOpenFaq(openFaq === key ? null : key)}
                          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/50 transition-colors"
                        >
                          <span className="font-medium text-foreground text-sm">{faq.q}</span>
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                              openFaq === key ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        <AnimatePresence>
                          {openFaq === key && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                                {faq.a}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Form */}
        <section>
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-display font-bold text-foreground mb-2 text-center">
              Submit a Ticket
            </h2>
            <p className="text-muted-foreground text-center mb-8 text-sm">
              Didn't find your answer above?{' '}
              {user ? 'Send us a message and we'll get back to you.' : 'Log in to submit a support ticket.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  placeholder="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  disabled={!user || sending}
                  className="bg-card border-border rounded-xl"
                />
              </div>
              <div>
                <Textarea
                  placeholder="Describe your issue or question in detail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  disabled={!user || sending}
                  className="bg-card border-border rounded-xl resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {message.length}/2000
                </p>
              </div>
              <Button
                type="submit"
                disabled={!user || sending || !subject.trim() || !message.trim()}
                className="w-full rounded-xl gap-2"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending ? 'Sending...' : 'Submit Ticket'}
              </Button>
              {!user && (
                <p className="text-center text-sm text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => navigate('/auth')}
                    className="text-primary hover:underline"
                  >
                    Log in
                  </button>{' '}
                  to submit a support ticket.
                </p>
              )}
            </form>
          </div>
        </section>

        {/* Ticket History */}
        {user && (
          <section>
            <div className="max-w-xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Your Tickets
                </h2>
                {!ticketsLoaded && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadTickets}
                    disabled={loadingTickets}
                    className="rounded-xl"
                  >
                    {loadingTickets ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Load History'
                    )}
                  </Button>
                )}
                {ticketsLoaded && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadTickets}
                    disabled={loadingTickets}
                    className="rounded-xl text-xs text-muted-foreground"
                  >
                    Refresh
                  </Button>
                )}
              </div>

              {ticketsLoaded && tickets.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No tickets yet. Submit one above if you need help!
                </p>
              )}

              {ticketsLoaded && tickets.length > 0 && (
                <div className="space-y-3">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="border border-border rounded-xl bg-card p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-medium text-sm text-foreground">{t.subject}</h3>
                        {statusBadge(t.status)}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.message}</p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {new Date(t.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            A product by KUBO PROTOCOL · CNPJ: 65.822.139/0001-66
          </p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} KUBO PROTOCOL. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
