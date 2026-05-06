// Teste de integração: sobe o handler em um servidor HTTP local (porta efêmera)
// e valida o contrato de resposta da edge function via fetch real.
//
// Cobre:
//  - 200 OK com schema completo de sessão quando secret correto.
//  - 401 unauthorized quando header x-test-secret está ausente
//    (e nenhum createClient é instanciado).
import { assertEquals, assert, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handle, type CreateClientFn } from './index.ts'

const SECRET = 'integration-test-secret'
const URL_ENV = 'https://example.supabase.co'
const SERVICE = 'service-role-key-INT'
const ANON = 'anon-key-INT'

const fullEnv: Record<string, string> = {
  SUPABASE_URL: URL_ENV,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE,
  SUPABASE_ANON_KEY: ANON,
  RLS_TEST_SECRET: SECRET,
}

function makeFakeClient() {
  return {
    auth: {
      admin: {
        createUser: async () => ({
          data: { user: { id: 'integration-user-id' } },
          error: null,
        }),
      },
      signInWithPassword: async () => ({
        data: {
          session: {
            access_token: 'access-token-int',
            refresh_token: 'refresh-token-int',
          },
        },
        error: null,
      }),
    },
  }
}

interface ServerCtx {
  url: string
  stop: () => Promise<void>
  createClientCalls: number
}

/**
 * Sobe o handler em uma porta efêmera (port: 0 -> SO escolhe livre).
 * Permite injetar um createClient fake e contar chamadas a partir do escopo do server.
 */
async function startServer(env: Record<string, string>): Promise<ServerCtx> {
  let createClientCalls = 0
  const fakeCreateClient: CreateClientFn = () => {
    createClientCalls++
    return makeFakeClient()
  }
  const ac = new AbortController()

  const server = Deno.serve(
    { port: 0, hostname: '127.0.0.1', signal: ac.signal, onListen: () => {} },
    (req) => handle(req, { createClient: fakeCreateClient, getEnv: (n) => env[n] }),
  )

  // Deno.serve retorna { addr } no objeto server (Deno 1.40+).
  const addr = (server as unknown as { addr: { hostname: string; port: number } }).addr
  const url = `http://${addr.hostname}:${addr.port}`

  return {
    url,
    createClientCalls: 0,
    get stop() {
      return async () => {
        ac.abort()
        try { await server.finished } catch { /* ignore */ }
      }
    },
    // proxy dinâmico para counter
    // @ts-ignore add getter
    get _calls() { return createClientCalls },
  } as unknown as ServerCtx & { _calls: number }
}

