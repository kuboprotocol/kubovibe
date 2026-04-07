import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Award, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'

const BADGES = [
  { type: 'streak_3', label: '3 Dias', emoji: '🔥', description: 'Streak de 3 dias consecutivos', color: 'from-orange-500/30 to-red-500/30', border: 'border-orange-500/50' },
  { type: 'streak_7', label: '7 Dias', emoji: '💎', description: 'Streak de 7 dias consecutivos', color: 'from-blue-500/30 to-cyan-500/30', border: 'border-blue-500/50' },
  { type: 'streak_14', label: '14 Dias', emoji: '🚀', description: 'Streak de 14 dias consecutivos', color: 'from-purple-500/30 to-pink-500/30', border: 'border-purple-500/50' },
  { type: 'streak_30', label: '30 Dias', emoji: '👑', description: 'Streak de 30 dias consecutivos', color: 'from-yellow-500/30 to-amber-500/30', border: 'border-yellow-500/50' },
]

export default function BadgesCard() {
  const { user } = useAuth()
  const [unlockedBadges, setUnlockedBadges] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function fetch() {
      const { data } = await supabase
        .from('user_badges' as any)
        .select('badge_type')
        .eq('user_id', user!.id)

      if (data) {
        setUnlockedBadges(new Set((data as any[]).map((b: any) => b.badge_type)))
      }
      setLoading(false)
    }
    fetch()
  }, [user])

  if (loading) return null

  const unlockedCount = BADGES.filter(b => unlockedBadges.has(b.type)).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass glass-border rounded-2xl p-5 mb-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center">
          <Award className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-display font-bold text-foreground">🏅 Conquistas</h3>
          <p className="text-xs text-muted-foreground">{unlockedCount}/{BADGES.length} desbloqueadas</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {BADGES.map((badge) => {
          const unlocked = unlockedBadges.has(badge.type)
          return (
            <motion.div
              key={badge.type}
              whileHover={{ scale: 1.03 }}
              className={`relative rounded-xl p-4 text-center transition-all border ${
                unlocked
                  ? `bg-gradient-to-br ${badge.color} ${badge.border}`
                  : 'bg-muted/20 border-border/30 opacity-50'
              }`}
            >
              {!unlocked && (
                <div className="absolute top-2 right-2">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
              <div className={`text-3xl mb-1 ${unlocked ? '' : 'grayscale'}`}>
                {badge.emoji}
              </div>
              <p className={`text-sm font-bold ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                {badge.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {badge.description}
              </p>
              {unlocked && (
                <div className="mt-2 text-xs text-primary font-bold">✅ Desbloqueada</div>
              )}
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
