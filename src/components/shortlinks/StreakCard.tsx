import { Flame } from 'lucide-react'
import { motion } from 'framer-motion'

const MILESTONES = [
  { days: 3, bonus: 0.5, emoji: '🔥' },
  { days: 7, bonus: 1.0, emoji: '💎' },
  { days: 14, bonus: 2.0, emoji: '🚀' },
  { days: 30, bonus: 5.0, emoji: '👑' },
]

interface StreakCardProps {
  currentStreak: number
  longestStreak: number
}

export default function StreakCard({ currentStreak, longestStreak }: StreakCardProps) {
  const nextMilestone = MILESTONES.find(m => m.days > currentStreak)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass glass-border rounded-2xl p-5 mb-6"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
          <Flame className="h-6 w-6 text-orange-500" />
        </div>
        <div className="flex-1">
          <h3 className="font-display font-bold text-foreground text-lg">
            🔥 Streak Diário
          </h3>
          <p className="text-sm text-muted-foreground">
            Complete 10 vídeos por dia consecutivo
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-display font-bold text-orange-500">
            {currentStreak}
          </div>
          <span className="text-xs text-muted-foreground">
            {currentStreak === 1 ? 'dia' : 'dias'}
          </span>
        </div>
      </div>

      {/* Milestone progress */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {MILESTONES.map((m) => {
          const reached = currentStreak >= m.days
          return (
            <div
              key={m.days}
              className={`rounded-xl p-2 text-center transition-all ${
                reached
                  ? 'bg-primary/20 border border-primary/30'
                  : 'bg-muted/30 border border-border/50'
              }`}
            >
              <div className="text-lg">{m.emoji}</div>
              <div className={`text-xs font-bold ${reached ? 'text-primary' : 'text-muted-foreground'}`}>
                {m.days} dias
              </div>
              <div className={`text-xs ${reached ? 'text-primary' : 'text-muted-foreground/60'}`}>
                +{m.bonus}
              </div>
            </div>
          )
        })}
      </div>

      {/* Next milestone hint */}
      {nextMilestone && currentStreak > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          ⏳ Faltam <span className="text-primary font-bold">{nextMilestone.days - currentStreak} dias</span> para o bônus de +{nextMilestone.bonus} créditos {nextMilestone.emoji}
        </p>
      )}

      {currentStreak >= 30 && (
        <p className="text-xs text-primary text-center font-bold">
          👑 Streak máximo! +5.0 bônus por dia completo!
        </p>
      )}

      {longestStreak > currentStreak && (
        <p className="text-xs text-muted-foreground text-center mt-1">
          Recorde: {longestStreak} dias 🏆
        </p>
      )}
    </motion.div>
  )
}
