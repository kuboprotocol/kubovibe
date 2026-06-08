// Camada 3 — Compila o source Solidity de um contrato gerado e faz o
// deploy automático na testnet Sepolia usando uma carteira deployer
// custodial (DEPLOYER_PRIVATE_KEY). Persiste endereço, txHash, bloco,
// gas e logs/eventos em `contract_deployments`.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0'
import { ethers } from 'npm:ethers@6.13.4'
// @ts-ignore solc has no types
import solc from 'npm:solc@0.8.26'
import { corsHeaders, sanitizeError } from '../_shared/cors.ts'

type Body = { contract_id: string; constructor_args?: unknown[] }

const ETHERSCAN = 'https://sepolia.etherscan.io'

// Resolver imports do OpenZeppelin via unpkg (sem node_modules).
async function resolveImport(path: string): Promise<{ contents: string } | { error: string }> {
  if (!path.startsWith('@openzeppelin/')) return { error: 'unsupported import: ' + path }
  const url = `https://unpkg.com/${path.replace('@openzeppelin/contracts/', '@openzeppelin/contracts@5.0.2/')}`
  try {
    const r = await fetch(url)
    if (!r.ok) return { error: `fetch ${path} -> ${r.status}` }
    return { contents: await r.text() }
  } catch (e) {
    return { error: String(e) }
  }
}

async function compile(source: string, contractName: string) {
  // Pré-resolver todos os imports recursivamente (solc.compile é síncrono).
  const sources: Record<string, { content: string }> = { 'main.sol': { content: source } }
  const seen = new Set<string>(['main.sol'])
  const queue: string[] = ['main.sol']
  while (queue.length) {
    const file = queue.shift()!
    const src = sources[file].content
    const importRegex = /import\s+(?:\{[^}]*\}\s+from\s+)?["']([^"']+)["']/g
    let m: RegExpExecArray | null
    while ((m = importRegex.exec(src))) {
      const dep = m[1]
      if (seen.has(dep)) continue
      seen.add(dep)
      const r = await resolveImport(dep)
      if ('error' in r) throw new Error(r.error)
      sources[dep] = { content: r.contents }
      queue.push(dep)
    }
  }

  const input = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  }
  const out = JSON.parse(solc.compile(JSON.stringify(input), { import: () => ({ error: 'sync-resolver-disabled' }) }))
  const errs = (out.errors ?? []).filter((e: { severity: string }) => e.severity === 'error')
  if (errs.length) throw new Error('solc: ' + errs.map((e: { formattedMessage: string }) => e.formattedMessage).join('\n'))
  const artifact = out.contracts['main.sol']?.[contractName]
  if (!artifact) throw new Error(`contract ${contractName} not found in compilation output`)
  return { abi: artifact.abi, bytecode: '0x' + artifact.evm.bytecode.object }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const RPC = Deno.env.get('SEPOLIA_RPC_URL')
    const PK = Deno.env.get('DEPLOYER_PRIVATE_KEY')
    if (!RPC || !PK) {
      return new Response(JSON.stringify({ error: 'deployer_not_configured' }), { status: 503, headers: corsHeaders })
    }

    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } })
    const { data: u } = await userClient.auth.getUser()
    if (!u?.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })

    const body = (await req.json().catch(() => ({}))) as Body
    if (!body.contract_id || typeof body.contract_id !== 'string') {
      return new Response(JSON.stringify({ error: 'contract_id required' }), { status: 400, headers: corsHeaders })
    }

    const { data: contract, error: cErr } = await userClient
      .from('generated_contracts')
      .select('id, user_id, name, source_code, decimals, initial_supply, symbol')
      .eq('id', body.contract_id)
      .maybeSingle()
    if (cErr || !contract) return new Response(JSON.stringify({ error: 'contract_not_found' }), { status: 404, headers: corsHeaders })

    // Compile
    const { abi, bytecode } = await compile(contract.source_code, contract.name)

    // Deploy
    const provider = new ethers.JsonRpcProvider(RPC)
    const wallet = new ethers.Wallet(PK, provider)
    const factory = new ethers.ContractFactory(abi, bytecode, wallet)

    // Construtor: nosso template ERC-20 = (address initialOwner)
    const args = body.constructor_args && Array.isArray(body.constructor_args) && body.constructor_args.length
      ? body.constructor_args
      : [wallet.address]

    const deployTx = await factory.deploy(...args)
    const deployed = await deployTx.waitForDeployment()
    const address = await deployed.getAddress()
    const receipt = await deployTx.deploymentTransaction()!.wait()
    if (!receipt) throw new Error('deployment receipt missing')

    const events = receipt.logs.map((l) => {
      try {
        const parsed = new ethers.Interface(abi).parseLog(l)
        return parsed ? { name: parsed.name, args: parsed.args.map((a) => (typeof a === 'bigint' ? a.toString() : a)) } : { topics: l.topics, data: l.data }
      } catch {
        return { topics: l.topics, data: l.data }
      }
    })

    // Persist com service role para garantir insert (RLS exige user_id = auth.uid())
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const explorer = `${ETHERSCAN}/address/${address}`
    const { data: dep, error: dErr } = await admin.from('contract_deployments').insert({
      user_id: u.user.id,
      contract_id: contract.id,
      network: 'sepolia',
      chain_id: 11155111,
      contract_address: address,
      deployer_address: wallet.address,
      tx_hash: receipt.hash,
      block_number: Number(receipt.blockNumber),
      gas_used: receipt.gasUsed.toString(),
      events,
      abi,
      explorer_url: explorer,
      status: 'success',
    }).select('id').single()
    if (dErr) console.error('persist deployment failed', dErr)

    return new Response(JSON.stringify({
      deployment_id: dep?.id,
      contract_address: address,
      tx_hash: receipt.hash,
      block_number: Number(receipt.blockNumber),
      gas_used: receipt.gasUsed.toString(),
      explorer_url: explorer,
      tx_explorer_url: `${ETHERSCAN}/tx/${receipt.hash}`,
      deployer: wallet.address,
      events,
    }), { status: 200, headers: corsHeaders })
  } catch (e) {
    console.error('deploy error:', e)
    return new Response(JSON.stringify({ error: sanitizeError(e) }), { status: 500, headers: corsHeaders })
  }
})
