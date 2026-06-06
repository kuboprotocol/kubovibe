# Kubo VibeDev

> Plataforma autônoma de criação, execução e monetização de software baseada em IA.
> Transforma ideias em produtos digitais completos — SaaS, metaversos, jogos AAA e aplicações Web3.

<!-- CI badges (clique para abrir o histórico de runs) -->
[![env-check](https://github.com/kuboprotocol/kubo-vibedev/actions/workflows/env-check.yml/badge.svg?branch=main)](https://github.com/kuboprotocol/kubo-vibedev/actions/workflows/env-check.yml?query=branch%3Amain)
[![vitest](https://github.com/kuboprotocol/kubo-vibedev/actions/workflows/vitest.yml/badge.svg?branch=main)](https://github.com/kuboprotocol/kubo-vibedev/actions/workflows/vitest.yml?query=branch%3Amain)
[![e2e](https://github.com/kuboprotocol/kubo-vibedev/actions/workflows/e2e.yml/badge.svg?branch=main)](https://github.com/kuboprotocol/kubo-vibedev/actions/workflows/e2e.yml?query=branch%3Amain)
[![wgsl-sanitizer](https://github.com/kuboprotocol/kubo-vibedev/actions/workflows/wgsl-sanitizer.yml/badge.svg?branch=main)](https://github.com/kuboprotocol/kubo-vibedev/actions/workflows/wgsl-sanitizer.yml?query=branch%3Amain)
[![post-migration-security](https://github.com/kuboprotocol/kubo-vibedev/actions/workflows/post-migration-security.yml/badge.svg?branch=main)](https://github.com/kuboprotocol/kubo-vibedev/actions/workflows/post-migration-security.yml?query=branch%3Amain)

> Cada badge linka para o histórico filtrado em `branch=main`. Verde = último run passou, vermelho = falhou (clique para ver logs e artifacts, incluindo `env-check-report`).

---

## Visão Geral

O **Kubo VibeDev** é uma plataforma SaaS com inteligência artificial que permite a criação automática de aplicações digitais, incluindo sistemas Web2 e Web3.

**O que ele faz:**
- Gera aplicações completas (frontend + backend)
- Cria APIs e microserviços automaticamente
- Estrutura bancos de dados PostgreSQL
- Realiza deploy em cloud
- Integra sistemas de pagamento e blockchain
- Cria jogos 2D/3D, metaversos e MMOs via **Quantum Game Engine**
- Produz vídeos motion graphics, mockups de produto e assets de IA

**URL de Produção:** https://kubovibe.dev  
**Preview:** https://id-preview--5ce8b966-167f-4e5a-be1c-165ac92bd64e.lovable.app

---

## Skills do Sistema (IA Multi-Agente)

O Kubo VibeDev opera com 4 skills de IA especializadas, acionadas automaticamente ou via `/` no chat:

| Skill | Status | Função |
|-------|--------|--------|
| **kubo-vibedev-ai-system** | Ativa | Orquestração multiagente + Quantum Game Engine |
| **video-creator** | Ativa | Vídeos motion graphics via Remotion |
| **product-shot** | Ativa | Screenshots polidos com frame macOS + mesh gradients |
| **ai-gateway** | Ativa | Scripts que chamam modelos AI via Lovable AI Gateway |

### kubo-vibedev-ai-system
Orquestra o ecossistema completo. Quando ativada, a IA instancia imediatamente a equipe multiagente (Dev, UI, Backend, Deploy, Data & Ops, Autonomous Action) para execução paralela. Inclui o **Kubo VibeDev Quantum Game Creator** — sistema AI-FIRST avançado que transforma prompts em jogos completos de nível AAA.

### video-creator
Cria vídeos motion graphics em qualidade de agência usando **Remotion + React + Tailwind**, renderizando MP4 via CLI headless para `/mnt/documents/`. Use quando precisar de vídeo, motion, animação cinematográfica, trailer ou peça de marketing animada.

### product-shot
Gera screenshots de produto polidos (frame macOS com traffic lights, cantos arredondados, sombra e mesh gradient) a partir de uma captura do app. Use para mockup, hero image, screenshot bonito ou imagem para landing/marketing. Presets: `sunset`, `ocean`, `aurora`, `candy`, `midnight`, `fog`, `peach`, `arctic`, `ember`, `lavender`.

### ai-gateway
Chama modelos AI (texto, JSON estruturado, batch, geração e edição de imagem) a partir de scripts no sandbox via Lovable AI Gateway, sem precisar de API key extra. Modelo padrão: `google/gemini-3-flash-preview`.

---

## Diagrama de Arquitetura

```mermaid
flowchart TB
    subgraph Client["Cliente (Browser / Capacitor)"]
        UI["React 18 + Vite 5<br/>Tailwind + shadcn/ui"]
        Builder["Builder Interface<br/>Canvas / KUBO FLOW AI"]
        Game["Quantum Game Engine<br/>Three.js + ECS + WebGPU"]
        WGSL["WGSL Sanitizer<br/>(src/game/wgsl-safe.ts)"]
    end

    subgraph Skills["Skills Multi-Agente"]
        S1["kubo-vibedev-ai-system"]
        S2["video-creator (Remotion)"]
        S3["product-shot"]
        S4["ai-gateway"]
    end

    subgraph Cloud["Lovable Cloud (Supabase)"]
        Auth["Auth<br/>JWT + GitHub/Google OAuth"]
        DB[("PostgreSQL<br/>profiles · ledger · user_roles")]
        RPC["RPC<br/>execute_atomic_credit_deduction"]
        RT["Realtime CDC<br/>WebSocket"]
        Storage["Storage<br/>uploads / WebP"]
        EF["Edge Functions<br/>game-npc-ai · stripe · email"]
    end

    subgraph External["Integrações Externas"]
        AIGW["Lovable AI Gateway<br/>Gemini · GPT-5 · DeepSeek"]
        Stripe["Stripe / Polar<br/>Pagamentos + Connect"]
        IPFS["web3.storage / IPFS"]
        Email["Resend (notify.kubovibe.dev)"]
        GH["GitHub OAuth + Deploy"]
    end

    UI --> Builder
    Builder --> Skills
    Builder --> EF
    Game --> WGSL
    WGSL --> Game

    Skills --> AIGW
    UI --> Auth
    Auth --> DB
    Builder --> RPC
    RPC --> DB
    DB --> RT
    RT --> UI
    UI --> Storage

    EF --> AIGW
    EF --> Stripe
    EF --> IPFS
    EF --> Email
    EF --> GH
    EF --> DB
```

### Fluxo de Crédito Atômico

```mermaid
sequenceDiagram
    participant U as Usuário
    participant F as Frontend
    participant R as RPC execute_atomic_credit_deduction
    participant L as smart_economy_ledger
    participant W as Realtime CDC
    U->>F: Ação (gerar app / vídeo / render)
    F->>R: deduct(user_id, tokens, op_type, provider, cost)
    R->>R: UPDATE profiles SET credits = credits - tokens (row lock)
    R->>L: INSERT ledger (gross_revenue, api_cost)
    R-->>F: novo saldo
    L->>W: CDC change event
    W-->>F: subscribe → UI atualiza saldo em <0.4ms
```

### ERD — Smart Economy Core

Modelo de dados das tabelas envolvidas no ledger de créditos atômicos. As relações são lógicas via `user_id` (sem foreign keys físicas, para isolar deleções de `auth.users` e permitir RLS por `auth.uid()`).

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "1:1 (id)"
    AUTH_USERS ||--o| SUBSCRIPTIONS : "1:1 (user_id)"
    AUTH_USERS ||--o{ CREDIT_TRANSACTIONS : "1:N (user_id)"
    AUTH_USERS ||--o{ AD_REWARDS : "1:N (user_id)"
    AUTH_USERS ||--o{ SHORTLINK_CLICKS : "1:N (user_id)"
    AUTH_USERS ||--o{ USER_BADGES : "1:N (user_id)"
    AUTH_USERS ||--|| USER_STREAKS : "1:1 (user_id)"
    AUTH_USERS ||--o{ REFERRALS : "referrer_id / referred_id"
    SHORTLINKS  ||--o{ SHORTLINK_CLICKS : "1:N (shortlink_id)"

    AUTH_USERS {
        uuid id PK
        text email
    }

    PROFILES {
        uuid id PK "= auth.users.id"
        text display_name
        text avatar_url
        text referral_code
        timestamptz created_at
        timestamptz updated_at
    }

    SUBSCRIPTIONS {
        uuid id PK
        uuid user_id FK
        text plan "beta|starter|ultra"
        int  edits_limit
        int  edits_used
        bool is_active
        timestamptz paid_at
    }

    CREDIT_TRANSACTIONS {
        uuid id PK
        uuid user_id FK
        int  delta "+ ganho / - consumo"
        int  balance_after
        text reason
        text category
        text idempotency_key UK
        jsonb metadata
        timestamptz created_at
    }

    AD_REWARDS {
        uuid id PK
        uuid user_id FK
        text ad_type "unity_rewarded|youtube"
        numeric reward_credits "default 0.5"
        timestamptz created_at
    }

    SHORTLINKS {
        uuid id PK
        text slug UK
        text destination_url
        numeric reward_credits
        int  wait_seconds
        bool is_active
    }

    SHORTLINK_CLICKS {
        uuid id PK
        uuid user_id FK
        uuid shortlink_id FK
        bool completed
        numeric reward_credited
        text ip_address
        timestamptz clicked_at
        timestamptz completed_at
    }

    REFERRALS {
        uuid id PK
        uuid referrer_id FK
        uuid referred_id FK
        numeric credits_awarded "default 100"
        timestamptz created_at
    }

    USER_STREAKS {
        uuid id PK
        uuid user_id FK
        int  current_streak
        int  longest_streak
        date last_activity_date
    }

    USER_BADGES {
        uuid id PK
        uuid user_id FK
        text badge_type
        timestamptz unlocked_at
    }
```

### Fontes de Crédito → Ledger

```mermaid
flowchart LR
    A[Ad Reward<br/>0.5 cred · max 10/dia] --> LED
    S[Shortlink Click<br/>+wait_seconds]     --> LED
    R[Referral<br/>+100 cred]                --> LED
    ST[Streak Bonus diário]                  --> LED
    SUB[Subscription / Stripe<br/>edits_limit] --> LED
    BUILD[Build / AI Gen<br/>consumo -] --> LED

    LED[(credit_transactions<br/>delta + balance_after<br/>idempotency_key)]
    LED -- atualiza --> P[(profiles / subscriptions)]
    LED -- CDC --> RT[Realtime → UI]
```

> Toda mutação de saldo passa por `execute_atomic_credit_deduction` (row-lock + INSERT no ledger na mesma transação). `idempotency_key` evita dupla contagem em webhooks (Stripe, Unity Ads, shortlinks).

---

### Dicionário de Dados — Smart Economy Core

Convenções: **PK** = chave primária · **FK*** = relação lógica (sem foreign key física, validada por RLS via `auth.uid()`) · **UK** = unique · timestamps em `timestamptz` UTC.

#### `profiles`
Espelho público de `auth.users`. Criado automaticamente pelo trigger `handle_new_user` no signup.

| Campo | Tipo | Chave | Nulo | Default | Descrição |
|---|---|---|---|---|---|
| `id` | uuid | PK · FK*→`auth.users.id` | não | — | Mesmo id do usuário em `auth.users` (1:1). |
| `display_name` | text | — | sim | — | Nome exibido (cai para `email` se ausente). |
| `avatar_url` | text | — | sim | — | URL pública do avatar (bucket `avatars`, com cache-bust por timestamp). |
| `referral_code` | text | UK | sim | — *(trigger `handle_new_user` → `substr(id::text,1,8)`)* | Código de indicação único de 8 chars. |
| `created_at` | timestamptz | — | não | `now()` | Criação. |
| `updated_at` | timestamptz | — | não | `now()` | Última atualização. |

#### `subscriptions`
Plano ativo e cota de créditos do usuário. Linha bloqueada via `FOR UPDATE` na RPC.

| Campo | Tipo | Chave | Nulo | Default | Descrição |
|---|---|---|---|---|---|
| `id` | uuid | PK | não | `gen_random_uuid()` | Identificador da assinatura. |
| `user_id` | uuid | FK*→`auth.users.id` | não | — | Dono da assinatura (1:1 ativa por usuário). |
| `plan` | text | — | não | `'beta'` | `beta` · `starter` · `ultra`. |
| `edits_limit` | int | — | não | `20` | Cota total de créditos do ciclo. |
| `edits_used` | int | — | não | `0` | Consumidos no ciclo. Saldo = `edits_limit - edits_used`. |
| `is_active` | bool | — | não | `true` | Se `false`, RPC rejeita com `subscription_not_found`. |
| `paid_at` | timestamptz | — | sim | `now()` | Último pagamento confirmado (Stripe/Polar webhook). |
| `created_at` / `updated_at` | timestamptz | — | não | `now()` | Auditoria. |

#### `credit_transactions` — ledger imutável
Toda mutação de saldo grava aqui dentro da mesma transação do `UPDATE subscriptions`.

| Campo | Tipo | Chave | Nulo | Default | Descrição |
|---|---|---|---|---|---|
| `id` | uuid | PK | não | `gen_random_uuid()` | Id da transação. |
| `user_id` | uuid | FK*→`auth.users.id` | não | — | Dono. |
| `delta` | int | — | não | — | `+` ganho / `−` consumo. |
| `balance_after` | int | — | não | — | Saldo resultante (snapshot). |
| `reason` | text | — | não | — | Texto humano (ex.: `ai_generation`, `ad_reward`). |
| `category` | text | — | não | `'general'` | Bucket para analytics. |
| `metadata` | jsonb | — | não | `'{}'` | Payload livre (op_type, provider, api_cost, etc.). |
| `idempotency_key` | text | UK por `user_id` | sim | — | Bloqueia replay de webhook (Stripe, Unity, shortlinks). |
| `created_at` | timestamptz | — | não | `now()` | Insert time. |

#### `ad_rewards`
Recompensas por anúncios assistidos (Unity Ads nativo / YouTube fallback web).

| Campo | Tipo | Chave | Nulo | Default | Descrição |
|---|---|---|---|---|---|
| `id` | uuid | PK | não | `gen_random_uuid()` | — |
| `user_id` | uuid | FK*→`auth.users.id` | não | — | Quem recebeu. |
| `ad_type` | text | — | não | `'unity_rewarded'` | `unity_rewarded` · `youtube`. |
| `reward_credits` | numeric | — | não | `0.5` | Créditos creditados (limite 10/dia). |
| `created_at` | timestamptz | — | não | `now()` | Anti-fraude por janela diária. |

#### `shortlinks`
Catálogo público de links monetizados. Somente `service_role` escreve.

| Campo | Tipo | Chave | Nulo | Default | Descrição |
|---|---|---|---|---|---|
| `id` | uuid | PK | não | `gen_random_uuid()` | — |
| `slug` | text | UK | não | — | Slug público (`/l/:slug`). |
| `title` | text | — | não | `'Shortlink'` | Rótulo. |
| `destination_url` | text | — | não | — | Destino final após espera. |
| `reward_credits` | numeric | — | não | `0.5` | Pago por click válido. |
| `wait_seconds` | int | — | não | `8` | Tempo mínimo antes do redirect (anti-bot). |
| `is_active` | bool | — | não | `true` | Visível para `anon`/`authenticated`. |
| `created_at` | timestamptz | — | não | `now()` | — |

#### `shortlink_clicks`
Sessões de click — uma por (user, shortlink, tentativa). Crédito só com `completed=true`.

| Campo | Tipo | Chave | Nulo | Default | Descrição |
|---|---|---|---|---|---|
| `id` | uuid | PK | não | `gen_random_uuid()` | — |
| `user_id` | uuid | FK*→`auth.users.id` | não | — | Clicador autenticado. |
| `shortlink_id` | uuid | FK*→`shortlinks.id` | não | — | Link clicado. |
| `ip_address` | text | — | sim | — | Auditoria anti-fraude. |
| `completed` | bool | — | não | `false` | `true` após `wait_seconds`. |
| `reward_credited` | numeric | — | não | `0` | Quanto foi pago (snapshot). |
| `clicked_at` | timestamptz | — | não | `now()` | Início. |
| `completed_at` | timestamptz | — | sim | — | Quando virou elegível. |

#### `referrals`
Indicações resgatadas — gravadas pelo trigger `handle_new_user` quando o novo usuário traz `referral_code`.

| Campo | Tipo | Chave | Nulo | Default | Descrição |
|---|---|---|---|---|---|
| `id` | uuid | PK | não | `gen_random_uuid()` | — |
| `referrer_id` | uuid | FK*→`auth.users.id` | não | — | Quem indicou (recebe os créditos). |
| `referred_id` | uuid | FK*→`auth.users.id` | não | — | Novo usuário. |
| `credits_awarded` | numeric | — | não | `100` | Bônus aplicado em `subscriptions.edits_limit`. |
| `created_at` | timestamptz | — | não | `now()` | — |

#### `user_streaks`
Sequência diária para gamificação e leaderboard.

| Campo | Tipo | Chave | Nulo | Default | Descrição |
|---|---|---|---|---|---|
| `id` | uuid | PK | não | `gen_random_uuid()` | — |
| `user_id` | uuid | FK*→`auth.users.id` (1:1) | não | — | Dono. |
| `current_streak` | int | — | não | `0` | Dias consecutivos atuais. |
| `longest_streak` | int | — | não | `0` | Recorde — usado para ranking do Top 50. |
| `last_activity_date` | date | — | sim | — | Última atividade contada. |
| `created_at` / `updated_at` | timestamptz | — | não | `now()` | — |

#### `user_badges`
Conquistas permanentes desbloqueadas (visíveis no perfil público).

| Campo | Tipo | Chave | Nulo | Default | Descrição |
|---|---|---|---|---|---|
| `id` | uuid | PK | não | `gen_random_uuid()` | — |
| `user_id` | uuid | FK*→`auth.users.id` | não | — | Dono. |
| `badge_type` | text | — | não | — | Slug da conquista (ex.: `first_app`, `streak_30`). |
| `unlocked_at` | timestamptz | — | não | `now()` | Quando foi obtida (somente `service_role` insere). |

---

### Índices e Constraints — Smart Economy Core

Índices do PostgreSQL (incluindo únicos) para as tabelas do núcleo econômico. Todos são `btree`.

#### `profiles`
| Índice | Tipo | Coluna(s) | Descrição |
|---|---|---|---|
| `profiles_pkey` | UNIQUE | `id` | Chave primária (mesmo UUID de `auth.users.id`). |
| `profiles_referral_code_key` | UNIQUE | `referral_code` | Garante unicidade do código de indicação de 8 chars. |

#### `subscriptions`
| Índice | Tipo | Coluna(s) | Descrição |
|---|---|---|---|
| `subscriptions_pkey` | UNIQUE | `id` | Chave primária da assinatura. |
| `subscriptions_user_id_key` | UNIQUE | `user_id` | Garante 1 assinatura ativa por usuário (usada pelo `FOR UPDATE` na RPC). |

#### `credit_transactions` — ledger
| Índice | Tipo | Coluna(s) | Filtro / Ordem | Descrição |
|---|---|---|---|---|
| `credit_transactions_pkey` | UNIQUE | `id` | — | Chave primária do ledger. |
| `credit_transactions_idem_uniq` | UNIQUE | `user_id`, `idempotency_key` | `WHERE idempotency_key IS NOT NULL` | Impede replay de webhooks (Stripe, Unity, shortlinks). |
| `credit_transactions_user_created_idx` | INDEX | `user_id`, `created_at` | `DESC` | Histórico rápido de transações por usuário (últimas primeiro). |

#### `ad_rewards`
| Índice | Tipo | Coluna(s) | Descrição |
|---|---|---|---|
| `ad_rewards_pkey` | UNIQUE | `id` | Chave primária. |

> Nota: o anti-fraude de limite diário (max 10/dia) é aplicado em Edge Function / client-side; não há constraint de banco nessa tabela além da PK.

#### `shortlinks`
| Índice | Tipo | Coluna(s) | Descrição |
|---|---|---|---|
| `shortlinks_pkey` | UNIQUE | `id` | Chave primária. |
| `shortlinks_slug_key` | UNIQUE | `slug` | Slug público (`/l/:slug`) obrigatoriamente único. |

#### `shortlink_clicks`
| Índice | Tipo | Coluna(s) | Descrição |
|---|---|---|---|
| `shortlink_clicks_pkey` | UNIQUE | `id` | Chave primária da sessão de click. |

> Nota: não há índice composto em `(user_id, shortlink_id)` porque a validação de elegibilidade (único click por usuário/link) é feita em lógica de aplicação + timer `wait_seconds`.

#### `referrals`
| Índice | Tipo | Coluna(s) | Descrição |
|---|---|---|---|
| `referrals_pkey` | UNIQUE | `id` | Chave primária. |
| `referrals_referred_id_key` | UNIQUE | `referred_id` | Um usuário só pode ser indicado uma vez (1:1 com `referred_id`). |

#### `user_streaks`
| Índice | Tipo | Coluna(s) | Descrição |
|---|---|---|---|
| `user_streaks_pkey` | UNIQUE | `id` | Chave primária. |
| `user_streaks_user_id_key` | UNIQUE | `user_id` | Um streak por usuário (usado no leaderboard Top 50). |

#### `user_badges`
| Índice | Tipo | Coluna(s) | Descrição |
|---|---|---|---|
| `user_badges_pkey` | UNIQUE | `id` | Chave primária. |
| `user_badges_user_id_badge_type_key` | UNIQUE | `user_id`, `badge_type` | Impede duplicação da mesma conquista para o mesmo usuário. |

---

### Triggers do Banco — Listagem Completa

Triggers ativos no banco (schemas `public`, `auth` e `storage`), com timing, evento, tabela/colunas afetadas e função executada. Lista extraída de `information_schema.triggers` + `pg_trigger`.

> **Nota sobre contagem:** o catálogo `information_schema.triggers` conta **cada evento separadamente**. O trigger `enforce_bucket_name_length_trigger` em `storage.buckets` aparece em **duas linhas** (`INSERT` e `UPDATE`), o que eleva o total de 14 "trigger names" para **15 linhas no catálogo**. O README lista ambas as linhas para refletir o schema real.

```sql
-- Reproduzir a contagem no banco (retorna 15 linhas — INSERT e UPDATE separados)
SELECT
    trigger_name,
    event_object_table  AS tabela,
    action_timing       AS timing,
    event_manipulation  AS evento,
    action_statement    AS funcao
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth', 'storage')
ORDER BY trigger_schema, trigger_name, event_manipulation;
```

```sql
-- Listagem compacta por trigger e evento
SELECT
    trigger_name,
    event_manipulation  AS evento,
    event_object_table  AS tabela,
    action_timing       AS timing
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth', 'storage')
ORDER BY trigger_name, event_manipulation;
```

```sql
-- Detalhamento por trigger com função chamada (INSERT e UPDATE separados)
SELECT
    trigger_name,
    event_manipulation  AS evento,
    event_object_table  AS tabela,
    action_timing       AS timing,
    action_statement    AS funcao_chamada
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth', 'storage')
ORDER BY trigger_name, event_manipulation;
```

```sql
-- Filtrar triggers por nome ou tabela (INSERT e UPDATE separados)
SELECT
    trigger_name,
    event_manipulation  AS evento,
    event_object_table  AS tabela,
    action_timing       AS timing,
    action_statement    AS funcao_chamada
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth', 'storage')
  AND (
    trigger_name LIKE '%enforce%bucket%'
    OR event_object_table = 'buckets'
    OR trigger_name = 'on_auth_user_created'
  )
ORDER BY trigger_name, event_manipulation;
```

```sql
-- Exemplo 1: filtrar por trigger_name exato (INSERT e UPDATE separados se existirem)
SELECT
    trigger_name,
    event_manipulation  AS evento,
    event_object_table  AS tabela,
    action_timing       AS timing,
    action_statement    AS funcao_chamada
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth', 'storage')
  AND trigger_name = 'enforce_bucket_name_length_trigger'
ORDER BY event_manipulation;
```

```sql
-- Exemplo 2: filtrar por event_object_table (todas as triggers da tabela)
SELECT
    trigger_name,
    event_manipulation  AS evento,
    event_object_table  AS tabela,
    action_timing       AS timing,
    action_statement    AS funcao_chamada
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth', 'storage')
  AND event_object_table = 'buckets'
ORDER BY trigger_name, event_manipulation;
```

```sql
-- Exemplo 3: busca parcial por nome de trigger (LIKE)
SELECT
    trigger_name,
    event_manipulation  AS evento,
    event_object_table  AS tabela,
    action_timing       AS timing,
    action_statement    AS funcao_chamada
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth', 'storage')
  AND trigger_name LIKE '%touch%'
ORDER BY trigger_name, event_manipulation;
```

```sql
-- Exemplo 4: busca case-insensitive por trigger_name (ILIKE)
SELECT
    trigger_name,
    event_manipulation  AS evento,
    event_object_table  AS tabela,
    action_timing       AS timing,
    action_statement    AS funcao_chamada
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth', 'storage')
  AND trigger_name ILIKE '%bucket%'
ORDER BY trigger_name, event_manipulation;
```

```sql
-- Exemplo 5: busca case-insensitive por event_object_table (ILIKE)
SELECT
    trigger_name,
    event_manipulation  AS evento,
    event_object_table  AS tabela,
    action_timing       AS timing,
    action_statement    AS funcao_chamada
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth', 'storage')
  AND event_object_table ILIKE '%object%'
ORDER BY trigger_name, event_manipulation;
```

```sql
-- Exemplo 6: busca combinada case-insensitive (trigger_name OU tabela)
SELECT
    trigger_name,
    event_manipulation  AS evento,
    event_object_table  AS tabela,
    action_timing       AS timing,
    action_statement    AS funcao_chamada
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth', 'storage')
  AND (
    trigger_name ILIKE '%auth%'
    OR event_object_table ILIKE '%user%'
  )
ORDER BY trigger_name, event_manipulation;
```

```sql
-- Exemplo 7: busca case-insensitive com LOWER() no trigger_name
SELECT
    trigger_name,
    event_manipulation  AS evento,
    event_object_table  AS tabela,
    action_timing       AS timing,
    action_statement    AS funcao_chamada
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth', 'storage')
  AND LOWER(trigger_name) LIKE '%bucket%'
ORDER BY trigger_name, event_manipulation;
```

```sql
-- Exemplo 8: busca case-insensitive com LOWER() na tabela
SELECT
    trigger_name,
    event_manipulation  AS evento,
    event_object_table  AS tabela,
    action_timing       AS timing,
    action_statement    AS funcao_chamada
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth', 'storage')
  AND LOWER(event_object_table) LIKE '%object%'
ORDER BY trigger_name, event_manipulation;
```

```sql
-- Exemplo 9: busca combinada case-insensitive com LOWER() (trigger_name OU tabela)
SELECT
    trigger_name,
    event_manipulation  AS evento,
    event_object_table  AS tabela,
    action_timing       AS timing,
    action_statement    AS funcao_chamada
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth', 'storage')
  AND (
    LOWER(trigger_name) LIKE '%auth%'
    OR LOWER(event_object_table) LIKE '%user%'
  )
ORDER BY trigger_name, event_manipulation;
```

```sql
-- Exemplo 10: filtros dinâmicos com LOWER() + LIKE
-- Substitua :trigger_filter e :table_filter pelos termos desejados
-- (use '' para ignorar um dos filtros).
WITH params AS (
  SELECT
    LOWER(:'trigger_filter') AS trigger_filter,
    LOWER(:'table_filter')   AS table_filter
)
SELECT
    trigger_name,
    event_manipulation  AS evento,
    event_object_table  AS tabela,
    action_timing       AS timing,
    action_statement    AS funcao_chamada
FROM information_schema.triggers, params
WHERE trigger_schema IN ('public', 'auth', 'storage')
  AND (
    params.trigger_filter = ''
    OR LOWER(trigger_name) LIKE '%' || params.trigger_filter || '%'
  )
  AND (
    params.table_filter = ''
    OR LOWER(event_object_table) LIKE '%' || params.table_filter || '%'
  )
ORDER BY trigger_name, event_manipulation;
```

Exemplos de execução via `psql`:

```bash
# Filtrar apenas por trigger_name contendo "bucket"
psql -v trigger_filter='bucket' -v table_filter='' -f triggers.sql

# Filtrar apenas por tabela contendo "user"
psql -v trigger_filter='' -v table_filter='user' -f triggers.sql

# Combinar os dois filtros
psql -v trigger_filter='auth' -v table_filter='users' -f triggers.sql
```

### Tabelas de exemplo (DDL compatível com os filtros)

DDL de demonstração para validar os filtros por `trigger_name` e `event_object_table`. Os tipos das chaves e colunas seguem o padrão do `information_schema.triggers` (`trigger_name`, `event_object_table` e `event_object_schema` são `text`/`name`), garantindo compatibilidade direta com `LOWER()` + `LIKE`.

```sql
-- 1) Tabela de objetos monitorados (ex.: "buckets", "users", "objects")
CREATE TABLE public.example_objects (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_name   text NOT NULL,                 -- compatível com event_object_schema
    object_name   text NOT NULL,                 -- compatível com event_object_table
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (schema_name, object_name)
);

-- 2) Tabela de triggers cadastrados (espelha trigger_name/timing/evento)
CREATE TABLE public.example_triggers (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_name        text NOT NULL UNIQUE,    -- compatível com trigger_name
    object_id           uuid NOT NULL REFERENCES public.example_objects(id) ON DELETE CASCADE,
    action_timing       text NOT NULL CHECK (action_timing IN ('BEFORE','AFTER','INSTEAD OF')),
    event_manipulation  text NOT NULL CHECK (event_manipulation IN ('INSERT','UPDATE','DELETE','TRUNCATE')),
    action_statement    text NOT NULL,           -- ex.: 'EXECUTE FUNCTION public.touch_updated_at()'
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- 3) Tabela de eventos disparados (log de execuções)
CREATE TABLE public.example_trigger_events (
    id            bigserial PRIMARY KEY,
    trigger_id    uuid NOT NULL REFERENCES public.example_triggers(id) ON DELETE CASCADE,
    fired_event   text NOT NULL CHECK (fired_event IN ('INSERT','UPDATE','DELETE','TRUNCATE')),
    row_pk        text,                          -- PK do registro afetado (genérico)
    payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
    fired_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices úteis para os filtros LOWER() + LIKE
CREATE INDEX idx_example_objects_lower_name    ON public.example_objects   (LOWER(object_name));
CREATE INDEX idx_example_triggers_lower_name   ON public.example_triggers  (LOWER(trigger_name));
CREATE INDEX idx_example_trigger_events_event  ON public.example_trigger_events (fired_event);
```

Seed mínimo para testar os exemplos anteriores:

```sql
INSERT INTO public.example_objects (schema_name, object_name) VALUES
    ('storage', 'buckets'),
    ('storage', 'objects'),
    ('auth',    'users');

INSERT INTO public.example_triggers (trigger_name, object_id, action_timing, event_manipulation, action_statement)
SELECT 'enforce_bucket_name_length_trigger', id, 'BEFORE', 'INSERT',
       'EXECUTE FUNCTION storage.enforce_bucket_name_length()'
FROM public.example_objects WHERE schema_name='storage' AND object_name='buckets';

INSERT INTO public.example_triggers (trigger_name, object_id, action_timing, event_manipulation, action_statement)
SELECT 'enforce_bucket_name_length_trigger', id, 'BEFORE', 'UPDATE',
       'EXECUTE FUNCTION storage.enforce_bucket_name_length()'
FROM public.example_objects WHERE schema_name='storage' AND object_name='buckets';

INSERT INTO public.example_triggers (trigger_name, object_id, action_timing, event_manipulation, action_statement)
SELECT 'on_auth_user_created', id, 'AFTER', 'INSERT',
       'EXECUTE FUNCTION public.handle_new_user()'
```

#### Passo a passo para rodar o DDL e o seed (psql)

1. **Salve o DDL em um arquivo** (`example_tables.sql`):

```sql
-- example_tables.sql
-- Execute este bloco uma única vez para criar as tabelas de exemplo
\echo '>>> Criando tabelas de exemplo...'
\i ddl_example_tables.sql
\echo '>>> Inserindo seed de demonstração...'
\i seed_example_tables.sql
\echo '>>> Pronto. Agora você pode rodar as queries com :trigger_filter e :table_filter.'
```

2. **Salve apenas o DDL** (`ddl_example_tables.sql`) com o bloco de `CREATE TABLE` e `CREATE INDEX` mostrado acima.

3. **Salve apenas o seed** (`seed_example_tables.sql`) com os `INSERT INTO public.example_objects ...` e `INSERT INTO public.example_triggers ...` mostrados acima.

4. **Execute via psql** (ajuste a connection string conforme seu ambiente):

```bash
# Usando variáveis de ambiente do Supabase (recomendado)
psql "$DATABASE_URL" -f example_tables.sql

# Ou com parâmetros explícitos
psql -h localhost -U postgres -d kubo_vibe_dev -f example_tables.sql
```

5. **Verifique se as tabelas foram criadas e populadas**:

```sql
\dt public.example_*
SELECT * FROM public.example_objects;
SELECT * FROM public.example_triggers;
```

6. **Agora rode as queries parametrizadas** do Exemplo 10 (ou a query equivalente nas tabelas de exemplo abaixo):

```bash
# Sem filtro (retorna tudo)
psql -v trigger_filter='' -v table_filter='' -f triggers.sql

# Filtrar por nome do trigger
psql -v trigger_filter='bucket' -v table_filter='' -f triggers.sql

# Filtrar por nome da tabela
psql -v trigger_filter='' -v table_filter='user' -f triggers.sql

# Combinar ambos os filtros
psql -v trigger_filter='auth' -v table_filter='users' -f triggers.sql
```

> **Nota**: os arquivos `.sql` devem estar no mesmo diretório de onde você executa o `psql`, ou use caminhos absolutos (ex.: `/path/to/triggers.sql`).

Query equivalente ao Exemplo 10, agora aplicada às tabelas de exemplo:

```sql
WITH params AS (
  SELECT
    LOWER(:'trigger_filter') AS trigger_filter,
    LOWER(:'table_filter')   AS table_filter
)
SELECT
    t.trigger_name,
    t.event_manipulation AS evento,
    o.object_name        AS tabela,
    t.action_timing      AS timing,
    t.action_statement   AS funcao_chamada
FROM public.example_triggers t
JOIN public.example_objects  o ON o.id = t.object_id
CROSS JOIN params
WHERE (params.trigger_filter = '' OR LOWER(t.trigger_name) LIKE '%' || params.trigger_filter || '%')
  AND (params.table_filter   = '' OR LOWER(o.object_name)  LIKE '%' || params.table_filter   || '%')
ORDER BY t.trigger_name, t.event_manipulation;
```

#### Rollback (dropar tabelas de exemplo)

Salve o comando abaixo em `rollback_example_tables.sql` e execute com `psql` para remover as tabelas de exemplo em ordem correta (respeitando as chaves estrangeiras):

```sql
-- rollback_example_tables.sql
DROP TABLE IF EXISTS public.example_trigger_events CASCADE;
DROP TABLE IF EXISTS public.example_triggers      CASCADE;
DROP TABLE IF EXISTS public.example_objects       CASCADE;
```

```bash
psql "$DATABASE_URL" -f rollback_example_tables.sql
```

> **Ordem obrigatória**: `example_trigger_events` → `example_triggers` → `example_objects`. A tabela de eventos depende de `example_triggers`, que por sua vez depende de `example_objects`.

#### Verificar remoção após rollback

Após executar o rollback, confirme que as tabelas de exemplo não existem mais no banco:

```bash
psql "$DATABASE_URL" -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('example_objects', 'example_triggers', 'example_trigger_events');
"
```

**Resultado esperado** (sem linhas retornadas):

```
 table_name 
------------
(0 rows)
```

Ou, de forma mais direta, via `psql` interativo:

```sql
\dt public.example_*      -- deve exibir "Did not find any relations."
SELECT count(*) FROM public.example_objects;        -- deve falhar: relation does not exist
```

> Se a query retornar `(0 rows)` e `\dt` não listar as tabelas, o rollback foi executado com sucesso.

#### Verificar dependências residuais no catálogo

Confirme que não restaram chaves estrangeiras, views, triggers ou sequências ligadas às tabelas removidas:

```bash
psql "$DATABASE_URL" -c "
SELECT conname AS constraint_name,
       conrelid::regclass AS source_table,
       confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE contype = 'f'
  AND confrelid::regclass::text IN (
    'public.example_objects',
    'public.example_triggers',
    'public.example_trigger_events'
  );
"
```

**Resultado esperado:**

```
 constraint_name | source_table | referenced_table
-----------------+--------------+------------------
(0 rows)
```

Verifique também views, materialized views e sequências órfãs:

```bash
psql "$DATABASE_URL" -c "
SELECT dependent.relname AS dependent_object,
       dependent.relkind AS tipo,
       referenced.relname AS referenced_table
FROM pg_depend d
JOIN pg_class dependent   ON d.objid = dependent.oid
JOIN pg_class referenced  ON d.refobjid = referenced.oid
WHERE referenced.relname IN (
    'example_objects',
    'example_triggers',
    'example_trigger_events'
  )
  AND dependent.relkind IN ('v', 'm', 'S');
"
```

**Tipos (`relkind`):**
- `v` = view
- `m` = materialized view
- `S` = sequence

**Resultado esperado:**

```
 dependent_object | tipo | referenced_table
------------------+------+------------------
(0 rows)
```

> Se ambas as queries retornarem `(0 rows)`, não há dependências residuais no catálogo do PostgreSQL.

#### Verificar triggers, funções e rotinas residuais

Confirme que não restaram triggers, funções, procedures ou rotinas que façam referência direta às tabelas de exemplo removidas:

```bash
psql "$DATABASE_URL" -c "
SELECT tgname AS trigger_name,
       tgrelid::regclass AS target_table,
       proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid::regclass::text IN (
    'public.example_objects',
    'public.example_triggers',
    'public.example_trigger_events'
  )
  AND NOT tgisinternal;
"
```

**Resultado esperado:**

```
 trigger_name | target_table | function_name
--------------+--------------+---------------
(0 rows)
```

Verifique também se existem funções ou procedures com corpo SQL que referenciem as tabelas removidas (busca no texto-fonte):

```bash
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema_name,
       p.proname AS routine_name,
       CASE p.prokind
         WHEN 'f' THEN 'function'
         WHEN 'p' THEN 'procedure'
         WHEN 'a' THEN 'aggregate'
         WHEN 'w' THEN 'window'
       END AS routine_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosrc ILIKE '%example_objects%'
   OR p.prosrc ILIKE '%example_triggers%'
   OR p.prosrc ILIKE '%example_trigger_events%';
"
```

**Resultado esperado:**

```
 schema_name | routine_name | routine_type
-------------+--------------+--------------
(0 rows)
```

> **Nota**: `prosrc` contém o corpo textual da rotina (para funções em SQL/plpgsql). Se a query retornar `(0 rows)`, não há rotinas no schema `public` que referenciem as tabelas de exemplo.

#### Verificar objetos dependentes por schema (defaults, constraints, policies)

Após o rollback, valide em **cada schema** que não restaram objetos dependentes ligados às tabelas de exemplo — incluindo `DEFAULT`s, `CHECK`/`UNIQUE`/`PK`/`FK` constraints e RLS policies. Essas consultas varrem todo o catálogo (não apenas `public`) para detectar referências residuais em qualquer schema.

**1. Defaults de colunas que referenciem as tabelas de exemplo:**

```bash
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       a.attname AS column_name,
       pg_get_expr(ad.adbin, ad.adrelid) AS default_expr
FROM pg_attrdef ad
JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
JOIN pg_class c ON c.oid = ad.adrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE pg_get_expr(ad.adbin, ad.adrelid) ILIKE '%example_objects%'
   OR pg_get_expr(ad.adbin, ad.adrelid) ILIKE '%example_triggers%'
   OR pg_get_expr(ad.adbin, ad.adrelid) ILIKE '%example_trigger_events%';
"
```

**Resultado esperado:**

```
 schema_name | table_name | column_name | default_expr
-------------+------------+-------------+--------------
(0 rows)
```

**2. Constraints (CHECK, UNIQUE, PK, FK, EXCLUDE) que referenciem as tabelas em qualquer schema:**

```bash
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       con.conname AS constraint_name,
       CASE con.contype
         WHEN 'c' THEN 'CHECK'
         WHEN 'f' THEN 'FOREIGN KEY'
         WHEN 'p' THEN 'PRIMARY KEY'
         WHEN 'u' THEN 'UNIQUE'
         WHEN 'x' THEN 'EXCLUDE'
       END AS constraint_type,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE pg_get_constraintdef(con.oid) ILIKE '%example_objects%'
   OR pg_get_constraintdef(con.oid) ILIKE '%example_triggers%'
   OR pg_get_constraintdef(con.oid) ILIKE '%example_trigger_events%';
"
```

**Resultado esperado:**

```
 schema_name | table_name | constraint_name | constraint_type | definition
-------------+------------+-----------------+-----------------+------------
(0 rows)
```

**3. RLS policies que referenciem as tabelas em qualquer schema:**

```bash
psql "$DATABASE_URL" -c "
SELECT schemaname,
       tablename,
       policyname,
       cmd,
       qual,
       with_check
FROM pg_policies
WHERE COALESCE(qual, '') ILIKE '%example_objects%'
   OR COALESCE(qual, '') ILIKE '%example_triggers%'
   OR COALESCE(qual, '') ILIKE '%example_trigger_events%'
   OR COALESCE(with_check, '') ILIKE '%example_objects%'
   OR COALESCE(with_check, '') ILIKE '%example_triggers%'
   OR COALESCE(with_check, '') ILIKE '%example_trigger_events%'
   OR tablename IN ('example_objects', 'example_triggers', 'example_trigger_events');
"
```

**Resultado esperado:**

```
 schemaname | tablename | policyname | cmd | qual | with_check
------------+-----------+------------+-----+------+------------
(0 rows)
```

> Se as três consultas retornarem `(0 rows)`, não existem defaults, constraints ou policies residuais — em nenhum schema — ligados às tabelas de exemplo. Combinadas com as verificações anteriores (FKs, views/sequências, triggers e rotinas), confirmam um rollback completo e sem dependências órfãs no catálogo do PostgreSQL.

#### Varredura global via `pg_depend` + `pg_class` (todos os schemas)

Como verificação final, faça uma varredura **catálogo-wide** cruzando `pg_depend` com `pg_class` para detectar **qualquer** objeto (em qualquer schema) que ainda dependa das tabelas de exemplo. Esta consulta cobre tudo o que o PostgreSQL registra como dependência: views, materialized views, sequências, índices, constraints, defaults, triggers, regras, tipos compostos, funções, extensões, etc.

**1. Dependências ativas via `pg_depend` (somente executa caso as tabelas ainda existam — após o rollback o CTE fica vazio e retorna `(0 rows)`):**

```bash
psql "$DATABASE_URL" -c "
WITH targets AS (
  SELECT c.oid AS refobjid,
         n.nspname AS ref_schema,
         c.relname AS ref_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname IN ('example_objects', 'example_triggers', 'example_trigger_events')
)
SELECT t.ref_schema,
       t.ref_table         AS referenced_table,
       dn.nspname          AS dependent_schema,
       dc.relname          AS dependent_object,
       dc.relkind          AS dependent_kind,
       d.deptype           AS dependency_type,
       d.classid::regclass AS catalog
FROM pg_depend d
JOIN targets t       ON d.refobjid = t.refobjid
JOIN pg_class dc     ON dc.oid = d.objid
JOIN pg_namespace dn ON dn.oid = dc.relnamespace
WHERE d.deptype IN ('n', 'a', 'i', 'e', 'p')
ORDER BY dn.nspname, dc.relname;
"
```

**Tipos de dependência (`deptype`):**
- `n` = normal — objeto independente que referencia outro
- `a` = auto — removido automaticamente com o referenciado
- `i` = internal — parte da implementação interna
- `e` = extension — pertence a uma extensão
- `p` = pin — objeto fixo do sistema

**Tipos de objeto (`relkind`):**
- `r` = tabela ordinária, `v` = view, `m` = materialized view, `i` = índice, `S` = sequência, `t` = TOAST, `c` = tipo composto, `f` = foreign table, `p` = tabela particionada

**Resultado esperado:**

```
 ref_schema | referenced_table | dependent_schema | dependent_object | dependent_kind | dependency_type | catalog
------------+------------------+------------------+------------------+----------------+-----------------+---------
(0 rows)
```

**2. Varredura por nome em `pg_class` cruzada com `pg_namespace` (detecta qualquer relação remanescente em qualquer schema cujo nome derive das tabelas de exemplo — incluindo índices, sequências e tipos compostos órfãos):**

```bash
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       CASE c.relkind
         WHEN 'r' THEN 'table'
         WHEN 'v' THEN 'view'
         WHEN 'm' THEN 'materialized view'
         WHEN 'i' THEN 'index'
         WHEN 'S' THEN 'sequence'
         WHEN 'c' THEN 'composite type'
         WHEN 'f' THEN 'foreign table'
         WHEN 'p' THEN 'partitioned table'
         ELSE c.relkind::text
       END AS object_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname ILIKE '%example_objects%'
   OR c.relname ILIKE '%example_triggers%'
   OR c.relname ILIKE '%example_trigger_events%'
ORDER BY n.nspname, c.relname;
"
```

**Resultado esperado:**

```
 schema_name | object_name | object_type
-------------+-------------+-------------
(0 rows)
```

> Se ambas as queries retornarem `(0 rows)`, a varredura via `pg_depend`/`pg_class` confirma que **nenhum objeto em nenhum schema** mantém dependência ou nome derivado das tabelas de exemplo. Esta é a verificação mais abrangente e fecha o ciclo de validação do rollback no catálogo do PostgreSQL.

#### Verificação dedicada de tabelas e views via `pg_class` por `relkind` (todos os schemas)

Além da varredura por nome, execute uma consulta **direta no catálogo** filtrando por `relkind` para garantir que não restaram tabelas (`r`), views (`v`) ou materialized views (`m`) remanescentes das amostras em **qualquer schema** — incluindo schemas de sistema, extensões e schemas criados dinamicamente. Esta query detecta objetos mesmo que tenham sido renomeados ou movidos entre schemas, desde que ainda existam no catálogo.

**Consulta filtrando exclusivamente tabelas (`r`) e views (`v`):**

```bash
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       CASE c.relkind
         WHEN 'r' THEN 'table'
         WHEN 'v' THEN 'view'
       END AS object_type,
       pg_get_userbyid(c.relowner) AS owner,
       obj_description(c.oid, 'pg_class') AS description
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'v')
  AND (
    c.relname ILIKE '%example_objects%'
    OR c.relname ILIKE '%example_triggers%'
    OR c.relname ILIKE '%example_trigger_events%'
  )
ORDER BY n.nspname, c.relname;
"
```

**Resultado esperado:**

```
 schema_name | object_name | object_type | owner | description
-------------+-------------+-------------+-------+-------------
(0 rows)
```

> Se esta consulta retornar `(0 rows)`, confirma que **nenhuma tabela ou view** derivada das amostras permanece em nenhum schema do PostgreSQL após o rollback.

---

**Consulta adicional — materialized views (`m`):**

```bash
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       'materialized view' AS object_type,
       pg_get_userbyid(c.relowner) AS owner,
       obj_description(c.oid, 'pg_class') AS description
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'm'
  AND (
    c.relname ILIKE '%example_objects%'
    OR c.relname ILIKE '%example_triggers%'
    OR c.relname ILIKE '%example_trigger_events%'
  )
ORDER BY n.nspname, c.relname;
"
```

**Resultado esperado:**

```
 schema_name | object_name | object_type | owner | description
-------------+-------------+-------------+-------+-------------
(0 rows)
```

> Se esta consulta retornar `(0 rows)`, confirma que **nenhuma materialized view** derivada das amostras permanece em nenhum schema.

---

**Consulta adicional — sequências (`S`):**

```bash
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       'sequence' AS object_type,
       pg_get_userbyid(c.relowner) AS owner,
       obj_description(c.oid, 'pg_class') AS description
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'S'
  AND (
    c.relname ILIKE '%example_objects%'
    OR c.relname ILIKE '%example_triggers%'
    OR c.relname ILIKE '%example_trigger_events%'
  )
ORDER BY n.nspname, c.relname;
"
```

**Resultado esperado:**

```
 schema_name | object_name | object_type | owner | description
-------------+-------------+-------------+-------+-------------
(0 rows)
```

> Se esta consulta retornar `(0 rows)`, confirma que **nenhuma sequência** derivada das amostras permanece em nenhum schema.

---

**Consulta adicional — funções (`pg_proc`):**

```bash
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (
    p.proname ILIKE '%example_objects%'
    OR p.proname ILIKE '%example_triggers%'
    OR p.proname ILIKE '%example_trigger_events%'
  )
ORDER BY n.nspname, p.proname;
"
```

**Resultado esperado:**

```
 schema_name | function_name | arguments | owner
-------------+---------------+-----------+-------
(0 rows)
```

> Se esta consulta retornar `(0 rows)`, confirma que **nenhuma função** derivada das amostras permanece em nenhum schema.

---

**Consulta adicional — triggers (`pg_trigger`):**

```bash
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       t.tgname AS trigger_name,
       CASE t.tgtype::integer & 66
         WHEN 2 THEN 'BEFORE'
         WHEN 64 THEN 'INSTEAD OF'
         ELSE 'AFTER'
       END AS timing,
       CASE t.tgtype::integer & 28
         WHEN 4 THEN 'INSERT'
         WHEN 8 THEN 'DELETE'
         WHEN 16 THEN 'UPDATE'
         WHEN 20 THEN 'INSERT OR UPDATE'
         WHEN 24 THEN 'UPDATE OR DELETE'
         WHEN 28 THEN 'INSERT OR UPDATE OR DELETE'
         ELSE 'UNKNOWN'
       END AS event,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND (
    t.tgname ILIKE '%example_objects%'
    OR t.tgname ILIKE '%example_triggers%'
    OR t.tgname ILIKE '%example_trigger_events%'
    OR c.relname ILIKE '%example_objects%'
    OR c.relname ILIKE '%example_triggers%'
    OR c.relname ILIKE '%example_trigger_events%'
  )
ORDER BY n.nspname, c.relname, t.tgname;
"
```

**Resultado esperado:**

```
 schema_name | table_name | trigger_name | timing | event | owner
-------------+------------+--------------+--------+-------+-------
(0 rows)
```

> Se esta consulta retornar `(0 rows)`, confirma que **nenhum trigger** derivado das amostras permanece em nenhum schema.

---

**Consulta adicional — constraints (`pg_constraint`):**

```bash
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       con.conname AS constraint_name,
       CASE con.contype
         WHEN 'c' THEN 'CHECK'
         WHEN 'f' THEN 'FOREIGN KEY'
         WHEN 'p' THEN 'PRIMARY KEY'
         WHEN 'u' THEN 'UNIQUE'
         WHEN 't' THEN 'TRIGGER'
         WHEN 'x' THEN 'EXCLUSION'
         ELSE con.contype::text
       END AS constraint_type,
       pg_get_constraintdef(con.oid, true) AS definition,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE (
    con.conname ILIKE '%example_objects%'
    OR con.conname ILIKE '%example_triggers%'
    OR con.conname ILIKE '%example_trigger_events%'
    OR c.relname ILIKE '%example_objects%'
    OR c.relname ILIKE '%example_triggers%'
    OR c.relname ILIKE '%example_trigger_events%'
  )
ORDER BY n.nspname, c.relname, con.conname;
"
```

**Resultado esperado:**

```
 schema_name | table_name | constraint_name | constraint_type | definition | owner
-------------+------------+-----------------+-----------------+------------+-------
(0 rows)
```

> Se esta consulta retornar `(0 rows)`, confirma que **nenhuma constraint** derivada das amostras permanece em nenhum schema.

---

**Consulta adicional — views (`relkind = 'v'`):**

```bash
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       'view' AS object_type,
       pg_get_userbyid(c.relowner) AS owner,
       obj_description(c.oid, 'pg_class') AS description
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND (
    c.relname ILIKE '%example_objects%'
    OR c.relname ILIKE '%example_triggers%'
    OR c.relname ILIKE '%example_trigger_events%'
  )
ORDER BY n.nspname, c.relname;
"
```

**Resultado esperado:**

```
 schema_name | object_name | object_type | owner | description
-------------+-------------+-------------+-------+-------------
(0 rows)
```

> Se esta consulta retornar `(0 rows)`, confirma que **nenhuma view** derivada das amostras permanece em nenhum schema.

---

**Consulta adicional — índices (`relkind = 'i'`):**

```bash
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       'index' AS object_type,
       pg_get_userbyid(c.relowner) AS owner,
       obj_description(c.oid, 'pg_class') AS description
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'i'
  AND (
    c.relname ILIKE '%example_objects%'
    OR c.relname ILIKE '%example_triggers%'
    OR c.relname ILIKE '%example_trigger_events%'
  )
ORDER BY n.nspname, c.relname;
"
```

**Resultado esperado:**

```
 schema_name | object_name | object_type | owner | description
-------------+-------------+-------------+-------+-------------
(0 rows)
```

> Se esta consulta retornar `(0 rows)`, confirma que **nenhum índice** derivado das amostras permanece em nenhum schema.

---

**Consulta adicional — schemas (`pg_namespace`):**

```bash
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema_name,
       pg_get_userbyid(n.nspowner) AS owner,
       obj_description(n.oid, 'pg_namespace') AS description
FROM pg_namespace n
WHERE n.nspname ILIKE '%example_objects%'
   OR n.nspname ILIKE '%example_triggers%'
   OR n.nspname ILIKE '%example_trigger_events%'
ORDER BY n.nspname;
"
```

**Resultado esperado:**

```
 schema_name | owner | description
-------------+-------+-------------
(0 rows)
```

> Se esta consulta retornar `(0 rows)`, confirma que **nenhum schema** derivado das amostras permanece no catálogo. As verificações de `relkind` (tabelas `r`, views `v`, materialized views `m`, sequências `S`, índices `i`) somadas às checagens em `pg_proc`, `pg_trigger`, `pg_constraint` e `pg_namespace` garantem rollback completo no catálogo do PostgreSQL.

---

**Padrão das consultas (rollback):** todas as verificações acima seguem o mesmo formato — `psql "$DATABASE_URL" -c "..."`, projeção iniciada por `schema_name`, filtro `ILIKE` com os três padrões (`%example_objects%`, `%example_triggers%`, `%example_trigger_events%`), `ORDER BY n.nspname, <object>` e resultado esperado `(0 rows)`. Mantenha esse padrão ao adicionar novas checagens de rollback.



























|---|---|---|---|---|---|
| `on_auth_user_created` | `auth.users` | `AFTER` | `INSERT` | `public.handle_new_user()` (SECURITY DEFINER) | **Insere em `public.profiles`** (`id`, `display_name`, `referral_code`). Se houver `referral_code` em `raw_user_meta_data`: **insere em `public.referrals`** (`referrer_id`, `referred_id`, `credits_awarded=100`) e **atualiza `public.subscriptions.edits_limit`** (`+100`) do referrer. Dispara `net.http_post` → Edge Function `send-transactional-email`. |

> `profiles.referral_code` e `profiles.display_name` **não têm `DEFAULT` na DDL** — este trigger é a única fonte desses valores.

#### Schema `public` — `touch_updated_at()` (`BEFORE UPDATE`)

Trigger genérico que executa `NEW.updated_at = now(); RETURN NEW;`. Garante timestamp transacional independentemente do cliente.

| Trigger | Tabela | Timing | Evento | Coluna afetada |
|---|---|---|---|---|
| `api_credentials_touch` | `public.api_credentials` | `BEFORE` | `UPDATE` | `updated_at` |
| `trg_audit_shares_updated` | `public.audit_shares` | `BEFORE` | `UPDATE` | `updated_at` |
| `gmail_accounts_touch` | `public.gmail_accounts` | `BEFORE` | `UPDATE` | `updated_at` |
| `trg_npc_memories_updated_at` | `public.npc_memories` | `BEFORE` | `UPDATE` | `updated_at` |
| `render_policies_touch` | `public.render_auto_heal_policies` | `BEFORE` | `UPDATE` | `updated_at` |
| `render_connections_touch` | `public.render_connections` | `BEFORE` | `UPDATE` | `updated_at` |
| `trg_slide_decks_updated` | `public.slide_decks` | `BEFORE` | `UPDATE` | `updated_at` |
| `trg_slide_pages_updated` | `public.slide_pages` | `BEFORE` | `UPDATE` | `updated_at` |
| `web3_connections_touch_updated_at` | `public.web3_connections` | `BEFORE` | `UPDATE` | `updated_at` |

#### Schema `storage` (gerenciado pelo Supabase)

| Trigger | Tabela | Timing | Evento | Função | Efeito |
|---|---|---|---|---|---|
| `enforce_bucket_name_length_trigger` | `storage.buckets` | `BEFORE` | `INSERT` | `storage.enforce_bucket_name_length()` | Valida tamanho do nome do bucket antes de inserir. |
| `enforce_bucket_name_length_trigger` | `storage.buckets` | `BEFORE` | `UPDATE` | `storage.enforce_bucket_name_length()` | Valida tamanho do nome do bucket antes de atualizar. |
| `protect_buckets_delete` | `storage.buckets` | `BEFORE` | `DELETE` | `storage.protect_delete()` | Bloqueia deleção indevida de buckets do sistema. |
| `protect_objects_delete` | `storage.objects` | `BEFORE` | `DELETE` | `storage.protect_delete()` | Bloqueia deleção indevida de objetos protegidos. |
| `update_objects_updated_at` | `storage.objects` | `BEFORE` | `UPDATE` | `storage.update_updated_at_column()` | Atualiza `updated_at` da row de objeto. |

#### Resumo por timing/evento

- **`AFTER INSERT`**: 1 trigger (`on_auth_user_created`) — orquestra criação de perfil/referral/email.
- **`BEFORE UPDATE`**: 11 triggers — 9 de `touch_updated_at` (public) + 1 de `enforce_bucket_name_length` (storage.buckets) + 1 de `update_objects_updated_at` (storage.objects).
- **`BEFORE INSERT`**: 1 trigger (`enforce_bucket_name_length_trigger` em `storage.buckets`).
- **`BEFORE DELETE`**: 2 triggers (`protect_buckets_delete`, `protect_objects_delete`).

**Total: 15 linhas no catálogo** (`information_schema.triggers`) — `enforce_bucket_name_length_trigger` conta como 2 linhas (INSERT + UPDATE) porque o catálogo indexa por `(trigger_name, event_manipulation)`.

> Schemas `auth` e `storage` são reservados pelo Supabase — não modificar diretamente. A única dependência aplicacional é `on_auth_user_created`, que invoca código no schema `public`.

---

### Funções Executadas pelas Triggers — Detalhamento

Detalhe de cada função SQL/PLpgSQL invocada pelas triggers acima: assinatura, retorno, efeitos no banco e tratamento de erro.

#### `public.handle_new_user() RETURNS trigger`

- **Trigger que invoca:** `on_auth_user_created` (AFTER INSERT em `auth.users`).
- **Segurança:** `SECURITY DEFINER`, `search_path = public`.
- **Retorno:** `NEW` (row inserida em `auth.users`, inalterada — é AFTER, então não modifica o registro original).
- **Modifica:**
  1. `INSERT INTO public.profiles (id, display_name, referral_code)` — sempre, para todo novo usuário.
     - `id ← NEW.id`
     - `display_name ← COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)`
     - `referral_code ← substr(NEW.id::text, 1, 8)`
  2. Se `NEW.raw_user_meta_data->>'referral_code'` existir e bater com um `profiles.referral_code` de outro usuário:
     - `INSERT INTO public.referrals (referrer_id, referred_id, credits_awarded=100)`
     - `UPDATE public.subscriptions SET edits_limit = edits_limit + 100, updated_at = now() WHERE user_id = referrer AND is_active = true`
     - `PERFORM net.http_post(...)` → Edge Function `send-transactional-email` com template `referral-notification` e `idempotencyKey = 'referral-<referrer>-<referred>'`.
- **Tratamento de erro:** o bloco de notificação por email está envolvido em `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING` — falha de email **não aborta** o signup. Falhas de `INSERT` em `profiles`/`referrals` **propagam** e abortam a transação.

#### `public.touch_updated_at() RETURNS trigger`

- **Triggers que invocam (9):** `api_credentials_touch`, `trg_audit_shares_updated`, `gmail_accounts_touch`, `trg_npc_memories_updated_at`, `render_policies_touch`, `render_connections_touch`, `trg_slide_decks_updated`, `trg_slide_pages_updated`, `web3_connections_touch_updated_at`.
- **Segurança:** sem `SECURITY DEFINER` (executa como o usuário do `UPDATE`).
- **Retorno:** `NEW` com `updated_at` reescrito para `now()`.
- **Modifica:** apenas `NEW.updated_at` (em memória, antes do `UPDATE` ser persistido — `BEFORE UPDATE`). Não toca nenhuma outra tabela.
- **Corpo:** `BEGIN NEW.updated_at = now(); RETURN NEW; END;`
- **Efeito prático:** garante que o timestamp seja sempre o da transação, mesmo se o cliente enviar `updated_at` explicitamente ou omitir o campo.

#### `storage.enforce_bucket_name_length()` *(gerenciada pelo Supabase)*

- **Triggers que invocam:** `enforce_bucket_name_length_trigger` (BEFORE INSERT **e** BEFORE UPDATE em `storage.buckets`).
- **Retorno:** `NEW` se o nome do bucket respeitar os limites de tamanho; caso contrário, `RAISE EXCEPTION` aborta a operação.
- **Modifica:** nada — função puramente validadora.

#### `storage.protect_delete()` *(gerenciada pelo Supabase)*

- **Triggers que invocam:** `protect_buckets_delete` (BEFORE DELETE em `storage.buckets`) e `protect_objects_delete` (BEFORE DELETE em `storage.objects`).
- **Retorno:** `OLD` se a deleção for permitida; `RAISE EXCEPTION` para buckets/objetos protegidos do sistema.
- **Modifica:** nada — gate de proteção contra DELETE acidental em recursos internos do Storage.

#### `storage.update_updated_at_column()` *(gerenciada pelo Supabase)*

- **Trigger que invoca:** `update_objects_updated_at` (BEFORE UPDATE em `storage.objects`).
- **Retorno:** `NEW` com `updated_at = now()`.
- **Modifica:** apenas `NEW.updated_at` da row em `storage.objects` — análogo ao `touch_updated_at()` do schema `public`.

> **Observação:** funções do schema `storage` são propriedade do Supabase e podem ser alteradas em upgrades da plataforma; o projeto **não as redefine** nem depende do corpo exato — apenas do contrato (validação de nome, proteção de delete e sincronização de `updated_at`).

---





```sql
execute_atomic_credit_deduction(
  _user_id         uuid,
  _amount          integer,         -- > 0 (consumo)
  _reason          text,
  _category        text  default 'general',
  _metadata        jsonb default '{}',
  _idempotency_key text  default null
) returns jsonb -- { success, replayed, transaction_id, balance_after }
```

Erros possíveis: `amount_must_be_positive` · `subscription_not_found` · `insufficient_credits`.

---




## Arquitetura Técnica



### Frontend
- **React 18** + **Vite 5**
- **TypeScript 5** (strict)
- **Tailwind CSS v3** com design tokens semânticos
- **shadcn/ui** componentes customizados
- **Framer Motion** para transições suaves (<300ms)
- Identidade visual: *Premium Dark UI* — dark metallic, glassmorphism, gold (`#C9941A`) accents
- Tipografia: Orbitron (headings), Inter (body)

### Backend (Lovable Cloud)
- **Supabase** PostgreSQL com RLS (Row Level Security)
- **Edge Functions** para lógica serverless
- **Realtime CDC** para streaming de eventos via WebSocket
- Autenticação: Supabase Auth + GitHub OAuth + Google OAuth

### Quantum Game Engine (`/src/game`)
Módulo de game engine avançado com:

| Componente | Descrição |
|------------|-----------|
| `ecs.ts` | Entity-Component-System core — determinístico, allocation-light |
| `wgsl-safe.ts` | Sanitizador WGSL com edge function `wgsl-sanitizer` — bloqueia DoS, loops infinitos, buffer overflow |
| `procedural.ts` | Geração procedural de mundos infinitos |
| `renderer.ts` | Renderizador WebGPU/Three.js com pipeline otimizado |
| `actions.ts` | Sistema de ações e gameplay |

**Segurança WebGPU:** Todo shader proveniente de input de usuário ou IA passa obrigatoriamente pelo `wgsl-sanitizer` antes de tocar `device.createShaderModule()`. O edge function bloqueia padrões perigosos (loops infinitos, workgroups excessivos, arrays >64KB, recursão).

---

## Variáveis de Ambiente (Setup Local)

Dois templates ficam versionados no repo — copie e preencha com valores reais (os arquivos `.env` finais não são commitados):

| Template | Para que serve | Copiar como |
|----------|----------------|-------------|
| [`.env.example`](.env.example) | Frontend (Vite). Apenas `VITE_*` + URLs/keys publicáveis. **Não** colocar secrets aqui — são bundleados no navegador. | `.env` |
| [`supabase/functions/.env.example`](supabase/functions/.env.example) | Edge Functions. Documenta **todos** os secrets server-side: Stripe, GitHub, Gmail, Pinata, OpenRouter, DeepSeek, Kimi, Groq, Polar, IONOS, RPC Web3, etc. | `supabase/functions/.env` (apenas para `supabase functions serve` local) |
| [`.github/rerun-concurrency.local.env.example`](.github/rerun-concurrency.local.env.example) | Específico do teste de idempotência `bun run preflight:rerun`. | `.env.rerun-ci` |
| [`.github/rerun-concurrency.secrets.example`](.github/rerun-concurrency.secrets.example) | Template para colar em GitHub Secrets do workflow CI. | (não copiar — usar como referência) |

### Setup com um comando

```bash
# 1. Copia ambos os templates (.env e supabase/functions/.env)
bun run setup:env

# 2. Pré-visualiza o que seria feito, sem escrever nada
bun run setup:env:dry

# 3. Sobrescreve arquivos existentes
bun run setup:env:force

# 4. Valida se .env e supabase/functions/.env têm todas as vars obrigatórias
#    e não contêm valores-placeholder (sai com código 3 se inválido)
bun run setup:env:check

# 5. Copia E carrega as variáveis na sessão atual do shell (precisa de `source`)
source scripts/setup-env.sh --load
```

#### Flags suportadas (`scripts/setup-env.sh`)

| Flag | Efeito |
|------|--------|
| _(nenhuma)_ | Copia templates preservando arquivos existentes. |
| `--force` | Sobrescreve `.env` e `supabase/functions/.env`. |
| `--dry-run` | Mostra o que faria, sem escrever nada (combina com `--force`). |
| `--validate` | Apenas valida `.env` files (não copia). Exit 3 se faltar var ou houver placeholder. |
| `--report` | Junto com `--validate`, grava relatório Markdown em `reports/env-check.md`. Aceita `--report=<path>`. |
| `--load` | Após copiar, exporta variáveis para o shell atual (exige `source`). |
| `-h`, `--help` | Mostra a ajuda inline. |

#### Pré-checagens executadas

Antes de qualquer cópia, o script aborta com mensagem clara (e exit code distinto) se:

1. **Bash < 4** — orienta `brew install bash` no macOS (exit 1).
2. **Template ausente** — `.env.example` ou `supabase/functions/.env.example` não encontrados; sugere restaurar via git (exit 1).
3. **Diretório não-gravável** — sem permissão de escrita na raiz ou `supabase/functions/` (exit 1).
4. **Flag desconhecida** — sai imediatamente com sugestão de `--help` (exit 2).
5. **`--load` sem `source`** — alerta que `--load` precisa ser sourced para exportar no shell atual.

#### Validação de variáveis (`--validate`)

Lê os arquivos `.env` reais (sem sourcing) e verifica:

- **Frontend (`.env`)** obrigatórias: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
- **Edge Functions (`supabase/functions/.env`)** obrigatórias: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Detecção de placeholders**: bloqueia valores como `your-project-ref`, `sk_live_...`, `eyJhbGciOiJIUzI1NiIs...`, `0x...`, `GOCSPX-...`, `whsec_...`, etc. (regex em `PLACEHOLDER_REGEX` no próprio script).
- Reporta linha-a-linha (`✓` ok, `✗` faltando/placeholder) e termina com exit `3` se houver falha — pronto para uso em CI/pre-commit.

#### Relatório (`--report`)

```bash
bun run setup:env:report            # grava em reports/env-check.md
bash scripts/setup-env.sh --validate --report=reports/custom.md
```

Tabela Markdown por escopo (frontend/functions) × variável × status (`✅ ok` / `⚠️ placeholder` / `❌ missing`) com timestamp UTC. Útil em CI — o workflow `env-check.yml` faz upload como artifact (`env-check-report`).

#### Códigos de saída

Códigos centralizados — válidos para CLI, CI, testes e build.

| Code | Origem | Significado | Quando |
|------|--------|-------------|--------|
| `0`  | script · vite · vitest | Sucesso. | Cópia/validação OK, `--help`, ou build limpo. |
| `1`  | script · vite build | Erro de IO / pré-check / build env inválido. | Bash < 4, template ausente, dir não-gravável, falha de cópia, **`vite build` aborta quando env-check falha**. |
| `2`  | script | Flag inválida. | Argumento desconhecido (sugere `--help`). |
| `3`  | script · CI | Falha de validação. | Variável obrigatória faltando ou ainda com valor-placeholder. |

Os mesmos códigos são consumidos pelo CI (`.github/workflows/env-check.yml`) e pelos testes unitários (`scripts/setup-env.test.sh`).

#### Validação em build-time (Vite)

`vite-plugins/env-check.ts` roda as mesmas regras durante `vite build`:

- **`vite build`** → lança erro e aborta com exit code `1` se faltar var ou houver placeholder.
- **`vite` (dev)** → apenas warning no console, não bloqueia HMR.
- **Bypass de emergência:** `SKIP_ENV_CHECK=1 bun run build` (logs aviso).

Isso garante que nenhum bundle de produção seja gerado com `.env` quebrado.

#### Runtime check (frontend)

`src/lib/envCheck.ts` valida no boot da aplicação (chamado em `src/main.tsx`) as mesmas vars obrigatórias do `--validate`:

- **DEV**: lança `Error` no console/overlay com instrução de rodar `bun run setup:env`.
- **PROD**: apenas `console.error` (nunca bloqueia o render do usuário final).

Cobertura: `src/lib/envCheck.test.ts` (vitest) — placeholders, missing, múltiplas falhas.

#### Testes & CI

```bash
# Testes unitários do script (sandbox isolado, ~11 casos)
bun run setup:env:test
```

CI (`.github/workflows/env-check.yml`) executa em cada push/PR que toca templates ou o script:

1. Templates existem.
2. `--help` retorna 0.
3. `--dry-run` não escreve arquivos.
4. Flag desconhecida retorna 2.
5. Cópia padrão cria os dois `.env`.
6. `--validate` sobre placeholders retorna 3.
7. `--validate` com valores reais retorna 0.
8. Suite completa de unit tests (`setup-env.test.sh`).

### Cópia manual (alternativa)

```bash
cp .env.example .env
cp supabase/functions/.env.example supabase/functions/.env
```

> ⚠️ Em produção, **secrets de edge functions vivem em Lovable Cloud Secrets** (Settings → Functions → Secrets). O arquivo `supabase/functions/.env` só é lido pelo CLI em dev local.

---

## Smart Economy Core


Sistema econômico atômico com ledger de créditos e dedução transacional segura.

### Tabelas Principais
- **`profiles`** — perfis de usuário com tier (FREE, CREATOR, PRO, STUDIO) e saldo de créditos
- **`smart_economy_ledger`** — ledger financeiro com todas as operações (MUSIC_GEN, VIDEO_GEN, CLIP_CUT, WEBGPU_RENDER)
- **`user_roles`** — roles separados (admin, moderator, user) com função `has_role()` security definer

### RPC Atômico
```sql
execute_atomic_credit_deduction(p_user_id, p_tokens_consumed, p_op_type, p_provider, p_api_cost)
```
Dedução atômica de créditos com `SELECT ... FOR UPDATE` implícito, evitando race conditions. Sempre usar esta RPC — nunca atualizar `current_credits` diretamente do cliente.

### Realtime CDC
As tabelas `profiles` e `smart_economy_ledger` estão na publicação `supabase_realtime`, permitindo streaming de eventos financeiros com latência <0.4ms para dashboards em tempo real.

---

## Estrutura de Diretórios

```
/
├── .agents/skills/           # Skills drafts (não ativas diretamente)
│   ├── ai-gateway/SKILL.md
│   ├── product-shot/SKILL.md
│   └── video-creator/SKILL.md
├── .workspace/skills/        # Skills ativas
│   └── kubo-vibedev-ai-system/SKILL.md
├── .github/workflows/        # CI/CD (WGSL sanitizer, testes)
├── src/
│   ├── game/                 # Quantum Game Engine
│   │   ├── ecs.ts
│   │   ├── wgsl-safe.ts
│   │   ├── procedural.ts
│   │   ├── renderer.ts
│   │   └── actions.ts
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts     # Cliente Supabase (auto-gerado)
│   │       └── types.ts      # Tipos do schema (auto-gerado)
│   └── ...                   # Páginas, componentes, hooks
├── supabase/
│   ├── functions/            # Edge Functions
│   │   ├── game-npc-ai/      # IA de NPCs para o game engine
│   │   └── wgsl-sanitizer/   # Sanitizador de shaders WGSL
│   └── migrations/           # 42+ migrations do schema
├── supabase/config.toml      # Configuração do projeto
├── public/                   # Assets estáticos
├── index.html
├── package.json
├── tailwind.config.ts
└── README.md                 # ← você está aqui
```

---

## Autenticação e Segurança

- **JWT** via Supabase Auth com refresh rotation
- **GitHub OAuth** e **Google OAuth** configurados
- **RLS** em todas as tabelas públicas — users só veem seus próprios dados
- **user_roles** em tabela separada (nunca no profile) — `has_role()` security definer
- Admin: `kuboprotocol@gmail.com` tem unlimited credits e dev access
- WebGPU: interceptor anti-injeção ativo em runtime
- Anti-fraude: timers de 10s/15s, tracking por IP/User, RLS reforçado

---

## CI / Post-Migration Security

[![Post-Migration Security](https://github.com/OWNER/REPO/actions/workflows/post-migration-security.yml/badge.svg?branch=main)](https://github.com/OWNER/REPO/actions/workflows/post-migration-security.yml)
[![Vitest](https://github.com/OWNER/REPO/actions/workflows/vitest.yml/badge.svg?branch=main)](https://github.com/OWNER/REPO/actions/workflows/vitest.yml)
[![E2E](https://github.com/OWNER/REPO/actions/workflows/e2e.yml/badge.svg?branch=main)](https://github.com/OWNER/REPO/actions/workflows/e2e.yml)

> Substitua `OWNER/REPO` pelo slug real do repositório (ex.: `kuboprotocol/kubo-vibe-dev`) para os badges renderizarem corretamente no GitHub.

Workflow `.github/workflows/post-migration-security.yml` executa automaticamente a cada push ou PR que altere `supabase/migrations/**` ou `supabase/functions/**`.

### O que o workflow faz

O job roda três camadas de verificação sequenciais e quebra o build se qualquer uma falhar:

1. **Lint estático nas migrations** — bloqueia padrões inseguros detectados por `grep`:
   - `CREATE TABLE public.*` sem `GRANT` ou `ENABLE RLS` subsequente
   - `SECURITY DEFINER` sem `SET search_path` fixo
   - `ALTER DATABASE postgres`
   - Modificações em schemas reservados (`auth`, `storage`, `realtime`, `vault`, `supabase_functions`)
   - Uso de `SERVICE_ROLE_KEY` em código fonte do frontend (`src/`)
   - Chamadas a `rpc('execute_sql')` em edge functions

2. **Checagens no banco via `psql`** — quando o secret `SUPABASE_DB_URL` está configurado:
   - Toda tabela em `public` deve ter RLS habilitado (`pg_class.relrowsecurity = true`)
   - Toda tabela em `public` deve ter pelo menos uma policy (`pg_policies`)
   - Toda tabela em `public` deve ter `GRANT` para `authenticated`, `anon` e `service_role`
   - Funções `SECURITY DEFINER` devem ter `SET search_path` fixo

3. **Supabase linter oficial** — quando `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF` estão configurados:
   - Executa `supabase db lint --level error` para validação programática do schema

### Secrets obrigatórios (GitHub Actions)

| Secret | Onde obter | Obrigatório para | Exemplo de valor |
|---|---|---|---|
| `SUPABASE_DB_URL` | Supabase Dashboard → Project Settings → Database → Connection string (URI, com password) | Checagens no banco (camada 2) | `postgresql://postgres.dlqmmubasyldcylhnqqd:STRONG_PWD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require` |
| `SUPABASE_ACCESS_TOKEN` | [app.supabase.com](https://app.supabase.com) → Account → Access Tokens → Generate new token | Linter oficial (camada 3) | `sbp_0123456789abcdef0123456789abcdef01234567` |
| `SUPABASE_PROJECT_REF` | URL do projeto: `https://supabase.com/dashboard/project/<ref>` | Linter oficial (camada 3) | `dlqmmubasyldcylhnqqd` |

> Use sempre a connection string do **pooler** (porta `6543`) com `sslmode=require` para não estourar o limite de conexões diretas. Nunca commitar o valor real — apenas em GitHub Secrets.

### Como configurar

1. Acesse **Settings → Secrets and variables → Actions** no repositório GitHub
2. Clique em **New repository secret**
3. Adicione os três secrets acima com os valores correspondentes
4. O workflow passa a disparar automaticamente em todo push/PR que tocar migrations ou edge functions

### Gatilhos

- `push` para branches que alterem `supabase/migrations/**` ou `supabase/functions/**`
- `pull_request` para as mesmas paths
- `workflow_dispatch` — execução manual pelo botão "Run workflow" no GitHub Actions

### Execução manual

#### 1) Pelo GitHub UI
1. Abra a aba **Actions** do repositório
2. Selecione **Post-Migration Security Scan** no menu lateral
3. Clique em **Run workflow** → escolha a branch → **Run workflow**
4. Acompanhe o log em tempo real e veja o summary ao final

#### 2) Pelo GitHub CLI
```bash
gh workflow run post-migration-security.yml --ref main
gh run watch
gh run list --workflow=post-migration-security.yml --limit 5
```

#### 3) Reproduzindo as 3 camadas localmente (script unificado)

Use o script `scripts/verify-security-local.sh` — roda exatamente o mesmo fluxo do CI e grava relatórios em `reports/security/`:

```bash
# Camada 1 apenas (sem secrets)
./scripts/verify-security-local.sh

# Camadas 1 + 2 (psql necessário)
export SUPABASE_DB_URL='postgresql://postgres.<ref>:<pwd>@...pooler.supabase.com:6543/postgres?sslmode=require'
./scripts/verify-security-local.sh

# Camadas 1 + 2 + 3 (supabase CLI necessário)
export SUPABASE_ACCESS_TOKEN='sbp_...'
export SUPABASE_PROJECT_REF='dlqmmubasyldcylhnqqd'
./scripts/verify-security-local.sh

# Saída:
#   reports/security/static-lint.log
#   reports/security/db-checks.log
#   reports/security/supabase-linter.log
#   reports/security/summary.md    ← tabela com Status por camada
# Exit code: 0 sucesso, 1 falha
```

### Relatórios persistidos pelo CI

A cada execução o workflow:

1. Roda `scripts/verify-security-local.sh` dentro do runner
2. Faz upload via `actions/upload-artifact@v4` com o nome **`post-migration-security-reports-<run_id>`** (retention de 30 dias)
3. Inclui o `summary.md` no painel **Actions → run → Summary**

#### Download guiado dos artifacts

**Opção A — UI (recomendada para não-técnicos):**
1. Abra **Actions** → clique no run desejado
2. Role até a seção **Artifacts** (final da página)
3. Clique em `post-migration-security-reports-<run_id>` → baixa um `.zip`
4. Extraia para inspecionar os 4 logs + `summary.md` + ZIP interno consolidado

**Opção B — GitHub CLI (automação / CI):**
```bash
# Lista os 5 runs mais recentes
gh run list --workflow=post-migration-security.yml --limit 5

# Baixa para ./reports/ci/<run-id>/
RUN_ID=<run-id>
mkdir -p reports/ci/$RUN_ID
gh run download $RUN_ID \
  -n post-migration-security-reports-$RUN_ID \
  -D reports/ci/$RUN_ID

# Inspeciona o summary direto no terminal
cat reports/ci/$RUN_ID/summary.md
unzip -l reports/ci/$RUN_ID/post-migration-security-$RUN_ID.zip
```

**Opção C — `curl` + API (sem `gh`):**
```bash
TOKEN=$GITHUB_TOKEN  REPO=OWNER/REPO  RUN_ID=<run-id>
ART_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID/artifacts" \
  | jq -r '.artifacts[0].id')
curl -L -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/$REPO/actions/artifacts/$ART_ID/zip" \
  -o reports.zip
unzip reports.zip -d reports/ci/$RUN_ID/
```

#### ZIP local consolidado

O script `verify-security-local.sh` também gera um ZIP carimbado com timestamp em
`reports/security/post-migration-security-<UTC>.zip`, com o mesmo conteúdo do
artifact do CI — pronto para anexar em tickets, PRs ou auditorias externas.

### Resultado esperado

Se todas as camadas passarem, o job exibe um summary com:
- Ícone verde para lint estático
- Ícone verde para checagens no banco (ou cinza se `SUPABASE_DB_URL` ausente)
- Ícone verde para Supabase linter (ou cinza se token/proj_ref ausente)
- Link para o artifact com os 4 logs/relatórios

Se alguma camada falhar, o job encerra com `exit 1` e impede o merge do PR.


### Troubleshooting

| Sintoma | Causa provável | Resolução |
|---|---|---|
| `❌ <file> cria tabela em public sem GRANT` | Migration nova com `CREATE TABLE public.x` sem bloco `GRANT` | Adicionar `GRANT SELECT, INSERT, UPDATE, DELETE ON public.x TO authenticated;` + `GRANT ALL ... TO service_role;` na mesma migration |
| `❌ <file> cria tabela em public sem ENABLE RLS` | Falta `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | Adicionar logo após o `CREATE TABLE` e antes do `CREATE POLICY` |
| `❌ <file> tem SECURITY DEFINER sem SET search_path` | Função `SECURITY DEFINER` sem `SET search_path = public` | Adicionar `SET search_path = public` na assinatura da função |
| `❌ ALTER DATABASE postgres não é permitido` | Migration tenta mudar parâmetros globais | Remover; usar `ALTER ROLE` ou `SET LOCAL` em transação |
| `❌ Migration toca schema reservado` | `CREATE/ALTER/DROP` em `auth`/`storage`/`realtime`/`vault`/`supabase_functions` | Mover lógica para `public` ou usar API oficial do Supabase |
| `❌ SERVICE_ROLE referenciado no frontend` | `SUPABASE_SERVICE_ROLE_KEY` em `src/**` | Mover para edge function; o frontend só usa `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `❌ Edge function executa SQL arbitrário via execute_sql` | `supabase.rpc('execute_sql', ...)` em edge function | Substituir por RPC tipada ou query via `from('table')` |
| `psql: error: connection to server ... failed` | `SUPABASE_DB_URL` incorreta, sem `sslmode=require` ou apontando para porta direta (5432) saturada | Usar connection string do pooler na porta `6543` com `?sslmode=require` |
| `permission denied for schema public` ao validar GRANTs | Role sem privilégio de leitura em `information_schema` | Usar a connection string padrão `postgres` do projeto |
| Workflow não dispara em push | Push não tocou `supabase/migrations/**` nem `supabase/functions/**` | Rodar via `workflow_dispatch` ou ajustar `paths:` |
| `supabase db lint` falha com `not linked` | Falta `SUPABASE_PROJECT_REF` ou `supabase link` não executou | Conferir os dois secrets e logs do passo `Supabase DB linter` |
| Camada 2/3 marcada como `⏭️` no summary | Secret correspondente não configurado | Configurar `SUPABASE_DB_URL` e/ou `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` |

---

## CI / Rerun Concurrency (Idempotência)

[![Rerun Concurrency](https://github.com/OWNER/REPO/actions/workflows/rerun-concurrency.yml/badge.svg?branch=main)](https://github.com/OWNER/REPO/actions/workflows/rerun-concurrency.yml)

> Substitua `OWNER/REPO` pelo slug real do repositório para o badge renderizar corretamente.

Workflow `.github/workflows/rerun-concurrency.yml` garante que reexecutar um asset criativo várias vezes em paralelo só desconta créditos **uma vez**, validando a idempotência da RPC `execute_atomic_credit_deduction`.

### O que o workflow faz

1. Dispara `N` requisições paralelas (padrão: 8) para a edge function criativa (`creative-chat`) com o mesmo `X-Idempotency-Key` (`rerun:<asset_id>`).
2. Verifica via REST API (`credit_transactions`) que **existe no máximo 1 linha** no ledger para aquela chave de idempotência.
3. **Falha o build** se encontrar mais de 1 transação (regressão de idempotência) ou se nenhuma requisição for bem-sucedida.

### O que o preflight valida (antes de gastar créditos)

O script `scripts/preflight-rerun.ts` (disparável via `bun run preflight:rerun`) executa **7 checks sequenciais** que garantem que o ambiente está saudável **antes** de rodar o teste de concorrência real. Isso evita falhas falsas negativas (ex.: token expirado, asset inexistente, falta de créditos).

| # | Check | Descrição | Falha comum |
|---|-------|-----------|-------------|
| 1 | **Env vars presentes** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ACCESS_TOKEN`, `ASSET_ID` estão preenchidos | Variável não exportada ou arquivo `.env.rerun-ci` não carregado |
| 2 | **URL HTTPS** | `SUPABASE_URL` usa `https://` e é parseável | URL com trailing slash mal formatada ou `http://` |
| 3 | **UUID válido** | `ASSET_ID` é um UUID v4 válido | Cópia truncada ou GUID mal formatado |
| 4 | **Token autenticado** | `ACCESS_TOKEN` consegue chamar `/auth/v1/user` e retorna um `user_id` | JWT expirado (dura ~1h) ou token de anon key |
| 5 | **Asset existe e pertence ao usuário** | `creative_assets` com o `ASSET_ID` existe e `user_id` bate com o do token | Asset de outro usuário (RLS vai bloquear) ou UUID inexistente |
| 6 | **Subscription ativa com créditos** | Usuário tem `subscription` ativa e `edits_limit - edits_used >= 5` | Plano Free sem créditos ou subscription inativa |
| 7 | **Edge function alcançável** | Faz `OPTIONS` na função (`creative-chat` por padrão) e recebe 200/204 | Edge function não deployada ou `FN` incorreto |

Se **qualquer um** dos checks falhar, o script imprime uma mensagem acionável e sai com código `1`, impedindo que o teste de concorrência rode em vão.

> **Dica:** Use `bun run preflight:rerun` como um smoke test rápido antes de rodar o CI ou o teste Deno diretamente.

### Secrets obrigatórios (GitHub Actions)

| Secret | Onde obter | Obrigatório para | Exemplo de valor |
|---|---|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API → URL | Endpoint das edge functions e REST | `https://dlqmmubasyldcylhnqqd.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → `service_role` key (reveal) | Ler `credit_transactions` via REST para verificação | `eyJhbGciOiJIUzI1NiIs...` |
| `RERUN_TEST_ACCESS_TOKEN` | Gerar um JWT válido de um usuário de teste (ou usar token de sessão autenticada) | Autenticar nas edge functions | `eyJhbGciOiJIUzI1NiIs...` |
| `RERUN_TEST_ASSET_ID` | UUID de um `creative_assets` existente pertencente ao usuário de teste | Construir a `X-Idempotency-Key` (`rerun:<asset_id>`) | `a1b2c3d4-e5f6...` |

> Nunca commitar valores reais — adicionar apenas em **GitHub Secrets**.

### Variável de controle (Repository Variable)

| Variable | Valor | Descrição |
|---|---|---|
| `RERUN_CONCURRENCY_ENABLED` | `true` | Ativa o workflow em push/PR automático. Se ausente ou diferente de `true`, o workflow pula silenciosamente em push/PR (mas ainda pode rodar via `workflow_dispatch`). Isso previne falhas em PRs de forks sem as credenciais de teste. |

### Como configurar

1. Acesse **Settings → Secrets and variables → Actions** no repositório GitHub
2. Em **Secrets**, clique em **New repository secret** e adicione os 4 secrets da tabela acima
3. Mude para a aba **Variables** e crie `RERUN_CONCURRENCY_ENABLED` com valor `true`
4. O workflow passa a disparar automaticamente em todo push/PR que tocar:
   - `supabase/functions/_shared/creative.ts`
   - `supabase/functions/creative-*/**`
   - `scripts/test-rerun-concurrency.ts`
   - `.github/workflows/rerun-concurrency.yml`

### Gatilhos

- `push` / `pull_request` para as paths acima (quando `vars.RERUN_CONCURRENCY_ENABLED == 'true'`)
- `workflow_dispatch` — execução manual sempre permitida

### Execução manual

#### 1) Pelo GitHub UI
1. Abra a aba **Actions** do repositório
2. Selecione **rerun-concurrency** no menu lateral
3. Clique em **Run workflow** → escolha a branch → **Run workflow**

#### 2) Pelo GitHub CLI
```bash
gh workflow run rerun-concurrency.yml --ref main
gh run watch
gh run list --workflow=rerun-concurrency.yml --limit 5
```

#### 3) Localmente (Deno ou bun)

##### Variáveis de ambiente necessárias

Crie um arquivo `.env.rerun-ci` a partir do template (já está no `.gitignore`):

```bash
cp .github/rerun-concurrency.local.env.example .env.rerun-ci
```

Exemplo preenchido com placeholders:

```bash
# Endpoint do projeto Supabase (obrigatório)
# Onde obter: Supabase Dashboard → Project Settings → API → Project URL
SUPABASE_URL="https://<project-ref>.supabase.co"

# service_role key — nunca exponha no frontend (obrigatório)
# Onde obter: Supabase Dashboard → Project Settings → API → service_role → Reveal
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIs..."

# JWT do usuário de teste autenticado (obrigatório)
# Onde obter: DevTools → Application → Local Storage → sb-<ref>-auth-token → access_token
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIs..."

# UUID de um creative_assets existente do usuário acima (obrigatório)
# Onde obter: SQL Editor → select id from public.creative_assets where user_id = '<uuid>' limit 1;
ASSET_ID="00000000-0000-0000-0000-000000000000"

# Número de requisições paralelas no teste de concorrência (opcional, padrão: 8)
CONCURRENCY=8

# Nome da edge function a testar (opcional, padrão: creative-chat)
FN=creative-chat
```

Carregue as variáveis no shell atual:

```bash
set -a && source .env.rerun-ci && set +a
```

##### Rodar o preflight

```bash
# Opção A — via bun (um comando, herda exit code do script)
bun run preflight:rerun

# Opção B — via Deno diretamente
deno run --allow-net --allow-env scripts/preflight-rerun.ts
```

##### Rodar o teste real (só após preflight passar)

```bash
deno run --allow-net --allow-env scripts/test-rerun-concurrency.ts
```

Saída esperada em caso de sucesso:
```
✅ PASS: idempotent — at most one credit transaction was created.
```

Saída em caso de regressão:
```
❌ FAIL: expected exactly 1 ledger row, found 3. Idempotency broken.
```

### Como desabilitar para forks

O workflow possui proteção nativa contra forks: se `vars.RERUN_CONCURRENCY_ENABLED` não for exatamente `'true'`, o job `rerun-idempotency` é pulado em triggers automáticos (`push`/`pull_request`). Forks que não copiarem a variável não quebrarão o CI por falta de secrets. A execução manual (`workflow_dispatch`) continua disponível para quem tiver as credenciais.

### ✅ Checklist rápido — habilitar em &lt; 5 minutos

Templates prontos: [`.github/rerun-concurrency.secrets.example`](.github/rerun-concurrency.secrets.example) · [`.github/rerun-concurrency.local.env.example`](.github/rerun-concurrency.local.env.example)

- [ ] **1. Coletar credenciais** (Supabase Dashboard → Project Settings → API)
  - `SUPABASE_URL` (Project URL)
  - `SUPABASE_SERVICE_ROLE_KEY` (Reveal em `service_role`)
- [ ] **2. Gerar `RERUN_TEST_ACCESS_TOKEN`** — logue na app com usuário de teste, copie o `access_token` do localStorage (`sb-<ref>-auth-token`)
- [ ] **3. Obter `RERUN_TEST_ASSET_ID`** — rode no SQL Editor:
  ```sql
  select id from public.creative_assets
  where user_id = '<uuid-do-usuario-teste>'
  order by created_at desc limit 1;
  ```
- [ ] **4. (Opcional) Validar localmente antes de habilitar o CI:**
  ```bash
  cp .github/rerun-concurrency.local.env.example .env.rerun-ci
  # edite .env.rerun-ci com os valores reais (já está no .gitignore)
  set -a && source .env.rerun-ci && set +a

  # 4a. Preflight — valida secrets, token, asset, créditos e edge function (sem gastar créditos)
  #    Opção rápida (bun):
  bun run preflight:rerun
  #    Opção Deno:
  deno run --allow-net --allow-env scripts/preflight-rerun.ts

  # 4b. Só rode o teste real se o preflight passar
  deno run --allow-net --allow-env scripts/test-rerun-concurrency.ts
  ```
  Esperado preflight: `✅ Preflight passed — safe to run the concurrency test.`
  Esperado teste: `✅ PASS: idempotent — at most one credit transaction was created.`
- [ ] **5. Adicionar no GitHub via CLI** (mais rápido que UI):
  ```bash
  gh secret set SUPABASE_URL               --body "$SUPABASE_URL"
  gh secret set SUPABASE_SERVICE_ROLE_KEY  --body "$SUPABASE_SERVICE_ROLE_KEY"
  gh secret set RERUN_TEST_ACCESS_TOKEN    --body "$ACCESS_TOKEN"
  gh secret set RERUN_TEST_ASSET_ID        --body "$ASSET_ID"
  gh variable set RERUN_CONCURRENCY_ENABLED --body "true"
  ```
- [ ] **6. Disparar uma execução manual para confirmar:**
  ```bash
  gh workflow run rerun-concurrency.yml --ref main
  gh run watch
  ```
- [ ] **7. Confirmar badge verde** no topo do README (substitua `OWNER/REPO` pelo slug real).

### 🛠️ Troubleshooting

| Sintoma | Causa provável | Como resolver |
|---|---|---|
| Job aparece como **skipped** em push/PR | `RERUN_CONCURRENCY_ENABLED` ausente ou ≠ `true` | `gh variable set RERUN_CONCURRENCY_ENABLED --body "true"` |
| `401 Unauthorized` / `invalid JWT` | `RERUN_TEST_ACCESS_TOKEN` expirou (JWTs duram ~1h) | Re-logue o usuário de teste e atualize o secret. Para CI estável, considere um service account com refresh automático |
| `403` ou `row-level security policy violated` | `ASSET_ID` não pertence ao usuário do `ACCESS_TOKEN` | Rode o SQL do passo 3 com o `user_id` correto |
| `404 Not Found` ao chamar a edge function | `FN` errado ou função não deployada | Confirme `FN=creative-chat` e `supabase functions list` |
| `expected exactly 1 ledger row, found N` | **Regressão real de idempotência** — a RPC está duplicando débitos | Verifique `execute_atomic_credit_deduction`: `idempotency_key` deve ter `UNIQUE` constraint e `INSERT ... ON CONFLICT DO NOTHING` |
| `expected exactly 1 ledger row, found 0` | Todas as requisições falharam antes de gravar | Veja `supabase functions logs creative-chat` — geralmente é token inválido ou créditos insuficientes |
| `CONCURRENCY` ignorado | Variável não exportada | Use `export CONCURRENCY=8` (não apenas `CONCURRENCY=8 deno ...`) ou `set -a` antes do `source` |
| Permission denied em `deno` | Faltam flags | Sempre rode com `--allow-net --allow-env` |
| Workflow falha só em PRs de forks | Secrets não são expostos a forks (comportamento padrão e seguro do GitHub) | Deixe como está — a guarda `RERUN_CONCURRENCY_ENABLED` já protege; rode manualmente após merge |
| Rate limit (`429`) durante o teste | A própria proteção de rate limit das edge functions disparou | Reduza `CONCURRENCY` para 4 ou espere 60s entre execuções |

---

## Como Executar Localmente


```sh
# 1. Clone o repositório
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# 2. Instale as dependências
npm i

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

**Requisitos:** Node.js & npm instalados. Recomendado: [nvm](https://github.com/nvm-sh/nvm).

---

## Deploy

O projeto é implantado automaticamente via **Vercel** quando publicado pelo Lovable:

1. Acesse o projeto no Lovable
2. Clique em **Share → Publish**

Ou faça push para o repo — a integração Git reflete as alterações automaticamente.

### Domínio Customizado

Navegue até **Project > Settings > Domains** e clique em **Connect Domain**.
Leia mais: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain)

---

## Tecnologias Utilizadas

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, Vite 5, TypeScript 5, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | Supabase (PostgreSQL + Edge Functions + Realtime) |
| Game Engine | Three.js, WebGPU, ECS custom, WGSL |
| Auth | Supabase Auth, GitHub OAuth, Google OAuth |
| Pagamentos | Stripe Checkout + Webhooks, Polar (fallback) |
| Vídeo | Remotion + React + Tailwind |
| Imagens | Lovable AI Gateway (Gemini) + mesh gradients |
| Infra | Vercel (frontend), Lovable Cloud (backend) |

---

## Principais Funcionalidades

- **Builder Interface** — Prompt, chat, KUBO Tools, FLOW AI modes
- **Canvas Tool** — Ferramenta visual de design com 20+ templates
- **Cloning System** — Firecrawl + DeepSeek + Tailwind para clonar sites
- **KUBO FLOW AI** — Modos FLOW (Free), THINK (Starter), SHIP (Ultra) com detecção de complexidade
- **Publishing System** — `/app/:projectId/:slug` URL pública com badge "Built with Kubo Vibe"
- **Reward System** — 0.5 créditos/vídeo (max 10/dia), timer de 15s
- **Gamification** — Daily streak bonuses e badges permanentes
- **Leaderboard** — Top 50 global por longest_streak
- **Referral System** — 100 créditos/referral, código de 8 caracteres
- **Connectors Hub** — GitHub OAuth real, IPFS deploy
- **Email Infra** — notify.kubovibe.dev, React Email, pg_net em DB triggers
- **Native Mobile** — Capacitor hybrid (dev.kubovibe.app)

---

## Contato

**KUBO PROTOCOL**  
CNPJ: 58.864.433/0001-90  
Website: https://kubovibe.dev

---

> *"A primeira IA do mundo capaz de criar universos digitais vivos sem depender de engines tradicionais."*

---

## Skills Orchestration

Skills ativas em `.workspace/skills/` (verificar com `ls .workspace/skills/`):

1. `kubo-vibedev-ai-system` — orquestrador raiz (primária por padrão)
2. `kubo-vibe-3d-websites-engine` — 3D / WebGPU
3. `ai-gateway` — roteamento LLM
4. `product-shot` — mockups de produto
5. `video-creator` — vídeos / roteiros

Regras de precedência, handoff, isolamento e fluxo para **registrar novas
skills via ZIP** estão em [`docs/SKILLS_ORCHESTRATION.md`](docs/SKILLS_ORCHESTRATION.md).
