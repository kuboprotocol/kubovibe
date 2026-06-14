import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Rocket,
  Sparkles,
  Palette,
  Plug,
  Gamepad2,
  Film,
  Bot,
  CreditCard,
  Shield,
  Cloud,
  Code2,
  Search as SearchIcon,
  ArrowLeft,
  Layers,
  Mail,
  Globe,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import logoImg from '@/assets/logo-kubovibe.png'

interface DocSection {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  group: string
  content: React.ReactNode
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="px-1.5 py-0.5 rounded-md bg-secondary/60 text-primary font-mono text-[0.85em]">
    {children}
  </code>
)

const Pre = ({ children }: { children: React.ReactNode }) => (
  <pre className="bg-black/60 border border-border rounded-xl p-4 overflow-x-auto text-xs font-mono text-foreground/90 leading-relaxed">
    {children}
  </pre>
)

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-4 mt-2">
    {children}
  </h2>
)

const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-display font-semibold text-foreground mt-8 mb-3">
    {children}
  </h3>
)

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{children}</p>
)

const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="text-sm text-muted-foreground space-y-2 mb-4 list-disc pl-5 marker:text-primary/60">
    {children}
  </ul>
)

const Callout = ({
  type = 'info',
  children,
}: {
  type?: 'info' | 'warn' | 'tip'
  children: React.ReactNode
}) => {
  const styles = {
    info: 'border-primary/30 bg-primary/5',
    warn: 'border-amber-500/30 bg-amber-500/5',
    tip: 'border-emerald-500/30 bg-emerald-500/5',
  }[type]
  return (
    <div className={`border ${styles} rounded-xl p-4 text-sm text-foreground/90 mb-4`}>
      {children}
    </div>
  )
}

