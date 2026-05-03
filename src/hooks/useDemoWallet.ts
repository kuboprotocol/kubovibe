// Carteira Web3 demo client-side — gera um endereço determinístico a partir
// do user_id usando WebCrypto (SHA-256). NÃO é uma chave real: o objetivo
// no MVP é dar ao usuário leigo uma "carteira" visível sem instalar
// MetaMask, sem custódia e sem rede. Quando o motor on-chain entrar, este
// hook é trocado por uma carteira embutida real (Privy/Magic).
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

type WalletState = {
  address: string | null
  short: string | null
  ready: boolean
}

const STORAGE_KEY = 'kubo:wallet:demo:v1'

async function deriveAddress(seed: string): Promise<string> {
  const buf = new TextEncoder().encode(`kubo-demo-wallet:${seed}`)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  const bytes = new Uint8Array(hash).slice(0, 20) // últimos 20 bytes = endereço
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `0x${hex}`
}

export function useDemoWallet(): WalletState {
  const { user } = useAuth()
  const [state, setState] = useState<WalletState>({ address: null, short: null, ready: false })

  useEffect(() => {
    let cancelled = false
    if (!user) {
      setState({ address: null, short: null, ready: true })
      return
    }
    const cached = localStorage.getItem(`${STORAGE_KEY}:${user.id}`)
    if (cached) {
      setState({ address: cached, short: shorten(cached), ready: true })
      return
    }
    deriveAddress(user.id).then((address) => {
      if (cancelled) return
      localStorage.setItem(`${STORAGE_KEY}:${user.id}`, address)
      setState({ address, short: shorten(address), ready: true })
    })
    return () => { cancelled = true }
  }, [user])

  return state
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
