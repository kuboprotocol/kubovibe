import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, FileText, Trash2, LogOut, Code, Pencil, UserCircle, Search, MoreHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { motion } from 'framer-motion'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import logoImg from '@/assets/logo-kubovibe.png'

interface Project {
  id: string
  title: string
  description: string | null
  generated_code: string | null
  updated_at: string
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [renameProject, setRenameProject] = useState<Project | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { loadProjects() }, [])

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, title, description, generated_code, updated_at')
      .order('updated_at', { ascending: false })
    if (error) { toast.error('Erro ao carregar projetos'); console.error(error) }
    else { setProjects(data || []) }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) { toast.error('Erro ao deletar projeto') }
    else { setProjects((prev) => prev.filter((p) => p.id !== id)) }
  }

  const handleRename = async () => {
    if (!renameProject || !newTitle.trim()) return
    const { error } = await supabase.from('projects').update({ title: newTitle.trim() }).eq('id', renameProject.id)
    if (error) { toast.error('Erro ao renomear projeto') }
    else {
      setProjects((prev) => prev.map((p) => (p.id === renameProject.id ? { ...p, title: newTitle.trim() } : p)))
      toast.success('Projeto renomeado!')
    }
    setRenameProject(null)
  }

  const handleSignOut = async () => { await signOut(); navigate('/') }

  const filtered = projects.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))

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
            <Button variant="hero" size="sm" onClick={() => navigate('/builder')} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" />
              Novo Projeto
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
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground mb-1">Seus projetos</h1>
          <p className="text-muted-foreground text-sm">Gerencie e continue trabalhando nos seus apps</p>
        </motion.div>

        {projects.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
            <div className="relative max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar projetos..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 rounded-xl bg-secondary/50 border-border/50 focus-visible:ring-primary/30" />
            </div>
          </motion.div>
        )}

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
                <div
                  className="group cursor-pointer glass glass-border rounded-2xl p-5 hover:shadow-gold transition-all duration-300 hover:border-primary/30"
                  onClick={() => navigate(`/builder/${project.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold text-foreground truncate text-sm">{project.title}</h3>
                      {project.description && <p className="text-xs text-muted-foreground mt-1 truncate">{project.description}</p>}
                      <div className="flex items-center gap-2 mt-3">
                        {project.generated_code && (
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
                          onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameProject(project); setNewTitle(project.title) }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Deletar
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deletar projeto?</AlertDialogTitle>
                              <AlertDialogDescription>Essa ação não pode ser desfeita. O projeto "{project.title}" será permanentemente removido.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={(e) => { e.stopPropagation(); handleDelete(project.id) }}
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

      <Dialog open={!!renameProject} onOpenChange={(open) => !open && setRenameProject(null)}>
        <DialogContent className="glass rounded-2xl" onClick={(e) => e.stopPropagation()}>
          <DialogHeader><DialogTitle className="font-display">Renomear projeto</DialogTitle></DialogHeader>
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Novo nome do projeto"
            onKeyDown={(e) => e.key === 'Enter' && handleRename()} className="h-11 rounded-xl" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameProject(null)} className="rounded-xl">Cancelar</Button>
            <Button variant="hero" onClick={handleRename} disabled={!newTitle.trim()} className="rounded-xl">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
