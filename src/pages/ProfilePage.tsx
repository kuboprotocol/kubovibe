import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Camera, Loader2, User } from 'lucide-react'
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Meu Perfil</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-8">
            {/* Avatar */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative group">
                <Avatar className="h-24 w-24 text-lg">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt="Avatar" />
                  ) : null}
                  <AvatarFallback className="bg-accent text-accent-foreground text-xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
              <p className="text-sm text-muted-foreground mt-2">
                Clique para alterar o avatar
              </p>
            </div>

            {/* Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ''} disabled className="opacity-60" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Nome de exibição</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || !displayName.trim()}
                className="w-full mt-4"
                variant="hero"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar alterações
              </Button>
            </div>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}
