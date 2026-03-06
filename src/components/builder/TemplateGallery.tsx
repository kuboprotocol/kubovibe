import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  X, Search, Globe, ShoppingCart, BarChart3, Briefcase, Gamepad2, Coins,
  Share2, Twitter, Instagram, Facebook, BookOpen, Link2, PenLine, Rocket,
  Wallet, Landmark, LayoutGrid, Sparkles, ArrowRight, Star, Zap,
  MessageSquare, Users, Heart, TrendingUp, Shield, Smartphone, Monitor,
} from 'lucide-react'

export interface Template {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  prompt: string
  icon: any
  color: string
  popular?: boolean
}

const categories = [
  { id: 'all', label: 'Todos', icon: LayoutGrid },
  { id: 'landing', label: 'Landing Pages', icon: Globe },
  { id: 'ecommerce', label: 'E-commerce', icon: ShoppingCart },
  { id: 'dashboard', label: 'Dashboards', icon: BarChart3 },
  { id: 'portfolio', label: 'Portfólios', icon: Briefcase },
  { id: 'casino', label: 'Cassinos', icon: Gamepad2 },
  { id: 'faucet', label: 'Faucets', icon: Coins },
  { id: 'social', label: 'Redes Sociais', icon: Share2 },
  { id: 'blog', label: 'Blog & CMS', icon: PenLine },
  { id: 'saas', label: 'SaaS', icon: Rocket },
  { id: 'crypto', label: 'Crypto Wallets', icon: Wallet },
  { id: 'bank', label: 'Banks & Fintech', icon: Landmark },
]

