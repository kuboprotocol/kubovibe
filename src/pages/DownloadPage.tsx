import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Monitor, Apple, Smartphone, Download as DownloadIcon, ExternalLink, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Navbar from '@/components/landing/Navbar'

type Platform = 'windows' | 'mac' | 'ios' | 'android'

/**
 * URL pública e estável da última release do KUBO Local Agent (GitHub
 * Releases — não é um artifact de workflow, esses expiram). Atualizar aqui
 * quando publicarmos uma tag estável (v1.0.0 etc.) em vez do "nightly-N".
 */
const WINDOWS_DOWNLOAD_URL =
  'https://github.com/kuboprotocol/kubovibe/releases/download/nightly-4/kubo-vibe-windows.exe'
const RELEASES_PAGE_URL = 'https://github.com/kuboprotocol/kubovibe/releases'

interface PlatformCard {
  id: Platform
  name: string
  icon: typeof Monitor
  status: 'available' | 'soon'
  detail: string
  downloadUrl?: string
}

const PLATFORMS: PlatformCard[] = [
  {
    id: 'windows',
    name: 'Windows',
    icon: Monitor,
    status: 'available',
    detail: 'KUBO Local Agent — detecta e integra com VS Code, Cursor, Trae e Antigravity automaticamente.',
    downloadUrl: WINDOWS_DOWNLOAD_URL,
  },
  {
    id: 'mac',
    name: 'macOS',
    icon: Apple,
    status: 'soon',
    detail: 'Com integração Xcode, Swift e iOS Simulator. Em construção.',
  },
  {
    id: 'ios',
    name: 'iOS / iPadOS',
    icon: Smartphone,
    status: 'soon',
    detail: 'Workspace remoto na nuvem KUBO, sincronizado em tempo real.',
  },
  {
    id: 'android',
    name: 'Android',
    icon: Smartphone,
    status: 'soon',
    detail: 'Mesma experiência do app web, otimizada para toque.',
  },
]

function detectPlatform(): Platform | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('windows')) return 'windows'
  if (ua.includes('android')) return 'android'
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios'
  if (ua.includes('mac')) return 'mac'
  return null
}

export default function DownloadPage() {
  const [detected, setDetected] = useState<Platform | null>(null)

  useEffect(() => {
    setDetected(detectPlatform())
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-14"
        >
          <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/5 text-primary">
            KUBO Local Agent
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Leve o KUBO Vibe para sua máquina
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Execução local de verdade, integrada ao editor que você já usa — sem sair do KUBO Vibe.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2">
          {PLATFORMS.map((platform, i) => {
            const Icon = platform.icon
            const isDetected = detected === platform.id
            return (
              <motion.div
                key={platform.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`relative rounded-2xl border p-6 backdrop-blur-sm transition-colors ${
                  isDetected
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/50 bg-card/40'
                }`}
              >
                {isDetected && (
                  <Badge className="absolute -top-3 left-6 bg-primary text-primary-foreground">
                    Seu sistema
                  </Badge>
                )}

                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/60">
                    <Icon className="h-6 w-6 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{platform.name}</h3>
                      {platform.status === 'soon' && (
                        <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> Em breve
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{platform.detail}</p>

                    <div className="mt-4">
                      {platform.status === 'available' && platform.downloadUrl ? (
                        <Button asChild className="rounded-xl">
                          <a href={platform.downloadUrl} target="_blank" rel="noreferrer noopener">
                            <DownloadIcon className="h-4 w-4 mr-2" />
                            Baixar para {platform.name}
                          </a>
                        </Button>
                      ) : (
                        <Button variant="outline" disabled className="rounded-xl">
                          Em breve
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-muted-foreground"
        >
          <p>
            <strong className="text-foreground">Sobre o build do Windows:</strong> ainda não está assinado
            digitalmente. O Windows SmartScreen pode avisar "O Windows protegeu seu PC" ao abrir — clique em{' '}
            <strong className="text-foreground">"Mais informações" → "Executar assim mesmo"</strong>. Isso é
            esperado num build recente sem certificado de assinatura, não é malware.
          </p>
        </motion.div>

        <div className="mt-6 text-center">
          <a
            href={RELEASES_PAGE_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todas as versões no GitHub <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </main>
    </div>
  )
}
