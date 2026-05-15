import { Github, CreditCard, Globe, Figma, Server, Smartphone, Cloud, Database, Mail, MessageSquare, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface ConnectorSetupStep {
  title: string
  description: string
}

export interface ConnectorConfig {
  name: string
  slug: string
  icon: LucideIcon
  color: string
  authType: 'oauth' | 'api_key' | 'webhook' | 'manual'
  category: 'development' | 'payments' | 'design' | 'infrastructure' | 'communication' | 'analytics'
  description: string
  longDescription: string
  features: string[]
  docsUrl?: string
  status: 'available' | 'coming_soon'
  internalRoute?: string
  apiKeyLabel: string
  apiKeyPlaceholder: string
  apiKeyHelp: string
  apiKeyDocsUrl?: string
  setupSteps: ConnectorSetupStep[]
}

export const connectors: ConnectorConfig[] = [
  {
    name: 'GitHub',
    slug: 'github',
    icon: Github,
    color: '#8B5CF6',
    authType: 'api_key',
    category: 'development',
    description: 'Sincronize repositórios e automatize deploys.',
    longDescription: 'Conecte sua conta do GitHub para sincronizar repositórios, automatizar deploys e gerenciar seu código diretamente da plataforma KUBO.',
    features: ['Sincronização de repositórios', 'Deploy automático', 'Webhooks', 'CI/CD Integration'],
    docsUrl: 'https://docs.github.com',
    status: 'available',
    apiKeyLabel: 'Personal Access Token (PAT)',
    apiKeyPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    apiKeyHelp: 'Crie um Personal Access Token clássico no GitHub com escopos: repo, workflow, read:user.',
    apiKeyDocsUrl: 'https://github.com/settings/tokens/new',
    setupSteps: [
      { title: 'Acesse seu GitHub', description: 'Abra Settings → Developer settings → Personal access tokens (classic).' },
      { title: 'Gere um novo token', description: 'Selecione os escopos: repo, workflow, read:user.' },
      { title: 'Cole o token aqui', description: 'O token será criptografado e armazenado de forma segura na KUBO.' },
    ],
  },
  {
    name: 'Stripe',
    slug: 'stripe',
    icon: CreditCard,
    color: '#635BFF',
    authType: 'api_key',
    category: 'payments',
    description: 'Gerencie pagamentos e assinaturas.',
    longDescription: 'Integre o Stripe Connect para processar pagamentos, gerenciar assinaturas e criar uma marketplace completa.',
    features: ['Pagamentos via cartão', 'Assinaturas', 'Stripe Connect', 'Webhooks de pagamento'],
    docsUrl: 'https://stripe.com/docs',
    status: 'available',
    apiKeyLabel: 'Secret API Key',
    apiKeyPlaceholder: 'sk_live_... ou sk_test_...',
    apiKeyHelp: 'Use uma Secret Key (não a Publishable). Recomendamos uma Restricted Key com escopos mínimos.',
    apiKeyDocsUrl: 'https://dashboard.stripe.com/apikeys',
    setupSteps: [
      { title: 'Abra o Dashboard do Stripe', description: 'Vá até Developers → API Keys.' },
      { title: 'Crie uma Restricted Key', description: 'Marque apenas as permissões necessárias (Charges, Customers, etc).' },
      { title: 'Cole a chave aqui', description: 'A chave será cifrada com AES-256-GCM antes de ser persistida.' },
    ],
  },
  {
    name: 'Figma',
    slug: 'figma',
    icon: Figma,
    color: '#F24E1E',
    authType: 'api_key',
    category: 'design',
    description: 'Importe designs e componentes do Figma.',
    longDescription: 'Conecte o Figma para importar designs, tokens de design e componentes diretamente para seus projetos.',
    features: ['Importar frames', 'Design tokens', 'Auto-layout sync', 'Componentes'],
    docsUrl: 'https://www.figma.com/developers',
    status: 'available',
    apiKeyLabel: 'Personal Access Token',
    apiKeyPlaceholder: 'figd_xxxxxxxxxxxxxxxxxxxx',
    apiKeyHelp: 'Gere um Personal Access Token nas suas configurações do Figma.',
    apiKeyDocsUrl: 'https://www.figma.com/developers/api#access-tokens',
    setupSteps: [
      { title: 'Abra Settings no Figma', description: 'Account → Personal access tokens.' },
      { title: 'Gere um token', description: 'Dê um nome (ex.: "KUBO") e copie o valor exibido.' },
      { title: 'Cole o token aqui', description: 'Você poderá importar arquivos sem mais autenticação.' },
    ],
  },
  {
    name: 'Vercel',
    slug: 'vercel',
    icon: Globe,
    color: '#000000',
    authType: 'api_key',
    category: 'infrastructure',
    description: 'Deploy automático e hosting.',
    longDescription: 'Faça deploy automático dos seus projetos na Vercel com preview deployments e domínios customizados.',
    features: ['Deploy automático', 'Preview URLs', 'Domínios customizados', 'Edge Functions'],
    docsUrl: 'https://vercel.com/docs',
    status: 'available',
    apiKeyLabel: 'Vercel Access Token',
    apiKeyPlaceholder: 'xxxxxxxxxxxxxxxxxxxx',
    apiKeyHelp: 'Crie um Access Token na sua conta Vercel.',
    apiKeyDocsUrl: 'https://vercel.com/account/tokens',
    setupSteps: [
      { title: 'Abra Account Settings', description: 'Vercel → Settings → Tokens.' },
      { title: 'Crie um novo token', description: 'Defina escopo (Full Account ou apenas um Team).' },
      { title: 'Cole o token aqui', description: 'A KUBO usará para automatizar deploys.' },
    ],
  },
  {
    name: 'Supabase',
    slug: 'supabase',
    icon: Database,
    color: '#3ECF8E',
    authType: 'api_key',
    category: 'infrastructure',
    description: 'Backend completo com banco de dados e auth.',
    longDescription: 'Integração nativa com Supabase para autenticação, banco de dados em tempo real, storage e edge functions.',
    features: ['Autenticação', 'Database realtime', 'Storage', 'Edge Functions'],
    status: 'available',
    apiKeyLabel: 'Service Role Key',
    apiKeyPlaceholder: 'eyJhbGciOi...',
    apiKeyHelp: 'Pegue a Service Role Key em Project Settings → API. Nunca exponha essa chave no frontend.',
    apiKeyDocsUrl: 'https://supabase.com/dashboard',
    setupSteps: [
      { title: 'Abra seu projeto Supabase', description: 'Project Settings → API.' },
      { title: 'Copie a Service Role Key', description: 'É a chave que começa com eyJ...' },
      { title: 'Cole aqui', description: 'A KUBO armazena cifrada e usa server-side apenas.' },
    ],
  },
  {
    name: 'Resend',
    slug: 'resend',
    icon: Mail,
    color: '#000000',
    authType: 'api_key',
    category: 'communication',
    description: 'Envie emails transacionais e marketing.',
    longDescription: 'Use o Resend para enviar emails transacionais, campanhas de marketing e notificações com templates customizados.',
    features: ['Emails transacionais', 'Templates React', 'Analytics', 'Domínio customizado'],
    docsUrl: 'https://resend.com/docs',
    status: 'available',
    apiKeyLabel: 'Resend API Key',
    apiKeyPlaceholder: 're_xxxxxxxxxxxx',
    apiKeyHelp: 'Crie uma API Key no painel do Resend.',
    apiKeyDocsUrl: 'https://resend.com/api-keys',
    setupSteps: [
      { title: 'Abra o Resend', description: 'Dashboard → API Keys.' },
      { title: 'Crie uma chave', description: 'Defina permissões (Full access ou Sending only).' },
      { title: 'Cole aqui', description: 'A KUBO enviará emails em seu nome.' },
    ],
  },
  {
    name: 'Discord',
    slug: 'discord',
    icon: MessageSquare,
    color: '#5865F2',
    authType: 'api_key',
    category: 'communication',
    description: 'Bots e notificações no Discord.',
    longDescription: 'Integre com Discord para enviar notificações, criar bots e gerenciar comunidades diretamente da plataforma.',
    features: ['Webhooks', 'Bot commands', 'Notificações', 'Community management'],
    status: 'available',
    apiKeyLabel: 'Bot Token',
    apiKeyPlaceholder: 'MTAxxxxx.xxxxx.xxxxxxxxxxxxxx',
    apiKeyHelp: 'Crie uma aplicação no Discord Developer Portal e copie o Bot Token.',
    apiKeyDocsUrl: 'https://discord.com/developers/applications',
    setupSteps: [
      { title: 'Crie uma aplicação', description: 'Discord Developer Portal → New Application.' },
      { title: 'Adicione um Bot', description: 'Bot → Add Bot → Reset Token.' },
      { title: 'Cole o token aqui', description: 'A KUBO automatizará notificações.' },
    ],
  },
  {
    name: 'Cloudflare',
    slug: 'cloudflare',
    icon: Shield,
    color: '#F38020',
    authType: 'api_key',
    category: 'infrastructure',
    description: 'CDN, DNS e proteção DDoS.',
    longDescription: 'Proteja e acelere seus apps com Cloudflare CDN, gerenciamento de DNS e proteção contra ataques DDoS.',
    features: ['CDN global', 'DNS management', 'DDoS protection', 'Workers'],
    docsUrl: 'https://developers.cloudflare.com',
    status: 'available',
    apiKeyLabel: 'API Token',
    apiKeyPlaceholder: 'xxxxxxxxxxxxxxxxxxxx',
    apiKeyHelp: 'Crie um API Token (não Global API Key) com permissões mínimas necessárias.',
    apiKeyDocsUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    setupSteps: [
      { title: 'Abra seu perfil Cloudflare', description: 'My Profile → API Tokens → Create Token.' },
      { title: 'Use template "Edit zone DNS"', description: 'Ou customize com permissões específicas.' },
      { title: 'Cole o token aqui', description: 'A KUBO gerenciará DNS e cache automaticamente.' },
    ],
  },
]

export function getConnectorBySlug(slug: string): ConnectorConfig | undefined {
  return connectors.find(c => c.slug === slug)
}

export function getConnectorsByCategory(category: string): ConnectorConfig[] {
  return connectors.filter(c => c.category === category)
}

export const categories = [
  { id: 'all', label: 'Todos' },
  { id: 'development', label: 'Desenvolvimento' },
  { id: 'payments', label: 'Pagamentos' },
  { id: 'design', label: 'Design' },
  { id: 'infrastructure', label: 'Infraestrutura' },
  { id: 'communication', label: 'Comunicação' },
  { id: 'analytics', label: 'Analytics' },
]
