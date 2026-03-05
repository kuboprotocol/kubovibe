import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ArrowLeft, Camera, Loader2, Mail, User, Shield, Sparkles } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!user) return
    loadProfile()
  }, [user])

  const loadProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user!.id)
      .single()

    if (!error && data) {
      setDisplayName(data.display_name || '')
      setAvatarUrl(data.avatar_url)
    }
    setLoading(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB')
      return
    }

    setUploading(true)
    const fileExt = file.name.split('.').pop()
    const filePath = `${user.id}/avatar.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      toast.error('Erro ao enviar imagem')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    const url = `${publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateError) {
      toast.error('Erro ao atualizar perfil')
    } else {
      setAvatarUrl(url)
      toast.success('Avatar atualizado!')
    }
    setUploading(false)
  }

  const handleSave = async () => {
    if (!user || !displayName.trim()) return
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) {
      toast.error('Erro ao salvar perfil')
    } else {
      toast.success('Perfil atualizado!')
    }
    setSaving(false)
  }

  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      {/* Header */}
      <header className="glass glass-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="hover:bg-accent">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Meu Perfil</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-6"
        >
          {/* Avatar Section */}
          <div className="glass glass-border rounded-2xl p-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group shrink-0">
              <div className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 blur-sm group-hover:blur-md transition-all" />
              <Avatar className="h-28 w-28 text-lg ring-2 ring-border relative">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt="Avatar" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-accent text-accent-foreground text-2xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/60 opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-background" />
                ) : (
                  <Camera className="h-6 w-6 text-background" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-2xl font-bold text-foreground">
                {displayName || 'Sem nome'}
              </h2>
              <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5 justify-center sm:justify-start">
                <Mail className="h-3.5 w-3.5" />
                {user?.email}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-2">
                Clique na foto para alterar o avatar
              </p>
            </div>
          </div>

          {/* Form Section */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="glass glass-border rounded-2xl p-8 space-y-6"
          >
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">Informações da conta</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground text-sm">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="pl-10 opacity-60 bg-muted/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-muted-foreground text-sm">Nome de exibição</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome"
                  className="pl-10"
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !displayName.trim()}
              className="w-full gradient-primary text-primary-foreground shadow-glow hover:shadow-glow-lg transition-all duration-300"
              size="lg"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar alterações
            </Button>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
