import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Brain, Rocket, Sparkles, Lock } from 'lucide-react'
import { toast } from 'sonner'

export type KuboFlowMode = 'flow' | 'think' | 'ship'

const MODE_PLAN_REQUIREMENTS: Record<KuboFlowMode, string[]> = {
  flow: [],           // free for all
  think: ['pro', 'ultra', 'starter'],
  ship: ['ultra'],
}

interface KuboFlowSelectorProps {
  mode: KuboFlowMode
  onChange: (mode: KuboFlowMode) => void
  autoDetected?: boolean
  userPlan?: string
}

const MODES = [
  {
    id: 'flow' as const,
    label: 'FLOW',
    icon: Zap,
    desc: 'Rápido & direto',
    gradient: 'from-blue-500 to-cyan-400',
    glowColor: 'rgba(59,130,246,0.6)',
    textActive: 'text-white',
    dotColor: 'bg-blue-400',
    barColor: '#3b82f6',
  },
  {
    id: 'think' as const,
    label: 'THINK',
    icon: Brain,
    desc: 'Estratégia & análise',
    gradient: 'from-purple-500 to-violet-400',
    glowColor: 'rgba(147,51,234,0.6)',
    textActive: 'text-white',
    dotColor: 'bg-purple-400',
    barColor: '#9333ea',
  },
  {
    id: 'ship' as const,
    label: 'SHIP',
    icon: Rocket,
    desc: 'Produção total',
    gradient: 'from-amber-500 to-yellow-400',
    glowColor: 'hsl(43,80%,55%,0.6)',
    textActive: 'text-black',
    dotColor: 'bg-primary',
    barColor: 'hsl(43,80%,55%)',
  },
]

export default function KuboFlowSelector({ mode, onChange, autoDetected }: KuboFlowSelectorProps) {
  const activeIndex = MODES.findIndex(m => m.id === mode)
  const activeMode = MODES[activeIndex]
  const [showAutoLabel, setShowAutoLabel] = useState(false)
  const prevModeRef = useRef(mode)

  // Show "auto" label briefly when auto-detected
  useEffect(() => {
    if (autoDetected && mode !== prevModeRef.current) {
      setShowAutoLabel(true)
      const t = setTimeout(() => setShowAutoLabel(false), 2000)
      prevModeRef.current = mode
      return () => clearTimeout(t)
    }
    prevModeRef.current = mode
  }, [mode, autoDetected])

  return (
    <div className="flex items-center gap-2">
      {/* Main selector pill */}
      <div className="relative flex items-center bg-secondary/80 rounded-full p-[3px] backdrop-blur-sm border border-border/50 overflow-hidden">
        {/* Ambient glow behind active */}
        <motion.div
          className="absolute inset-0 rounded-full opacity-20 blur-xl pointer-events-none"
          animate={{ backgroundColor: activeMode.barColor }}
          transition={{ duration: 0.4 }}
        />

        {/* Sliding pill indicator */}
        <motion.div
          className={`absolute top-[3px] bottom-[3px] rounded-full bg-gradient-to-r ${activeMode.gradient}`}
          style={{
            width: `calc(${100 / 3}% - 2px)`,
            boxShadow: `0 0 16px ${activeMode.glowColor}, 0 0 4px ${activeMode.glowColor}`,
          }}
          animate={{ left: `calc(${activeIndex * (100 / 3)}% + 1px)` }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />

        {MODES.map((m) => {
          const Icon = m.icon
          const isActive = mode === m.id
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-display font-bold transition-all duration-200 cursor-pointer select-none ${
                isActive ? m.textActive : 'text-muted-foreground hover:text-foreground'
              }`}
              title={m.desc}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? 'drop-shadow-sm' : ''}`} />
              <span className="hidden sm:inline tracking-wider">{m.label}</span>
            </button>
          )
        })}
      </div>

      {/* Status indicator */}
      <div className="relative flex items-center gap-1.5">
        {/* Pulsing dot */}
        <div className="relative">
          <motion.div
            key={mode}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`h-2 w-2 rounded-full ${activeMode.dotColor}`}
          />
          <motion.div
            key={`ring-${mode}`}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            className={`absolute inset-0 h-2 w-2 rounded-full ${activeMode.dotColor}`}
          />
        </div>

        {/* Auto-detect label */}
        <AnimatePresence>
          {showAutoLabel && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              className="flex items-center gap-0.5 text-[9px] font-display font-bold text-muted-foreground uppercase tracking-widest"
            >
              <Sparkles className="h-2.5 w-2.5 text-primary" />
              auto
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * Auto-detect the best mode based on prompt complexity.
 * Returns null if prompt is too short to decide.
 */
export function autoDetectMode(prompt: string): KuboFlowMode {
  const lower = prompt.toLowerCase().trim()
  const len = lower.length

  if (len < 15) return 'flow'

  const shipKeywords = [
    'app completo', 'complete app', 'sistema completo', 'full system',
    'e-commerce', 'ecommerce', 'marketplace', 'plataforma', 'platform',
    'clone', 'clonar', 'production', 'produção', 'saas',
    'startup', 'produto completo', 'full product', 'build a complete',
    'crie um app', 'create an app', 'aplicativo completo',
  ]

  const thinkKeywords = [
    'analise', 'analyze', 'planeje', 'plan', 'arquitetura', 'architecture',
    'estratégia', 'strategy', 'compare', 'avalie', 'evaluate',
    'melhor forma', 'best way', 'como fazer', 'how to',
    'explique', 'explain', 'sugira', 'suggest', 'pense', 'think',
    'sistema', 'system', 'api', 'backend', 'database',
  ]

  if (shipKeywords.some(kw => lower.includes(kw)) || len > 500) return 'ship'
  if (thinkKeywords.some(kw => lower.includes(kw)) || (len > 200 && len <= 500)) return 'think'
  return 'flow'
}