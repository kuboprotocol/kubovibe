## Conector Web3 — Alchemy + multi-provider (v1 completo)

Reaproveita a arquitetura existente de `api_credentials` (AES-256-GCM via `CONNECTOR_ENC_KEY`) e `connector-credentials-save/test`, adicionando uma camada Web3 com providers e networks tipados.

### 1. Provider catalog (frontend, tipado)

`src/lib/web3Providers.ts`:
- `providers`: alchemy, infura, quicknode, moralis, chainstack, custom-rpc.
- Cada provider declara: id, label, logo, `apiKeyLabel`, `apiKeyHelp`, `docsUrl`, `networks: NetworkId[]`, e `buildRpcUrl(networkId, apiKey)`.
- `networks`: catálogo único `NetworkCatalog` (id, label, family, chainId|null, defaultExplorer, requiresJsonRpc).

### 2. Networks suportadas (v1)

EVM (testáveis via `eth_blockNumber`):
- ethereum-mainnet (1), ethereum-sepolia (11155111), ethereum-hoodi (560048)
- bsc-mainnet (56), polygon-mainnet (137)
- arbitrum-one (42161), arbitrum-sepolia (421614)
- optimism-mainnet (10), base-mainnet (8453), boba-mainnet (288)
- flow-evm-mainnet (747)

Não-EVM (família própria, teste via endpoint específico):
- solana-mainnet, solana-devnet → `getHealth` JSON-RPC
- bitcoin-mainnet, bitcoin-cash, litecoin, dogecoin → REST de explorer (Blockstream/Blockchair). Sem Alchemy nativo; só com custom-rpc/Moralis.

`stellar-mainnet` (você escreveu "Stella") — confirmo com você antes de incluir.

UI deixa claro quais providers suportam cada network (filtra dropdown).

### 3. Banco de dados

Migração nova (não toca `api_credentials`):

```sql
create table public.web3_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null,           -- alchemy | infura | ...
  network text not null,            -- ethereum-mainnet | solana-mainnet | ...
  connection_name text not null,
  rpc_url_ciphertext text not null, -- RPC pode conter a API key, cifrado
  rpc_url_iv text not null,
  rpc_url_tag text not null,
  api_key_ciphertext text,          -- opcional (custom-rpc pode não ter)
  api_key_iv text,
  api_key_tag text,
  api_key_hint text,
  explorer_url text not null,
  last_status text default 'unknown',  -- connected|offline|error|unknown
  last_checked_at timestamptz,
  last_block bigint,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, network, connection_name)
);
alter table public.web3_connections enable row level security;
create policy "owner select" on public.web3_connections for select using (auth.uid()=user_id);
create policy "owner insert" on public.web3_connections for insert with check (auth.uid()=user_id);
create policy "owner update" on public.web3_connections for update using (auth.uid()=user_id);
create policy "owner delete" on public.web3_connections for delete using (auth.uid()=user_id);
create policy "service role all" on public.web3_connections for all using (auth.role()='service_role') with check (auth.role()='service_role');
```

Trigger `touch_updated_at` reutilizado.

### 4. Edge Functions

- `web3-connection-save` — valida zod, cifra rpc/api_key com `CONNECTOR_ENC_KEY`, upsert por `(provider,network,connection_name)`.
- `web3-connection-test` — decifra RPC do registro, executa `eth_blockNumber` (EVM) / `getHealth` (Solana) / GET de explorer (UTXO), grava `last_status/last_block/last_checked_at/last_error`, retorna `{ok, status, blockNumber?, latencyMs, detail?}`.
- `web3-connection-delete` — RLS já cobre, mas centraliza auditoria.

Todas com `verify_jwt = true` (default) + `supabase.auth.getUser()`.

### 5. Frontend

- `src/pages/ConnectorWeb3Page.tsx` (rota `/connectors/web3/:provider`, ex.: `/connectors/web3/alchemy`).
- Painel lateral `<Sheet>` ao clicar no provider no hub `/connectors`.
- Campos: connectionName, network (Select agrupado por family), apiKey (toggle show/hide), rpcUrl (auto-preenchido por `buildRpcUrl`, editável), explorerUrl (auto-preenchido, editável).
- Botões: **Testar conexão** (chama `web3-connection-test` sem salvar — passa payload em memória) e **Salvar** (chama `web3-connection-save`).
- Status pill (Connected/Offline/Error) ligada a `last_status`, atualizada em tempo real via realtime na `web3_connections`.
- Lista de conexões existentes acima do form.
- Toasts via sonner; loading states com `Loader2`.

### 6. Segurança

- API keys e RPC URLs cifrados (RPC frequentemente contém a key na URL).
- Apenas `masked_hint` retornado ao cliente. Nunca log de chave bruta.
- Rate limit `bump_rate_limit('web3-test', user, 60)` máx 30/min por usuário.

### 7. Roadmap (fora desta entrega)

- WalletConnect/MetaMask (browser provider, sem servidor).
- Schemas adicionais (gasPrice, network status dashboard).
- Compartilhar conexões com projetos do builder.

### Arquivos a criar/editar

```
src/lib/web3Providers.ts                              (novo)
src/lib/web3Networks.ts                               (novo)
src/pages/ConnectorWeb3Page.tsx                       (novo)
src/components/connectors/Web3ConnectionForm.tsx      (novo)
src/components/connectors/Web3ConnectionList.tsx      (novo)
src/components/connectors/Web3StatusPill.tsx          (novo)
src/App.tsx                                           (rota nova)
src/pages/ConnectorsHubPage.tsx                       (entry points Alchemy/Infura/...)
supabase/migrations/<ts>_web3_connections.sql         (novo)
supabase/functions/web3-connection-save/index.ts      (novo)
supabase/functions/web3-connection-test/index.ts      (novo)
supabase/functions/web3-connection-delete/index.ts    (novo)
```

### Pergunta antes de implementar

1. Confirmar "Stella" = **Stellar** (XLM) ou outra chain? Stellar não é EVM nem usa JSON-RPC padrão — incluir adiaria a v1.
2. Para Bitcoin/BCH/Doge/LTC sem provider EVM, posso usar **Blockstream/Blockchair públicos** como teste (sem API key obrigatória)?
3. OK em começar habilitando **Alchemy + Infura + Custom RPC** nesta PR e adicionar QuickNode/Moralis/Chainstack na próxima?
