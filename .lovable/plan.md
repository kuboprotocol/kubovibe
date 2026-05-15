## Objetivo

Eliminar qualquer redirecionamento direto para sites de terceiros ao clicar num conector. Todo o fluxo passa a acontecer dentro da KUBO, em duas subpáginas internas, com persistência segura das credenciais por projeto e exposição automática das capacidades para a IA.

## Fluxo novo

```text
/connectors  →  /connectors/:slug          (Etapa 1 — Aviso/TC)
              →  /connectors/:slug/setup    (Etapa 2 — Docs + API)
              →  salva credencial por projeto + log
```

Nenhum botão da listagem ou da página de detalhe abre nova aba para o site do terceiro sem passar antes pela Etapa 1. Links externos (docs oficiais, painel do provedor) só aparecem dentro da Etapa 2 e sempre rotulados como "site externo de terceiro".

## Etapa 1 — Página de Aviso (`/connectors/:slug`)

Refatorar a `ConnectorDetailPage` atual para virar a tela de aviso/TC. Conteúdo:

- Branding KUBO + ícone/cor do conector.
- Bloco "Serviço de terceiros": nome do provedor, link para o site oficial **só** como referência textual.
- Bullets de responsabilidade:
  - O serviço **não pertence** à KUBO.
  - A KUBO apenas integra/automatiza.
  - Cobranças, limites, política de API e segurança são responsabilidade do provedor.
  - Riscos de uso indevido das chaves recaem sobre o usuário.
- Checkbox obrigatório "Li e aceito os termos deste serviço de terceiros".
- Botão **Continuar configuração** → habilitado só com o checkbox marcado, navega para `/connectors/:slug/setup`.
- Botão secundário **Voltar para conectores**.

A tela de gerenciamento avançada de logs/runs/share que hoje está nessa rota é movida para `/connectors/:slug/manage` (mesmo componente, sem alterações funcionais), preservando os testes E2E existentes via redirect transparente quando há `?run=...` ou usuário já tem credencial salva.

## Etapa 2 — Setup (`/connectors/:slug/setup`)

Novo arquivo `src/pages/ConnectorSetupPage.tsx`. Layout estilo docs (sidebar + steps numerados + cards):

1. **O que é o serviço** — descrição longa do `connectorsConfig`.
2. **Como criar a API Key** — instruções específicas por conector (`setupSteps` no config, com fallback genérico + link para docs oficiais marcado como externo).
3. **Permissões necessárias** — lista de scopes/escopos por conector.
4. **Conectar ao projeto**:
   - Select de projeto (lista os `projects` do usuário).
   - Campo `API Key` (password).
   - Campo `Secret` (password, opcional por conector).
   - Campo `Webhook/Callback URL` (opcional).
   - Botão **Salvar e ativar**.
5. **Como a IA vai usar** — cards listando capacidades derivadas do conector (ex.: GitHub → "criar commits", "ler repos", "CI/CD"; Supabase → "ler schema", "auth", "storage", "realtime").

Submit chama edge function `connector-credentials-save` que criptografa e grava em `api_credentials`, cria linha em `project_integrations` e registra evento em `connector_activity_logs`. Em sucesso, navega para `/connectors/:slug/manage?project=<id>`.

GitHub mantém o fluxo OAuth existente, mas o botão "Conectar com GitHub" aparece dentro da Etapa 2 (depois do aviso), não mais direto da listagem.

## Banco de dados

Migration nova:

- `connectors` — catálogo persistido (slug, nome, categoria, auth_type, capabilities[], required_scopes[], docs_url). Seed a partir do `connectorsConfig`.
- `project_integrations` — `(project_id, connector_slug, credential_id, status, scopes, created_at)`. RLS: dono do projeto.
- `api_credentials` — `(id, user_id, connector_slug, ciphertext, iv, tag, created_at, rotated_at)`. RLS: dono. **Nunca lida no client** — apenas edge functions com service role + chave AES de `Deno.env`.
- Função `has_project_access(_project uuid)` SECURITY DEFINER reutilizada nas policies.

Adicionar segredo `CONNECTOR_ENC_KEY` (32 bytes base64) via `add_secret` antes da migração ser usada.

## Edge functions

- `connector-credentials-save` — valida JWT, criptografa AES-256-GCM, insere em `api_credentials` + `project_integrations`, loga.
- `connector-credentials-reveal` — só retorna metadados (mascarado: `ghp_••••1234`), nunca o segredo bruto.
- `connector-capabilities` — devolve, para um `project_id`, a lista de conectores ativos + capabilities + scopes; consumida pela IA do builder via `orchestrator`.

`verify_jwt = false` + validação manual com `auth.getUser()` (padrão do projeto).

## Integração com a IA

`supabase/functions/orchestrator/index.ts` passa a chamar `connector-capabilities` no início da execução e injeta um bloco `available_connectors` no system prompt. Sem expor segredos — só nomes, scopes e capabilities. Quando a IA precisar executar uma ação que dependa do segredo, ela invoca uma função intermediária que carrega a credencial server-side.

## Segurança

- AES-256-GCM com `CONNECTOR_ENC_KEY` server-only.
- Frontend nunca recebe `ciphertext`, `iv`, `tag` ou segredo em claro.
- Inputs validados com Zod nas edge functions (length, formato).
- RLS estrita em `api_credentials` e `project_integrations`.
- Confirmação de domínio externo já existente no `PromptAttachMenu` continua aplicando para qualquer link "abrir docs/painel".

## UI/UX

- Dark + glassmorphism + ouro (#C9941A) — alinhado ao design system existente.
- Stepper animado (framer-motion) na Etapa 2.
- Cards com ícone do conector.
- Toasts (sonner) para erros de validação e sucesso.

## Arquivos

- **Editar**: `src/pages/ConnectorDetailPage.tsx` (vira tela de aviso; conteúdo atual movido), `src/App.tsx` (novas rotas), `src/lib/connectorsConfig.ts` (adicionar `setupSteps`, `permissions`, `aiCapabilities`), `src/pages/ConnectorsHubPage.tsx` (rota continua `/connectors/:slug`), `supabase/functions/orchestrator/index.ts`.
- **Criar**: `src/pages/ConnectorSetupPage.tsx`, `src/pages/ConnectorManagePage.tsx` (re-export do componente atual), `supabase/functions/connector-credentials-save/index.ts`, `supabase/functions/connector-credentials-reveal/index.ts`, `supabase/functions/connector-capabilities/index.ts`, migração SQL.

## Ordem de execução

1. `add_secret CONNECTOR_ENC_KEY`.
2. Migração (tabelas + RLS + seed).
3. Edge functions.
4. Refactor `ConnectorDetailPage` → tela de aviso + nova `ConnectorManagePage`.
5. `ConnectorSetupPage` + rotas em `App.tsx`.
6. Atualizar `connectorsConfig` com docs/permissions/capabilities.
7. Hook `orchestrator` para ler capabilities.

## Pontos de confirmação antes de codar

- Confirma o nome do segredo `CONNECTOR_ENC_KEY`?
- O fluxo OAuth do GitHub passa a iniciar **só** após o aviso ser aceito (mesmo para usuários já conectados a primeira vez)?
- Mantemos `/connectors/:slug/manage` como página avançada (logs/share/runs) ou esse painel deveria virar uma aba dentro do setup?
