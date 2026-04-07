import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Trophy, Flame, Crown, Medal } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import logoImg from '@/assets/logo-kubovibe.png'

interface LeaderboardEntry {
  user_id: string
  current_streak: number
  longest_streak: number
  display_name: string | null
  avatar_url: string | null
}

const RANK_STYLES = [
  { bg: 'from-yellow-500/20 to-amber-500/20', border: 'border-yellow-500/40', icon: Crown, color: 'text-yellow-500' },
  { bg: 'from-slate-300/20 to-slate-400/20', border: 'border-slate-400/40', icon: Medal, color: 'text-slate-400' },
  { bg: 'from-amber-700/20 to-orange-600/20', border: 'border-amber-700/40', icon: Medal, color: 'text-amber-700' },
]

export default function LeaderboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [userRank, setUserRank] = useState<number | null>(null)

  useEffect(() => {
    async function fetchLeaderboard() {
      const { data: streaks } = await supabase
        .from('user_streaks')
        .select('user_id, current_streak, longest_streak')
        .order('longest_streak', { ascending: false })
        .limit(50)

      if (!streaks || streaks.length === 0) {
        setLoading(false)
        return
      }

      const userIds = streaks.map((s) => s.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds)

      const profileMap = new Map(
        (profiles || []).map(p => [p.id, p])
      )

      const merged: LeaderboardEntry[] = streaks.map((s) => {
        const profile = profileMap.get(s.user_id)
        return {
          user_id: s.user_id,
          current_streak: s.current_streak,
          longest_streak: s.longest_streak,
          display_name: profile?.display_name || 'Anônimo',
          avatar_url: profile?.avatar_url || null,
        }
      })

      setEntries(merged)

      if (user) {
        const rank = merged.findIndex(e => e.user_id === user.id)
        setUserRank(rank >= 0 ? rank + 1 : null)
      }

      setLoading(false)
    }

    fetchLeaderboard()
  }, [user])

  if (!user) { navigate('/auth'); return null }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />

      <header className="sticky top-0 z-50 glass glass-border">
        <div className="max-w-lg mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/shortlinks')} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logoImg} alt="KUBO VIBE" className="h-8" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-primary font-bold">Leaderboard</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-yellow-500/20 flex items-center justify-center mx-auto mb-4">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display font-bold text-2xl text-foreground">🏆 Ranking de Streaks</h1>
          <p className="text-muted-foreground text-sm mt-1">Os maiores streaks da comunidade Kubo Vibe</p>
          {userRank && (
            <p className="text-primary text-sm font-bold mt-2">
              Sua posição: #{userRank}
            </p>
          )}
        </motion.div>

        {loading ? (
          <div className="text-center py-12">
            <Flame className="h-8 w-8 text-primary mx-auto animate-pulse mb-3" />
            <p className="text-muted-foreground">Carregando ranking...</p>
          </div>
        ) : entries.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <p className="text-muted-foreground">Nenhum streak registrado ainda.</p>
            <Button variant="hero" className="mt-4" onClick={() => navigate('/shortlinks')}>
              🔥 Começar meu streak
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, i) => {
              const isCurrentUser = entry.user_id === user?.id
              const rankStyle = i < 3 ? RANK_STYLES[i] : null
              const RankIcon = rankStyle?.icon || null

              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`glass glass-border rounded-2xl p-4 flex items-center gap-4 ${
                    isCurrentUser ? 'ring-2 ring-primary/40 border-primary/30' : ''
                  } ${rankStyle ? `bg-gradient-to-r ${rankStyle.bg} ${rankStyle.border}` : ''}`}
                >
                  {/* Rank number */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-lg ${
                    rankStyle ? rankStyle.color : 'text-muted-foreground'
                  } ${i < 3 ? 'bg-background/50' : 'bg-muted/30'}`}>
                    {RankIcon ? <RankIcon className="h-5 w-5" /> : i + 1}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-bold">
                        {(entry.display_name || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Name & streak */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate ${isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
                      {entry.display_name || 'Anônimo'}
                      {isCurrentUser && <span className="text-xs ml-1 opacity-70">(você)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Streak atual: {entry.current_streak} dias
                    </p>
                  </div>

                  {/* Longest streak */}
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xl font-display font-bold ${rankStyle ? rankStyle.color : 'text-primary'}`}>
                      {entry.longest_streak}
                    </div>
                    <span className="text-xs text-muted-foreground">recorde</span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-8 text-center">
          <Button
            variant="outline"
            className="rounded-full gap-2 px-6"
            onClick={() => navigate('/shortlinks')}
          >
            <Flame className="h-4 w-4" />
            🔥 Voltar para ganhar créditos
          </Button>
        </motion.div>
      </main>
    </div>
  )
}
