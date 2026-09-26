import { APP_NAME } from '@/config/brand'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Monitor, Apple, Smartphone, Terminal, Download as DownloadIcon, ExternalLink, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Navbar from '@/components/landing/Navbar'
import LocalAgentTokens from '@/components/download/LocalAgentTokens'
import {
  FALLBACK_DOWNLOADS,
  RELEASES_PAGE_URL,
  fetchAgentDownloads,
  type AgentPlatform,
  type ResolvedDownloads,
} from '@/lib/agentReleases'

type Platform = AgentPlatform | 'ios' | 'android'

interface PlatformCard {
  id: Platform
  name: string
  icon: typeof Monitor
  detail: string
  /** Comando de primeira execução, mostrado quando o download existe. */
  install?: string
}

const PLATFORMS: PlatformCard[] = [
  {
    id: 'windows',
    name: 'Windows',
    icon: Monitor,
    detail: 'KUBO Local Agent — detecta e integra com VS Code, Cursor, Trae e Antigravity automaticamente.',
  },
  {
    id: 'mac',
    name: 'macOS',
    icon: Apple,
    detail: 'Binário universal (Apple Silicon + Intel). Mesma integração com VS Code, Cursor, Trae e Antigravity.',
    install: 'tar -xzf kubo-vibe-macos.tar.gz && xattr -d com.apple.quarantine kubo-agent; ./kubo-agent',
  },
  {
    id: 'linux',
    name: 'Linux',
    icon: Terminal,
    detail: 'Binário x86_64 para Ubuntu, Debian, Fedora e derivados.',
    install: 'tar -xzf kubo-vibe-linux-x64.tar.gz && ./kubo-agent',
  },
  {
    id: 'ios',
    name: 'iOS / iPadOS',
    icon: Smartphone,
    detail: 'Workspace remoto na nuvem KUBO, sincronizado em tempo real.',
  },
  {
    id: 'android',
    name: 'Android',
    icon: Smartphone,
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
  if (ua.includes('linux') || ua.includes('x11')) return 'linux'
  return null
}

export default function DownloadPage() {
  const [detected, setDetected] = useState<Platform | null>(null)
  const [downloads, setDownloads] = useState<ResolvedDownloads>({ urls: FALLBACK_DOWNLOADS, version: null })

  useEffect(() => {
    setDetected(detectPlatform())
    const controller = new AbortController()
    fetchAgentDownloads(controller.signal).then(setDownloads).catch(() => {})
    return () => controller.abort()
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
            Leve o {APP_NAME} para sua máquina
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Execução local de verdade, integrada ao editor que você já usa — sem sair do {APP_NAME}.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2">
          {PLATFORMS.map((platform, i) => {
            const Icon = platform.icon
            const isDetected = detected === platform.id
            const downloadUrl = downloads.urls[platform.id as AgentPlatform]
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
                      {!downloadUrl && (
                        <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> Em breve
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{platform.detail}</p>

                    <div className="mt-4">
                      {downloadUrl ? (
                        <Button asChild className="rounded-xl">
                          <a href={downloadUrl} target="_blank" rel="noreferrer noopener">
                            <DownloadIcon className="h-4 w-4 mr-2" />
                            Baixar para {platform.name}
                          </a>
                        </Button>
                      ) : (
                        <Button variant="outline" disabled className="rounded-xl">
                          Em breve
                        </Button>
                      )}
                      {downloadUrl && platform.install && (
                        <code className="mt-3 block overflow-x-auto whitespace-nowrap rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                          {platform.install}
                        </code>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        <LocalAgentTokens />

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-muted-foreground"
        >
          <p>
            <strong className="text-foreground">Sobre os builds:</strong> ainda não estão assinados
            digitalmente. No Windows, o SmartScreen pode avisar "O Windows protegeu seu PC" — clique em{' '}
            <strong className="text-foreground">"Mais informações" → "Executar assim mesmo"</strong>. No macOS,
            o Gatekeeper bloqueia binários baixados sem notarização — o comando{' '}
            <code className="text-foreground">xattr -d com.apple.quarantine</code> acima libera a execução.
            Isso é esperado num build recente sem certificado, não é malware.
          </p>
        </motion.div>

        <div className="mt-6 text-center">
          <a
            href={RELEASES_PAGE_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {downloads.version ? `Versão ${downloads.version} · ` : ''}Ver todas as versões no GitHub{' '}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </main>
    </div>
  )
}
