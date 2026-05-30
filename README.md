# Kubo VibeDev

> Plataforma autônoma de criação, execução e monetização de software baseada em IA.
> Transforma ideias em produtos digitais completos — SaaS, metaversos, jogos AAA e aplicações Web3.

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
