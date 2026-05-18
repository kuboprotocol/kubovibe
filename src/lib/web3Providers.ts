import { NETWORKS, getNetwork, type NetworkSpec } from './web3Networks'

export type ProviderId = 'alchemy' | 'infura' | 'custom-rpc'

export interface ProviderSpec {
  id: ProviderId
  label: string
  color: string
  description: string
  docsUrl: string
  apiKeyLabel: string
  apiKeyPlaceholder: string
  apiKeyHelp: string
  /** Quais networks (por id) este provider suporta. */
  supportedNetworks: string[]
  requiresApiKey: boolean
  /** Constrói uma RPC URL a partir do networkId + apiKey. Pode retornar null se incompatível. */
  buildRpcUrl: (networkId: string, apiKey: string) => string | null
}

const supportedAlchemy = NETWORKS.filter((n) => !!n.alchemyHost).map((n) => n.id)
const supportedInfura = NETWORKS.filter((n) => !!n.infuraHost).map((n) => n.id)

export const PROVIDERS: ProviderSpec[] = [
  {
    id: 'alchemy',
    label: 'Alchemy',
    color: '#0E76FD',
    description: 'RPC enterprise multi-chain com SLA, webhooks e enhanced APIs.',
    docsUrl: 'https://docs.alchemy.com',
    apiKeyLabel: 'Alchemy API Key',
    apiKeyPlaceholder: 'Cole sua API Key da Alchemy',
    apiKeyHelp: 'Crie em https://dashboard.alchemy.com → Apps → View Key.',
    supportedNetworks: supportedAlchemy,
    requiresApiKey: true,
    buildRpcUrl: (networkId, apiKey) => {
      const net = getNetwork(networkId)
      if (!net?.alchemyHost || !apiKey) return null
      return `https://${net.alchemyHost}/v2/${apiKey}`
    },
  },
  {
    id: 'infura',
    label: 'Infura',
    color: '#FF6B4A',
    description: 'Provider RPC tradicional da ConsenSys com cobertura EVM ampla.',
    docsUrl: 'https://docs.infura.io',
    apiKeyLabel: 'Infura Project ID',
    apiKeyPlaceholder: 'Cole seu Project ID (API Key) da Infura',
    apiKeyHelp: 'Crie em https://app.infura.io → API Keys.',
    supportedNetworks: supportedInfura,
    requiresApiKey: true,
    buildRpcUrl: (networkId, apiKey) => {
      const net = getNetwork(networkId)
      if (!net?.infuraHost || !apiKey) return null
      return `https://${net.infuraHost}/v3/${apiKey}`
    },
  },
  {
    id: 'custom-rpc',
    label: 'Custom RPC',
    color: '#10B981',
    description: 'Conecte qualquer endpoint RPC próprio (self-hosted, QuickNode, Moralis, etc.).',
    docsUrl: 'https://ethereum.org/en/developers/docs/apis/json-rpc/',
    apiKeyLabel: 'API Key (opcional)',
    apiKeyPlaceholder: 'Opcional — use se sua RPC exigir header de auth',
    apiKeyHelp: 'Se sua RPC URL já contém a chave embutida, deixe este campo vazio.',
    supportedNetworks: NETWORKS.map((n) => n.id),
    requiresApiKey: false,
    buildRpcUrl: () => null, // o usuário cola manualmente
  },
]

export const PROVIDERS_BY_ID: Record<ProviderId, ProviderSpec> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p]),
) as Record<ProviderId, ProviderSpec>

export function getProvider(id: string): ProviderSpec | undefined {
  return PROVIDERS_BY_ID[id as ProviderId]
}

export function getNetworksForProvider(providerId: ProviderId): NetworkSpec[] {
  const p = PROVIDERS_BY_ID[providerId]
  if (!p) return []
  return p.supportedNetworks.map((id) => getNetwork(id)).filter((n): n is NetworkSpec => !!n)
}
