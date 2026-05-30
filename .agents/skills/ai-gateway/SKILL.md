---
name: ai-gateway
description: Chama modelos AI (texto, JSON estruturado, batch, geração e edição de imagem) a partir de scripts no sandbox via Lovable AI Gateway, sem precisar de API key extra. Use para análises one-off, geração de conteúdo, extração estruturada, batch de prompts ou geração/edição de imagens via CLI.
---

Delegate ao built-in `ai-gateway`. Siga `knowledge://skill/ai-gateway/SKILL.md`: copie `knowledge://skill/ai-gateway/scripts/lovable_ai.py` para `/tmp/lovable_ai.py` e execute via `code--exec`. `LOVABLE_API_KEY` já está provisionada no projeto. Default model: `google/gemini-3-flash-preview`. Sempre escrever artefatos em `/mnt/documents/`. Usar `requests` (nunca `urllib`).