const templates: Template[] = [
  // Landing Pages
  {
    id: 'landing-startup',
    name: 'Startup Launch',
    description: 'Landing page moderna para startups com hero animado, features, pricing e CTA.',
    category: 'landing',
    tags: ['startup', 'modern', 'responsive'],
    prompt: 'Create a modern startup landing page with: animated hero section with gradient background, features grid with icons, pricing table with 3 tiers (Free, Pro, Enterprise), testimonials carousel, newsletter signup, and sticky navigation. Use a modern color scheme with purple/blue gradients. Make it fully responsive.',
    icon: Globe,
    color: 'from-violet-500 to-purple-600',
    popular: true,
  },
  {
    id: 'landing-product',
    name: 'Product Showcase',
    description: 'Landing page focada em produto com galeria de imagens e especificações.',
    category: 'landing',
    tags: ['product', 'showcase', 'minimal'],
    prompt: 'Create a product showcase landing page with: large hero image placeholder, product features with icons, image gallery section, specifications table, customer reviews, and a buy now CTA button. Use clean white design with accent colors.',
    icon: Star,
    color: 'from-amber-500 to-orange-600',
  },
  {
    id: 'landing-agency',
    name: 'Creative Agency',
    description: 'Landing page elegante para agências criativas com portfolio e equipe.',
    category: 'landing',
    tags: ['agency', 'creative', 'elegant'],
    prompt: 'Create a creative agency landing page with: dramatic hero with large typography, services offered, portfolio grid with hover effects, team members section, client logos, contact form, and footer. Use dark theme with gold accents.',
    icon: Sparkles,
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'landing-app',
    name: 'Mobile App',
    description: 'Landing page para apps mobile com mockups e download buttons.',
    category: 'landing',
    tags: ['app', 'mobile', 'download'],
    prompt: 'Create a mobile app landing page with: hero section showing phone mockup, app features list, screenshots carousel, user stats counters, download buttons for App Store and Google Play, FAQ section, and footer. Use gradient background.',
    icon: Smartphone,
    color: 'from-blue-500 to-cyan-600',
  },

  // E-commerce
  {
    id: 'ecommerce-store',
    name: 'Online Store',
    description: 'Loja virtual completa com catálogo, carrinho e checkout.',
    category: 'ecommerce',
    tags: ['store', 'cart', 'checkout'],
    prompt: 'Create a full e-commerce online store with: top navigation with cart icon and search, hero banner, product grid (8+ products with name, price, image placeholder, and add to cart button), category filters sidebar, shopping cart slide-over panel, and footer with links. Use clean modern design.',
    icon: ShoppingCart,
    color: 'from-pink-500 to-rose-600',
    popular: true,
  },
  {
    id: 'ecommerce-fashion',
    name: 'Fashion Store',
    description: 'Loja de moda com layout editorial e lookbook.',
    category: 'ecommerce',
    tags: ['fashion', 'editorial', 'lookbook'],
    prompt: 'Create a fashion e-commerce store with: full-width hero image, "New Arrivals" section, product cards with hover effects showing quick view, categories (Men, Women, Accessories), lookbook grid, newsletter signup, and minimal navigation. Use elegant serif fonts and muted colors.',
    icon: Heart,
    color: 'from-fuchsia-500 to-pink-600',
  },

  // Dashboards
  {
    id: 'dashboard-analytics',
    name: 'Analytics Dashboard',
    description: 'Dashboard de analytics com gráficos, KPIs e tabelas de dados.',
    category: 'dashboard',
    tags: ['analytics', 'charts', 'data'],
    prompt: 'Create an analytics dashboard with: sidebar navigation, top stats cards (Revenue, Users, Conversion, Active Sessions with trends), line chart for revenue over time, bar chart for traffic sources, pie chart for device breakdown, recent activity table, and user dropdown. Use dark sidebar with white main area.',
    icon: BarChart3,
    color: 'from-blue-500 to-indigo-600',
    popular: true,
  },
  {
    id: 'dashboard-admin',
    name: 'Admin Panel',
    description: 'Painel administrativo com gestão de usuários e configurações.',
    category: 'dashboard',
    tags: ['admin', 'management', 'users'],
    prompt: 'Create an admin panel with: sidebar with icons (Dashboard, Users, Orders, Products, Settings), breadcrumb, stats overview, users table with avatar, name, email, role, status, and actions (edit, delete), pagination, and search/filter bar. Use professional clean design.',
    icon: Shield,
    color: 'from-slate-500 to-gray-700',
  },
  {
    id: 'dashboard-project',
    name: 'Project Manager',
    description: 'Dashboard de gestão de projetos com kanban e timeline.',
    category: 'dashboard',
    tags: ['project', 'kanban', 'tasks'],
    prompt: 'Create a project management dashboard with: sidebar navigation, kanban board with 3 columns (To Do, In Progress, Done) with draggable task cards, project overview stats, team members avatars, timeline/gantt view placeholder, and quick add task button. Use modern colorful design.',
    icon: LayoutGrid,
    color: 'from-green-500 to-emerald-600',
  },

  // Portfolios
  {
    id: 'portfolio-dev',
    name: 'Developer Portfolio',
    description: 'Portfolio para desenvolvedores com projetos, skills e contato.',
    category: 'portfolio',
    tags: ['developer', 'tech', 'projects'],
    prompt: 'Create a developer portfolio with: hero with name, title, and animated typing effect, about me section, skills grid with progress bars (React, TypeScript, Node.js, Python, etc.), projects showcase with cards (image, title, description, tech stack tags, GitHub/live links), experience timeline, and contact form. Use dark theme with green/cyan accents.',
    icon: Monitor,
    color: 'from-cyan-500 to-blue-600',
    popular: true,
  },
  {
    id: 'portfolio-designer',
    name: 'Designer Portfolio',
    description: 'Portfolio visual para designers com galeria imersiva.',
    category: 'portfolio',
    tags: ['designer', 'visual', 'gallery'],
    prompt: 'Create a designer portfolio with: minimal navigation, large hero with name and tagline, masonry grid gallery of work with hover overlays, case study sections, about/bio section, client testimonials, and contact section. Use lots of whitespace and elegant typography.',
    icon: Briefcase,
    color: 'from-purple-500 to-violet-600',
  },

  // Cassinos
  {
    id: 'casino-landing',
    name: 'Casino Landing',
    description: 'Landing page para cassino online com jogos e bônus.',
    category: 'casino',
    tags: ['casino', 'gambling', 'games'],
    prompt: 'Create a casino/gambling landing page with: flashy hero with neon glow effects and "Join Now" CTA, featured games grid (Slots, Poker, Roulette, Blackjack, Baccarat, Dice) with thumbnails, welcome bonus banner (100% up to $500), live casino section, payment methods icons, VIP program tiers, and footer with responsible gambling notice. Use dark theme with gold and red accents, neon glow effects.',
    icon: Gamepad2,
    color: 'from-yellow-500 to-red-600',
    popular: true,
  },
  {
    id: 'casino-slots',
    name: 'Slot Machine',
    description: 'Interface de caça-níquel interativo com animações.',
    category: 'casino',
    tags: ['slots', 'game', 'interactive'],
    prompt: 'Create an interactive slot machine game with: 3x3 reel grid with emoji symbols (🍒🍋🔔💎7️⃣⭐), spin button with animation, bet amount selector, balance display, win/lose popup, paytable showing combinations, and autoplay toggle. Use dark background with gold accents and glowing effects. Add spinning animation for reels.',
    icon: Zap,
    color: 'from-amber-500 to-yellow-600',
  },

  // Faucets
  {
    id: 'faucet-crypto',
    name: 'Crypto Faucet',
    description: 'Faucet de criptomoedas com claim, referral e leaderboard.',
    category: 'faucet',
    tags: ['faucet', 'crypto', 'claim'],
    prompt: 'Create a crypto faucet website with: hero section showing claim amount and countdown timer, claim button (large and prominent), user balance display, referral link section with copy button, leaderboard table (top earners), supported coins list (BTC, ETH, LTC, DOGE), FAQ section, anti-bot captcha placeholder, and earnings history. Use dark/cyber theme with green accents.',
    icon: Coins,
    color: 'from-green-500 to-lime-600',
    popular: true,
  },
  {
    id: 'faucet-multi',
    name: 'Multi-Coin Faucet',
    description: 'Faucet multi-moeda com tabs para diferentes cryptos.',
    category: 'faucet',
    tags: ['multi-coin', 'tabs', 'earnings'],
    prompt: 'Create a multi-coin faucet with: tabs for different coins (Bitcoin, Ethereum, Litecoin, Dogecoin, Tron), each tab showing claim amount, timer, and claim button. Include wallet address input, daily earnings tracker, withdrawal section with minimum amounts, referral program (50% commission), and trust indicators. Dark theme with each coin having its brand color.',
    icon: Coins,
    color: 'from-orange-500 to-amber-600',
  },

  // Redes Sociais
  {
    id: 'social-x',
    name: 'Clone do X (Twitter)',
    description: 'Interface tipo X/Twitter com feed, posts e perfil.',
    category: 'social',
    tags: ['twitter', 'x', 'feed'],
    prompt: 'Create a Twitter/X clone interface with: left sidebar with navigation (Home, Explore, Notifications, Messages, Bookmarks, Profile), main feed with tweet cards (avatar, name, handle, timestamp, text, image placeholder, action buttons: reply, retweet, like, share with counts), compose tweet box at top, trending sidebar on right, and "Who to follow" suggestions. Use the classic X dark theme.',
    icon: Twitter,
    color: 'from-gray-700 to-gray-900',
    popular: true,
  },
  {
    id: 'social-instagram',
    name: 'Clone do Instagram',
    description: 'Interface tipo Instagram com stories, feed e explore.',
    category: 'social',
    tags: ['instagram', 'photos', 'stories'],
    prompt: 'Create an Instagram clone interface with: top navigation bar with logo, search, and icons, stories bar with circular avatars and gradient borders, photo feed with posts (user header, image placeholder, like/comment/share/save buttons, likes count, caption), explore grid page with different sized photo tiles. Use clean white design with gradient accents.',
    icon: Instagram,
    color: 'from-pink-500 via-purple-500 to-orange-500',
  },
  {
    id: 'social-facebook',
    name: 'Clone do Facebook',
    description: 'Interface tipo Facebook com feed, grupos e marketplace.',
    category: 'social',
    tags: ['facebook', 'feed', 'social'],
    prompt: 'Create a Facebook clone interface with: blue top navigation bar with search, center icons (Home, Friends, Marketplace, Groups, Gaming), and user menu. Left sidebar with shortcuts, main feed with post cards (create post box, posts with reactions, comments, shares), right sidebar with contacts and sponsored. Use Facebook blue color scheme.',
    icon: Facebook,
    color: 'from-blue-600 to-blue-800',
  },
  {
    id: 'social-substack',
    name: 'Clone do Substack',
    description: 'Plataforma de newsletter tipo Substack com editor e assinaturas.',
    category: 'social',
    tags: ['substack', 'newsletter', 'writing'],
    prompt: 'Create a Substack-like newsletter platform with: clean homepage with featured posts, post page with rich typography and reading time, subscribe modal with email input and free/paid options, writer profile page with bio and post archive, and navigation. Use clean minimal design with orange accent color.',
    icon: BookOpen,
    color: 'from-orange-500 to-orange-700',
  },
  {
    id: 'social-linktree',
    name: 'Clone do Linktree',
    description: 'Bio link page tipo Linktree com links personalizáveis.',
    category: 'social',
    tags: ['linktree', 'bio', 'links'],
    prompt: 'Create a Linktree-like bio link page with: profile picture and name at top, customizable link buttons stacked vertically (YouTube, Instagram, Twitter, Portfolio, Shop, Blog, Discord), social media icons at bottom, share button, and theme selector (light/dark/colorful). Use centered layout with rounded buttons and animations on hover.',
    icon: Link2,
    color: 'from-lime-500 to-green-600',
  },

  // Blog & CMS
  {
    id: 'blog-modern',
    name: 'Blog Moderno',
    description: 'Blog com layout editorial, categorias e busca.',
    category: 'blog',
    tags: ['blog', 'editorial', 'articles'],
    prompt: 'Create a modern blog with: navigation with categories (Technology, Design, Business, Lifestyle), hero featured article with large image, article grid (image, category tag, title, excerpt, author, date), sidebar with popular posts, tags cloud, newsletter signup, and pagination. Use clean typography-focused design.',
    icon: PenLine,
    color: 'from-indigo-500 to-purple-600',
    popular: true,
  },
  {
    id: 'blog-magazine',
    name: 'Digital Magazine',
    description: 'Magazine digital com layout de grid editorial.',
    category: 'blog',
    tags: ['magazine', 'editorial', 'news'],
    prompt: 'Create a digital magazine/news site with: breaking news ticker, large hero article, grid layout mixing different article card sizes, category navigation bar, trending topics section, author spotlights, and newsletter popup. Use bold typography with red accent color.',
    icon: BookOpen,
    color: 'from-red-500 to-rose-600',
  },

  // SaaS
  {
    id: 'saas-landing',
    name: 'SaaS Platform',
    description: 'Landing page SaaS completa com pricing, features e demo.',
    category: 'saas',
    tags: ['saas', 'platform', 'pricing'],
    prompt: 'Create a complete SaaS landing page with: navigation with login/signup buttons, hero with product screenshot mockup, trusted by logos section, 3-column features with icons, how it works steps, pricing table (Starter $9, Professional $29, Enterprise custom), testimonials with company logos, FAQ accordion, CTA section, and footer. Use modern gradient design.',
    icon: Rocket,
    color: 'from-violet-500 to-indigo-600',
    popular: true,
  },
  {
    id: 'saas-dashboard-app',
    name: 'SaaS App Interface',
    description: 'Interface de aplicação SaaS com sidebar e workspace.',
    category: 'saas',
    tags: ['app', 'workspace', 'interface'],
    prompt: 'Create a SaaS application interface with: collapsible sidebar (workspaces, projects, team, settings), top bar with breadcrumbs and user menu, main content area with tabs, data table with sorting and filtering, action modals, and notification dropdown. Use clean professional design with blue accents.',
    icon: Monitor,
    color: 'from-blue-500 to-indigo-600',
  },

  // Crypto Wallets
  {
    id: 'crypto-wallet',
    name: 'Crypto Wallet',
    description: 'Wallet de criptomoedas com portfolio, envio e recebimento.',
    category: 'crypto',
    tags: ['wallet', 'crypto', 'portfolio'],
    prompt: 'Create a cryptocurrency wallet interface with: portfolio balance card with total value and 24h change, asset list (BTC, ETH, BNB, SOL, ADA, DOT with amounts, values, and price changes), send/receive buttons, transaction history, price charts placeholder, and QR code receive modal. Use dark theme with glass morphism effects and green/red for gains/losses.',
    icon: Wallet,
    color: 'from-amber-500 to-orange-600',
    popular: true,
  },
  {
    id: 'crypto-exchange',
    name: 'Crypto Exchange',
    description: 'Interface de exchange com order book e trading.',
    category: 'crypto',
    tags: ['exchange', 'trading', 'orderbook'],
    prompt: 'Create a crypto exchange trading interface with: price chart area (candlestick placeholder), order book with bids and asks, trading pair selector (BTC/USDT), buy/sell form with market/limit tabs, open orders table, recent trades list, and market overview sidebar. Use dark professional trading theme.',
    icon: TrendingUp,
    color: 'from-green-500 to-emerald-600',
  },
  {
    id: 'crypto-defi',
    name: 'DeFi Platform',
    description: 'Plataforma DeFi com swap, liquidity pools e staking.',
    category: 'crypto',
    tags: ['defi', 'swap', 'staking'],
    prompt: 'Create a DeFi platform interface with: token swap interface (from/to with token selectors and amounts), liquidity pools list with APY, staking section with lock periods and rewards, portfolio overview, wallet connect button, and gas fee estimator. Use dark theme with purple/blue gradients and glassmorphism.',
    icon: Coins,
    color: 'from-purple-500 to-fuchsia-600',
  },

  // Banks & Fintech
  {
    id: 'bank-app',
    name: 'Digital Bank',
    description: 'App de banco digital com conta, transferências e cartões.',
    category: 'bank',
    tags: ['bank', 'digital', 'fintech'],
    prompt: 'Create a digital banking app interface with: account balance card with hide/show toggle, quick actions (Transfer, Pay, Deposit, Invest), virtual card display with card number, recent transactions list with categories and icons, spending analytics by category (Food, Transport, Shopping, Bills), and bottom navigation. Use clean modern design with purple/dark theme.',
    icon: Landmark,
    color: 'from-purple-600 to-indigo-700',
    popular: true,
  },
  {
    id: 'bank-landing',
    name: 'Fintech Landing',
    description: 'Landing page para fintech com benefícios e download.',
    category: 'bank',
    tags: ['fintech', 'landing', 'banking'],
    prompt: 'Create a fintech/neobank landing page with: hero with phone mockup showing the app, key benefits (No fees, Instant transfers, Cashback, Global payments), how it works in 3 steps, security features section, customer testimonials, app download buttons, comparison table vs traditional banks, and footer. Use dark premium theme with gold accents.',
    icon: Landmark,
    color: 'from-emerald-600 to-green-700',
  },
  {
    id: 'bank-investment',
    name: 'Investment Platform',
    description: 'Plataforma de investimentos com portfolio e mercado.',
    category: 'bank',
    tags: ['investment', 'stocks', 'portfolio'],
    prompt: 'Create an investment platform dashboard with: portfolio overview with total value and performance chart, asset allocation donut chart, watchlist with stocks/ETFs (ticker, price, change %), buy/sell quick trade form, market news feed, and dividend calendar. Use professional dark theme with green for gains and red for losses.',
    icon: TrendingUp,
    color: 'from-blue-600 to-cyan-700',
  },
]

