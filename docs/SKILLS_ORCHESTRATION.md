# Skills Orchestration — Kubo Vibe Dev

Documento de coordenação entre as skills ativas em `.workspace/skills/`.
Objetivo: garantir handoffs limpos, sem conflito de arquivos e com precedência
determinística quando o usuário aciona múltiplas skills no mesmo prompt.

## Índice de skills ativas

| # | Skill | Domínio | Edita `src/`? | Saída |
|---|---|---|---|---|
| 1 | `kubo-vibedev-ai-system` | Orquestrador raiz (CTO virtual, Smart Economy, WGSL Guardian, RLS) | ✅ primária | código + migrations |
| 2 | `kubo-vibe-3d-websites-engine` | 3D / WebGPU / Three.js / cenas imersivas | ✅ quando 3D ativo | componentes 3D em `src/` |
| 3 | `ai-gateway` | Roteamento LLM (Gemini/GPT/DeepSeek) via Lovable AI | ❌ | edge functions |
| 4 | `product-shot` | Mockups e renders de produto (imagem) | ❌ | `/mnt/documents/*.png` |
| 5 | `video-creator` | Vídeos curtos / roteiros / Remotion | ❌ | `/mnt/documents/*.mp4` |

> Para verificar o índice no sandbox: `ls .workspace/skills/`

## Precedência (quando o prompt cruza skills)

1. **Verbos de mídia** (`vídeo`, `roteiro`, `mockup`, `render de produto`) → `video-creator` ou `product-shot` assumem a entrega final.
2. **3D / cena / WebGPU / Three** → `kubo-vibe-3d-websites-engine` é a skill primária para alterações em `src/`.
3. **Qualquer outro caso** → `kubo-vibedev-ai-system` é a skill primária.
4. `ai-gateway` nunca é primária — é invocada por outras para chamadas LLM.

## Regras de handoff

- **Single-writer no `src/`**: apenas a skill primária pode editar `src/**`. As auxiliares produzem artefatos em `/mnt/documents/` e retornam o caminho.
- **Migrations**: somente `kubo-vibedev-ai-system` cria migrations em `supabase/migrations/**`. Toda nova tabela em `public` exige `GRANT` + `ENABLE RLS` + `POLICY` na mesma migration (validado pelo workflow `post-migration-security`).
- **Scripts temporários** rodam em `/tmp/`, nunca no repo.
- **Segredos**: skills nunca imprimem `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` ou tokens de API.

## Isolamento

| Recurso | Convenção |
|---|---|
| Arquivos temporários | `/tmp/<skill>-<uuid>/` |
| Artefatos finais | `/mnt/documents/` |
| Logs de auditoria | `reports/<skill>/` (gitignored) |
| Edge functions geradas | `supabase/functions/<nome-único>/` |

## Importar uma nova skill via ZIP

1. Suba o ZIP em uploads (UI do Lovable).
2. Extraia para `/tmp/skill-import/` (o agente faz isso via `code--copy` + `unzip`).
3. **Verifique** que não há `.git/` no conteúdo (proibido — quebra commits).
4. Mova `SKILL.md` + assets para `.agents/skills/<nome>/`.
5. Aplique com `skills--apply_draft`.
6. Adicione a linha na tabela "Índice de skills ativas" acima.

> Nota: na execução atual desta auditoria, **nenhum ZIP de skill foi detectado em `/mnt/documents/` ou em uploads**. Caso queira registrar uma nova skill, anexe o ZIP e o agente executará o fluxo acima.
