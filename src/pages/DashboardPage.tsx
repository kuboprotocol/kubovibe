import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, FileText, Trash2, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'

interface CanvasEntry {
  id: string
  name: string
  updatedAt: string
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [canvasList, setCanvasList] = useState<CanvasEntry[]>([])

  useEffect(() => {
    const list = JSON.parse(localStorage.getItem('canvas-list') || '[]')
    setCanvasList(list)
  }, [])

  const handleDelete = (id: string) => {
    const updated = canvasList.filter((c) => c.id !== id)
    setCanvasList(updated)
    localStorage.setItem('canvas-list', JSON.stringify(updated))
    localStorage.removeItem(`canvas-${id}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">My Projects</h1>
          </div>
          <Button variant="hero" onClick={() => navigate('/canvas')}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {canvasList.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="inline-flex p-4 rounded-2xl bg-accent mb-4">
              <FileText className="h-10 w-10 text-accent-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No projects yet</h2>
            <p className="text-muted-foreground mb-6">Create your first project to get started</p>
            <Button variant="hero" onClick={() => navigate('/canvas')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {canvasList.map((canvas, index) => (
              <motion.div
                key={canvas.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="group cursor-pointer p-5 hover:border-primary hover:shadow-lg transition-all duration-200"
                  onClick={() => navigate(`/canvas/${canvas.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{canvas.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(canvas.updatedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(canvas.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
