import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import robotImg from '@/assets/robot-coding.png'

const MESSAGES = [
  { text: "Estamos trabalhando no seu projeto. Obrigado pela confiança.", lang: "pt" },
  { text: "We are working on your project. Thank you for your trust.", lang: "en" },
  { text: "Nous travaillons sur votre projet. Merci pour votre confiance.", lang: "fr" },
  { text: "Estamos trabajando en tu proyecto. Gracias por tu confianza.", lang: "es" },
]

const CODE_LINES = [
  'const app = createApp({',
  '  theme: "dark",',
  '  layout: "responsive",',
  '  components: [...],',
  '});',
  'app.render(<Main />);',
  'export default app;',
]

function FloatingCodeLine({ text, delay, x, y }: { text: string; delay: number; x: number; y: number }) {
  return (
    <motion.div
      className="absolute text-xs font-mono whitespace-nowrap pointer-events-none select-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, x: -20 }}
      animate={{
        opacity: [0, 0.3, 0.3, 0],
        x: [-20, 0, 0, 20],
      }}
      transition={{
        duration: 6,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <span className="text-accent-foreground/40">{text}</span>
    </motion.div>
  )
}

function ProgressDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-primary"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 1.2,
            delay: i * 0.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

function GlowOrb({ size, x, y, delay, color }: { size: number; x: string; y: string; delay: number; color: string }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: 'blur(40px)',
      }}
      animate={{
        opacity: [0.15, 0.35, 0.15],
        scale: [0.9, 1.1, 0.9],
      }}
      transition={{
        duration: 5,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

export default function AILoadingAnimation({ isVisible }: { isVisible: boolean }) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    if (!isVisible) return
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % MESSAGES.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [isVisible])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-background overflow-hidden z-10"
        >
          {/* Ambient glow orbs */}
          <GlowOrb size={300} x="10%" y="20%" delay={0} color="hsl(43 80% 55% / 0.2)" />
          <GlowOrb size={250} x="70%" y="60%" delay={2} color="hsl(220 70% 50% / 0.15)" />
          <GlowOrb size={200} x="50%" y="10%" delay={1} color="hsl(280 60% 50% / 0.1)" />

          {/* Floating code lines */}
          {CODE_LINES.map((line, i) => (
            <FloatingCodeLine
              key={i}
              text={line}
              delay={i * 1.2}
              x={5 + (i % 3) * 30 + Math.random() * 10}
              y={10 + i * 12}
            />
          ))}

          {/* Main content */}
          <motion.div
            className="relative z-20 flex flex-col items-center gap-8"
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {/* Robot image with glow */}
            <motion.div
              className="relative"
              animate={{ y: [-4, 4, -4] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div
                className="absolute inset-0 rounded-3xl"
                style={{
                  background: 'radial-gradient(circle, hsl(43 80% 55% / 0.15) 0%, transparent 60%)',
                  filter: 'blur(30px)',
                  transform: 'scale(1.5)',
                }}
              />
              <img
                src={robotImg}
                alt="AI Working"
                className="relative w-64 h-48 object-contain rounded-2xl"
              />
            </motion.div>

            {/* Progress indicator */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                <motion.div
                  className="h-1 rounded-full bg-primary/30 overflow-hidden"
                  style={{ width: 120 }}
                >
                  <motion.div
                    className="h-full rounded-full gradient-primary"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ width: '50%' }}
                  />
                </motion.div>
                <ProgressDots />
              </div>

              {/* Rotating subtitle */}
              <div className="h-12 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={messageIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5 }}
                    className="text-sm text-muted-foreground text-center max-w-sm font-medium"
                  >
                    {MESSAGES[messageIndex].text}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