const sections: DocSection[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    icon: BookOpen,
    group: 'Getting Started',
    content: (
      <>
        <H2>Welcome to Kubo Vibe Dev</H2>
        <P>
          Kubo Vibe Dev is an AI-first SaaS platform that turns plain-language ideas into
          production-ready web applications, Web3 tools, creative media and full 3D experiences.
          The platform combines a multi-agent code generator, a creative studio, a Web3
          connector layer, a procedural game engine and a credit-based economy in a single
          cohesive product.
        </P>
        <H3>What you can build</H3>
        <UL>
          <li>Full-stack SaaS apps (React + Vite frontend, Supabase backend).</li>
          <li>Landing pages and e-commerce stores cloned from any URL.</li>
          <li>AI-generated media: images, video (RunwayML), music, ebooks, avatars.</li>
          <li>3D games and metaverse scenes with the Quantum Engine.</li>
          <li>Custom Web3 dApps with wallet, IPFS deploy and token integration.</li>
        </UL>
        <H3>Who is it for</H3>
        <UL>
          <li>Founders and indie hackers shipping MVPs.</li>
          <li>Agencies delivering client work in hours instead of weeks.</li>
          <li>Creators monetising tools, media and digital products.</li>
          <li>Web3 builders launching dApps without infra setup.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'quickstart',
    title: 'Quickstart',
    icon: Rocket,
    group: 'Getting Started',
    content: (
      <>
        <H2>Quickstart</H2>
        <P>From zero to a live app in under five minutes.</P>
        <H3>1. Create an account</H3>
        <P>
          Sign up at <Code>/auth</Code> using email + password or Google OAuth. New accounts
          receive starter credits automatically.
        </P>
        <H3>2. Start a project</H3>
        <P>
          Open the Dashboard and click <Code>New Project</Code>. You will land on the Builder
          with a prompt input, an AI chat panel and a live preview frame.
        </P>
        <H3>3. Describe what you want</H3>
        <Pre>{`Build a SaaS landing page for a fitness app called PulseFit.
Use a dark theme with neon green accents. Include hero, pricing,
testimonials and a waitlist form.`}</Pre>
        <H3>4. Iterate with the AI</H3>
        <P>
          Refine the result by chatting: ask for new sections, swap colors, add pages or
          connect a database. Every change is versioned and reversible.
        </P>
        <H3>5. Publish</H3>
        <P>
          Click <Code>Publish</Code> to get a shareable URL at{' '}
          <Code>/app/:projectId/:slug</Code>. Attach a custom domain from the Domains panel
          when ready.
        </P>
        <Callout type="tip">
          You can also clone any existing website — paste a URL in the Builder and the AI
          will reproduce the layout in editable React + Tailwind.
        </Callout>
      </>
    ),
  },
  {
    id: 'architecture',
    title: 'Architecture',
    icon: Layers,
    group: 'Getting Started',
    content: (
      <>
        <H2>Architecture</H2>
        <P>
          Kubo Vibe is a modern hybrid stack designed for scale, real-time collaboration
          and AI-native development.
        </P>
        <H3>Frontend</H3>
        <UL>
          <li>React 18 + Vite 5 + TypeScript (strict).</li>
          <li>Tailwind CSS v3 with semantic design tokens.</li>
          <li>shadcn/ui components, Framer Motion for transitions.</li>
          <li>React Router v6, TanStack Query for data fetching.</li>
          <li>Capacitor wrapper for native iOS / Android builds.</li>
        </UL>
        <H3>Backend (Lovable Cloud / Supabase)</H3>
        <UL>
          <li>PostgreSQL with strict Row Level Security on every table.</li>
          <li>Edge Functions (Deno) for AI calls, payments and webhooks.</li>
          <li>Realtime channels via CDC publication.</li>
          <li>Storage buckets for avatars, project assets and exports.</li>
          <li>Auth with email, magic link, Google and GitHub providers.</li>
        </UL>
        <H3>AI Gateway</H3>
        <UL>
          <li>Hermes dynamic router picks the best model per prompt.</li>
          <li>Kimi for light prompts, DeepSeek for heavy ones (300+ chars).</li>
          <li>Gemini as universal fallback.</li>
          <li>RunwayML for video, Suno for music, Nano Banana for images.</li>
        </UL>
        <H3>Infrastructure</H3>
        <UL>
          <li>Vercel for the marketing site and frontend builds.</li>
          <li>Render for long-running microservices.</li>
          <li>IPFS (web3.storage) for decentralised app hosting.</li>
          <li>Cloudflare for edge caching and DDoS protection.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'builder',
    title: 'Builder',
    icon: Sparkles,
    group: 'Core Features',
    content: (
      <>
        <H2>The Builder</H2>
        <P>
          The Builder at <Code>/builder</Code> is the heart of Kubo Vibe. It combines a
          prompt input, a streaming AI chat, a Preview / Code toggle and a toolbar with
          publish, share and version controls.
        </P>
        <H3>FLOW AI modes</H3>
        <UL>
          <li>
            <strong>FLOW</strong> (Free): fast iteration, light models, ideal for layout
            tweaks.
          </li>
          <li>
            <strong>THINK</strong> (Starter): deeper reasoning, multi-file edits.
          </li>
          <li>
            <strong>SHIP</strong> (Ultra): full-stack changes including database, auth and
            edge functions.
          </li>
        </UL>
        <H3>KUBO Tools</H3>
        <P>
          One-click panels inside the Builder for: template gallery, file uploads (auto
          WebP compression above 200 KB), website cloning, CSV import/export, preview
          auditing and chat history.
        </P>
        <H3>Versioning</H3>
        <P>
          Every prompt creates a snapshot. Use the version drawer to diff and roll back to
          any previous state.
        </P>
      </>
    ),
  },
  {
    id: 'canvas',
    title: 'Canvas',
    icon: Palette,
    group: 'Core Features',
    content: (
      <>
        <H2>Canvas</H2>
        <P>
          A visual design surface at <Code>/canvas</Code> built on TLDraw. Sketch flows,
          UI ideas and architecture diagrams, then ask the AI to turn the canvas into
          working code.
        </P>
        <H3>Templates</H3>
        <P>
          20+ ready-made templates covering landing pages, dashboards, e-commerce,
          onboarding flows and mobile shells.
        </P>
      </>
    ),
  },
  {
    id: 'connectors',
    title: 'Connectors',
    icon: Plug,
    group: 'Core Features',
    content: (
      <>
        <H2>Connectors</H2>
        <P>
          The hub at <Code>/connectors</Code> exposes first-party integrations that
          generated apps can call out of the box.
        </P>
        <H3>Available connectors</H3>
        <UL>
          <li>
            <strong>GitHub</strong> — real OAuth, repo listing, commits and CI status.
          </li>
          <li>
            <strong>Gmail</strong> — read inbox, send transactional and reply automation.
          </li>
          <li>
            <strong>Slack</strong> — channel posting, slash commands, event subscriptions.
          </li>
          <li>
            <strong>Render</strong> — backend deploys and log streaming.
          </li>
          <li>
            <strong>Stripe</strong> — checkout, subscriptions and Connect Express accounts.
          </li>
          <li>
            <strong>Web3 wallets</strong> — MetaMask, WalletConnect, Phantom, plus chain
            switching across EVM, Solana and Bitcoin networks.
          </li>
          <li>
            <strong>IPFS</strong> — one-click deploy of static apps via web3.storage.
          </li>
        </UL>
        <H3>Security</H3>
        <P>
          All credentials are encrypted at rest with AES-256 and scoped per user. RLS
          policies ensure tenants can never read each other&apos;s tokens.
        </P>
      </>
    ),
  },
  {
    id: 'creative-studio',
    title: 'Creative Studio',
    icon: Film,
    group: 'Creative Suite',
    content: (
      <>
        <H2>Creative Studio</H2>
        <P>
          The Creative Studio at <Code>/creative</Code> bundles every media tool in a
          single panel: chat, images, video, music, ebooks, shorts, avatars and download
          utilities.
        </P>
        <H3>Tools</H3>
        <UL>
          <li>Chat AI assistant with file attach.</li>
          <li>Image generation (Nano Banana, Stable Diffusion variants).</li>
          <li>Video creation and clip cutting.</li>
          <li>Avatar studio with crop, progress steps and audit trail.</li>
          <li>Music generation through Suno.</li>
          <li>Ebook composer with cover and chapter generation.</li>
          <li>Downloader for YouTube and social media assets.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'runwayml',
    title: 'RunwayML',
    icon: Film,
    group: 'Creative Suite',
    content: (
      <>
        <H2>RunwayML Integration</H2>
        <P>
          High-end video generation powered by the <Code>runway-generate</Code> edge
          function. Available in the Builder and Canvas surfaces.
        </P>
        <H3>Endpoints</H3>
        <UL>
          <li>Text-to-video</li>
          <li>Image-to-video</li>
          <li>Video-to-video restyle</li>
          <li>Inpainting / outpainting on frames</li>
        </UL>
        <H3>Pricing</H3>
        <P>
          Each generation costs <strong>28 credits</strong> and is logged in the credit
          ledger with provider, latency and API cost telemetry.
        </P>
      </>
    ),
  },
  {
    id: 'agents',
    title: 'Agents Hub',
    icon: Bot,
    group: 'Creative Suite',
    content: (
      <>
        <H2>Agents Hub</H2>
        <P>
          The Agents Hub at <Code>/agents</Code> exposes the Creative Studio agents as
          standalone microservices. Each agent runs as an edge function with:
        </P>
        <UL>
          <li>Atomic credit deduction via the <Code>execute_atomic_credit_deduction</Code> RPC.</li>
          <li>Job tracking in the <Code>agent_jobs</Code> table.</li>
          <li>Full audit trail for compliance and debugging.</li>
          <li>Streaming responses where supported by the underlying model.</li>
        </UL>
        <Callout type="info">
          Agents are composable — chain them together by passing the output of one job as
          the input of another using the orchestrator at <Code>/orchestrator</Code>.
        </Callout>
      </>
    ),
  },
  {
    id: 'game-engine',
    title: 'Quantum Game Engine',
    icon: Gamepad2,
    group: 'Creative Suite',
    content: (
      <>
        <H2>Quantum Game Engine</H2>
        <P>
          The <Code>/game</Code> module ships a complete browser-based game engine built
          on Three.js with WebGPU acceleration.
        </P>
        <H3>Pillars</H3>
        <UL>
          <li>Entity Component System (ECS) for deterministic gameplay.</li>
          <li>Procedural world generation — terrain, biomes, dungeons.</li>
          <li>AI-driven NPCs with persistent memory and emotion.</li>
          <li>WGSL shader sanitiser blocking DoS / TDR attacks before they reach the GPU.</li>
          <li>Physics, particle systems and cinematic post-processing.</li>
        </UL>
        <H3>Security: WGSL Guardian</H3>
        <P>
          Every shader is statically analysed before compilation. Patterns like infinite
          loops, unbounded runtime arrays and atomic abuse are rejected with HTTP 403.
        </P>
        <H3>Modules &amp; Routes</H3>
        <UL>
          <li><Code>/game</Code> — Hub with the AI-driven sandbox world.</li>
          <li><Code>/game/editor</Code> — Visual scene editor for entities and components.</li>
          <li><Code>/game/retro</Code> — 8-bit/16-bit canvas renderer (palette, sprites, tilemaps).</li>
          <li><Code>/game/rpg</Code> — Turn-based RPG template with battles, inventory and dialogue.</li>
          <li><Code>/game/metaverse</Code> — Realtime multiplayer 3D rooms (presence + broadcast).</li>
          <li><Code>/game/sdk</Code> — Public <Code>@kubo/sdk</Code> playground for external developers.</li>
        </UL>
        <H3>SDK Usage</H3>
        <P>
          Import the public surface from <Code>@/sdk</Code> to embed any template in a
          third-party app: <Code>createRetroGame</Code>, <Code>createRpgGame</Code> and{' '}
          <Code>createMetaverseRoom</Code> wrap the engines behind a stable contract.
          React bindings live in <Code>@/sdk/react</Code> (<Code>useRetroGame</Code>,{' '}
          <Code>useMetaverseRoom</Code>).
        </P>
      </>
    ),
  },
  {
    id: 'credits',
    title: 'Credits & Plans',
    icon: CreditCard,
    group: 'Monetization',
    content: (
      <>
        <H2>Credits & Plans</H2>
        <P>
          Every action consumes credits from the user&apos;s balance. The credit ledger is
          atomic, real-time and visible in the dashboard.
        </P>
        <H3>Plans</H3>
        <UL>
          <li>
            <strong>Free</strong> — starter credits, basic models, public publishing.
          </li>
          <li>
            <strong>Starter</strong> — higher monthly credit pool, THINK mode access.
          </li>
          <li>
            <strong>Pro</strong> — heavy AI usage, priority queue, custom domains.
          </li>
          <li>
            <strong>Ultra / Studio</strong> — SHIP mode, RunwayML, Agents Hub, white-label.
          </li>
        </UL>
        <H3>Earning credits</H3>
        <UL>
          <li>Daily streak bonuses and gamification badges.</li>
          <li>Watch-to-earn rewards (max 10 videos per day, 0.5 credits each).</li>
          <li>Referrals — 100 credits per successful invite.</li>
          <li>Public leaderboard rewards for top creators.</li>
        </UL>
        <H3>Anti-fraud</H3>
        <P>
          Watch timers, IP + user fingerprinting and RLS-scoped tracking tables prevent
          credit farming. All reward paths are server-validated.
        </P>
      </>
    ),
  },
  {
    id: 'payments',
    title: 'Payments',
    icon: CreditCard,
    group: 'Monetization',
    content: (
      <>
        <H2>Payments</H2>
        <P>
          Stripe Checkout is the primary processor, with Polar as fallback. Webhooks
          update the <Code>subscription</Code> table and refresh the user&apos;s edit
          limit in real time.
        </P>
        <H3>Stripe Connect</H3>
        <P>
          Creators can onboard as Stripe Connect <strong>Express</strong> accounts (BR /
          BRL by default) and receive payouts via Destination Charges. The flow is
          v1-compatible and fully embedded.
        </P>
      </>
    ),
  },
  {
    id: 'auth',
    title: 'Authentication',
    icon: Shield,
    group: 'Platform',
    content: (
      <>
        <H2>Authentication</H2>
        <P>
          Supabase Auth handles email, magic link, Google OAuth and GitHub OAuth (with
          state-based <Code>returnUrl</Code> for deep linking back to the Builder).
        </P>
        <H3>Best practices</H3>
        <UL>
          <li>
            Edge functions always validate the JWT with <Code>auth.getUser()</Code> — never
            trust the raw token.
          </li>
          <li>
            Roles live in a dedicated <Code>user_roles</Code> table to prevent privilege
            escalation.
          </li>
          <li>
            The <Code>has_role()</Code> security-definer function powers RLS policies for
            admin views.
          </li>
        </UL>
      </>
    ),
  },
  {
    id: 'database',
    title: 'Database & RLS',
    icon: Shield,
    group: 'Platform',
    content: (
      <>
        <H2>Database & Row Level Security</H2>
        <P>
          Every table in the <Code>public</Code> schema enforces RLS. Migrations follow a
          strict pattern: <Code>CREATE TABLE</Code> → <Code>GRANT</Code> →{' '}
          <Code>ENABLE RLS</Code> → <Code>CREATE POLICY</Code>.
        </P>
        <H3>Public vs private</H3>
        <UL>
          <li>
            <strong>Public</strong>: leaderboard views, badges, basic profile fields.
          </li>
          <li>
            <strong>Owner-scoped</strong>: projects, agent jobs, credit ledger entries.
          </li>
          <li>
            <strong>Admin-only</strong>: orchestrator config, domain transfer codes, rate
            limits.
          </li>
        </UL>
        <H3>CI Security Gate</H3>
        <P>The CI pipeline rejects PRs that introduce:</P>
        <UL>
          <li>SECURITY DEFINER functions without <Code>SET search_path</Code>.</li>
          <li>Public-schema tables without RLS.</li>
          <li>Broad <Code>GRANT ALL</Code> to <Code>authenticated</Code> or <Code>anon</Code>.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'emails',
    title: 'Emails',
    icon: Mail,
    group: 'Platform',
    content: (
      <>
        <H2>Email Infrastructure</H2>
        <P>
          Emails are sent through the verified subdomain <Code>notify.kubovibe.dev</Code>{' '}
          using React Email templates and the shared <Code>send-transactional-email</Code>{' '}
          edge function.
        </P>
        <H3>Triggers</H3>
        <UL>
          <li>Account: welcome, magic link, password reset, reauthentication.</li>
          <li>Referrals: notification when a friend signs up.</li>
          <li>Domain transfer: status updates and auth codes.</li>
        </UL>
        <Callout type="warn">
          Kubo Vibe does not support marketing emails or bulk campaigns. All sends are
          recipient-triggered and respect the unsubscribe registry.
        </Callout>
      </>
    ),
  },
  {
    id: 'domains',
    title: 'Domains',
    icon: Globe,
    group: 'Platform',
    content: (
      <>
        <H2>Domain Management</H2>
        <P>
          Buy or transfer a domain directly from <Code>/domains</Code>. The integration
          uses the IONOS API for search, registration and DNS transfer flows. Transfers
          require an auth code that is stored encrypted and only accessible by the owner.
        </P>
      </>
    ),
  },
  {
    id: 'deploy',
    title: 'Deployment',
    icon: Cloud,
    group: 'Platform',
    content: (
      <>
        <H2>Deployment</H2>
        <H3>Vercel (frontend)</H3>
        <UL>
          <li>Connect the GitHub repo and Vercel auto-deploys on every push to <Code>main</Code>.</li>
          <li>
            Configure env vars in Vercel Dashboard → Settings → Environment Variables:{' '}
            <Code>VITE_SENTRY_DSN</Code>, <Code>VITE_API_URL</Code>.
          </li>
          <li>Custom domains and cron jobs are managed under Vercel → Settings.</li>
        </UL>
        <H3>Render (backend services)</H3>
        <UL>
          <li>The repo ships a <Code>render.yaml</Code> blueprint.</li>
          <li>
            Set <Code>VITE_SUPABASE_*</Code> with <Code>sync: false</Code> for each
            service.
          </li>
        </UL>
        <H3>IPFS (decentralised)</H3>
        <P>
          Published projects can be pinned to IPFS via web3.storage in one click from the
          Connectors hub.
        </P>
      </>
    ),
  },
  {
    id: 'api',
    title: 'Edge Functions API',
    icon: Code2,
    group: 'Developers',
    content: (
      <>
        <H2>Edge Functions API</H2>
        <P>
          Edge functions are invoked from the client using the typed Supabase client:
        </P>
        <Pre>{`import { supabase } from '@/integrations/supabase/client'

const { data, error } = await supabase.functions.invoke('runway-generate', {
  body: { prompt: 'A spaceship over a neon city', duration: 5 }
})`}</Pre>
        <H3>Conventions</H3>
        <UL>
          <li>Every function validates the caller via <Code>auth.getUser()</Code>.</li>
          <li>Credit-consuming functions call the atomic deduction RPC before the work.</li>
          <li>All responses follow <Code>{`{ success, data, error }`}</Code>.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    icon: Shield,
    group: 'Developers',
    content: (
      <>
        <H2>Security Model</H2>
        <UL>
          <li>Strict RLS on every public-schema table (40+ enforced).</li>
          <li>AES-256 encryption for connector credentials.</li>
          <li>WGSL shader sanitiser before any GPU compile.</li>
          <li>Branch protection requiring Playwright + Fuzz tests on <Code>main</Code>.</li>
          <li>Atomic credit ledger prevents race conditions on balance updates.</li>
          <li>JWT validated server-side on every privileged operation.</li>
        </UL>
        <Callout type="info">
          Full security checklist lives in <Code>docs/SECURITY_CHECKLIST.md</Code> in the
          repository.
        </Callout>
      </>
    ),
  },
]

const groups = Array.from(new Set(sections.map((s) => s.group)))

export default function DocsPage() {
  const [active, setActive] = useState<string>(sections[0].id)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && sections.find((s) => s.id === hash)) setActive(hash)
  }, [])

  useEffect(() => {
    window.history.replaceState(null, '', `#${active}`)
  }, [active])

  const filtered = useMemo(() => {
    if (!query) return sections
    const q = query.toLowerCase()
    return sections.filter((s) => s.title.toLowerCase().includes(q))
  }, [query])

  const current = sections.find((s) => s.id === active) ?? sections[0]

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute inset-0 dot-pattern opacity-20 pointer-events-none" />

      <header className="sticky top-0 z-50 glass glass-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src={logoImg}
              alt="KUBO VIBE"
              className="h-7 group-hover:scale-105 transition-transform"
            />
            <span className="text-sm font-display font-semibold text-foreground hidden sm:inline">
              Documentation
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="rounded-xl gap-2 text-muted-foreground hover:text-foreground"
            >
              <Link to="/">
                <ArrowLeft className="h-4 w-4" /> Back to home
              </Link>
            </Button>
            <Button variant="hero" size="sm" asChild className="rounded-xl">
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 relative z-10 grid lg:grid-cols-[260px_1fr] gap-10">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 self-start">
          <div className="relative mb-4">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search docs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 rounded-xl bg-card/50 border-border"
            />
          </div>
          <nav className="space-y-6">
            {groups.map((group) => {
              const items = filtered.filter((s) => s.group === group)
              if (!items.length) return null
              return (
                <div key={group}>
                  <p className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/70 uppercase mb-2 px-2">
                    {group}
                  </p>
                  <div className="space-y-0.5">
                    {items.map((s) => {
                      const Icon = s.icon
                      const isActive = s.id === active
                      return (
                        <button
                          key={s.id}
                          onClick={() => setActive(s.id)}
                          className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                            isActive
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{s.title}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <motion.main
          key={current.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="min-w-0 max-w-3xl"
        >
          <p className="text-xs font-mono tracking-[0.2em] uppercase text-primary mb-3">
            {current.group}
          </p>
          {current.content}

          <div className="mt-16 pt-6 border-t border-border flex items-center justify-between text-sm">
            {(() => {
              const idx = sections.findIndex((s) => s.id === current.id)
              const prev = idx > 0 ? sections[idx - 1] : null
              const next = idx < sections.length - 1 ? sections[idx + 1] : null
              return (
                <>
                  {prev ? (
                    <button
                      onClick={() => setActive(prev.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ← {prev.title}
                    </button>
                  ) : (
                    <span />
                  )}
                  {next ? (
                    <button
                      onClick={() => setActive(next.id)}
                      className="text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      {next.title} →
                    </button>
                  ) : (
                    <span />
                  )}
                </>
              )
            })()}
          </div>
        </motion.main>
      </div>
    </div>
  )
}
