import { Github, CreditCard, Globe, Figma, Server, Smartphone, Cloud, Database, Mail, MessageSquare, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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
  internalRoute?: string // for connectors that already have pages
}

export const connectors: ConnectorConfig[] = [
  {
    name: 'GitHub',
    slug: 'github',
    icon: Github,
    color: '#8B5CF6',
    authType: 'oauth',
    category: 'development',
    description: 'Sincronize repositórios e automatize deploys.',
    longDescription: 'Conecte sua conta do GitHub para sincronizar repositórios, automatizar deploys e gerenciar seu código diretamente da plataforma KUBO.',
    features: ['Sincronização de repositórios', 'Deploy automático', 'Webhooks', 'CI/CD Integration'],
    docsUrl: 'https://docs.github.com',
    status: 'available',
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
  },
  {
    name: 'Figma',
    slug: 'figma',
    icon: Figma,
    color: '#F24E1E',
    authType: 'oauth',
    category: 'design',
    description: 'Importe designs e componentes do Figma.',
    longDescription: 'Conecte o Figma para importar designs, tokens de design e componentes diretamente para seus projetos.',
    features: ['Importar frames', 'Design tokens', 'Auto-layout sync', 'Componentes'],
    docsUrl: 'https://www.figma.com/developers',
    status: 'coming_soon',
  },
  {
    name: 'Vercel',
    slug: 'vercel',
    icon: Globe,
    color: '#000000',
    authType: 'oauth',
    category: 'infrastructure',
    description: 'Deploy automático e hosting.',
    longDescription: 'Faça deploy automático dos seus projetos na Vercel com preview deployments e domínios customizados.',
    features: ['Deploy automático', 'Preview URLs', 'Domínios customizados', 'Edge Functions'],
    docsUrl: 'https://vercel.com/docs',
    status: 'coming_soon',
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
    status: 'coming_soon',
  },
  {
    name: 'Discord',
    slug: 'discord',
    icon: MessageSquare,
    color: '#5865F2',
    authType: 'oauth',
    category: 'communication',
    description: 'Bots e notificações no Discord.',
    longDescription: 'Integre com Discord para enviar notificações, criar bots e gerenciar comunidades diretamente da plataforma.',
    features: ['Webhooks', 'Bot commands', 'Notificações', 'Community management'],
    status: 'coming_soon',
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
    status: 'coming_soon',
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
