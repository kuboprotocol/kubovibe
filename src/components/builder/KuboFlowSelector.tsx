import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Brain, Rocket } from 'lucide-react'

export type KuboFlowMode = 'flow' | 'think' | 'ship'

interface KuboFlowSelectorProps {
  mode: KuboFlowMode
  onChange: (mode: KuboFlowMode) => void
}

const MODES = [
  {
    id: 'flow' as const,
    label: 'FLOW',
    icon: Zap,
    desc: 'Rápido & direto',
    color: 'from-blue-500 to-cyan-400',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.5)]',
    ring: 'ring-blue-500/50',
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    dotColor: 'bg-blue-400',
  },
  {
    id: 'think' as const,
    label: 'THINK',
    icon: Brain,
    desc: 'Estratégia & análise',
    color: 'from-purple-500 to-violet-400',
    glow: 'shadow-[0_0_20px_rgba(147,51,234,0.5)]',
    ring: 'ring-purple-500/50',
    textColor: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    dotColor: 'bg-purple-400',
  },
  {
    id: 'ship' as const,
    label: 'SHIP',
    icon: Rocket,
    desc: 'Produção total',
    color: 'from-primary to-yellow-400',
    glow: 'shadow-[0_0_20px_hsl(43,80%,55%,0.5)]',
    ring: 'ring-primary/50',
    textColor: 'text-primary',
    bgColor: 'bg-primary/10',
    dotColor: 'bg-primary',
  },
]

export default function KuboFlowSelector({ mode, onChange }: KuboFlowSelectorProps) {
  const activeIndex = MODES.findIndex(m => m.id === mode)
  const activeMode = MODES[activeIndex]

  return (
    <div className="flex items-center gap-1">
      {/* Compact pill selector */}
      <div className="relative flex items-center bg-secondary/80 rounded-full p-0.5 backdrop-blur-sm border border-border/50">
        {/* Sliding indicator */}
        <motion.div
          className={`absolute h-[calc(100%-4px)] rounded-full bg-gradient-to-r ${activeMode.color} ${activeMode.glow}`}
          style={{ width: `${100 / 3}%` }}
          animate={{ x: `${activeIndex * 100}%` }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />

        {MODES.map((m) => {
          const Icon = m.icon
          const isActive = mode === m.id
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              className={`relative z-10 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-display font-bold transition-colors duration-200 ${
                isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={m.desc}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          )
        })}
      </div>

      {/* Active mode indicator dot with pulse */}
      <div className="relative">
        <motion.div
          key={mode}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`h-2 w-2 rounded-full ${activeMode.dotColor}`}
        />
        <motion.div
          key={`pulse-${mode}`}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={`absolute inset-0 h-2 w-2 rounded-full ${activeMode.dotColor}`}
        />
      </div>
    </div>
  )
}

/**
 * Auto-detect the best mode based on prompt complexity
 */
export function autoDetectMode(prompt: string): KuboFlowMode {
  const lower = prompt.toLowerCase()
  const len = prompt.length

  const shipKeywords = [
    'app completo', 'complete app', 'sistema', 'system', 'e-commerce',
    'dashboard completo', 'full dashboard', 'produto', 'product',
    'startup', 'saas', 'marketplace', 'plataforma', 'platform',
    'clone', 'clonar', 'production', 'produção',
  ]

  const thinkKeywords = [
    'analise', 'analyze', 'planeje', 'plan', 'arquitetura', 'architecture',
    'estratégia', 'strategy', 'compare', 'avalie', 'evaluate',
    'melhor forma', 'best way', 'como fazer', 'how to',
    'explique', 'explain', 'sugira', 'suggest',
  ]

  if (shipKeywords.some(kw => lower.includes(kw)) || len > 500) return 'ship'
  if (thinkKeywords.some(kw => lower.includes(kw)) || (len > 200 && len <= 500)) return 'think'
  return 'flow'
}