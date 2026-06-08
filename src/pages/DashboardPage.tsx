import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, FileText, Trash2, LogOut, Code, Pencil, UserCircle, Search, MoreHorizontal, Zap, Globe, BarChart3, CreditCard, Gift, Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { motion } from 'framer-motion'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { PromoCards } from '@/components/dashboard/PromoCards'
import logoImg from '@/assets/logo-kubovibe.png'
import CreditLedger from '@/components/CreditLedger'
import { Gamepad2, Sparkles, Palette } from 'lucide-react'

interface Project {
  id: string
  title: string
  description: string | null
  generated_code: string | null
  updated_at: string
  is_published: boolean
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { subscription, loading: subLoading, editsRemaining } = useSubscription()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [renameProject, setRenameProject] = useState<Project | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { loadProjects() }, [])

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, title, description, generated_code, updated_at, is_published')
      .order('updated_at', { ascending: false })
    if (error) { toast.error('Erro ao carregar projetos'); console.error(error) }
    else setProjects(data || [])
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) toast.error('Erro ao deletar projeto')
    else setProjects(prev => prev.filter(p => p.id !== id))
  }

  const handleRename = async () => {
    if (!renameProject || !newTitle.trim()) return
    const { error } = await supabase.from('projects').update({ title: newTitle.trim() }).eq('id', renameProject.id)
    if (error) toast.error('Erro ao renomear projeto')
    else {
      setProjects(prev => prev.map(p => p.id === renameProject.id ? { ...p, title: newTitle.trim() } : p))
      toast.success('Projeto renomeado!')
    }
    setRenameProject(null)
  }

  const handleSignOut = async () => { await signOut(); navigate('/') }

  const filtered = projects.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
  const publishedCount = projects.filter(p => p.is_published).length
  const withCodeCount = projects.filter(p => p.generated_code).length
  const usagePercent = subscription ? Math.round((subscription.edits_used / subscription.edits_limit) * 100) : 0

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute inset-0 dot-pattern opacity-20 pointer-events-none" />

      <header className="sticky top-0 z-50 glass glass-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="KUBO VIBE" className="h-7" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/emails')} className="rounded-xl gap-2 text-muted-foreground hover:text-foreground">
              <Mail className="h-4 w-4" /> Emails
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/shortlinks')} className="rounded-xl gap-2 border-primary/20 text-primary hover:bg-primary/10">
              <Gift className="h-4 w-4" /> Ganhar Créditos
            </Button>
            <Button variant="hero" size="sm" onClick={() => navigate('/builder')} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" /> Novo Projeto
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} title="Perfil" className="rounded-xl text-muted-foreground hover:text-foreground">
              <UserCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair" className="rounded-xl text-muted-foreground hover:text-foreground">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 relative z-10">
        {/* Stats Cards */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <div className="glass glass-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Projects</span>
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{projects.length}</p>
          </div>
          <div className="glass glass-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-accent/50 flex items-center justify-center">
                <Globe className="h-4 w-4 text-accent-foreground" />
              </div>
              <span className="text-xs text-muted-foreground">Published</span>
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{publishedCount}</p>
          </div>
          <div className="glass glass-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Credits</span>
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{editsRemaining ?? '—'}</p>
            {subscription && (
              <Progress value={usagePercent} className="mt-2 h-1.5" />
            )}
          </div>
          <div className="glass glass-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate('/pricing')}>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Plan</span>
            </div>
            <p className="text-lg font-display font-bold text-foreground capitalize">{subscription?.plan ?? 'None'}</p>
            <p className="text-[10px] text-primary mt-1">Upgrade →</p>
          </div>
        </motion.div>

        {/* Promo Cards */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
          <PromoCards />
        </motion.div>

        {/* Smart Economy + Quantum Engine entry */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          className="grid lg:grid-cols-[1fr_360px] gap-4 mb-8 mt-6">
          <div
            onClick={() => navigate('/game')}
            className="glass-premium hover-glow rounded-2xl p-6 cursor-pointer gradient-aurora animate-aurora-shift relative overflow-hidden group"
          >
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Gamepad2 className="w-5 h-5 text-primary" />
                  <span className="text-xs tracking-[0.3em] text-muted-foreground">KUBO QUANTUM ENGINE</span>
                </div>
                <h3 className="text-2xl font-display font-bold mb-2">
                  Crie <span className="neon-text">mundos vivos</span> com IA
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Mundo procedural · NPCs com memória · ECS · WebGL/Three.js · Sandbox WGSL seguro
                </p>
              </div>
              <Sparkles className="w-8 h-8 text-primary opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
            </div>
          </div>
          {user && <CreditLedger userId={user.id} />}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground mb-1">Seus projetos</h1>
              <p className="text-muted-foreground text-sm">Gerencie e continue trabalhando nos seus apps</p>
            </div>
            {projects.length > 0 && (
              <div className="relative w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar projetos..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-10 h-10 rounded-xl bg-secondary/50 border-border/50 focus-visible:ring-primary/30" />
              </div>
            )}
          </div>
        </motion.div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Carregando...</div>
        ) : projects.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24">
            <div className="glass glass-border rounded-3xl p-12 max-w-md mx-auto shadow-gold">
              <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow">
                <FileText className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="text-xl font-display font-bold text-foreground mb-2">Nenhum projeto ainda</h2>
              <p className="text-muted-foreground text-sm mb-8">Crie seu primeiro projeto e comece a construir</p>
              <Button variant="hero" size="lg" onClick={() => navigate('/builder')} className="rounded-xl gap-2">
                <Plus className="h-4 w-4" /> Criar primeiro projeto
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project, index) => (
              <motion.div key={project.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                <div className="group cursor-pointer glass glass-border rounded-2xl p-5 hover:shadow-gold transition-all duration-300 hover:border-primary/30"
                  onClick={() => navigate(`/builder/${project.id}`)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold text-foreground truncate text-sm">{project.title}</h3>
                      {project.description && <p className="text-xs text-muted-foreground mt-1 truncate">{project.description}</p>}
                      <div className="flex items-center gap-2 mt-3">
                        {project.is_published && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-accent/50 text-accent-foreground font-medium">
                            <Globe className="h-2.5 w-2.5" /> Published
                          </span>
                        )}
                        {project.generated_code && !project.is_published && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-accent/80 text-accent-foreground font-medium">
                            <Code className="h-2.5 w-2.5" /> Has code
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(project.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
                          onClick={e => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                        <DropdownMenuItem onClick={e => { e.stopPropagation(); setRenameProject(project); setNewTitle(project.title) }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Deletar
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={e => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deletar projeto?</AlertDialogTitle>
                              <AlertDialogDescription>Essa ação não pode ser desfeita. O projeto "{project.title}" será permanentemente removido.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={e => { e.stopPropagation(); handleDelete(project.id) }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Deletar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!renameProject} onOpenChange={open => !open && setRenameProject(null)}>
        <DialogContent className="glass rounded-2xl" onClick={e => e.stopPropagation()}>
          <DialogHeader><DialogTitle className="font-display">Renomear projeto</DialogTitle></DialogHeader>
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Novo nome do projeto"
            onKeyDown={e => e.key === 'Enter' && handleRename()} className="h-11 rounded-xl" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameProject(null)} className="rounded-xl">Cancelar</Button>
            <Button variant="hero" onClick={handleRename} disabled={!newTitle.trim()} className="rounded-xl">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
