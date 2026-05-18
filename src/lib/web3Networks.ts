// Catálogo único de redes Web3 suportadas pelo conector multi-provider.
// chainId = null para chains não-EVM. requiresJsonRpc determina como o
// edge function `web3-connection-test` valida a conexão.

export type NetworkFamily = 'evm' | 'solana' | 'utxo'

export interface NetworkSpec {
  id: string
  label: string
  family: NetworkFamily
  chainId: number | null
  defaultExplorer: string
  /** Subdomínio canônico usado por Alchemy/Infura para montar a RPC URL. */
  alchemyHost?: string
  infuraHost?: string
  /** REST fallback para chains UTXO (Blockstream/Blockchair, sem API key). */
  publicRpcUrl?: string
}

export const NETWORKS: readonly NetworkSpec[] = [
  // EVM L1
  { id: 'ethereum-mainnet',  label: 'Ethereum Mainnet',  family: 'evm', chainId: 1,        defaultExplorer: 'https://etherscan.io',         alchemyHost: 'eth-mainnet.g.alchemy.com',  infuraHost: 'mainnet.infura.io' },
  { id: 'ethereum-sepolia',  label: 'Ethereum Sepolia',  family: 'evm', chainId: 11155111, defaultExplorer: 'https://sepolia.etherscan.io', alchemyHost: 'eth-sepolia.g.alchemy.com',  infuraHost: 'sepolia.infura.io' },
  { id: 'ethereum-hoodi',    label: 'Ethereum Hoodi',    family: 'evm', chainId: 560048,   defaultExplorer: 'https://hoodi.etherscan.io',   alchemyHost: 'eth-hoodi.g.alchemy.com' },
  { id: 'bsc-mainnet',       label: 'BNB Smart Chain',   family: 'evm', chainId: 56,       defaultExplorer: 'https://bscscan.com',          alchemyHost: 'bnb-mainnet.g.alchemy.com' },
  { id: 'polygon-mainnet',   label: 'Polygon Mainnet',   family: 'evm', chainId: 137,      defaultExplorer: 'https://polygonscan.com',      alchemyHost: 'polygon-mainnet.g.alchemy.com', infuraHost: 'polygon-mainnet.infura.io' },

  // EVM L2
  { id: 'arbitrum-one',      label: 'Arbitrum One',      family: 'evm', chainId: 42161,    defaultExplorer: 'https://arbiscan.io',          alchemyHost: 'arb-mainnet.g.alchemy.com',  infuraHost: 'arbitrum-mainnet.infura.io' },
  { id: 'arbitrum-sepolia',  label: 'Arbitrum Sepolia',  family: 'evm', chainId: 421614,   defaultExplorer: 'https://sepolia.arbiscan.io',  alchemyHost: 'arb-sepolia.g.alchemy.com',  infuraHost: 'arbitrum-sepolia.infura.io' },
  { id: 'optimism-mainnet',  label: 'Optimism Mainnet',  family: 'evm', chainId: 10,       defaultExplorer: 'https://optimistic.etherscan.io', alchemyHost: 'opt-mainnet.g.alchemy.com', infuraHost: 'optimism-mainnet.infura.io' },
  { id: 'base-mainnet',      label: 'Base Mainnet',      family: 'evm', chainId: 8453,     defaultExplorer: 'https://basescan.org',         alchemyHost: 'base-mainnet.g.alchemy.com' },
  { id: 'boba-mainnet',      label: 'Boba Mainnet',      family: 'evm', chainId: 288,      defaultExplorer: 'https://bobascan.com' },
  { id: 'flow-evm-mainnet',  label: 'Flow EVM Mainnet',  family: 'evm', chainId: 747,      defaultExplorer: 'https://evm.flowscan.io' },

  // Solana
  { id: 'solana-mainnet',    label: 'Solana Mainnet',    family: 'solana', chainId: null, defaultExplorer: 'https://explorer.solana.com',                       alchemyHost: 'solana-mainnet.g.alchemy.com' },
  { id: 'solana-devnet',     label: 'Solana Devnet',     family: 'solana', chainId: null, defaultExplorer: 'https://explorer.solana.com?cluster=devnet',        alchemyHost: 'solana-devnet.g.alchemy.com' },

  // UTXO (sem suporte nativo Alchemy/Infura → custom-rpc + REST público)
  { id: 'bitcoin-mainnet',   label: 'Bitcoin',           family: 'utxo', chainId: null, defaultExplorer: 'https://blockstream.info',                          publicRpcUrl: 'https://blockstream.info/api' },
  { id: 'bitcoin-cash',      label: 'Bitcoin Cash',      family: 'utxo', chainId: null, defaultExplorer: 'https://blockchair.com/bitcoin-cash',               publicRpcUrl: 'https://api.blockchair.com/bitcoin-cash' },
  { id: 'litecoin',          label: 'Litecoin',          family: 'utxo', chainId: null, defaultExplorer: 'https://blockchair.com/litecoin',                   publicRpcUrl: 'https://api.blockchair.com/litecoin' },
  { id: 'dogecoin',          label: 'Dogecoin',          family: 'utxo', chainId: null, defaultExplorer: 'https://blockchair.com/dogecoin',                   publicRpcUrl: 'https://api.blockchair.com/dogecoin' },
] as const

export const NETWORKS_BY_ID: Record<string, NetworkSpec> = Object.fromEntries(NETWORKS.map((n) => [n.id, n]))

export function getNetwork(id: string): NetworkSpec | undefined {
  return NETWORKS_BY_ID[id]
}
