import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight, Zap, Globe, Palette } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import logoImg from '@/assets/logo-kubovibe.png'
import PromptAttachMenu from '@/components/landing/PromptAttachMenu'

// Sugestões em linguagem natural — sem jargão técnico (Web2 ou Web3).
// O orquestrador detecta a stack por trás. O usuário só descreve a ideia.
const suggestions = [
  'Um app estilo Nubank com login e carteira digital',
  'Marketplace de NFTs com pagamento em cripto',
  'Loja online com fidelidade em tokens',
  'Dashboard SaaS com analytics em tempo real',
  'Rede social com recompensas para criadores',
]

export default function HeroSection() {
  const [prompt, setPrompt] = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [references, setReferences] = useState<string[]>([])
  const navigate = useNavigate()

  const handleAttachFile = (file: File) => {
    setAttachedFile(file)
    toast.success(`Arquivo anexado: ${file.name}`)
  }

  const handleScreenshot = async () => {
    try {
      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()
      
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      
      // Stop the stream
      stream.getTracks().forEach(track => track.stop())
      
      // Convert to blob and create file
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' })
          setAttachedFile(file)
          toast.success('Screenshot capturado!')
        }
      }, 'image/png')
    } catch (err) {
      toast.error('Não foi possível capturar a tela')
    }
  }

  const handleAddReference = (url: string) => {
    setReferences(prev => [...prev, url])
    toast.success('Referência adicionada!')
  }

  const handleGenerate = () => {
    if (prompt.trim()) {
      navigate('/builder', { state: { initialPrompt: prompt.trim() } })
    }
  }

  return (
    <section className="relative py-28 md:py-40 px-6 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />
      {/* Subtle gold radial */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/[0.03] blur-3xl pointer-events-none" />

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

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="flex justify-center mb-8"
        >
          <img src={logoImg} alt="KUBO VIBE" className="h-16 md:h-20 drop-shadow-2xl" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl md:text-6xl font-display font-bold text-foreground leading-[1.1] tracking-tight"
        >
          Transforme ideias em
          <br />
          <span className="hero-highlight">produtos reais</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed"
        >
          Descreva sua ideia em português comum. Nós cuidamos do resto — Web2, Web3, carteira, contratos. Você não precisa saber nada disso.
        </motion.p>

        {/* Prompt input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-10 max-w-2xl mx-auto"
        >
          <div className="relative glass glass-border rounded-2xl shadow-gold overflow-hidden">
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
              <div className="flex items-center gap-3">
                <PromptAttachMenu 
                  onAttachFile={handleAttachFile}
                  onScreenshot={handleScreenshot}
                  onAddReference={handleAddReference}
                />
                {attachedFile && (
                  <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-lg">
                    📎 {attachedFile.name}
                  </span>
                )}
                {references.length > 0 && (
                  <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-lg">
                    🔗 {references.length} ref{references.length > 1 ? 's' : ''}
                  </span>
                )}
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
                className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors border border-border/50"
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
              <Icon className="h-4 w-4 text-primary/70" />
              <span className="text-xs font-medium">{label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