Deno.test('HTTP integration: 200 OK with full session contract when secret is correct', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const res = await fetch(`${ctx.url}/`, {
      method: 'POST',
      headers: { 'x-test-secret': SECRET, 'content-type': 'application/json' },
    })
    assertEquals(res.status, 200, 'status deve ser 200')
    assertEquals(res.headers.get('content-type'), 'application/json')

    const body = await res.json()

    // Contrato de resposta: todos os campos exigidos pelo cliente de testes.
    assertExists(body.user_id, 'user_id é obrigatório')
    assertExists(body.email, 'email é obrigatório')
    assertExists(body.access_token, 'access_token é obrigatório')
    assertExists(body.refresh_token, 'refresh_token é obrigatório')

    assertEquals(typeof body.user_id, 'string')
    assertEquals(typeof body.email, 'string')
    assertEquals(typeof body.access_token, 'string')
    assertEquals(typeof body.refresh_token, 'string')

    assertEquals(body.user_id, 'integration-user-id')
    assertEquals(body.access_token, 'access-token-int')
    assertEquals(body.refresh_token, 'refresh-token-int')
    assert(body.email.endsWith('@rls-test.kubovibe.dev'), 'email deve usar domínio de teste')

    // Apenas as 4 chaves esperadas — nada de vazar service role/secret.
    assertEquals(
      Object.keys(body).sort(),
      ['access_token', 'email', 'refresh_token', 'user_id'],
    )

    // Dois createClient: admin (service role) + userClient (anon).
    assertEquals(ctx._calls, 2)
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: 401 unauthorized when x-test-secret header is absent', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const res = await fetch(`${ctx.url}/`, { method: 'POST' })
    assertEquals(res.status, 401)
    assertEquals(res.headers.get('content-type'), 'application/json')

    const body = await res.json()
    assertEquals(body, { error: 'unauthorized' })

    // Nenhum cliente instanciado — sem chance de tocar Supabase Admin API.
    assertEquals(ctx._calls, 0, 'createClient não deve ser chamado sem secret')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: 401 unauthorized when x-test-secret is incorrect (no createClient call)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Variantes de secret incorreto: valor errado, vazio, com prefixo/sufixo do válido.
    // (whitespace-only é coberto por teste dedicado abaixo.)
    const wrongSecrets = ['totally-wrong', '', `${SECRET}-extra`, `wrong-${SECRET}`]
    for (const wrong of wrongSecrets) {
      const res = await fetch(`${ctx.url}/`, {
        method: 'POST',
        headers: { 'x-test-secret': wrong, 'content-type': 'application/json' },
      })
      assertEquals(res.status, 401, `secret "${wrong}" deve resultar em 401`)
      assertEquals(res.headers.get('content-type'), 'application/json')
      const body = await res.json()
      assertEquals(body, { error: 'unauthorized' })
    }
    // Nenhuma das tentativas pode instanciar Supabase client.
    assertEquals(ctx._calls, 0, 'createClient não deve ser chamado com secret incorreto')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: whitespace-only x-test-secret (" ") -> 401, body {error:"unauthorized"}, createClientCalls === 0', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const res = await fetch(`${ctx.url}/`, {
      method: 'POST',
      headers: { 'x-test-secret': ' ', 'content-type': 'application/json' },
    })

    // Contrato: status 401
    assertEquals(res.status, 401, 'secret só com whitespace deve ser rejeitado')
    assertEquals(res.headers.get('content-type'), 'application/json')

    // Contrato: body exato
    const body = await res.json()
    assertEquals(body, { error: 'unauthorized' })

    // Contrato: createClient nunca foi chamado
    assertEquals(ctx._calls, 0, 'createClientCalls === 0 — nenhum cliente Supabase instanciado')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: whitespace-only x-test-secret (" ") -> 401 includes CORS headers', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const res = await fetch(`${ctx.url}/`, {
      method: 'POST',
      headers: {
        'x-test-secret': ' ',
        'origin': 'https://app.kubovibe.dev',
        'content-type': 'application/json',
      },
    })

    assertEquals(res.status, 401)

    // CORS obrigatório mesmo em 401, senão o browser bloqueia a leitura do erro.
    assertEquals(res.headers.get('access-control-allow-origin'), '*', 'allow-origin deve ser *')
    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.length > 0, 'allow-headers deve estar presente')
    assert(allowed.includes('x-test-secret'), 'allow-headers deve listar x-test-secret')
    assert(allowed.includes('content-type'), 'allow-headers deve listar content-type')
    assert(allowed.includes('authorization'), 'allow-headers deve listar authorization')

    assertEquals(res.headers.get('content-type'), 'application/json')
    const body = await res.json()
    assertEquals(body, { error: 'unauthorized' })

    assertEquals(ctx._calls, 0, 'createClient não deve ser chamado com secret whitespace-only')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: CORS preflight (OPTIONS) responds 200 with allowed headers', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const res = await fetch(`${ctx.url}/`, { method: 'OPTIONS' })
    assertEquals(res.status, 200)
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.includes('x-test-secret'), 'preflight deve permitir x-test-secret')
    await res.text()
    assertEquals(ctx._calls, 0)
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight returns CORS even with WRONG x-test-secret', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Browser preflight nunca envia o body real; o handler DEVE responder 200
    // com CORS antes de qualquer validação de secret. Caso contrário, o browser
    // bloqueia a request real e o usuário vê erro de CORS em vez de 401.
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'x-test-secret': 'definitely-wrong-secret',
        'origin': 'https://app.kubovibe.dev',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'x-test-secret, content-type',
      },
    })

    assertEquals(res.status, 200, 'preflight deve responder 200 independente do secret')
    assertEquals(res.headers.get('access-control-allow-origin'), '*')

    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.includes('x-test-secret'), 'allow-headers deve listar x-test-secret')
    assert(allowed.includes('content-type'), 'allow-headers deve listar content-type')
    assert(allowed.includes('authorization'), 'allow-headers deve listar authorization')

    // Consome body para evitar resource leak no Deno.
    await res.text()

    // OPTIONS NÃO pode validar secret nem instanciar Supabase client.
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: 401 with wrong secret still includes CORS headers', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const res = await fetch(`${ctx.url}/`, {
      method: 'POST',
      headers: { 'x-test-secret': 'definitely-wrong', 'content-type': 'application/json' },
    })
    assertEquals(res.status, 401)

    // CORS deve estar presente mesmo em respostas de erro (necessário para o
    // browser conseguir LER o status/body 401 vindo de outra origem).
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.includes('x-test-secret'), 'allow-headers deve listar x-test-secret')
    assert(allowed.includes('content-type'), 'allow-headers deve listar content-type')
    assert(allowed.includes('authorization'), 'allow-headers deve listar authorization')

    const body = await res.json()
    assertEquals(body, { error: 'unauthorized' })
    assertEquals(ctx._calls, 0)
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: empty x-test-secret ("") -> 401 unauthorized + CORS, no createClient', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const res = await fetch(`${ctx.url}/`, {
      method: 'POST',
      headers: { 'x-test-secret': '', 'content-type': 'application/json' },
    })
    assertEquals(res.status, 401, 'header vazio deve ser tratado como ausente')
    assertEquals(res.headers.get('content-type'), 'application/json')
    assertEquals(res.headers.get('access-control-allow-origin'), '*')

    const body = await res.json()
    assertEquals(body, { error: 'unauthorized' })
    assertEquals(ctx._calls, 0, 'createClient não deve ser chamado com secret vazio')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: invalid JSON body is tolerated (handler does not parse it)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Secret correto + body claramente malformado: handler não consome body,
    // portanto deve responder 200 normalmente. Garante que não há regressão
    // que comece a parsear req.json() sem proteção.
    const okRes = await fetch(`${ctx.url}/`, {
      method: 'POST',
      headers: { 'x-test-secret': SECRET, 'content-type': 'application/json' },
      body: '{not-json,,,',
    })
    assertEquals(okRes.status, 200)
    assertEquals(okRes.headers.get('access-control-allow-origin'), '*')
    const okBody = await okRes.json()
    assertEquals(typeof okBody.access_token, 'string')

    // Secret errado + body malformado: 401 + CORS, sem tocar createClient extra.
    const callsAfterOk = ctx._calls
    const badRes = await fetch(`${ctx.url}/`, {
      method: 'POST',
      headers: { 'x-test-secret': 'wrong', 'content-type': 'application/json' },
      body: '<<<not-json>>>',
    })
    assertEquals(badRes.status, 401)
    assertEquals(badRes.headers.get('access-control-allow-origin'), '*')
    const badBody = await badRes.json()
    assertEquals(badBody, { error: 'unauthorized' })
    assertEquals(ctx._calls, callsAfterOk, 'sem createClient extra para body inválido + secret errado')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS without Origin header + WRONG x-test-secret still returns CORS headers', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Cenários como curl, scripts server-to-server e alguns clients HTTP
    // não enviam Origin no preflight. O handler DEVE responder CORS mesmo
    // assim e ignorar o secret (preflight é sempre processado antes da auth).
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'x-test-secret': 'definitely-wrong-secret',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'x-test-secret, content-type',
        // Intencionalmente SEM 'origin'
      },
    })

    assertEquals(res.status, 200, 'OPTIONS sem Origin deve responder 200')
    assertEquals(
      res.headers.get('access-control-allow-origin'),
      '*',
      'allow-origin: * deve ser retornado mesmo sem Origin na request',
    )

    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.includes('x-test-secret'), 'allow-headers deve listar x-test-secret')
    assert(allowed.includes('content-type'), 'allow-headers deve listar content-type')
    assert(allowed.includes('authorization'), 'allow-headers deve listar authorization')

    await res.text()

    // Preflight nunca pode validar secret nem instanciar Supabase client.
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS with whitespace-only x-test-secret (" ") returns 200 + CORS, no createClient', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Preflight (OPTIONS) é tratado ANTES da validação de secret. O contrato:
    //   - status SEMPRE 200 (nunca 401), pois browsers descartariam a resposta
    //     real se o preflight falhasse — gerando erro de CORS em vez de 401.
    //   - allow-origin: * e allow-headers presentes mesmo com secret esquisito.
    //   - createClient nunca é chamado em OPTIONS.
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'x-test-secret': ' ',
        'origin': 'https://app.kubovibe.dev',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'x-test-secret, content-type',
      },
    })

    assertEquals(res.status, 200, 'preflight com secret " " deve responder 200, não 401')
    assertEquals(res.headers.get('access-control-allow-origin'), '*')

    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.length > 0, 'allow-headers deve estar presente')
    assert(allowed.includes('x-test-secret'), 'allow-headers deve listar x-test-secret')
    assert(allowed.includes('content-type'), 'allow-headers deve listar content-type')
    assert(allowed.includes('authorization'), 'allow-headers deve listar authorization')

    await res.text()
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: POST with invalid JSON body returns CORS headers (200 with valid secret, 401 with invalid)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // (1) JSON malformado + secret VÁLIDO -> 200 (handler não consome body)
    //     mas a resposta DEVE conter CORS para o browser conseguir lê-la.
    const okRes = await fetch(`${ctx.url}/`, {
      method: 'POST',
      headers: {
        'x-test-secret': SECRET,
        'origin': 'https://app.kubovibe.dev',
        'content-type': 'application/json',
      },
      body: '{this-is-not-valid-json,,,',
    })
    assertEquals(okRes.status, 200)
    assertEquals(okRes.headers.get('access-control-allow-origin'), '*', 'CORS obrigatório em 200')
    const okAllowed = okRes.headers.get('access-control-allow-headers') ?? ''
    assert(okAllowed.includes('x-test-secret'), 'allow-headers deve listar x-test-secret em 200')
    assert(okAllowed.includes('content-type'), 'allow-headers deve listar content-type em 200')
    const okBody = await okRes.json()
    assertEquals(typeof okBody.access_token, 'string')

    const callsAfterOk = ctx._calls

    // (2) JSON malformado + secret INVÁLIDO -> 401 ainda com CORS completo.
    const badRes = await fetch(`${ctx.url}/`, {
      method: 'POST',
      headers: {
        'x-test-secret': 'wrong-secret',
        'origin': 'https://app.kubovibe.dev',
        'content-type': 'application/json',
      },
      body: '<<not-json>>',
    })
    assertEquals(badRes.status, 401)
    assertEquals(badRes.headers.get('access-control-allow-origin'), '*', 'CORS obrigatório em 401')
    const badAllowed = badRes.headers.get('access-control-allow-headers') ?? ''
    assert(badAllowed.includes('x-test-secret'), 'allow-headers deve listar x-test-secret em 401')
    assert(badAllowed.includes('content-type'), 'allow-headers deve listar content-type em 401')
    assert(badAllowed.includes('authorization'), 'allow-headers deve listar authorization em 401')
    assertEquals(badRes.headers.get('content-type'), 'application/json')
    const badBody = await badRes.json()
    assertEquals(badBody, { error: 'unauthorized' })

    // Body inválido + secret errado não pode tocar createClient.
    assertEquals(ctx._calls, callsAfterOk, 'sem createClient extra para body inválido + secret errado')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: bare OPTIONS (no CORS request headers) + WRONG x-test-secret still returns default CORS headers', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Cenário "bare": cliente envia apenas OPTIONS + secret errado, sem nenhum
    // dos headers padrão de preflight (Origin, Access-Control-Request-*).
    // Comum em healthchecks, curl manual e probes server-to-server.
    // Contrato: o handler ignora secret em OPTIONS e responde 200 + CORS default.
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: { 'x-test-secret': 'definitely-wrong-secret' },
    })

    assertEquals(res.status, 200, 'OPTIONS bare deve responder 200 mesmo sem headers CORS')

    // Headers CORS default DEVEM estar presentes independentemente da request.
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.length > 0, 'allow-headers default deve ser retornado')
    assert(allowed.includes('x-test-secret'), 'allow-headers deve listar x-test-secret')
    assert(allowed.includes('content-type'), 'allow-headers deve listar content-type')
    assert(allowed.includes('authorization'), 'allow-headers deve listar authorization')
    assert(allowed.includes('apikey'), 'allow-headers deve listar apikey')

    await res.text()

    // Preflight nunca pode validar secret nem instanciar Supabase client.
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight exposes Access-Control-Allow-Methods (POST, OPTIONS) with blank x-test-secret', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'x-test-secret': ' ',
        'origin': 'https://app.kubovibe.dev',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'x-test-secret, content-type',
      },
    })

    assertEquals(res.status, 200, 'preflight com secret em branco deve responder 200')

    // Allow-Methods: deve listar POST (método real) e OPTIONS (preflight).
    const methods = res.headers.get('access-control-allow-methods') ?? ''
    assert(methods.length > 0, 'allow-methods deve estar presente')
    const upper = methods.toUpperCase()
    assert(upper.includes('POST'), `allow-methods deve listar POST (got: "${methods}")`)
    assert(upper.includes('OPTIONS'), `allow-methods deve listar OPTIONS (got: "${methods}")`)
    // Métodos não suportados não devem ser anunciados (handler só aceita POST).
    assert(!upper.includes('DELETE'), 'allow-methods não deve listar DELETE')
    assert(!upper.includes('PUT'), 'allow-methods não deve listar PUT')

    // Allow-Origin e Allow-Headers continuam corretos.
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.includes('x-test-secret'), 'allow-headers deve listar x-test-secret')
    assert(allowed.includes('content-type'), 'allow-headers deve listar content-type')
    assert(allowed.includes('authorization'), 'allow-headers deve listar authorization')

    await res.text()
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: bare OPTIONS (no CORS request headers) + WRONG x-test-secret returns default Allow-Methods and Max-Age', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Cenário "bare + wrong secret": probes/healthchecks que disparam OPTIONS
    // sem nenhum header de preflight (sem Origin, sem Access-Control-Request-*)
    // e ainda enviam um x-test-secret inválido. O handler DEVE ignorar o secret
    // em OPTIONS e devolver os defaults de CORS — incluindo Allow-Methods e
    // Max-Age — para que o navegador possa cachear o preflight corretamente.
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: { 'x-test-secret': 'definitely-wrong-secret' },
    })

    assertEquals(res.status, 200, 'OPTIONS bare deve responder 200 mesmo com secret errado')

    // Allow-Methods default: POST + OPTIONS, sem métodos não suportados.
    const methods = res.headers.get('access-control-allow-methods') ?? ''
    assert(methods.length > 0, 'allow-methods default deve estar presente')
    const upper = methods.toUpperCase()
    assert(upper.includes('POST'), `allow-methods deve listar POST (got: "${methods}")`)
    assert(upper.includes('OPTIONS'), `allow-methods deve listar OPTIONS (got: "${methods}")`)
    assert(!upper.includes('DELETE'), 'allow-methods não deve listar DELETE')
    assert(!upper.includes('PUT'), 'allow-methods não deve listar PUT')
    assert(!upper.includes('PATCH'), 'allow-methods não deve listar PATCH')

    // Max-Age default: numérico positivo (segundos de cache do preflight).
    const maxAge = res.headers.get('access-control-max-age') ?? ''
    assert(maxAge.length > 0, 'access-control-max-age default deve estar presente')
    const maxAgeNum = Number(maxAge)
    assert(Number.isInteger(maxAgeNum), `max-age deve ser inteiro (got: "${maxAge}")`)
    assert(maxAgeNum > 0, `max-age deve ser positivo (got: ${maxAgeNum})`)

    // Sanidade: outros headers CORS continuam corretos.
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.includes('x-test-secret'), 'allow-headers deve listar x-test-secret')
    assert(allowed.includes('content-type'), 'allow-headers deve listar content-type')

    await res.text()

    // Preflight nunca pode validar secret nem instanciar Supabase client.
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS with CORS headers (Origin + Request-Method) + WRONG x-test-secret returns Allow-Methods and Max-Age', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Cenário "preflight real do navegador": Origin + Access-Control-Request-Method
    // presentes (como qualquer browser envia), mas com x-test-secret inválido.
    // Contrato: handler ignora secret em OPTIONS e responde 200 com Allow-Methods
    // (POST, OPTIONS) e Max-Age para cache do preflight.
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'origin': 'https://app.kubovibe.dev',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-test-secret',
        'x-test-secret': 'definitely-wrong-secret',
      },
    })

    assertEquals(res.status, 200, 'preflight com secret errado deve responder 200')

    // Allow-Methods: POST + OPTIONS, sem métodos não suportados.
    const methods = res.headers.get('access-control-allow-methods') ?? ''
    assert(methods.length > 0, 'allow-methods deve estar presente')
    const upper = methods.toUpperCase()
    assert(upper.includes('POST'), `allow-methods deve listar POST (got: "${methods}")`)
    assert(upper.includes('OPTIONS'), `allow-methods deve listar OPTIONS (got: "${methods}")`)
    assert(!upper.includes('DELETE'), 'allow-methods não deve listar DELETE')
    assert(!upper.includes('PUT'), 'allow-methods não deve listar PUT')
    assert(!upper.includes('PATCH'), 'allow-methods não deve listar PATCH')

    // Max-Age: inteiro positivo.
    const maxAge = res.headers.get('access-control-max-age') ?? ''
    assert(maxAge.length > 0, 'access-control-max-age deve estar presente')
    const maxAgeNum = Number(maxAge)
    assert(Number.isInteger(maxAgeNum), `max-age deve ser inteiro (got: "${maxAge}")`)
    assert(maxAgeNum > 0, `max-age deve ser positivo (got: ${maxAgeNum})`)

    // Sanidade: outros headers CORS continuam corretos.
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.includes('x-test-secret'), 'allow-headers deve listar x-test-secret')
    assert(allowed.includes('content-type'), 'allow-headers deve listar content-type')
    assert(allowed.includes('authorization'), 'allow-headers deve listar authorization')

    await res.text()

    // Preflight nunca pode validar secret nem instanciar Supabase client.
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS with VALID x-test-secret returns Max-Age 86400 and full CORS headers', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Mesmo com secret válido, OPTIONS é preflight: deve devolver os defaults
    // de CORS (incluindo Max-Age 86400) sem chamar createClient. O contrato
    // garante que o cache de preflight do navegador funcione independente da
    // validade do secret.
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'origin': 'https://app.kubovibe.dev',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-test-secret',
        'x-test-secret': SECRET,
      },
    })

    assertEquals(res.status, 200, 'preflight com secret válido deve responder 200')

    // Max-Age: exatamente 86400 (24h) — valor do default em corsHeaders.
    assertEquals(
      res.headers.get('access-control-max-age'),
      '86400',
      'max-age default deve ser 86400 (24h)',
    )

    // Allow-Methods: POST + OPTIONS, sem métodos não suportados.
    const methods = res.headers.get('access-control-allow-methods') ?? ''
    const upper = methods.toUpperCase()
    assert(upper.includes('POST'), `allow-methods deve listar POST (got: "${methods}")`)
    assert(upper.includes('OPTIONS'), `allow-methods deve listar OPTIONS (got: "${methods}")`)
    assert(!upper.includes('DELETE'), 'allow-methods não deve listar DELETE')
    assert(!upper.includes('PUT'), 'allow-methods não deve listar PUT')

    // Allow-Origin wildcard + Allow-Headers completos.
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.includes('x-test-secret'), 'allow-headers deve listar x-test-secret')
    assert(allowed.includes('content-type'), 'allow-headers deve listar content-type')
    assert(allowed.includes('authorization'), 'allow-headers deve listar authorization')
    assert(allowed.includes('apikey'), 'allow-headers deve listar apikey')

    await res.text()

    // Preflight nunca pode instanciar Supabase client, mesmo com secret válido.
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS with Origin + WRONG Access-Control-Request-Method + WRONG x-test-secret still returns expected Allow-Headers', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Cenário: navegador envia preflight para um método NÃO suportado pelo
    // handler (ex.: DELETE) e ainda manda x-test-secret inválido. Mesmo assim,
    // o handler responde 200 com os defaults de CORS — incluindo Allow-Headers
    // completo — porque OPTIONS nunca valida secret nem método solicitado.
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'origin': 'https://app.kubovibe.dev',
        'access-control-request-method': 'DELETE',
        'access-control-request-headers': 'content-type, x-test-secret',
        'x-test-secret': 'definitely-wrong-secret',
      },
    })

    assertEquals(res.status, 200, 'preflight com método errado deve responder 200')

    // Allow-Headers default: deve listar todos os headers aceitos pelo handler.
    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.length > 0, 'allow-headers default deve estar presente')
    assert(allowed.includes('x-test-secret'), 'allow-headers deve listar x-test-secret')
    assert(allowed.includes('content-type'), 'allow-headers deve listar content-type')
    assert(allowed.includes('authorization'), 'allow-headers deve listar authorization')
    assert(allowed.includes('apikey'), 'allow-headers deve listar apikey')
    assert(allowed.includes('x-client-info'), 'allow-headers deve listar x-client-info')

    // Sanidade: outros headers CORS continuam corretos.
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
    const methods = res.headers.get('access-control-allow-methods') ?? ''
    const upper = methods.toUpperCase()
    assert(upper.includes('POST'), `allow-methods deve listar POST (got: "${methods}")`)
    assert(upper.includes('OPTIONS'), `allow-methods deve listar OPTIONS (got: "${methods}")`)
    // Allow-Methods reflete o que o servidor suporta, NÃO o método solicitado.
    assert(!upper.includes('DELETE'), 'allow-methods não deve ecoar DELETE solicitado')

    await res.text()

    // Preflight nunca pode validar secret nem instanciar Supabase client.
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS with VALID x-test-secret — Allow-Headers includes content-type and x-test-secret', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Foco: garantir que o preflight com secret VÁLIDO devolve um
    // Allow-Headers cuja lista de tokens (separados por vírgula) inclui
    // exatamente "content-type" e "x-test-secret" — os dois headers
    // mínimos que o cliente real do app envia em POSTs.
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'origin': 'https://app.kubovibe.dev',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-test-secret',
        'x-test-secret': SECRET,
      },
    })

    assertEquals(res.status, 200, 'preflight com secret válido deve responder 200')

    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.length > 0, 'allow-headers deve estar presente')

    // Parse defensivo: tokeniza por vírgula e normaliza para lowercase/trim,
    // assim o teste não depende de espaçamento ou caixa do header.
    const tokens = allowed
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)

    assert(
      tokens.includes('content-type'),
      `allow-headers deve conter token "content-type" (got: "${allowed}")`,
    )
    assert(
      tokens.includes('x-test-secret'),
      `allow-headers deve conter token "x-test-secret" (got: "${allowed}")`,
    )

    await res.text()

    // Preflight nunca pode instanciar Supabase client.
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS without Origin + WRONG x-test-secret returns full CORS headers (allow-origin + allow-headers)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Cenário server-to-server: cliente envia OPTIONS sem Origin (probes,
    // monitors, curl manual) e ainda passa um x-test-secret inválido. O
    // handler deve devolver 200 + headers CORS default completos para que
    // o contrato de preflight permaneça consistente independentemente do
    // contexto de chamada.
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: { 'x-test-secret': 'definitely-wrong-secret' },
    })

    assertEquals(res.status, 200, 'OPTIONS sem Origin deve responder 200')

    // Allow-Origin: wildcard padrão.
    assertEquals(
      res.headers.get('access-control-allow-origin'),
      '*',
      'allow-origin deve ser "*" mesmo sem Origin na request',
    )

    // Allow-Headers: lista completa via tokens normalizados.
    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.length > 0, 'allow-headers default deve estar presente')
    const tokens = allowed
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)

    assert(tokens.includes('x-test-secret'), `allow-headers deve listar x-test-secret (got: "${allowed}")`)
    assert(tokens.includes('content-type'), `allow-headers deve listar content-type (got: "${allowed}")`)
    assert(tokens.includes('authorization'), `allow-headers deve listar authorization (got: "${allowed}")`)
    assert(tokens.includes('apikey'), `allow-headers deve listar apikey (got: "${allowed}")`)
    assert(tokens.includes('x-client-info'), `allow-headers deve listar x-client-info (got: "${allowed}")`)

    await res.text()

    // Preflight nunca pode validar secret nem instanciar Supabase client.
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS with VALID x-test-secret — Allow-Headers is the static full list, including the requested content-type and x-test-secret tokens', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Contrato atual do handler: o preflight devolve sempre a lista CORS
    // ESTÁTICA completa em Access-Control-Allow-Headers, independente do
    // que o cliente solicita em Access-Control-Request-Headers. Esse é o
    // padrão recomendado para edge functions Supabase.
    //
    // Aqui o cliente solicita explicitamente apenas "content-type" e
    // "x-test-secret". O teste valida que:
    //   1. Esses dois tokens solicitados ESTÃO presentes em Allow-Headers
    //      (sem eles o navegador bloquearia o POST real).
    //   2. Os demais headers default (authorization, apikey, x-client-info)
    //      TAMBÉM estão presentes — confirmando o contrato estático.
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'origin': 'https://app.kubovibe.dev',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-test-secret',
        'x-test-secret': SECRET,
      },
    })

    assertEquals(res.status, 200, 'preflight com secret válido deve responder 200')

    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(allowed.length > 0, 'allow-headers deve estar presente')

    // Tokenização defensiva (case/whitespace-insensitive).
    const tokens = allowed
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)

    // (1) Tokens efetivamente solicitados pelo cliente devem estar autorizados.
    const requested = ['content-type', 'x-test-secret']
    for (const t of requested) {
      assert(
        tokens.includes(t),
        `allow-headers deve conter token solicitado "${t}" (got: "${allowed}")`,
      )
    }

    // (2) Contrato estático: lista completa também é devolvida, mesmo que
    // o cliente não tenha solicitado esses tokens em Request-Headers.
    const staticExtras = ['authorization', 'apikey', 'x-client-info']
    for (const t of staticExtras) {
      assert(
        tokens.includes(t),
        `allow-headers (lista estática) deve conter "${t}" mesmo sem ser solicitado (got: "${allowed}")`,
      )
    }

    // Sanidade dos demais headers CORS.
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
    const methods = (res.headers.get('access-control-allow-methods') ?? '').toUpperCase()
    assert(methods.includes('POST'), `allow-methods deve listar POST (got: "${methods}")`)
    assert(methods.includes('OPTIONS'), `allow-methods deve listar OPTIONS (got: "${methods}")`)

    await res.text()

    // Preflight nunca pode validar secret nem instanciar Supabase client.
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS with VALID x-test-secret — Allow-Methods is exactly "POST, OPTIONS" in canonical order/form', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Contrato: o handler declara estaticamente
    //   'Access-Control-Allow-Methods': 'POST, OPTIONS'
    // em corsHeaders. Esse teste blinda TRÊS propriedades simultaneamente,
    // já que cada uma é importante por uma razão diferente:
    //
    //   (1) Conjunto exato — apenas POST e OPTIONS. Nenhum método extra
    //       (GET/PUT/PATCH/DELETE/HEAD) deve vazar para o cliente, pois
    //       o handler retorna 405 para qualquer um deles.
    //   (2) Ordem canônica — "POST, OPTIONS" (POST primeiro). Alguns
    //       proxies/CDNs fazem cache do preflight indexado pelo valor
    //       literal; mudanças silenciosas de ordem invalidam caches sem
    //       motivo e quebram nosso SLA de <300ms no primeiro POST.
    //   (3) Forma canônica — vírgula + espaço único entre tokens, sem
    //       trailing comma e sem whitespace nas pontas. RFC 7231 §5.3
    //       permite variações, mas fixar a forma evita drift acidental.
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'origin': 'https://app.kubovibe.dev',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-test-secret',
        'x-test-secret': SECRET,
      },
    })

    assertEquals(res.status, 200, 'preflight com secret válido deve responder 200')

    const methods = res.headers.get('access-control-allow-methods')
    assertExists(methods, 'access-control-allow-methods deve estar presente')

    // (3) Forma canônica — comparação literal exata.
    assertEquals(
      methods,
      'POST, OPTIONS',
      `allow-methods deve ser exatamente "POST, OPTIONS" em ordem canônica (got: "${methods}")`,
    )

    // (1) + (2) Conjunto e ordem — validação redundante via tokenização,
    // garante que mesmo se a comparação literal mudar (ex: alguém trocar
    // por valor equivalente), a ordem POST→OPTIONS continue exata.
    const tokens = methods.split(',').map((t) => t.trim())
    assertEquals(
      tokens,
      ['POST', 'OPTIONS'],
      `tokens devem ser exatamente ["POST","OPTIONS"] nesta ordem (got: ${JSON.stringify(tokens)})`,
    )

    // Defesa explícita contra vazamento de métodos não suportados.
    const upper = methods.toUpperCase()
    for (const forbidden of ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
      assert(
        !upper.split(/[\s,]+/).includes(forbidden),
        `allow-methods NÃO deve listar "${forbidden}" — handler retorna 405 (got: "${methods}")`,
      )
    }

    // Sanidade dos demais headers CORS.
    assertEquals(res.headers.get('access-control-allow-origin'), '*')

    await res.text()

    // Preflight nunca pode validar secret nem instanciar Supabase client.
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS with INVALID x-test-secret — preflight is unauthenticated, returns 200 + canonical "POST, OPTIONS" (NOT 401)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Contrato CORS por design (RFC 6454 / Fetch spec):
    //   * Preflight é executado pelo BROWSER antes do POST real.
    //   * O browser NUNCA carrega cabeçalhos de aplicação (como x-test-secret)
    //     dentro do OPTIONS — eles só são enviados na request "real" depois.
    //   * Logo, validar x-test-secret no OPTIONS quebraria todo cliente web,
    //     pois o preflight retornaria 401 e o POST real nunca aconteceria.
    //
    // Este teste BLINDA esse contrato: garante que mesmo um OPTIONS com
    // secret deliberadamente inválido (cenário hostil ou cliente malformado):
    //   (1) responde 200 — NÃO 401/403/405,
    //   (2) Allow-Methods continua exatamente "POST, OPTIONS" em forma canônica,
    //   (3) tokens parseados são exatamente ["POST","OPTIONS"] (ordem fixa),
    //   (4) nenhum método não suportado vaza,
    //   (5) createClient NÃO é chamado (preflight não toca Supabase).
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'origin': 'https://app.kubovibe.dev',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-test-secret',
        'x-test-secret': 'definitely-wrong-secret',
      },
    })

    // (1) Status — preflight é incondicional.
    assertEquals(
      res.status,
      200,
      `OPTIONS com secret inválido DEVE retornar 200 (preflight CORS não autentica), got ${res.status}`,
    )

    const methods = res.headers.get('access-control-allow-methods')
    assertExists(methods, 'access-control-allow-methods deve estar presente mesmo com secret inválido')

    // (2) Forma canônica literal — "POST, OPTIONS" exato.
    assertEquals(
      methods,
      'POST, OPTIONS',
      `allow-methods deve ser exatamente "POST, OPTIONS" (canônico) mesmo com secret inválido (got: "${methods}")`,
    )

    // (3) Tokens em ordem fixa.
    const tokens = methods.split(',').map((t) => t.trim())
    assertEquals(
      tokens,
      ['POST', 'OPTIONS'],
      `tokens devem ser exatamente ["POST","OPTIONS"] nesta ordem (got: ${JSON.stringify(tokens)})`,
    )

    // (4) Nenhum método não suportado.
    const upper = methods.toUpperCase().split(/[\s,]+/).filter(Boolean)
    for (const forbidden of ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
      assert(
        !upper.includes(forbidden),
        `allow-methods NÃO deve listar "${forbidden}" (got: "${methods}")`,
      )
    }

    // Sanidade dos demais headers CORS.
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    assert(
      allowed.toLowerCase().includes('x-test-secret'),
      `allow-headers deve listar x-test-secret mesmo no preflight rejeitado (got: "${allowed}")`,
    )

    await res.text()

    // (5) Preflight nunca instancia o Supabase client — secret nem é lido.
    assertEquals(
      ctx._calls,
      0,
      'OPTIONS jamais deve chamar createClient, mesmo com secret inválido',
    )
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — Allow-Headers is EXACTLY the canonical set, no extras', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Contrato estático declarado em corsHeaders no index.ts:
    //   'Access-Control-Allow-Headers':
    //     'authorization, x-client-info, apikey, content-type, x-test-secret'
    //
    // Esse teste blinda quatro propriedades ao mesmo tempo:
    //   (1) Forma canônica LITERAL — string exata, vírgula + espaço único,
    //       ordem fixa. Proxies/CDNs cacheiam preflight pelo valor literal,
    //       então qualquer drift silencioso invalida cache sem motivo.
    //   (2) Conjunto exato — exatamente os 5 tokens canônicos, nada além.
    //       Vazar tokens não suportados (ex: "x-admin-token") pode iludir
    //       clientes a enviarem headers que o handler simplesmente ignora.
    //   (3) Sem duplicatas — cada token aparece uma única vez.
    //   (4) Sem tokens vazios — nada de trailing/leading comma.
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'origin': 'https://app.kubovibe.dev',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-test-secret',
      },
    })

    assertEquals(res.status, 200, 'preflight deve responder 200')

    const allowed = res.headers.get('access-control-allow-headers')
    assertExists(allowed, 'access-control-allow-headers deve estar presente')

    // (1) Forma canônica literal exata.
    const CANONICAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    assertEquals(
      allowed,
      CANONICAL,
      `allow-headers deve ser EXATAMENTE a string canônica "${CANONICAL}" (got: "${allowed}")`,
    )

    // (2) + (3) + (4) Conjunto exato via tokenização defensiva.
    const tokens = allowed.split(',').map((t) => t.trim().toLowerCase())

    // Sem tokens vazios (defesa contra trailing/leading/double comma).
    for (const t of tokens) {
      assert(t.length > 0, `allow-headers não deve conter tokens vazios (got: "${allowed}")`)
    }

    // Ordem canônica fixa.
    const EXPECTED_ORDERED = [
      'authorization',
      'x-client-info',
      'apikey',
      'content-type',
      'x-test-secret',
    ]
    assertEquals(
      tokens,
      EXPECTED_ORDERED,
      `tokens devem ser exatamente ${JSON.stringify(EXPECTED_ORDERED)} nesta ordem (got: ${JSON.stringify(tokens)})`,
    )

    // (3) Sem duplicatas (Set-size invariant).
    assertEquals(
      new Set(tokens).size,
      tokens.length,
      `allow-headers não deve conter tokens duplicados (got: ${JSON.stringify(tokens)})`,
    )

    // (2) Conjunto fechado — nenhum token "inesperado" presente.
    const ALLOWED_SET = new Set(EXPECTED_ORDERED)
    const FORBIDDEN_SAMPLES = [
      'x-admin-token',
      'x-supabase-auth',
      'cookie',
      'x-forwarded-for',
      'x-real-ip',
      'x-csrf-token',
      'x-api-key',
    ]
    for (const t of tokens) {
      assert(
        ALLOWED_SET.has(t),
        `Token inesperado em allow-headers: "${t}" (canônico: ${JSON.stringify(EXPECTED_ORDERED)})`,
      )
    }
    for (const f of FORBIDDEN_SAMPLES) {
      assert(
        !tokens.includes(f),
        `Token proibido "${f}" não pode aparecer em allow-headers (got: "${allowed}")`,
      )
    }

    // Sanidade dos demais headers CORS.
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
    assertEquals(res.headers.get('access-control-allow-methods'), 'POST, OPTIONS')
    assertEquals(res.headers.get('access-control-max-age'), '86400')

    await res.text()

    // Preflight nunca pode instanciar Supabase client.
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — Allow-Origin is exactly "*" and no unexpected CORS headers leak', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Contrato: corsHeaders declara estaticamente apenas QUATRO chaves CORS:
    //   - Access-Control-Allow-Origin:  "*"
    //   - Access-Control-Allow-Headers: <canonical 5-token list>
    //   - Access-Control-Allow-Methods: "POST, OPTIONS"
    //   - Access-Control-Max-Age:       "86400"
    //
    // Esse teste blinda DUAS propriedades:
    //   (1) Allow-Origin é EXATAMENTE "*" (literal). Não pode ecoar o
    //       Origin recebido, não pode ter espaços/whitespace, não pode
    //       virar "null", e não pode listar múltiplas origens (CORS spec
    //       permite só "*" OU uma única origem; múltiplas violam o RFC).
    //   (2) Nenhum outro header da família "Access-Control-*" vaza além
    //       dos quatro declarados — com destaque para os perigosos:
    //         - Allow-Credentials (incompatível com "*" — vazaria cookies)
    //         - Expose-Headers    (não declarado pelo handler)
    //         - Request-Method/Request-Headers (são REQUEST-side, nunca
    //           devem aparecer em RESPONSE)
    const HOSTILE_ORIGIN = 'https://evil.example.com'
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        // Origin propositalmente "hostil" para garantir que o handler
        // NÃO está ecoando o valor recebido em vez de devolver "*".
        'origin': HOSTILE_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-test-secret',
      },
    })

    assertEquals(res.status, 200, 'preflight deve responder 200')

    // (1) Allow-Origin literal exato.
    const origin = res.headers.get('access-control-allow-origin')
    assertEquals(
      origin,
      '*',
      `allow-origin deve ser EXATAMENTE "*" (got: "${origin}")`,
    )
    assert(
      origin !== HOSTILE_ORIGIN,
      'allow-origin NÃO pode ecoar o Origin recebido (risco de bypass de CORS)',
    )
    assert(
      origin !== 'null',
      'allow-origin NÃO pode ser a string "null" (vazaria a contextos opaque)',
    )
    assert(
      !/[, ]/.test(origin!),
      `allow-origin NÃO pode conter vírgula ou espaço (CORS spec proíbe múltiplas origens) (got: "${origin}")`,
    )

    // (2) Whitelist de headers Access-Control-* esperados na RESPOSTA.
    // Tudo que estiver fora dessa lista é regressão.
    const ALLOWED_RESPONSE_HEADERS = new Set([
      'access-control-allow-origin',
      'access-control-allow-headers',
      'access-control-allow-methods',
      'access-control-max-age',
    ])

    // Headers explicitamente PROIBIDOS na resposta — cada um por um motivo
    // de segurança/conformidade distinto, validados individualmente para
    // mensagem de erro precisa.
    const FORBIDDEN_RESPONSE_HEADERS: Array<[string, string]> = [
      [
        'access-control-allow-credentials',
        'incompatível com Allow-Origin "*" — combinação rejeitada por todos os browsers e vazaria cookies/auth',
      ],
      [
        'access-control-expose-headers',
        'handler não declara Expose-Headers; presença indica drift acidental',
      ],
      [
        'access-control-request-method',
        'header REQUEST-side; jamais deve aparecer em resposta',
      ],
      [
        'access-control-request-headers',
        'header REQUEST-side; jamais deve aparecer em resposta',
      ],
    ]

    for (const [forbidden, reason] of FORBIDDEN_RESPONSE_HEADERS) {
      assertEquals(
        res.headers.get(forbidden),
        null,
        `Header proibido "${forbidden}" presente na resposta — ${reason}`,
      )
    }

    // Varredura geral: enumera TODOS os headers da resposta e falha se
    // achar algum "access-control-*" fora da whitelist. Isso captura
    // headers desconhecidos/futuros que possam ser introduzidos por
    // engano (ex: alguém adicionando "access-control-allow-private-network").
    const unexpected: string[] = []
    for (const [name] of res.headers) {
      const lower = name.toLowerCase()
      if (lower.startsWith('access-control-') && !ALLOWED_RESPONSE_HEADERS.has(lower)) {
        unexpected.push(lower)
      }
    }
    assertEquals(
      unexpected,
      [],
      `Headers Access-Control-* inesperados na resposta: ${JSON.stringify(unexpected)}`,
    )

    // Sanidade dos quatro headers CORS canônicos (presença obrigatória).
    assertExists(res.headers.get('access-control-allow-headers'), 'Allow-Headers obrigatório ausente')
    assertEquals(res.headers.get('access-control-allow-methods'), 'POST, OPTIONS')
    assertEquals(res.headers.get('access-control-max-age'), '86400')

    await res.text()

    // Preflight nunca pode instanciar Supabase client.
    assertEquals(ctx._calls, 0, 'OPTIONS jamais deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — Access-Control-Allow-Credentials MUST be absent', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Por que esse teste é DEDICADO (e não só uma asserção dentro de outro):
    //   * `Allow-Credentials: true` combinado com `Allow-Origin: "*"` é
    //     EXPLICITAMENTE rejeitado pela CORS spec (Fetch §3.2). Browsers
    //     bloqueiam a resposta inteira, derrubando 100% dos clientes.
    //   * Mesmo com origem específica, habilitar credentials nessa edge
    //     vazaria cookies/Authorization para qualquer página que faça
    //     cross-origin request — risco de CSRF amplificado.
    //   * O handler NUNCA declara esse header em corsHeaders. Esse teste
    //     blinda contra adição acidental futura (ex: copiar/colar de outra
    //     edge function que precise de auth com cookie).
    //
    // Validação tripla para máxima robustez:
    //   (1) headers.get(...) === null em ambos OPTIONS comum e POST (caminho
    //       de erro), pois Allow-Credentials, se vazasse, viria de corsHeaders
    //       e contaminaria TODAS as respostas, não só o preflight.
    //   (2) Iteração case-insensitive sobre todos os headers para detectar
    //       qualquer variação de capitalização que pudesse escapar do .get().
    //   (3) Valor literal — se um dia alguém adicionar com valor "false",
    //       ainda assim falhamos, pois a spec não permite o header com NENHUM
    //       valor numa resposta com Allow-Origin "*".

    // ----- Cenário A: OPTIONS preflight -----
    const preflight = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'origin': 'https://app.kubovibe.dev',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-test-secret',
      },
    })
    assertEquals(preflight.status, 200, 'preflight deve responder 200')

    // (1) .get() direto.
    assertEquals(
      preflight.headers.get('access-control-allow-credentials'),
      null,
      'OPTIONS: Access-Control-Allow-Credentials NÃO pode estar presente (incompatível com Allow-Origin "*")',
    )

    // (2) Varredura case-insensitive — protege contra Headers que retornem
    // capitalização diferente (browsers normalizam, mas reverse-proxies podem
    // injetar variantes mistas tipo "Access-Control-Allow-Credentials").
    const preflightLeak: string[] = []
    for (const [name, value] of preflight.headers) {
      if (name.toLowerCase() === 'access-control-allow-credentials') {
        preflightLeak.push(`${name}=${value}`)
      }
    }
    assertEquals(
      preflightLeak,
      [],
      `OPTIONS: nenhum cabeçalho Allow-Credentials (qualquer capitalização) é permitido — vazamentos: ${JSON.stringify(preflightLeak)}`,
    )

    await preflight.text()

    // ----- Cenário B: POST com secret inválido (caminho de erro 401) -----
    // Garante que a mesma proteção vale fora do preflight, já que o header,
    // se adicionado por engano, viria do spread {...corsHeaders} usado em
    // TODAS as respostas (json() helper), não só no OPTIONS.
    const errResp = await fetch(`${ctx.url}/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-secret': 'wrong-secret',
      },
      body: JSON.stringify({ email: 'a@b.com', password: 'pw' }),
    })
    assertEquals(errResp.status, 401, 'POST com secret errado deve retornar 401')
    assertEquals(
      errResp.headers.get('access-control-allow-credentials'),
      null,
      'POST 401: Access-Control-Allow-Credentials NÃO pode estar presente em respostas de erro',
    )
    const errLeak: string[] = []
    for (const [name, value] of errResp.headers) {
      if (name.toLowerCase() === 'access-control-allow-credentials') {
        errLeak.push(`${name}=${value}`)
      }
    }
    assertEquals(
      errLeak,
      [],
      `POST 401: nenhum cabeçalho Allow-Credentials permitido — vazamentos: ${JSON.stringify(errLeak)}`,
    )
    await errResp.text()

    // Sanidade: o preflight ainda devolve Allow-Origin "*" (combinação que
    // PRECISA estar livre de Allow-Credentials para ser válida).
    assertEquals(preflight.headers.get('access-control-allow-origin'), '*')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — Vary: Origin and Access-Control-Expose-Headers MUST be absent', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Por que esse teste é DEDICADO:
    //   * `Vary: Origin` só faz sentido quando o handler ECOA o Origin recebido
    //     (resposta dependente de input). Como esta edge devolve `Allow-Origin: "*"`
    //     ESTÁTICO, declarar `Vary: Origin` é incorreto: induz proxies/CDNs a
    //     fragmentar o cache por origem desnecessariamente, degradando hit-rate
    //     e mascarando bugs de cache. Deve estar ausente.
    //   * `Access-Control-Expose-Headers` só deve ser declarado quando o handler
    //     intencionalmente expõe headers customizados ao JS do browser (além da
    //     CORS-safelist). O handler NÃO expõe nada custom — declarar esse header
    //     vazaria a superfície de resposta e poderia acidentalmente expor
    //     identificadores internos a clientes cross-origin.
    //
    // Validação dupla por header:
    //   (1) headers.get(name) === null
    //   (2) Iteração case-insensitive sobre todos os headers, garantindo que
    //       nenhuma variante de capitalização escape do .get().

    const preflight = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'origin': 'https://app.kubovibe.dev',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-test-secret',
      },
    })
    assertEquals(preflight.status, 200, 'preflight deve responder 200')

    // (1) .get() direto — Vary NÃO deve listar "Origin" (o runtime pode injetar
    // `Vary: Accept-Encoding` automaticamente para negociação de compressão; isso
    // é OK e independe do handler. O que NÃO pode aparecer é "Origin", pois
    // Allow-Origin é estático "*").
    const varyHeader = preflight.headers.get('vary')
    if (varyHeader !== null) {
      const tokens = varyHeader.split(',').map((t) => t.trim().toLowerCase())
      assertEquals(
        tokens.includes('origin'),
        false,
        `OPTIONS: Vary NÃO pode listar "Origin" — Allow-Origin é estático "*". Vary recebido: "${varyHeader}"`,
      )
      assertEquals(
        tokens.includes('*'),
        false,
        `OPTIONS: Vary NÃO pode ser "*" — força revalidação total no cache. Vary recebido: "${varyHeader}"`,
      )
    }

    // (1) .get() direto — Expose-Headers
    assertEquals(
      preflight.headers.get('access-control-expose-headers'),
      null,
      'OPTIONS: Access-Control-Expose-Headers NÃO pode estar presente — handler não expõe headers custom',
    )

    // (2) Varredura case-insensitive — detecta qualquer variante de
    // Access-Control-Expose-Headers (não verificamos Vary aqui pois pode conter
    // tokens legítimos como Accept-Encoding injetados pelo runtime).
    const leaks: string[] = []
    for (const [name, value] of preflight.headers) {
      if (name.toLowerCase() === 'access-control-expose-headers') {
        leaks.push(`${name}=${value}`)
      }
    }
    assertEquals(
      leaks,
      [],
      `OPTIONS: nenhum cabeçalho Access-Control-Expose-Headers permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(leaks)}`,
    )

    await preflight.text()

    // Sanidade: o preflight retorna Allow-Origin "*" estático (justifica ausência de Vary).
    assertEquals(preflight.headers.get('access-control-allow-origin'), '*')
    assertEquals(ctx._calls, 0, 'preflight nunca deve chamar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: POST responses (200 success + 401 unauthorized) MUST NOT include Access-Control-Allow-Credentials', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Por que esse teste é DEDICADO ao caminho POST (e não só ao OPTIONS):
    //   * `corsHeaders` é spreadado em TODAS as respostas via o helper json(),
    //     então um vazamento acidental de Allow-Credentials apareceria igual
    //     em sucesso (200) e erro (401). Validar ambos os caminhos blinda
    //     contra qualquer divergência futura entre branches do handler.
    //   * Allow-Credentials: true + Allow-Origin: "*" é REJEITADO pela CORS
    //     spec (Fetch §3.2). Qualquer resposta — preflight, sucesso ou erro —
    //     com essa combinação seria bloqueada pelo browser, derrubando 100%
    //     dos clientes cross-origin.
    //   * Como o handler nunca usa cookies/Authorization auto-enviados pelo
    //     browser, habilitar credentials seria também uma vulnerabilidade
    //     CSRF amplificada. Esse contrato precisa ser blindado nos dois
    //     status codes mais comuns do endpoint (sucesso + falha de auth).
    //
    // Validação dupla por resposta:
    //   (1) headers.get(...) === null
    //   (2) Iteração case-insensitive sobre todos os headers (protege contra
    //       capitalização não-canônica vinda de reverse-proxies).

    // ----- Cenário A: POST 200 (secret correto) -----
    const okRes = await fetch(`${ctx.url}/`, {
      method: 'POST',
      headers: {
        'x-test-secret': SECRET,
        'content-type': 'application/json',
        // Origin presente intencionalmente — reproduz cenário real cross-origin
        // onde o browser AVALIA Allow-Credentials junto com Allow-Origin "*".
        'origin': 'https://app.kubovibe.dev',
      },
    })
    assertEquals(okRes.status, 200, 'POST com secret correto deve retornar 200')

    assertEquals(
      okRes.headers.get('access-control-allow-credentials'),
      null,
      'POST 200: Access-Control-Allow-Credentials NÃO pode estar presente (incompatível com Allow-Origin "*")',
    )
    const okLeak: string[] = []
    for (const [name, value] of okRes.headers) {
      if (name.toLowerCase() === 'access-control-allow-credentials') {
        okLeak.push(`${name}=${value}`)
      }
    }
    assertEquals(
      okLeak,
      [],
      `POST 200: nenhum cabeçalho Allow-Credentials permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(okLeak)}`,
    )
    // Sanidade: a resposta de sucesso ainda devolve Allow-Origin "*" — combinação
    // que SÓ é válida na ausência de Allow-Credentials.
    assertEquals(okRes.headers.get('access-control-allow-origin'), '*')
    await okRes.text()

    // ----- Cenário B: POST 401 (secret errado) -----
    const errRes = await fetch(`${ctx.url}/`, {
      method: 'POST',
      headers: {
        'x-test-secret': 'definitely-wrong-secret',
        'content-type': 'application/json',
        'origin': 'https://app.kubovibe.dev',
      },
      body: JSON.stringify({ email: 'a@b.com', password: 'pw' }),
    })
    assertEquals(errRes.status, 401, 'POST com secret errado deve retornar 401')

    assertEquals(
      errRes.headers.get('access-control-allow-credentials'),
      null,
      'POST 401: Access-Control-Allow-Credentials NÃO pode estar presente em respostas de erro',
    )
    const errLeak: string[] = []
    for (const [name, value] of errRes.headers) {
      if (name.toLowerCase() === 'access-control-allow-credentials') {
        errLeak.push(`${name}=${value}`)
      }
    }
    assertEquals(
      errLeak,
      [],
      `POST 401: nenhum cabeçalho Allow-Credentials permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(errLeak)}`,
    )
    assertEquals(errRes.headers.get('access-control-allow-origin'), '*')
    await errRes.text()
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: cross-origin GET response MUST NOT include Access-Control-Allow-Credentials', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Por que esse teste cobre GET (método NÃO suportado pelo handler):
    //   * O contrato real do handler é responder 405 (`method_not_allowed`)
    //     para qualquer método != POST/OPTIONS. O usuário pediu validação
    //     "200 ou 404" como guarda-chuva genérico — espelhamos o comportamento
    //     real (405) e aceitamos qualquer status >= 200 < 500, pois o que
    //     importa para esse teste é o CONTRATO DE HEADERS, não o status code.
    //   * Mesmo num caminho de erro (405), `corsHeaders` é spreadado via json(),
    //     então qualquer vazamento acidental de Allow-Credentials apareceria.
    //     Precisamos blindar TODOS os métodos HTTP, não apenas POST/OPTIONS.
    //   * Allow-Credentials: true + Allow-Origin: "*" é REJEITADO pela CORS
    //     spec (Fetch §3.2). Browsers bloqueariam a resposta inteira mesmo
    //     em métodos não-suportados, mascarando o 405 com erro de CORS.
    //
    // Validação dupla:
    //   (1) headers.get(...) === null
    //   (2) Iteração case-insensitive (protege contra reverse-proxies que
    //       reescrevem capitalização de headers).

    const res = await fetch(`${ctx.url}/`, {
      method: 'GET',
      headers: {
        // Origin presente — reproduz cenário cross-origin real onde o
        // browser AVALIA Allow-Credentials junto com Allow-Origin "*".
        'origin': 'https://hostile.example.com',
      },
    })

    // Sanidade: status deve ser uma resposta HTTP válida (não 5xx). O handler
    // real retorna 405; aceitamos 200/404/405 para cobrir evolução futura
    // (ex: adicionar GET de health-check).
    if (res.status >= 500) {
      throw new Error(`GET retornou ${res.status}, esperado < 500 (handler real retorna 405)`)
    }

    // (1) .get() direto — proteção primária.
    assertEquals(
      res.headers.get('access-control-allow-credentials'),
      null,
      `GET ${res.status}: Access-Control-Allow-Credentials NÃO pode estar presente em resposta cross-origin (incompatível com Allow-Origin "*")`,
    )

    // (2) Varredura case-insensitive — captura variantes capitalizadas
    // (ex: "Access-Control-Allow-Credentials") que possam escapar de .get().
    const leaks: string[] = []
    for (const [name, value] of res.headers) {
      if (name.toLowerCase() === 'access-control-allow-credentials') {
        leaks.push(`${name}=${value}`)
      }
    }
    assertEquals(
      leaks,
      [],
      `GET ${res.status}: nenhum cabeçalho Allow-Credentials permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(leaks)}`,
    )

    // Sanidade do contrato CORS: a resposta cross-origin DEVE devolver
    // Allow-Origin "*" estático (combinação que SÓ é válida na ausência
    // de Allow-Credentials — o que acabamos de provar acima).
    assertEquals(
      res.headers.get('access-control-allow-origin'),
      '*',
      'GET cross-origin: Allow-Origin deve ser "*" estático (não ecoar Origin do request)',
    )

    // GET não invoca createClient (handler rejeita método antes).
    assertEquals(ctx._calls, 0, 'GET não-suportado nunca deve chamar createClient')

    await res.text()
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: POST 401 (permission denied) MUST NOT include Allow-Credentials and MUST keep Allow-Origin "*"', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Por que 401 (e não 403):
    //   * O handler `rls-test-create-user` NÃO tem branch que retorne 403
    //     hoje. Seu único caminho de "permissão negada" é o 401, disparado
    //     quando o `x-test-secret` é inválido/ausente. Espelhamos o
    //     comportamento real em vez de inventar mocks artificiais.
    //   * Esse teste é DEDICADO ao contrato CORS no caminho de erro de
    //     autorização, complementando os testes existentes de POST 200/401
    //     genéricos. Aqui validamos o par EXATO Allow-Origin "*" + ausência
    //     de Allow-Credentials, que é a combinação CORS-spec-compliant.
    //
    // Por que o par precisa ser validado JUNTO:
    //   * Allow-Credentials: true + Allow-Origin: "*" = REJEITADO pela
    //     spec (Fetch §3.2). Browsers descartam a resposta inteira.
    //   * Allow-Origin que ECOA Origin do request (não "*" estático) +
    //     Allow-Credentials: true = válido pela spec, mas vazaria cookies
    //     a qualquer origem que faça o request (CSRF amplificado).
    //   * O handler usa "*" estático — então Allow-Credentials DEVE estar
    //     ausente, e Allow-Origin DEVE permanecer "*" mesmo no caminho de erro.
    //
    // Validação tripla:
    //   (1) headers.get('access-control-allow-credentials') === null
    //   (2) Iteração case-insensitive (protege contra capitalização variante).
    //   (3) headers.get('access-control-allow-origin') === '*' literal exato
    //       (não ecoa Origin recebido, não "null", sem vírgulas/espaços).

    const HOSTILE_ORIGIN = 'https://attacker.example.com'

    const res = await fetch(`${ctx.url}/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-secret': 'wrong-secret-permission-denied',
        // Origin presente — reproduz cenário cross-origin real onde o
        // browser AVALIA Allow-Credentials + Allow-Origin juntos.
        'origin': HOSTILE_ORIGIN,
      },
      body: JSON.stringify({ email: 'a@b.com', password: 'pw' }),
    })

    assertEquals(res.status, 401, 'POST com secret inválido deve retornar 401 (permission denied)')

    // (1) .get() direto — Allow-Credentials ausente.
    assertEquals(
      res.headers.get('access-control-allow-credentials'),
      null,
      'POST 401: Access-Control-Allow-Credentials NÃO pode estar presente em resposta de permissão negada',
    )

    // (2) Varredura case-insensitive — captura variantes capitalizadas
    // que possam escapar do .get().
    const leaks: string[] = []
    for (const [name, value] of res.headers) {
      if (name.toLowerCase() === 'access-control-allow-credentials') {
        leaks.push(`${name}=${value}`)
      }
    }
    assertEquals(
      leaks,
      [],
      `POST 401: nenhum cabeçalho Allow-Credentials permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(leaks)}`,
    )

    // (3) Allow-Origin permanece exatamente "*" — NÃO ecoa o Origin hostil,
    // NÃO vira "null", NÃO contém vírgulas/espaços (CORS spec proíbe múltiplas
    // origens num único header).
    const allowOrigin = res.headers.get('access-control-allow-origin')
    assertEquals(
      allowOrigin,
      '*',
      `POST 401: Allow-Origin deve ser exatamente "*" literal, recebido: ${JSON.stringify(allowOrigin)}`,
    )
    // Sanidade defensiva: garante que o handler NÃO ecoou o Origin hostil
    // (vetor clássico de CORS misconfig).
    if (allowOrigin === HOSTILE_ORIGIN) {
      throw new Error(`POST 401: Allow-Origin ECOOU o Origin hostil "${HOSTILE_ORIGIN}" — falha crítica de CORS`)
    }

    // Sanidade do contrato: 401 ainda devolve JSON estruturado.
    assertEquals(res.headers.get('content-type'), 'application/json')
    const body = await res.json()
    assertExists(body.error, '401 deve retornar payload com campo error')
  } finally {
    await ctx.stop()
  }
})
