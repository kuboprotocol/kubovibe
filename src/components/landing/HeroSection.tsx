import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Paperclip, ArrowRight, Zap, Globe, Palette } from 'lucide-react'
import { motion } from 'framer-motion'

const suggestions = [
  'A food delivery app with live tracking',
  'Portfolio website with dark mode',
  'SaaS dashboard with analytics',
]

export default function HeroSection() {
  const [prompt, setPrompt] = useState('')
  const navigate = useNavigate()

  const handleGenerate = () => {
    if (prompt.trim()) {
      navigate('/canvas')
    }
  }

  return (
    <section className="relative py-28 md:py-40 px-6 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />

      <div className="max-w-3xl mx-auto text-center relative z-10">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent glass-border text-accent-foreground text-xs font-medium mb-8"
        >
          <Zap className="h-3 w-3" />
          AI-powered app builder
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-display font-bold text-foreground leading-[1.1] tracking-tight"
        >
          Turn ideas into
          <br />
          <span className="hero-highlight">real products</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed"
        >
          Describe your vision and watch it come to life. No coding, no templates — just your imagination.
        </motion.p>

        {/* Prompt input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-10 max-w-2xl mx-auto"
        >
          <div className="relative glass glass-border rounded-2xl shadow-glow-lg overflow-hidden">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your app idea..."
              className="w-full resize-none bg-transparent px-5 pt-5 pb-16 text-foreground placeholder:text-muted-foreground focus:outline-none text-base min-h-[130px] font-sans"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleGenerate()
                }
              }}
            />
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
                  <Paperclip className="h-4 w-4" />
                </button>
                <span className="text-xs text-muted-foreground">Attach files</span>
              </div>
              <Button
                variant="hero"
                size="sm"
                onClick={handleGenerate}
                className="rounded-xl px-6 gap-2"
              >
                Generate
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Suggestion chips */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-16 flex items-center justify-center gap-8 md:gap-12"
        >
          {[
            { icon: Globe, label: '10K+ apps built' },
            { icon: Palette, label: '500+ templates' },
            { icon: Zap, label: '< 30s to generate' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
