import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Paperclip, ArrowUp } from 'lucide-react'
import { motion } from 'framer-motion'

export default function HeroSection() {
  const [prompt, setPrompt] = useState('')
  const navigate = useNavigate()

  const handleGenerate = () => {
    if (prompt.trim()) {
      navigate('/canvas')
    }
  }

  return (
    <section className="relative py-24 md:py-36 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold text-foreground leading-tight"
        >
          Bring your <span className="hero-highlight">ideas</span>
          <br />
          to life
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-6 text-lg text-muted-foreground"
        >
          The <strong className="text-foreground">easiest path</strong> to create what your business needs
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 max-w-2xl mx-auto"
        >
          <div className="relative bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Let's create a menu and delivery page"
              className="w-full resize-none bg-transparent px-5 pt-5 pb-14 text-foreground placeholder:text-muted-foreground focus:outline-none text-base min-h-[120px]"
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
                <span className="text-xs text-muted-foreground">0/2</span>
              </div>
              <Button
                variant="hero"
                size="sm"
                onClick={handleGenerate}
                className="rounded-xl px-5"
              >
                Generate
                <ArrowUp className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            You can add up to 2 files per idea (images, text, PDF)
          </p>
        </motion.div>
      </div>
    </section>
  )
}
