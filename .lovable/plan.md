## Problema

Hoje o GitHub no /connectors ainda depende do OAuth real (`useGitHubConnection` → `/github-auth`). Mesmo passando pela `/connectors/github/setup`, a página de detalhe (`/connectors/github`) só mostra avatar/username/repos se o usuário tiver feito o **OAuth do GitHub**, não bastando ter cadastrado o PAT.

Você quer o oposto: **a conta GitHub deve ser vinculada à KUBO usando apenas o Personal Access Token (PAT)** salvo na setup. Sem redirecionamento externo. O detalhe só aparece depois que o PAT é validado contra a API do GitHub.

## Plano

### 1. Edge function `connector-credentials-save` — vincular GitHub ao salvar
Quando `connector_slug === "github"`, após cifrar o PAT:
- Chamar `GET https://api.github.com/user` com o token.
- Se 200, gravar/atualizar `github_connections` com `user_id`, `access_token` (mesmo PAT), `github_username`, `github_avatar_url`, `scope = "pat"`.
- Se 401/403, retornar erro 400 com mensagem clara — **não salva** a credencial inválida.

### 2. Página `ConnectorSetupPage` (GitHub)
- Antes de redirecionar para `/connectors/github`, exibir resultado da validação (já temos UI de teste).
- Só navegar para `/connectors/github` quando o PAT for aceito pelo GitHub.
- Texto explicativo: *"Vamos vincular sua conta GitHub à KUBO usando seu PAT — sem login OAuth externo."*

### 3. Hook `useGitHubConnection`
- Remover/desativar o `connect()` que dispara OAuth (`/github-auth`).
- `connect()` agora apenas redireciona para `/connectors/github/setup`.
- `disconnect()` continua deletando linha em `github_connections` **e** em `api_credentials` (slug `github`).

### 4. Página `ConnectorDetailPage` (GitHub)
- Botão "Conectar" passa a navegar para `/connectors/github/setup` (não dispara OAuth).
- `isConnected` continua lendo de `github_connections` — agora populada pelo PAT.
- Bloco de avatar/username/repos funciona inalterado.

### 5. Hub `ConnectorsHubPage`
- Remover `internalRoute` do GitHub em `connectorsConfig.ts` (se houver) para forçar `/connectors/github/setup` como entrada única.
- Comportamento já correto para os demais conectores.

### 6. Rota `/github-auth` e edge function `github-auth`/`github-callback`
- Manter funcionando (não remover) para não quebrar quem já está conectado via OAuth, mas **não chamar mais** a partir do app.
- Opcional: marcar como deprecated em comentário.

## Detalhes técnicos

```text
Fluxo novo:

[Hub /connectors]
       │ click GitHub
       ▼
[/connectors/github/setup]
       │ usuário cola PAT + aceita termos
       │ → connector-credentials-save
       │     ├─ valida PAT em api.github.com/user
       │     ├─ cifra e grava api_credentials
       │     └─ upsert github_connections (username, avatar)
       │ ← sucesso
       ▼
[/connectors/github]  ← já mostra avatar/repos vindos do PAT
```

- Tabela `github_connections` já aceita `access_token TEXT` — guardamos o PAT em claro lá (RLS já restringe a service_role + dono). Alternativa: guardar só metadados em `github_connections` e ler o token sempre cifrado de `api_credentials` (mais seguro). **Recomendo a alternativa** para não duplicar segredo em claro.
- O componente `GitHubReposList` que hoje usa `github_connections.access_token` precisa passar a chamar uma edge function (`github-repos`) que descriptografa o PAT de `api_credentials` e lista os repos — assim o token nunca vai para o frontend.

## Arquivos afetados
- `supabase/functions/connector-credentials-save/index.ts` (validação + upsert github)
- `supabase/functions/github-repos/index.ts` (ler PAT cifrado)
- `src/hooks/useGitHubConnection.ts` (sem OAuth)
- `src/pages/ConnectorSetupPage.tsx` (redirect condicional pós-validação)
- `src/pages/ConnectorDetailPage.tsx` (botão conectar → /setup)
- `src/lib/connectorsConfig.ts` (remover internalRoute do github, se houver)

## Confirma?
Quer que eu também aplique o mesmo padrão "validar antes de redirecionar para o detalhe" para os outros conectores (Stripe, Vercel, etc.), ou só para o GitHub agora?
