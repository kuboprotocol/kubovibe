## Plano de implementação

Duas frentes em paralelo. Frente 1 finaliza o sistema de auditoria; frente 2 inicia o gerador de slides visual.

---

### Frente 1 — Auditoria: link protegido, revogação, timeline e ZIP

**1.1 Banco (`audit_shares`)**
Nova tabela para gerir os relatórios compartilhados:
- `id`, `user_id`, `storage_path`, `password_hash` (bcrypt), `salt`, `expires_at`, `revoked_at`, `download_count`, `last_accessed_at`, `created_at`, `size_bytes`, `label`.
- RLS: dono pode `SELECT/UPDATE/DELETE` os próprios; service role gerencia tudo. Acesso público só via Edge Function (com senha).

**1.2 Edge functions**
- `audit-share-create`: gera salt+hash da senha, faz upload do ZIP no bucket privado, devolve URL pública do tipo `/share/audit/:id` (não signed URL bruta — sempre passa pela função).
- `audit-share-access`: recebe `id` + `password`, valida hash, checa `expires_at`/`revoked_at`, incrementa contador, devolve `signedUrl` curta (60s) para download.
- `audit-share-revoke`: marca `revoked_at = now()` (apenas dono).

**1.3 Cliente**
- `src/lib/auditBundle.ts`: substituir `shareReport` para chamar `audit-share-create` (com `password`, `expiresInSec`); novo `revokeShare(id)`.
- `PreviewAuditPanel.tsx`:
  - Diálogo de compartilhamento: campos *Senha* + *Expira em* (1h…30d) + *Rótulo*.
  - Histórico expandido: status (ativo/expirado/revogado), botão **Revogar**, copiar link, copiar senha.
  - Filtro de **Timeline por tipo** (multi-toggle: log/info/warn/error/network/resource).
  - Sub-painel de **seleção de itens do ZIP** já existente refinado: checkboxes por categoria + por screenshot individual.

**1.4 Página pública `/share/audit/:id`**
Form mínimo (senha → download). Mostra metadados e mensagem clara em caso de expirado/revogado.

---

### Frente 2 — Gerador de Slides visual (v1)

Nova área `/slides`. Arquitetura conforme guia de slides-app:

**2.1 Banco**
- `slide_decks` (id, user_id, title, theme jsonb, updated_at)
- `slide_pages` (id, deck_id, position, content jsonb, notes)
RLS por dono.

**2.2 Estrutura de código**
```text
src/pages/SlidesPage.tsx           # lista de decks
src/pages/SlidesEditorPage.tsx     # editor de um deck
src/components/slides/
  ├─ ScaledSlide.tsx               # 1920x1080 + transform: scale
  ├─ SlideLayout.tsx               # wrapper c/ tema/scoped fonts
  ├─ SlideThumbnailStrip.tsx       # sidebar
  ├─ SlideToolbar.tsx              # add/dup/delete/present
  ├─ SlidePresenter.tsx            # fullscreen + atalhos
  ├─ SlideGridOverview.tsx         # tecla G
  └─ blocks/                       # Heading, Text, Image, Bullet, Quote
src/lib/slides/
  ├─ types.ts
  ├─ deckStore.ts                  # zustand persist + sync supabase
  └─ exportPdf.ts                  # via window.print() inicial
src/index.css                      # tokens .slide-content (font scale)
```

**2.3 Funcionalidades v1**
- CRUD de decks/slides + auto-save.
- Edição inline de blocos (texto, título, bullets, imagem por upload).
- 6 layouts pré-prontos (title, title+content, two-col, image-left, quote, section-divider).
- 4 temas com tokens CSS (Midnight, Paper, Forest, Coral).
- Modo Presentar (F5), Grid (G), navegação ←/→/Space, Esc para sair.
- Export PDF inicial via `window.print()` com CSS `@page { size: 1920px 1080px landscape }`.
- Atalhos: ⌘/Ctrl+D duplica, Del remove, ⌘/Ctrl+S força save.

**2.4 Fora de escopo nesta v1** (próximas iterações)
- Geração por IA de deck inteiro a partir de prompt.
- Export PPTX nativo (precisará de `pptxgenjs` no front).
- Colaboração em tempo real e presenter view com timer.

---

### Notas técnicas
- Novas dependências: `bcryptjs` (na edge function via `npm:`), nada novo no front.
- Bucket `audit-reports` continua, mas deixa de servir links públicos diretos — só via edge function. Migration ajusta política para SELECT só do dono + service_role.
- Adicionar entrada **Slides** no menu principal (sidebar/landing) e rota protegida em `App.tsx`.
- Memória: registrar tema/feature *Slide Generator v1* após pronta.

### Ordem de execução
1. Migration `audit_shares` + ajuste bucket.
2. Edge functions de share/access/revoke.
3. Refator `auditBundle.ts` + UI do painel (senha, revogação, timeline filter, ZIP picker).
4. Página pública `/share/audit/:id`.
5. Migration `slide_decks/slide_pages`.
6. Tipos + store + componentes base do editor.
7. Editor + presenter + grid + export PDF.
8. Rota e link no menu.