import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useMemo } from 'react'
import robotImg from '@/assets/robot-coding.png'

// Messages grouped by language
const MESSAGES_BY_LANG: Record<string, string[]> = {
  pt: [
    "Estamos trabalhando no seu projeto. Obrigado pela confiança.",
    "A mágica está acontecendo nos bastidores...",
    "Cada linha de código é pensada com cuidado.",
    "Quase lá! Seu app está tomando forma.",
    "Transformando suas ideias em realidade...",
    "Nosso robô está programando sem parar!",
    "Criando algo incrível, só pra você.",
    "Preparando cada detalhe com carinho.",
    "Seu projeto está ficando sensacional!",
    "Aguarde um instante, a IA está em ação.",
    "Montando a estrutura do seu aplicativo...",
    "A criatividade artificial está a todo vapor!",
    "Estamos quase prontos. Não saia daí!",
    "Otimizando o código para a melhor performance.",
    "Dando os toques finais no seu projeto.",
    "Conectando os componentes com precisão.",
    "Design e código caminhando juntos.",
    "A inteligência artificial está concentrada!",
    "Seu app ganha vida a cada segundo.",
    "Finalizando os últimos detalhes...",
  ],
  en: [
    "We are working on your project. Thank you for your trust.",
    "Building something amazing, just for you.",
    "Transforming your idea into reality...",
    "Great things take a moment. Hang tight!",
    "Our robot is coding non-stop!",
    "Every line of code is crafted with care.",
    "Almost there! Your app is taking shape.",
    "The AI is hard at work behind the scenes.",
    "Creativity meets technology, just for you.",
    "Preparing every detail with precision.",
    "Your project is looking amazing!",
    "Hold on, the magic is happening.",
    "Assembling your application structure...",
    "Optimizing code for best performance.",
    "Adding the finishing touches to your project.",
    "Connecting components with precision.",
    "Design and code working in harmony.",
    "The artificial intelligence is focused!",
    "Your app comes to life every second.",
    "Wrapping up the final details...",
  ],
  es: [
    "Estamos trabajando en tu proyecto. Gracias por tu confianza.",
    "La magia está sucediendo tras bastidores...",
    "Cada línea de código se piensa con cuidado.",
    "¡Casi listo! Tu app está tomando forma.",
    "Transformando tus ideas en realidad...",
    "Nuestro robot está programando sin parar.",
    "Creando algo increíble, solo para ti.",
    "Preparando cada detalle con cariño.",
    "Tu proyecto está quedando sensacional.",
    "Espera un momento, la IA está en acción.",
  ],
  fr: [
    "Nous travaillons sur votre projet. Merci pour votre confiance.",
    "La magie opère en coulisses...",
    "Chaque ligne de code est soigneusement pensée.",
    "Presque terminé ! Votre app prend forme.",
    "Transformer vos idées en réalité...",
    "Notre robot code sans relâche !",
    "Création de quelque chose d'incroyable, juste pour vous.",
    "Préparer chaque détail avec soin.",
    "Votre projet est sensationnel !",
    "Patientez un instant, l'IA est en action.",
  ],
  de: [
    "Wir arbeiten an Ihrem Projekt. Danke für Ihr Vertrauen.",
    "Die Magie geschieht hinter den Kulissen...",
    "Jede Codezeile wird sorgfältig durchdacht.",
    "Fast fertig! Ihre App nimmt Gestalt an.",
    "Ihre Ideen werden Wirklichkeit...",
    "Unser Roboter programmiert ohne Pause!",
    "Etwas Erstaunliches wird nur für Sie erstellt.",
    "Jedes Detail wird mit Sorgfalt vorbereitet.",
    "Ihr Projekt sieht fantastisch aus!",
    "Einen Moment bitte, die KI ist in Aktion.",
  ],
  ja: [
    "プロジェクトに取り組んでいます。ご信頼ありがとうございます。",
    "魔法が舞台裏で起こっています...",
    "コードの一行一行を丁寧に作成しています。",
    "もう少しです！アプリが形になっています。",
    "あなたのアイデアを現実に変えています...",
    "ロボットが休みなくプログラミング中！",
    "あなただけのために、素晴らしいものを作成中。",
    "すべてのディテールを丁寧に準備しています。",
    "プロジェクトが素晴らしい仕上がりに！",
    "少々お待ちください、AIが作業中です。",
  ],
}

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

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`
}

/** Detect language from text using simple heuristics */
function detectLanguage(text: string): string {
  const lower = text.toLowerCase()
  // Japanese/Chinese characters
  if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(lower)) return 'ja'
  // Portuguese indicators
  if (/\b(criar|fazer|adicionar|quero|preciso|pode|como|obrigado|olá|projeto|página|botão|não|sim|está|são|você|também|aplicativo)\b/.test(lower)) return 'pt'
  // Spanish indicators
  if (/\b(crear|hacer|añadir|quiero|necesito|puede|cómo|gracias|hola|proyecto|página|botón|también|aplicación)\b/.test(lower)) return 'es'
  // French indicators
  if (/\b(créer|faire|ajouter|veux|besoin|peut|comment|merci|bonjour|projet|aussi|application|je|nous|vous|est)\b/.test(lower)) return 'fr'
  // German indicators
  if (/\b(erstellen|machen|hinzufügen|möchte|brauche|kann|wie|danke|hallo|projekt|auch|anwendung|ich|wir|sie|ist)\b/.test(lower)) return 'de'
  // Default to English
  return 'en'
}

interface AILoadingAnimationProps {
  isVisible: boolean
  /** The language detected from user's chat messages */
  chatLanguage?: string
  /** Generation already finished — show "ready" CTA so user isn't stuck on the overlay */
  isReady?: boolean
  /** Called when user clicks "ver agora" — should hide the overlay */
  onSkip?: () => void
}

export default function AILoadingAnimation({ isVisible, chatLanguage, isReady, onSkip }: AILoadingAnimationProps) {
  const [messageIndex, setMessageIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  // Get messages for the detected language, fallback to 'en'
  const messages = useMemo(() => {
    const lang = chatLanguage || 'en'
    return MESSAGES_BY_LANG[lang] || MESSAGES_BY_LANG['en']
  }, [chatLanguage])

  useEffect(() => {
    if (!isVisible) {
      setElapsed(0)
      setMessageIndex(0)
      return
    }
    // Rotate messages every 5 seconds (slower since we have more messages)
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length)
    }, 5000)
    const timer = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 1000)
    return () => {
      clearInterval(interval)
      clearInterval(timer)
    }
  }, [isVisible, messages])

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

              {/* Elapsed timer */}
              <motion.div
                className="flex items-center gap-2 text-xs text-muted-foreground/70 font-mono"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <span>⏱</span>
                <span>{formatTime(elapsed)}</span>
                <span className="text-muted-foreground/40">elapsed</span>
              </motion.div>

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
                    {messages[messageIndex]}
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

export { detectLanguage }
