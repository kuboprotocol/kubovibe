

# Plano: Fallback automático Lovable AI → OpenRouter

## Objetivo
Atualizar a edge function `generate-code` para tentar primeiro a Lovable AI e, se falhar com erro 402 (sem créditos) ou 429 (rate limit), automaticamente fazer fallback para a OpenRouter API.

## Passos

### 1. Armazenar o secret OPENROUTER_API_KEY
Usar a ferramenta `add_secret` para salvar a chave da OpenRouter de forma segura.

### 2. Atualizar `supabase/functions/generate-code/index.ts`
- Tentar primeiro a Lovable AI (gateway atual)
- Se retornar 402 ou 429, tentar automaticamente a OpenRouter (`https://openrouter.ai/api/v1/chat/completions`)
- Usar o mesmo modelo equivalente na OpenRouter (ex: `google/gemini-2.5-flash`)
- Manter streaming SSE em ambos os caminhos
- Log de qual provider foi usado para debugging

### 3. Lógica de fallback (pseudo-código)

```text
1. Chamar Lovable AI Gateway
2. Se response.ok → retornar stream
3. Se status 402 ou 429:
   a. Ler OPENROUTER_API_KEY do env
   b. Chamar OpenRouter API com mesmos messages
   c. Se ok → retornar stream
   d. Se falhar → retornar erro
4. Outros erros → retornar erro 503
```

### Detalhes técnicos
- OpenRouter endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Header: `Authorization: Bearer ${OPENROUTER_API_KEY}`
- Modelo: `google/gemini-2.5-flash` (compatível e disponível na OpenRouter)
- O formato de resposta SSE da OpenRouter é compatível com OpenAI, então o frontend não precisa de mudanças