interface TemplateGalleryProps {
  onSelect: (template: Template) => void
  onClose: () => void
}

export default function TemplateGallery({ onSelect, onClose }: TemplateGalleryProps) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = templates.filter(t => {
    const matchCategory = activeCategory === 'all' || t.category === activeCategory
    const matchSearch = !search || 
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
    return matchCategory && matchSearch
  })

  const popularTemplates = templates.filter(t => t.popular)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex bg-background/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex flex-col w-full h-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Templates</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Escolha um template para começar rapidamente
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-xl bg-secondary/50 border-border/50 text-sm"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Category Sidebar */}
          <div className="w-52 border-r border-border/50 p-3 overflow-y-auto shrink-0">
            {categories.map(cat => {
              const Icon = cat.icon
              const count = cat.id === 'all' ? templates.length : templates.filter(t => t.category === cat.id).length
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 mb-0.5 ${
                    activeCategory === cat.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{cat.label}</span>
                  <span className="ml-auto text-[10px] opacity-60">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Template Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Popular section when viewing all */}
            {activeCategory === 'all' && !search && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-display font-semibold text-foreground">Populares</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {popularTemplates.map((template, i) => (
                    <TemplateCard key={template.id} template={template} index={i} onSelect={onSelect} />
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-display font-semibold text-foreground">
                {activeCategory === 'all' && !search ? 'Todos os templates' : `${filtered.length} template${filtered.length !== 1 ? 's' : ''}`}
              </h3>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhum template encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((template, i) => (
                  <TemplateCard key={template.id} template={template} index={i} onSelect={onSelect} />
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function TemplateCard({ template, index, onSelect }: { template: Template; index: number; onSelect: (t: Template) => void }) {
  const Icon = template.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
    >
      <button
        onClick={() => onSelect(template)}
        className="w-full text-left group rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-glow transition-all duration-300 overflow-hidden"
      >
        {/* Color preview bar */}
        <div className={`h-24 bg-gradient-to-br ${template.color} opacity-80 group-hover:opacity-100 transition-opacity flex items-center justify-center relative overflow-hidden`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.15),transparent)]" />
          <Icon className="h-10 w-10 text-white/90 drop-shadow-lg" />
          {template.popular && (
            <Badge className="absolute top-2 right-2 bg-white/20 backdrop-blur-sm text-white border-white/20 text-[10px] px-1.5 py-0">
              <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
              Popular
            </Badge>
          )}
        </div>
        <div className="p-4">
          <h4 className="font-display font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
            {template.name}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {template.description}
          </p>
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {template.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
            Usar template
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </button>
    </motion.div>
  )
}
