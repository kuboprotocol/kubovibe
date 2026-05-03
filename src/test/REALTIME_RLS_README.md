# Testes de RLS + Realtime

Valida que:
1. Usuário só lê os próprios `connector_activity_logs` (RLS REST).
2. Usuário não consegue inserir registros com `user_id` alheio (RLS WITH CHECK).
3. Usuário não recebe broadcasts no tópico Realtime privado de outro usuário.

## Como rodar

A edge function `rls-test-create-user` cria 2 usuários efêmeros já confirmados
(usando service role), permitindo logar imediatamente sem confirmação de email.
Ela exige o header `x-test-secret` igual à secret `RLS_TEST_SECRET` (configurada
no Lovable Cloud).

Para rodar localmente, exponha a mesma secret no shell:

```bash
export VITE_RLS_TEST_SECRET="<valor da secret RLS_TEST_SECRET>"
bunx vitest run src/test/realtime-rls.test.ts
```

Sem a variável, os testes são auto-skip (saída verde, com aviso `[skip]`)
para não bloquear o CI quando o segredo não está disponível.
