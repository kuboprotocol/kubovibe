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

Deno.test('HTTP integration: cross-origin HEAD request MUST NOT include Allow-Credentials and MUST keep Allow-Origin "*"', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Por que HEAD merece teste DEDICADO (além de GET):
    //   * HEAD é frequentemente usado por health-checkers, monitores, crawlers
    //     e proxies para validar disponibilidade SEM baixar o body. Mesmo que
    //     o handler responda 405 (método não suportado), o contrato CORS DEVE
    //     ser idêntico aos demais métodos — Allow-Origin "*" estático e
    //     Allow-Credentials AUSENTE.
    //   * Diferente de GET, respostas a HEAD por spec NÃO devem ter body, mas
    //     PODEM (e devem) carregar todos os response headers como se fosse o
    //     GET equivalente. Isso significa que `corsHeaders` ainda é spreadado
    //     via json() mesmo no caminho 405, e qualquer vazamento de
    //     Allow-Credentials apareceria aqui.
    //   * Browsers AVALIAM Allow-Credentials + Allow-Origin "*" no caminho de
    //     HEAD cross-origin do mesmo jeito que avaliam para GET/POST. A
    //     combinação inválida bloquearia a resposta inteira, mascarando 405
    //     com erro genérico de CORS.
    //
    // Validação tripla:
    //   (1) headers.get('access-control-allow-credentials') === null
    //   (2) Iteração case-insensitive sobre todos os headers (protege contra
    //       reverse-proxies que normalizam capitalização de forma diferente).
    //   (3) headers.get('access-control-allow-origin') === '*' literal (não
    //       ecoa Origin recebido, não vira "null", sem vírgulas/espaços).

    const HOSTILE_ORIGIN = 'https://attacker.example.com'

    const res = await fetch(`${ctx.url}/`, {
      method: 'HEAD',
      headers: {
        // Origin presente — reproduz cenário cross-origin real onde o browser
        // AVALIA Allow-Credentials + Allow-Origin juntos. Sem Origin, o browser
        // nem checa CORS, então o teste perderia o sinal.
        'origin': HOSTILE_ORIGIN,
      },
    })

    // Sanidade: HEAD não-suportado deve retornar 4xx (handler real: 405).
    // Aceitamos qualquer < 500 para tolerar evolução futura (ex: health-check
    // que aceite HEAD com 200). Se for >= 500, é bug independente.
    if (res.status >= 500) {
      // Drena o body antes de lançar para evitar resource leak.
      try { await res.body?.cancel() } catch { /* ignore */ }
      throw new Error(`HEAD retornou ${res.status}, esperado < 500 (handler real retorna 405)`)
    }

    // (1) .get() direto — Allow-Credentials ausente.
    assertEquals(
      res.headers.get('access-control-allow-credentials'),
      null,
      `HEAD ${res.status}: Access-Control-Allow-Credentials NÃO pode estar presente em resposta cross-origin (incompatível com Allow-Origin "*")`,
    )

    // (2) Varredura case-insensitive — captura variantes capitalizadas
    // que possam escapar de .get().
    const leaks: string[] = []
    for (const [name, value] of res.headers) {
      if (name.toLowerCase() === 'access-control-allow-credentials') {
        leaks.push(`${name}=${value}`)
      }
    }
    assertEquals(
      leaks,
      [],
      `HEAD ${res.status}: nenhum cabeçalho Allow-Credentials permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(leaks)}`,
    )

    // (3) Allow-Origin permanece exatamente "*" — NÃO ecoa o Origin hostil,
    // NÃO vira "null", NÃO contém vírgulas/espaços.
    const allowOrigin = res.headers.get('access-control-allow-origin')
    assertEquals(
      allowOrigin,
      '*',
      `HEAD ${res.status}: Allow-Origin deve ser exatamente "*" literal, recebido: ${JSON.stringify(allowOrigin)}`,
    )
    // Sanidade defensiva: garante que o handler NÃO ecoou o Origin hostil
    // (vetor clássico de CORS misconfig).
    if (allowOrigin === HOSTILE_ORIGIN) {
      throw new Error(`HEAD ${res.status}: Allow-Origin ECOOU o Origin hostil "${HOSTILE_ORIGIN}" — falha crítica de CORS`)
    }

    // HEAD não-suportado nunca invoca createClient (handler rejeita método antes).
    assertEquals(ctx._calls, 0, 'HEAD não-suportado nunca deve chamar createClient')

    // Drena qualquer body residual (HEAD por spec não tem body, mas algumas
    // implementações enviam Content-Length sem payload — drenar é seguro).
    try { await res.body?.cancel() } catch { /* ignore */ }
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight cross-origin — no Allow-Credentials, Allow-Origin "*", no cookies, sane CORS cache, status in valid HTTP range', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Esse teste consolida 4 contratos críticos do preflight cross-origin:
    //
    //   (A) Allow-Credentials AUSENTE + Allow-Origin "*" literal exato.
    //       Combinação CORS-spec-compliant (Fetch §3.2). Sem isso o browser
    //       descarta a resposta inteira.
    //
    //   (B) Ausência total de cookies (Set-Cookie / Set-Cookie2) no preflight.
    //       Preflights NUNCA devem setar cookies — eles são pings de capability,
    //       não fluxos autenticados. Setar cookie aqui pode (i) vazar sessão a
    //       origem cross-origin, (ii) ser silenciosamente descartado pelo browser
    //       (cookies em preflight são ignorados pela spec), criando confusão
    //       entre dev e produção.
    //
    //   (C) Cache CORS sano:
    //         * `Max-Age: 86400` presente (1 dia — evita preflight a cada call,
    //           reduzindo latência e custo).
    //         * Sem `Vary: Origin` (o handler devolve "*" estático, então
    //           variar por Origin fragmentaria cache desnecessariamente em
    //           CDNs/proxies).
    //         * Sem `Vary: Cookie` (preflight não lê cookies; declarar isso
    //           induziria proxies a fragmentar cache por sessão, derrubando
    //           hit-rate).
    //
    //   (D) Status code numa faixa HTTP válida (100–599). HTTP não define 6xx;
    //       guarda defensiva contra qualquer código fora do range causado por
    //       bug de runtime (ex: Response construído com status 600 jogaria
    //       TypeError no Deno, mas blindamos aqui também).
    //
    // Por que CONSOLIDAR num único teste: os 4 contratos são intrinsecamente
    // ligados ao caminho de preflight. Separá-los multiplicaria setup/teardown
    // (cada teste sobe um servidor) sem ganho de granularidade — se qualquer
    // um falhar, o vazamento é local ao mesmo branch do handler.

    const HOSTILE_ORIGIN = 'https://attacker.example.com'

    const preflight = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'origin': HOSTILE_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-test-secret',
        // Cookie no request — alguns clientes mandam mesmo em preflight
        // (browsers não, mas curl/proxy podem). Garante que o handler
        // não REFLETE cookie de volta via Set-Cookie.
        'cookie': 'session=stolen-session-id; tracking=hostile-value',
      },
    })

    // ----- (D) Faixa de status HTTP válida (100–599) -----
    // HTTP não define 6xx. Se algum dia o handler retornar status fora da
    // faixa, capturamos aqui antes de qualquer outra asserção.
    if (preflight.status < 100 || preflight.status >= 600) {
      throw new Error(
        `OPTIONS retornou status ${preflight.status}, fora da faixa HTTP válida (100–599). ` +
        `HTTP não define códigos 6xx — handler real deve responder 200.`,
      )
    }
    assertEquals(preflight.status, 200, 'preflight cross-origin deve responder 200')

    // ----- (A) Allow-Credentials ausente + Allow-Origin "*" literal -----
    assertEquals(
      preflight.headers.get('access-control-allow-credentials'),
      null,
      'OPTIONS: Access-Control-Allow-Credentials NÃO pode estar presente (incompatível com Allow-Origin "*")',
    )
    const credLeak: string[] = []
    for (const [name, value] of preflight.headers) {
      if (name.toLowerCase() === 'access-control-allow-credentials') {
        credLeak.push(`${name}=${value}`)
      }
    }
    assertEquals(credLeak, [], `OPTIONS: nenhum Allow-Credentials permitido — vazamentos: ${JSON.stringify(credLeak)}`)

    const allowOrigin = preflight.headers.get('access-control-allow-origin')
    assertEquals(
      allowOrigin,
      '*',
      `OPTIONS: Allow-Origin deve ser exatamente "*" literal, recebido: ${JSON.stringify(allowOrigin)}`,
    )
    if (allowOrigin === HOSTILE_ORIGIN) {
      throw new Error(`OPTIONS: Allow-Origin ECOOU o Origin hostil "${HOSTILE_ORIGIN}" — falha crítica de CORS`)
    }

    // ----- (B) Ausência total de cookies -----
    assertEquals(
      preflight.headers.get('set-cookie'),
      null,
      'OPTIONS: preflight NUNCA deve setar cookies (Set-Cookie ausente)',
    )
    assertEquals(
      preflight.headers.get('set-cookie2'),
      null,
      'OPTIONS: preflight NUNCA deve setar cookies legacy (Set-Cookie2 ausente)',
    )
    const cookieLeak: string[] = []
    for (const [name, value] of preflight.headers) {
      const lower = name.toLowerCase()
      if (lower === 'set-cookie' || lower === 'set-cookie2') {
        cookieLeak.push(`${name}=${value}`)
      }
    }
    assertEquals(
      cookieLeak,
      [],
      `OPTIONS: nenhum cabeçalho de cookie permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(cookieLeak)}`,
    )

    // ----- (C) Cache CORS sano -----
    // (C.1) Max-Age presente e razoável (handler usa 86400 = 1 dia).
    const maxAge = preflight.headers.get('access-control-max-age')
    assertEquals(
      maxAge,
      '86400',
      `OPTIONS: Max-Age deve ser "86400" (1 dia) para reduzir preflights repetidos. Recebido: ${JSON.stringify(maxAge)}`,
    )
    // Sanidade numérica defensiva — não pode ser 0 (desabilita cache) nem
    // negativo (browsers rejeitam).
    const maxAgeNum = Number(maxAge)
    if (!Number.isFinite(maxAgeNum) || maxAgeNum <= 0) {
      throw new Error(`OPTIONS: Max-Age inválido para cache (${maxAge}). Deve ser inteiro positivo.`)
    }

    // (C.2) Sem Vary: Origin nem Vary: Cookie — Allow-Origin é "*" estático
    // e o handler não lê cookies. Tolera Vary: Accept-Encoding (injetado pelo
    // runtime para negociação de compressão, independente do handler).
    const varyHeader = preflight.headers.get('vary')
    if (varyHeader !== null) {
      const tokens = varyHeader.split(',').map((t) => t.trim().toLowerCase())
      assertEquals(
        tokens.includes('origin'),
        false,
        `OPTIONS: Vary NÃO pode listar "Origin" — Allow-Origin é estático "*". Vary recebido: "${varyHeader}"`,
      )
      assertEquals(
        tokens.includes('cookie'),
        false,
        `OPTIONS: Vary NÃO pode listar "Cookie" — preflight não lê cookies. Vary recebido: "${varyHeader}"`,
      )
      assertEquals(
        tokens.includes('*'),
        false,
        `OPTIONS: Vary NÃO pode ser "*" — força revalidação total no cache. Vary recebido: "${varyHeader}"`,
      )
    }

    // ----- Sanidade final -----
    // createClient nunca é chamado em preflight (handler retorna antes).
    assertEquals(ctx._calls, 0, 'preflight nunca deve invocar createClient')
    // Allow-Methods canônico deve permanecer estável.
    assertEquals(
      preflight.headers.get('access-control-allow-methods'),
      'POST, OPTIONS',
      'OPTIONS: Allow-Methods deve ser exatamente "POST, OPTIONS"',
    )

    await preflight.text()
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: minimal cross-origin OPTIONS (Origin only, no Access-Control-Request-*) — no Allow-Credentials, Allow-Origin "*"', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Por que essa variante MINIMALISTA é dedicada (e não redundante com o
    // teste consolidado anterior):
    //   * O teste consolidado envia preflight COMPLETO com
    //     `Access-Control-Request-Method` e `Access-Control-Request-Headers`
    //     — cenário típico de browser fazendo preflight para POST custom.
    //   * Esse teste cobre o caminho ALTERNATIVO: OPTIONS cross-origin com
    //     APENAS `Origin`, sem `Access-Control-Request-*`. Isso simula:
    //       - Clientes não-browser (curl, monitores, scanners) que não
    //         distinguem preflight de probe.
    //       - Browsers fazendo OPTIONS direto (raro, mas possível via
    //         fetch({ method: 'OPTIONS' }) explícito).
    //       - Reverse-proxies que stripam headers `Access-Control-Request-*`
    //         antes do upstream.
    //     O handler NÃO faz branching por presença desses headers — devolve
    //     sempre o mesmo `corsHeaders`. Esse teste BLINDA contra regressão
    //     que adicione branching condicional acidentalmente.
    //   * Foco LASER: só o par (Allow-Credentials ausente + Allow-Origin "*").
    //     Sem assertions sobre Max-Age, Vary, cookies — esses já estão no
    //     teste consolidado. Aqui validamos APENAS o contrato que o usuário
    //     pediu, no caminho mais minimalista possível.

    const HOSTILE_ORIGIN = 'https://attacker.example.com'

    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        // Apenas Origin — nenhum Access-Control-Request-* header.
        'origin': HOSTILE_ORIGIN,
      },
    })

    assertEquals(res.status, 200, 'OPTIONS minimalista cross-origin deve retornar 200')

    // Allow-Credentials ausente — checagem dupla (.get + varredura case-insensitive).
    assertEquals(
      res.headers.get('access-control-allow-credentials'),
      null,
      'OPTIONS minimalista: Access-Control-Allow-Credentials NÃO pode estar presente',
    )
    const credLeak: string[] = []
    for (const [name, value] of res.headers) {
      if (name.toLowerCase() === 'access-control-allow-credentials') {
        credLeak.push(`${name}=${value}`)
      }
    }
    assertEquals(
      credLeak,
      [],
      `OPTIONS minimalista: nenhum Allow-Credentials permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(credLeak)}`,
    )

    // Allow-Origin literal "*" — não ecoa o Origin hostil mesmo sem
    // Access-Control-Request-* (cenário onde alguns handlers mal-escritos
    // fazem fallback para "echo Origin").
    const allowOrigin = res.headers.get('access-control-allow-origin')
    assertEquals(
      allowOrigin,
      '*',
      `OPTIONS minimalista: Allow-Origin deve ser exatamente "*" literal, recebido: ${JSON.stringify(allowOrigin)}`,
    )
    if (allowOrigin === HOSTILE_ORIGIN) {
      throw new Error(
        `OPTIONS minimalista: Allow-Origin ECOOU o Origin hostil "${HOSTILE_ORIGIN}" — falha crítica de CORS`,
      )
    }

    // Sanidade: createClient nunca é invocado em OPTIONS.
    assertEquals(ctx._calls, 0, 'OPTIONS minimalista nunca deve chamar createClient')

    await res.text()
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: cross-origin GET — no Allow-Credentials, Allow-Origin "*"', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const HOSTILE_ORIGIN = 'https://evil.example.com'
    const res = await fetch(ctx.url, {
      method: 'GET',
      headers: { 'origin': HOSTILE_ORIGIN },
    })

    // Aceita qualquer status < 500 (handler real costuma responder 405/404 a GET).
    assert(res.status < 500, `GET cross-origin não deve gerar 5xx, recebido ${res.status}`)

    // (1) Allow-Credentials ausente — checagem direta.
    assertEquals(
      res.headers.get('access-control-allow-credentials'),
      null,
      'GET cross-origin: Access-Control-Allow-Credentials NÃO pode estar presente',
    )

    // (1b) Varredura case-insensitive defensiva.
    const credLeak: string[] = []
    for (const [name, value] of res.headers) {
      if (name.toLowerCase() === 'access-control-allow-credentials') {
        credLeak.push(`${name}=${value}`)
      }
    }
    assertEquals(
      credLeak,
      [],
      `GET cross-origin: nenhum Allow-Credentials permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(credLeak)}`,
    )

    // (2) Allow-Origin literal "*" — não pode ecoar Origin hostil.
    const allowOrigin = res.headers.get('access-control-allow-origin')
    assertEquals(
      allowOrigin,
      '*',
      `GET cross-origin: Allow-Origin deve ser exatamente "*", recebido ${JSON.stringify(allowOrigin)}`,
    )
    assert(
      allowOrigin !== HOSTILE_ORIGIN,
      `GET cross-origin: Allow-Origin ECOOU o Origin hostil "${HOSTILE_ORIGIN}"`,
    )

    await res.text()
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: cross-origin POST — no Allow-Credentials, Allow-Origin "*" (both with and without valid secret)', async () => {
  const HOSTILE_ORIGIN = 'https://evil.example.com'

  for (const variant of ['valid-secret', 'no-secret'] as const) {
    const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
    try {
      const headers: Record<string, string> = {
        'origin': HOSTILE_ORIGIN,
        'content-type': 'application/json',
      }
      if (variant === 'valid-secret') headers['x-test-secret'] = SECRET

      const res = await fetch(ctx.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })

      // Status esperado: 200 (com secret) ou 401 (sem secret).
      const expected = variant === 'valid-secret' ? 200 : 401
      assertEquals(res.status, expected, `POST cross-origin (${variant}): status esperado ${expected}`)

      // (1) Allow-Credentials ausente — checagem direta.
      assertEquals(
        res.headers.get('access-control-allow-credentials'),
        null,
        `POST cross-origin (${variant}): Access-Control-Allow-Credentials NÃO pode estar presente`,
      )

      // (1b) Varredura case-insensitive defensiva.
      const credLeak: string[] = []
      for (const [name, value] of res.headers) {
        if (name.toLowerCase() === 'access-control-allow-credentials') {
          credLeak.push(`${name}=${value}`)
        }
      }
      assertEquals(
        credLeak,
        [],
        `POST cross-origin (${variant}): nenhum Allow-Credentials permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(credLeak)}`,
      )

      // (2) Allow-Origin literal "*".
      const allowOrigin = res.headers.get('access-control-allow-origin')
      assertEquals(
        allowOrigin,
        '*',
        `POST cross-origin (${variant}): Allow-Origin deve ser exatamente "*", recebido ${JSON.stringify(allowOrigin)}`,
      )
      assert(
        allowOrigin !== HOSTILE_ORIGIN,
        `POST cross-origin (${variant}): Allow-Origin ECOOU o Origin hostil "${HOSTILE_ORIGIN}"`,
      )

      await res.text()
    } finally {
      await ctx.stop()
    }
  }
})

Deno.test('HTTP integration: OPTIONS without Origin header — no Allow-Credentials, Allow-Origin still "*" (no echo, no "null")', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const res = await fetch(ctx.url, {
      method: 'OPTIONS',
      headers: {
        // Sem 'origin' propositalmente — alguns handlers mal-escritos fazem
        // fallback para echo do header inexistente, gerando "null" literal,
        // string vazia, ou simplesmente omitem o Allow-Origin.
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-test-secret',
      },
    })

    assertEquals(res.status, 200, 'OPTIONS sem Origin deve retornar 200')

    // (1) Allow-Credentials ausente — checagem direta.
    assertEquals(
      res.headers.get('access-control-allow-credentials'),
      null,
      'OPTIONS sem Origin: Access-Control-Allow-Credentials NÃO pode estar presente',
    )

    // (1b) Varredura case-insensitive defensiva.
    const credLeak: string[] = []
    for (const [name, value] of res.headers) {
      if (name.toLowerCase() === 'access-control-allow-credentials') {
        credLeak.push(`${name}=${value}`)
      }
    }
    assertEquals(
      credLeak,
      [],
      `OPTIONS sem Origin: nenhum Allow-Credentials permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(credLeak)}`,
    )

    // (2) Allow-Origin deve ser exatamente "*" — nem ausente, nem "null"
    // literal, nem string vazia, nem ecoando algum valor inesperado.
    const allowOrigin = res.headers.get('access-control-allow-origin')
    assertEquals(
      allowOrigin,
      '*',
      `OPTIONS sem Origin: Allow-Origin deve ser exatamente "*", recebido ${JSON.stringify(allowOrigin)}`,
    )

    // (2b) Guardas explícitas contra valores patológicos comuns.
    const PATHOLOGICAL = ['null', '', 'undefined', 'http://', 'https://']
    if (allowOrigin !== null && PATHOLOGICAL.includes(allowOrigin)) {
      throw new Error(
        `OPTIONS sem Origin: Allow-Origin retornou valor patológico ${JSON.stringify(allowOrigin)}`,
      )
    }

    // Sanidade: OPTIONS nunca invoca createClient.
    assertEquals(ctx._calls, 0, 'OPTIONS sem Origin nunca deve chamar createClient')

    await res.text()
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: cross-origin GET/POST WITH Cookie header — server still MUST NOT add Allow-Credentials, keeps Allow-Origin "*"', async () => {
  const HOSTILE_ORIGIN = 'https://evil.example.com'
  // Cookie hostil simulando sessão de outro site (clássico vetor CSRF/CORS).
  const HOSTILE_COOKIE = 'sid=stolen-session-abc123; theme=dark; tracking=xyz'

  const variants = [
    { method: 'GET' as const, withSecret: false, expectStatus: (s: number) => s < 500 },
    { method: 'POST' as const, withSecret: true, expectStatus: (s: number) => s === 200 },
    { method: 'POST' as const, withSecret: false, expectStatus: (s: number) => s === 401 },
  ]

  for (const v of variants) {
    const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
    const label = `${v.method}${v.withSecret ? '+secret' : ''}+cookie`
    try {
      const headers: Record<string, string> = {
        'origin': HOSTILE_ORIGIN,
        'cookie': HOSTILE_COOKIE,
      }
      if (v.method === 'POST') headers['content-type'] = 'application/json'
      if (v.withSecret) headers['x-test-secret'] = SECRET

      const res = await fetch(ctx.url, {
        method: v.method,
        headers,
        body: v.method === 'POST' ? JSON.stringify({}) : undefined,
      })

      assert(
        v.expectStatus(res.status),
        `${label}: status inesperado ${res.status}`,
      )

      // (1) Allow-Credentials ausente — checagem direta. ESTE é o ponto
      // crítico: presença de Cookie no request NÃO pode induzir o servidor
      // a refletir Allow-Credentials: true (vetor clássico de CORS bypass
      // com `*` + credentials, que browsers rejeitam mas servidores
      // mal-configurados emitem).
      assertEquals(
        res.headers.get('access-control-allow-credentials'),
        null,
        `${label}: Allow-Credentials NÃO pode aparecer mesmo com Cookie no request`,
      )

      // (1b) Varredura case-insensitive defensiva.
      const credLeak: string[] = []
      for (const [name, value] of res.headers) {
        if (name.toLowerCase() === 'access-control-allow-credentials') {
          credLeak.push(`${name}=${value}`)
        }
      }
      assertEquals(
        credLeak,
        [],
        `${label}: vazamento de Allow-Credentials (qualquer capitalização): ${JSON.stringify(credLeak)}`,
      )

      // (2) Allow-Origin literal "*" — combinação spec-compliant com
      // ausência de Allow-Credentials. Não pode ecoar Origin hostil.
      const allowOrigin = res.headers.get('access-control-allow-origin')
      assertEquals(
        allowOrigin,
        '*',
        `${label}: Allow-Origin deve ser exatamente "*", recebido ${JSON.stringify(allowOrigin)}`,
      )
      assert(
        allowOrigin !== HOSTILE_ORIGIN,
        `${label}: Allow-Origin ECOOU o Origin hostil "${HOSTILE_ORIGIN}"`,
      )

      // (3) Servidor não deve devolver Set-Cookie em resposta a request
      // cross-origin com Cookie — sanidade adicional contra session fixation.
      const setCookieLeak: string[] = []
      for (const [name, value] of res.headers) {
        const ln = name.toLowerCase()
        if (ln === 'set-cookie' || ln === 'set-cookie2') {
          setCookieLeak.push(`${name}=${value}`)
        }
      }
      assertEquals(
        setCookieLeak,
        [],
        `${label}: nenhum Set-Cookie esperado em resposta cross-origin: ${JSON.stringify(setCookieLeak)}`,
      )

      await res.text()
    } finally {
      await ctx.stop()
    }
  }
})

Deno.test('HTTP integration: cross-origin OPTIONS preflight WITH Cookie header — server MUST NOT add Allow-Credentials, keeps Allow-Origin "*"', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const HOSTILE_ORIGIN = 'https://evil.example.com'
    const HOSTILE_COOKIE = 'sid=stolen-session-abc123; theme=dark; auth=fake-token'

    const res = await fetch(ctx.url, {
      method: 'OPTIONS',
      headers: {
        'origin': HOSTILE_ORIGIN,
        'cookie': HOSTILE_COOKIE,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-test-secret',
      },
    })

    assertEquals(res.status, 200, 'OPTIONS preflight com Cookie deve retornar 200')

    // (1) Allow-Credentials ausente — checagem direta. Presença de Cookie
    // no preflight NÃO pode induzir o servidor a refletir credentials:true
    // (vetor clássico de CORS bypass: `*` + credentials, rejeitado por
    // browsers mas emitido por servidores mal-configurados).
    assertEquals(
      res.headers.get('access-control-allow-credentials'),
      null,
      'OPTIONS+Cookie: Allow-Credentials NÃO pode aparecer mesmo com Cookie no preflight',
    )

    // (1b) Varredura case-insensitive defensiva.
    const credLeak: string[] = []
    for (const [name, value] of res.headers) {
      if (name.toLowerCase() === 'access-control-allow-credentials') {
        credLeak.push(`${name}=${value}`)
      }
    }
    assertEquals(
      credLeak,
      [],
      `OPTIONS+Cookie: vazamento de Allow-Credentials (qualquer capitalização): ${JSON.stringify(credLeak)}`,
    )

    // (2) Allow-Origin literal "*" — combinação spec-compliant com
    // ausência de Allow-Credentials. Não pode ecoar Origin hostil.
    const allowOrigin = res.headers.get('access-control-allow-origin')
    assertEquals(
      allowOrigin,
      '*',
      `OPTIONS+Cookie: Allow-Origin deve ser exatamente "*", recebido ${JSON.stringify(allowOrigin)}`,
    )
    assert(
      allowOrigin !== HOSTILE_ORIGIN,
      `OPTIONS+Cookie: Allow-Origin ECOOU o Origin hostil "${HOSTILE_ORIGIN}"`,
    )

    // (3) Servidor não deve devolver Set-Cookie em resposta a preflight
    // cross-origin com Cookie — sanidade contra session fixation.
    const setCookieLeak: string[] = []
    for (const [name, value] of res.headers) {
      const ln = name.toLowerCase()
      if (ln === 'set-cookie' || ln === 'set-cookie2') {
        setCookieLeak.push(`${name}=${value}`)
      }
    }
    assertEquals(
      setCookieLeak,
      [],
      `OPTIONS+Cookie: nenhum Set-Cookie esperado em preflight cross-origin: ${JSON.stringify(setCookieLeak)}`,
    )

    // Sanidade: preflight nunca invoca createClient.
    assertEquals(ctx._calls, 0, 'OPTIONS+Cookie nunca deve chamar createClient')

    await res.text()
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: hostile Cookie on cross-origin (HEAD/GET/POST/OPTIONS) — explicit assertion: NEVER Set-Cookie, NEVER Allow-Credentials', async () => {
  const HOSTILE_ORIGIN = 'https://evil.example.com'
  const HOSTILE_COOKIE = [
    'sid=stolen-session-abc123',
    'auth=fake-jwt-token',
    'csrf=hijack-token',
    'theme=dark',
    'tracking=xyz',
  ].join('; ')

  const variants: Array<{
    method: 'HEAD' | 'GET' | 'POST' | 'OPTIONS'
    extraHeaders?: Record<string, string>
    body?: string
  }> = [
    { method: 'HEAD' },
    { method: 'GET' },
    { method: 'POST', extraHeaders: { 'content-type': 'application/json', 'x-test-secret': SECRET }, body: JSON.stringify({}) },
    { method: 'POST', extraHeaders: { 'content-type': 'application/json' }, body: JSON.stringify({}) },
    { method: 'OPTIONS', extraHeaders: { 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type, x-test-secret' } },
  ]

  for (const v of variants) {
    const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
    const label = `${v.method}${v.extraHeaders?.['x-test-secret'] ? '+secret' : ''}`
    try {
      const res = await fetch(ctx.url, {
        method: v.method,
        headers: {
          'origin': HOSTILE_ORIGIN,
          'cookie': HOSTILE_COOKIE,
          ...(v.extraHeaders ?? {}),
        },
        body: v.body,
      })

      // Sanidade: nenhum 5xx por causa de cookies hostis.
      assert(res.status < 500, `${label}: cookies hostis não podem causar 5xx, recebido ${res.status}`)

      // ────────────────────────────────────────────────────────────────
      // ASSERÇÃO EXPLÍCITA #1 — NUNCA Set-Cookie (nem Set-Cookie2).
      // ────────────────────────────────────────────────────────────────
      const setCookie = res.headers.get('set-cookie')
      assertEquals(
        setCookie,
        null,
        `${label}: response NUNCA pode conter Set-Cookie quando cookies hostis são enviados — recebido: ${JSON.stringify(setCookie)}`,
      )
      const setCookie2 = res.headers.get('set-cookie2')
      assertEquals(
        setCookie2,
        null,
        `${label}: response NUNCA pode conter Set-Cookie2 quando cookies hostis são enviados — recebido: ${JSON.stringify(setCookie2)}`,
      )

      // Varredura case-insensitive — bloqueia qualquer capitalização exótica
      // injetada por reverse proxy (ex: "SET-COOKIE", "Set-cookie").
      const cookieLeak: string[] = []
      for (const [name, value] of res.headers) {
        const ln = name.toLowerCase()
        if (ln === 'set-cookie' || ln === 'set-cookie2') {
          cookieLeak.push(`${name}=${value}`)
        }
      }
      assertEquals(
        cookieLeak,
        [],
        `${label}: nenhum Set-Cookie/Set-Cookie2 permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(cookieLeak)}`,
      )

      // ────────────────────────────────────────────────────────────────
      // ASSERÇÃO EXPLÍCITA #2 — NUNCA Access-Control-Allow-Credentials.
      // Crítico: Cookie no request NÃO pode induzir credentials:true,
      // que combinado com Allow-Origin "*" é o vetor clássico de CORS
      // bypass (browsers rejeitam, mas servidores mal-configurados emitem).
      // ────────────────────────────────────────────────────────────────
      const allowCreds = res.headers.get('access-control-allow-credentials')
      assertEquals(
        allowCreds,
        null,
        `${label}: response NUNCA pode conter Access-Control-Allow-Credentials quando cookies hostis são enviados — recebido: ${JSON.stringify(allowCreds)}`,
      )

      const credLeak: string[] = []
      for (const [name, value] of res.headers) {
        if (name.toLowerCase() === 'access-control-allow-credentials') {
          credLeak.push(`${name}=${value}`)
        }
      }
      assertEquals(
        credLeak,
        [],
        `${label}: nenhum Allow-Credentials permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(credLeak)}`,
      )

      // ────────────────────────────────────────────────────────────────
      // ASSERÇÃO COMPLEMENTAR #3 — Allow-Origin permanece "*" (ou null
      // para HEAD, dependendo do handler) e NUNCA ecoa o Origin hostil.
      // ────────────────────────────────────────────────────────────────
      const allowOrigin = res.headers.get('access-control-allow-origin')
      // Guarda anti-eco PRIMEIRO (antes do narrowing) — String() evita
      // que o TS estreite o tipo e marque a comparação como impossível.
      assert(
        String(allowOrigin) !== String(HOSTILE_ORIGIN),
        `${label}: Allow-Origin ECOOU o Origin hostil "${HOSTILE_ORIGIN}"`,
      )
      assert(
        allowOrigin === '*' || allowOrigin === null,
        `${label}: Allow-Origin deve ser "*" ou ausente, recebido ${JSON.stringify(allowOrigin)}`,
      )

      await res.text()
    } finally {
      await ctx.stop()
    }
  }
})

Deno.test('HTTP integration: CORS responses MUST NOT leak Access-Control-Expose-Headers across all methods/statuses', async () => {
  const HOSTILE_ORIGIN = 'https://evil.example.com'

  const variants: Array<{
    method: 'HEAD' | 'GET' | 'POST' | 'OPTIONS'
    extraHeaders?: Record<string, string>
    body?: string
    label: string
  }> = [
    { method: 'OPTIONS', extraHeaders: { 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type, x-test-secret' }, label: 'OPTIONS preflight' },
    { method: 'OPTIONS', label: 'OPTIONS bare' },
    { method: 'POST', extraHeaders: { 'content-type': 'application/json', 'x-test-secret': SECRET }, body: JSON.stringify({}), label: 'POST 200' },
    { method: 'POST', extraHeaders: { 'content-type': 'application/json' }, body: JSON.stringify({}), label: 'POST 401' },
    { method: 'POST', extraHeaders: { 'content-type': 'application/json', 'x-test-secret': 'wrong' }, body: JSON.stringify({}), label: 'POST wrong-secret' },
    { method: 'GET', label: 'GET' },
    { method: 'HEAD', label: 'HEAD' },
  ]

  for (const v of variants) {
    const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
    try {
      const res = await fetch(ctx.url, {
        method: v.method,
        headers: { 'origin': HOSTILE_ORIGIN, ...(v.extraHeaders ?? {}) },
        body: v.body,
      })

      // (1) Checagem direta — Expose-Headers NÃO pode estar presente.
      // O handler não expõe nenhum header customizado ao cliente cross-origin
      // (não há body fields que dependam de header inspection no JS do
      // browser), então emitir Expose-Headers é leak de superfície.
      const expose = res.headers.get('access-control-expose-headers')
      assertEquals(
        expose,
        null,
        `${v.label}: Access-Control-Expose-Headers NÃO pode estar presente — recebido: ${JSON.stringify(expose)}`,
      )

      // (1b) Varredura case-insensitive defensiva contra reverse proxies.
      const exposeLeak: string[] = []
      for (const [name, value] of res.headers) {
        if (name.toLowerCase() === 'access-control-expose-headers') {
          exposeLeak.push(`${name}=${value}`)
        }
      }
      assertEquals(
        exposeLeak,
        [],
        `${v.label}: nenhum Expose-Headers permitido (qualquer capitalização) — vazamentos: ${JSON.stringify(exposeLeak)}`,
      )

      await res.text()
    } finally {
      await ctx.stop()
    }
  }
})

Deno.test('HTTP integration: Vary header contract — MUST NOT include Origin/Cookie/Authorization/* (Allow-Origin is literal "*", caching by Origin would be wrong)', async () => {
  const HOSTILE_ORIGIN = 'https://evil.example.com'

  // Tokens proibidos no Vary. "Origin" é o caso crítico: como o servidor
  // sempre devolve Allow-Origin: "*" (independente do request), incluir
  // "Vary: Origin" forçaria caches a manter uma entrada por Origin sem
  // benefício, e indica handler com lógica de eco escondida.
  // "Cookie" e "Authorization" no Vary indicam que a resposta varia com
  // credenciais — incompatível com Allow-Origin: "*".
  // "*" no Vary desabilita cache totalmente — também não esperado aqui.
  const FORBIDDEN_VARY_TOKENS = ['origin', 'cookie', 'authorization', '*']

  const variants: Array<{
    method: 'HEAD' | 'GET' | 'POST' | 'OPTIONS'
    extraHeaders?: Record<string, string>
    body?: string
    label: string
  }> = [
    { method: 'OPTIONS', extraHeaders: { 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type, x-test-secret' }, label: 'OPTIONS preflight' },
    { method: 'POST', extraHeaders: { 'content-type': 'application/json', 'x-test-secret': SECRET }, body: JSON.stringify({}), label: 'POST 200' },
    { method: 'POST', extraHeaders: { 'content-type': 'application/json' }, body: JSON.stringify({}), label: 'POST 401' },
    { method: 'GET', label: 'GET' },
    { method: 'HEAD', label: 'HEAD' },
  ]

  for (const v of variants) {
    const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
    try {
      const res = await fetch(ctx.url, {
        method: v.method,
        headers: { 'origin': HOSTILE_ORIGIN, ...(v.extraHeaders ?? {}) },
        body: v.body,
      })

      // Coleta TODAS as instâncias de Vary (case-insensitive) — HTTP permite
      // múltiplos Vary, alguns proxies também duplicam.
      const varyValues: string[] = []
      for (const [name, value] of res.headers) {
        if (name.toLowerCase() === 'vary') varyValues.push(value)
      }

      // Sano se: (a) não há Vary, OU (b) Vary só contém tokens neutros
      // tipo "Accept-Encoding" (injetado pelo runtime de compressão).
      if (varyValues.length > 0) {
        // Junta todos os Vary, normaliza e quebra por vírgula.
        const tokens = varyValues
          .join(',')
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)

        for (const forbidden of FORBIDDEN_VARY_TOKENS) {
          assert(
            !tokens.includes(forbidden),
            `${v.label}: Vary NÃO pode conter token "${forbidden}" — Vary completo: ${JSON.stringify(varyValues)}`,
          )
        }
      }

      await res.text()
    } finally {
      await ctx.stop()
    }
  }
})

Deno.test('HTTP integration: 200 OK response with hostile Cookie — NEVER Set-Cookie/Set-Cookie2 (exhaustive casing variants)', async () => {
  const HOSTILE_ORIGIN = 'https://evil.example.com'
  // Cookies hostis com nomes que tipicamente disparam middlewares de
  // session refresh (sid/session/auth/jwt/csrf), maximizando a chance de
  // expor um handler que reflita Set-Cookie por engano.
  const HOSTILE_COOKIE = [
    'sid=stolen-session-abc123',
    'session=hijacked',
    'auth=fake-jwt-token-xyz',
    'jwt=eyJfake',
    'csrf=hijack-token',
    'remember_me=1',
  ].join('; ')

  // Variantes de casing exaustivas — cobre toda combinação plausível de
  // mistura de maiúsculas/minúsculas que algum reverse proxy ou runtime
  // poderia injetar. fetch() normaliza nomes de header para lowercase
  // ao iterar, mas a varredura .toLowerCase() blinda contra implementações
  // não-conformes.
  const FORBIDDEN_COOKIE_HEADERS = [
    'set-cookie',
    'Set-Cookie',
    'SET-COOKIE',
    'Set-cookie',
    'set-Cookie',
    'sEt-CoOkIe',
    'set-cookie2',
    'Set-Cookie2',
    'SET-COOKIE2',
    'Set-cookie2',
    'set-Cookie2',
  ]

  // Múltiplas execuções no mesmo servidor para garantir idempotência:
  // um handler bug-prone poderia emitir Set-Cookie só na 2ª chamada
  // (ex: lazy session bootstrap).
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(ctx.url, {
        method: 'POST',
        headers: {
          'origin': HOSTILE_ORIGIN,
          'cookie': HOSTILE_COOKIE,
          'content-type': 'application/json',
          'x-test-secret': SECRET,
        },
        body: JSON.stringify({}),
      })

      // Sanidade: este teste cobre EXCLUSIVAMENTE o caminho 200 OK.
      assertEquals(res.status, 200, `attempt #${attempt}: response com secret válido deve ser 200`)

      // ────────────────────────────────────────────────────────────────
      // (1) Checagem direta por nome canônico — Headers.get() é
      // case-insensitive na spec, então um único get('set-cookie')
      // captura qualquer capitalização vinda do servidor.
      // ────────────────────────────────────────────────────────────────
      const setCookie = res.headers.get('set-cookie')
      assertEquals(
        setCookie,
        null,
        `attempt #${attempt}: 200 OK NUNCA pode conter Set-Cookie — recebido ${JSON.stringify(setCookie)}`,
      )
      const setCookie2 = res.headers.get('set-cookie2')
      assertEquals(
        setCookie2,
        null,
        `attempt #${attempt}: 200 OK NUNCA pode conter Set-Cookie2 — recebido ${JSON.stringify(setCookie2)}`,
      )

      // ────────────────────────────────────────────────────────────────
      // (2) Varredura exaustiva por TODAS as variantes de casing.
      // Usa Headers.has() — também case-insensitive, mas testar cada
      // variante explicitamente documenta o contrato e blinda contra
      // qualquer runtime futuro que viole a spec.
      // ────────────────────────────────────────────────────────────────
      for (const variant of FORBIDDEN_COOKIE_HEADERS) {
        const present = res.headers.has(variant)
        assertEquals(
          present,
          false,
          `attempt #${attempt}: 200 OK NUNCA pode conter header "${variant}" (qualquer casing) — has() retornou true`,
        )
      }

      // ────────────────────────────────────────────────────────────────
      // (3) Iteração final case-insensitive — pega qualquer header cujo
      // nome normalizado bata com set-cookie / set-cookie2, independente
      // do casing original recebido.
      // ────────────────────────────────────────────────────────────────
      const cookieLeak: Array<{ name: string; value: string }> = []
      for (const [name, value] of res.headers) {
        const ln = name.toLowerCase()
        if (ln === 'set-cookie' || ln === 'set-cookie2') {
          cookieLeak.push({ name, value })
        }
      }
      assertEquals(
        cookieLeak,
        [],
        `attempt #${attempt}: vazamento de Set-Cookie/Set-Cookie2 detectado (qualquer casing) — ${JSON.stringify(cookieLeak)}`,
      )

      await res.text()
    }
  } finally {
    await ctx.stop()
  }
})

// ============================================================
// Access-Control-Allow-Methods contract on CORS preflight
// ------------------------------------------------------------
// O handler em index.ts declara:
//   'Access-Control-Allow-Methods': 'POST, OPTIONS'
// Estes testes blindam esse contrato contra regressões: garantem que
// (a) o header está presente em respostas de preflight (OPTIONS),
// (b) lista exatamente POST e OPTIONS,
// (c) NUNCA inclui métodos perigosos/desnecessários (GET, PUT, PATCH,
//     DELETE, HEAD, CONNECT, TRACE, *), o que reduziria a superfície
//     CORS exposta a origens hostis,
// (d) o contrato é estável independentemente dos headers de preflight
//     (Access-Control-Request-Method / -Headers / Origin variados).
// ============================================================

function parseAllowMethods(h: string | null): string[] {
  if (!h) return []
  return h.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
}

const FORBIDDEN_METHODS = ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'CONNECT', 'TRACE', '*']

Deno.test('HTTP integration: CORS preflight — Allow-Methods is present and equals exactly "POST, OPTIONS"', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Preflight clássico: OPTIONS + Origin + Access-Control-Request-Method.
    const variants: Array<{ name: string; init: RequestInit }> = [
      {
        name: 'preflight POST from browser-like origin',
        init: {
          method: 'OPTIONS',
          headers: {
            'Origin': 'https://app.kubovibe.dev',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'x-test-secret, content-type',
          },
        },
      },
      {
        name: 'preflight from hostile origin',
        init: {
          method: 'OPTIONS',
          headers: {
            'Origin': 'https://evil.example.com',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'x-test-secret',
          },
        },
      },
      {
        name: 'preflight requesting a forbidden method (DELETE) — server must NOT echo it',
        init: {
          method: 'OPTIONS',
          headers: {
            'Origin': 'https://evil.example.com',
            'Access-Control-Request-Method': 'DELETE',
            'Access-Control-Request-Headers': 'authorization',
          },
        },
      },
      {
        name: 'bare OPTIONS without preflight headers',
        init: { method: 'OPTIONS' },
      },
    ]

    for (const v of variants) {
      const res = await fetch(`${ctx.url}/`, v.init)
      // body fully consumed to release the connection
      await res.text()

      assertEquals(res.status, 200, `[${v.name}] status preflight deve ser 200`)

      const raw = res.headers.get('access-control-allow-methods')
      assertExists(raw, `[${v.name}] Allow-Methods deve estar presente em preflight`)

      // Igualdade exata de string (contrato literal do handler).
      assertEquals(
        raw,
        'POST, OPTIONS',
        `[${v.name}] Allow-Methods deve ser literalmente "POST, OPTIONS"`,
      )

      // Igualdade de conjunto (defesa contra reordenação futura).
      const methods = parseAllowMethods(raw)
      assertEquals(
        methods.sort(),
        ['OPTIONS', 'POST'],
        `[${v.name}] Allow-Methods deve conter exatamente {POST, OPTIONS}`,
      )

      // Nenhum método perigoso pode aparecer.
      for (const forbidden of FORBIDDEN_METHODS) {
        assert(
          !methods.includes(forbidden),
          `[${v.name}] Allow-Methods NÃO pode incluir "${forbidden}" (vazaria superfície CORS)`,
        )
      }

      // Allow-Origin deve permanecer literal "*" (não eco do Origin).
      const allowOrigin = res.headers.get('access-control-allow-origin')
      assert(
        allowOrigin === '*' || allowOrigin === null,
        `[${v.name}] Allow-Origin deve ser "*" ou ausente, got: ${allowOrigin}`,
      )

      // Preflight não invoca createClient — sanidade.
      assertEquals(ctx._calls, 0, `[${v.name}] preflight não pode instanciar Supabase client`)
    }
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: CORS preflight — Allow-Methods header is case-insensitive readable & no duplicate methods', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const res = await fetch(`${ctx.url}/`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://evil.example.com',
        'Access-Control-Request-Method': 'POST',
      },
    })
    await res.text()

    // Defesa contra capitalização exótica do header name.
    const variants = [
      'access-control-allow-methods',
      'Access-Control-Allow-Methods',
      'ACCESS-CONTROL-ALLOW-METHODS',
    ]
    for (const name of variants) {
      const v = res.headers.get(name)
      assertExists(v, `header "${name}" deve ser legível (Headers é case-insensitive)`)
      assertEquals(v, 'POST, OPTIONS', `header "${name}" deve retornar "POST, OPTIONS"`)
    }

    // Garante NÃO duplicação (alguns proxies podem somar headers).
    const methods = parseAllowMethods(res.headers.get('access-control-allow-methods'))
    const unique = Array.from(new Set(methods))
    assertEquals(
      methods.length,
      unique.length,
      'Allow-Methods não pode conter métodos duplicados',
    )
    assertEquals(methods.length, 2, 'Allow-Methods deve listar exatamente 2 métodos')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: 401/403 auth-rejection responses with hostile Cookie — NEVER Set-Cookie/Set-Cookie2 (exhaustive casing)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // O handler emite 401 para: (a) header secreto ausente, (b) header secreto incorreto.
    // Não há caminho 403 neste handler, mas a asserção é defensiva: qualquer status
    // de rejeição de auth (401/403) NÃO PODE conter Set-Cookie/Set-Cookie2 mesmo com
    // cookies hostis enviados pelo cliente. O sweep abaixo cobre os 401 reais e
    // valida o invariante que se aplicaria igualmente a um eventual 403 futuro.
    const HOSTILE_COOKIE =
      'sid=stolen-session-abc123; session=hijacked; auth=fake-jwt-token-xyz; jwt=eyJfake; csrf=hijack-token; remember_me=1; admin=true'

    const HOSTILE_ORIGIN = 'https://evil.example.com'

    // Variantes de casing exaustivas para set-cookie / set-cookie2.
    const COOKIE_HEADER_VARIANTS = [
      'set-cookie', 'Set-Cookie', 'SET-COOKIE', 'set-Cookie', 'Set-cookie',
      'SET-cookie', 'set-COOKIE', 'sEt-CoOkIe',
      'set-cookie2', 'Set-Cookie2', 'SET-COOKIE2', 'set-Cookie2', 'Set-cookie2',
      'SET-cookie2', 'sEt-CoOkIe2',
    ]

    // Cenários que produzem 401/403-style rejections.
    const scenarios: Array<{ name: string; expectedStatus: number; init: RequestInit }> = [
      {
        name: '401 — POST sem header x-test-secret',
        expectedStatus: 401,
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'origin': HOSTILE_ORIGIN,
            'cookie': HOSTILE_COOKIE,
          },
        },
      },
      {
        name: '401 — POST com x-test-secret incorreto',
        expectedStatus: 401,
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'origin': HOSTILE_ORIGIN,
            'cookie': HOSTILE_COOKIE,
            'x-test-secret': 'wrong-secret-attempt',
          },
        },
      },
      {
        name: '401 — POST com x-test-secret vazio',
        expectedStatus: 401,
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'origin': HOSTILE_ORIGIN,
            'cookie': HOSTILE_COOKIE,
            'x-test-secret': '',
          },
        },
      },
      {
        name: '401 — POST cross-origin, secret incorreto, cookies + Authorization hostis',
        expectedStatus: 401,
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'origin': HOSTILE_ORIGIN,
            'cookie': HOSTILE_COOKIE,
            'authorization': 'Bearer attacker-jwt-token',
            'x-test-secret': 'definitely-not-the-secret',
          },
        },
      },
    ]

    for (const sc of scenarios) {
      // Executa 2x para garantir idempotência — nenhuma chamada pode emitir Set-Cookie.
      for (let attempt = 1; attempt <= 2; attempt++) {
        const res = await fetch(`${ctx.url}/`, sc.init)
        await res.text() // sempre consumir body (Deno fetch leak guard)

        assertEquals(
          res.status,
          sc.expectedStatus,
          `[${sc.name}] tentativa ${attempt}: status esperado ${sc.expectedStatus}`,
        )

        // (1) Checagem canônica — Headers.get é case-insensitive.
        assertEquals(
          res.headers.get('set-cookie'),
          null,
          `[${sc.name}] tentativa ${attempt}: Set-Cookie NUNCA deve aparecer em resposta ${sc.expectedStatus}`,
        )
        assertEquals(
          res.headers.get('set-cookie2'),
          null,
          `[${sc.name}] tentativa ${attempt}: Set-Cookie2 NUNCA deve aparecer em resposta ${sc.expectedStatus}`,
        )

        // (2) Headers.has() em todas as variantes de casing — defesa contra runtimes exóticos.
        for (const variant of COOKIE_HEADER_VARIANTS) {
          assert(
            !res.headers.has(variant),
            `[${sc.name}] tentativa ${attempt}: header "${variant}" NÃO PODE existir em resposta ${sc.expectedStatus}`,
          )
        }

        // (3) Iteração case-insensitive sobre todos os headers — captura vazamentos não documentados.
        for (const [name] of res.headers) {
          const lower = name.toLowerCase()
          assert(
            lower !== 'set-cookie' && lower !== 'set-cookie2',
            `[${sc.name}] tentativa ${attempt}: header "${name}" vazou cookie em resposta ${sc.expectedStatus}`,
          )
        }

        // (4) Garantia adicional: respostas de auth-rejection NÃO podem conter
        // Access-Control-Allow-Credentials (incompatível com Allow-Origin: '*').
        assertEquals(
          res.headers.get('access-control-allow-credentials'),
          null,
          `[${sc.name}] tentativa ${attempt}: Allow-Credentials NUNCA deve aparecer`,
        )

        // (5) Sanidade: Allow-Origin permanece '*' literal (sem eco do Origin hostil).
        const allowOrigin = res.headers.get('access-control-allow-origin')
        assert(
          allowOrigin === '*' || allowOrigin === null,
          `[${sc.name}] tentativa ${attempt}: Allow-Origin deve ser '*' ou ausente, recebeu "${allowOrigin}"`,
        )
      }
    }

    // Garantia: nenhum createClient instanciado em qualquer cenário 401 — sem chance de vazar SERVICE_ROLE_KEY.
    assertEquals(
      ctx._calls,
      0,
      'createClient NUNCA deve ser invocado em respostas 401/403',
    )
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: CORS preflight — Allow-Headers contract (exact set, case-insensitive, no wildcards)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Contrato esperado (literal do handler index.ts):
    //   'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])

    // Helper de parsing case-insensitive.
    const parseAllowHeaders = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    // Cenários: preflights variados — todos devem retornar o mesmo Allow-Headers.
    const scenarios: Array<{ name: string; init: RequestInit }> = [
      {
        name: 'preflight padrão (Origin same-origin-ish + Request-Method POST + Request-Headers)',
        init: {
          method: 'OPTIONS',
          headers: {
            'origin': 'https://app.kubovibe.dev',
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'content-type, x-test-secret, authorization',
          },
        },
      },
      {
        name: 'preflight cross-origin hostil',
        init: {
          method: 'OPTIONS',
          headers: {
            'origin': 'https://evil.example.com',
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'x-test-secret',
          },
        },
      },
      {
        name: 'preflight bare OPTIONS (sem headers de preflight)',
        init: { method: 'OPTIONS' },
      },
      {
        name: 'preflight pedindo header NÃO listado (apikey + custom)',
        init: {
          method: 'OPTIONS',
          headers: {
            'origin': 'https://app.kubovibe.dev',
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'apikey, x-fake-not-allowed',
          },
        },
      },
    ]

    for (const sc of scenarios) {
      const res = await fetch(`${ctx.url}/`, sc.init)
      await res.text()

      // (1) Status do preflight: handler retorna 200 com 'ok'.
      assertEquals(res.status, 200, `[${sc.name}] preflight deve retornar 200`)

      // (2) Allow-Headers presente.
      const ah = res.headers.get('access-control-allow-headers')
      assertExists(ah, `[${sc.name}] Allow-Headers deve estar presente`)

      // (3) Valor literal exato — handler NÃO ecoa Request-Headers, retorna lista fixa.
      assertEquals(
        ah,
        EXPECTED_LITERAL,
        `[${sc.name}] Allow-Headers deve ser literal "${EXPECTED_LITERAL}"`,
      )

      // (4) Conjunto parseado bate exatamente — sem extras, sem omissões.
      const parsed = new Set(parseAllowHeaders(ah))
      assertEquals(
        parsed.size,
        EXPECTED_SET.size,
        `[${sc.name}] Allow-Headers deve listar exatamente ${EXPECTED_SET.size} headers`,
      )
      for (const h of EXPECTED_SET) {
        assert(parsed.has(h), `[${sc.name}] Allow-Headers deve incluir "${h}"`)
      }

      // (5) NUNCA usar wildcard '*' em Allow-Headers (incompatível com credenciais e ambíguo).
      assert(
        !parsed.has('*'),
        `[${sc.name}] Allow-Headers NÃO PODE conter wildcard '*'`,
      )

      // (6) Headers perigosos NUNCA podem aparecer (cookie / set-cookie / etc).
      const FORBIDDEN = ['cookie', 'set-cookie', 'set-cookie2', 'host', 'origin']
      for (const f of FORBIDDEN) {
        assert(
          !parsed.has(f),
          `[${sc.name}] Allow-Headers NÃO PODE listar header sensível "${f}"`,
        )
      }

      // (7) Leitura case-insensitive do nome do header.
      for (const variant of [
        'access-control-allow-headers',
        'Access-Control-Allow-Headers',
        'ACCESS-CONTROL-ALLOW-HEADERS',
      ]) {
        assertEquals(
          res.headers.get(variant),
          EXPECTED_LITERAL,
          `[${sc.name}] header "${variant}" deve ser legível e idêntico`,
        )
      }
    }
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: CORS preflight — Access-Control-Max-Age contract (exact 86400, numeric, sane bounds)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Contrato esperado (literal do handler index.ts): '86400' (24h).
    const EXPECTED_MAX_AGE = '86400'
    const EXPECTED_NUMERIC = 86400

    const scenarios: Array<{ name: string; init: RequestInit }> = [
      {
        name: 'preflight padrão',
        init: {
          method: 'OPTIONS',
          headers: {
            'origin': 'https://app.kubovibe.dev',
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'content-type, x-test-secret',
          },
        },
      },
      {
        name: 'preflight cross-origin hostil',
        init: {
          method: 'OPTIONS',
          headers: {
            'origin': 'https://evil.example.com',
            'access-control-request-method': 'POST',
          },
        },
      },
      {
        name: 'preflight bare OPTIONS',
        init: { method: 'OPTIONS' },
      },
    ]

    for (const sc of scenarios) {
      const res = await fetch(`${ctx.url}/`, sc.init)
      await res.text()

      assertEquals(res.status, 200, `[${sc.name}] preflight deve retornar 200`)

      // (1) Max-Age presente.
      const ma = res.headers.get('access-control-max-age')
      assertExists(ma, `[${sc.name}] Access-Control-Max-Age deve estar presente`)

      // (2) Valor literal exato.
      assertEquals(
        ma,
        EXPECTED_MAX_AGE,
        `[${sc.name}] Max-Age deve ser literal "${EXPECTED_MAX_AGE}"`,
      )

      // (3) Numérico válido — sem espaços, sem sufixos, parseável como inteiro positivo.
      assert(/^\d+$/.test(ma), `[${sc.name}] Max-Age deve ser dígitos puros, recebeu "${ma}"`)
      const n = Number(ma)
      assert(Number.isInteger(n), `[${sc.name}] Max-Age deve ser inteiro`)
      assertEquals(n, EXPECTED_NUMERIC, `[${sc.name}] Max-Age numérico deve ser ${EXPECTED_NUMERIC}`)

      // (4) Bounds sanos — > 0 (não desabilitar cache) e <= 86400 (Chrome cap; Firefox cap = 24h).
      // Valores acima de 86400 são silenciosamente truncados pelos browsers — desperdício e indica bug.
      assert(n > 0, `[${sc.name}] Max-Age deve ser > 0 (zero desabilita cache de preflight)`)
      assert(n <= 86400, `[${sc.name}] Max-Age deve ser <= 86400 (limite efetivo dos browsers)`)

      // (5) Leitura case-insensitive do nome do header.
      for (const variant of [
        'access-control-max-age',
        'Access-Control-Max-Age',
        'ACCESS-CONTROL-MAX-AGE',
      ]) {
        assertEquals(
          res.headers.get(variant),
          EXPECTED_MAX_AGE,
          `[${sc.name}] header "${variant}" deve ser legível e idêntico`,
        )
      }

      // (6) Garantia: Max-Age aparece exatamente uma vez (sem duplicação por proxy).
      let occurrences = 0
      for (const [name] of res.headers) {
        if (name.toLowerCase() === 'access-control-max-age') occurrences++
      }
      assertEquals(occurrences, 1, `[${sc.name}] Max-Age deve aparecer exatamente 1x, encontrou ${occurrences}`)
    }
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: bare OPTIONS (no preflight headers) — returns 200 with FULL CORS contract and no createClient', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // OPTIONS "puro" — sem Origin nem Request-Method/Headers. Handler ainda deve responder
    // com o conjunto completo de CORS headers (contrato uniforme) e nunca instanciar Supabase.
    const res = await fetch(`${ctx.url}/`, { method: 'OPTIONS' })
    const body = await res.text()

    // (1) Status + body literal do handler.
    assertEquals(res.status, 200, 'bare OPTIONS deve retornar 200')
    assertEquals(body, 'ok', 'bare OPTIONS deve retornar body literal "ok"')

    // (2) Contrato CORS completo — todos os 4 headers definidos em corsHeaders.
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
    assertEquals(
      res.headers.get('access-control-allow-headers'),
      'authorization, x-client-info, apikey, content-type, x-test-secret',
    )
    assertEquals(res.headers.get('access-control-allow-methods'), 'POST, OPTIONS')
    assertEquals(res.headers.get('access-control-max-age'), '86400')

    // (3) Headers proibidos NUNCA presentes (mesmo sem cookies no request).
    assertEquals(res.headers.get('access-control-allow-credentials'), null)
    assertEquals(res.headers.get('access-control-expose-headers'), null)
    assertEquals(res.headers.get('set-cookie'), null)
    assertEquals(res.headers.get('set-cookie2'), null)

    // (4) Vary nunca contém Origin/Cookie/Authorization (incompatível com Allow-Origin: '*').
    const vary = res.headers.get('vary')
    if (vary !== null) {
      const tokens = vary.split(',').map((s) => s.trim().toLowerCase())
      for (const forbidden of ['origin', 'cookie', 'authorization', '*']) {
        assert(
          !tokens.includes(forbidden),
          `bare OPTIONS: Vary NÃO PODE conter "${forbidden}", recebeu "${vary}"`,
        )
      }
    }

    // (5) Sem createClient instanciado — preflight nunca toca Supabase.
    assertEquals(ctx._calls, 0, 'bare OPTIONS NUNCA pode instanciar createClient')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: 405 method_not_allowed with hostile Cookie — NEVER Set-Cookie/Set-Cookie2 (exhaustive casing variants)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // O handler retorna 405 para QUALQUER método ≠ POST/OPTIONS.
    // Invariante: nenhuma resposta 405 pode emitir Set-Cookie/Set-Cookie2,
    // mesmo quando o cliente envia cookies hostis e Origin cross-origin.
    const HOSTILE_COOKIE =
      'sid=stolen-session-abc123; session=hijacked; auth=fake-jwt-token-xyz; jwt=eyJfake; csrf=hijack-token; remember_me=1; admin=true'
    const HOSTILE_ORIGIN = 'https://evil.example.com'

    // 15 variantes de casing exaustivas para set-cookie / set-cookie2.
    const COOKIE_HEADER_VARIANTS = [
      'set-cookie', 'Set-Cookie', 'SET-COOKIE', 'set-Cookie', 'Set-cookie',
      'SET-cookie', 'set-COOKIE', 'sEt-CoOkIe',
      'set-cookie2', 'Set-Cookie2', 'SET-COOKIE2', 'set-Cookie2', 'Set-cookie2',
      'SET-cookie2', 'sEt-CoOkIe2',
    ]

    // Métodos que devem disparar 405 (handler aceita apenas POST/OPTIONS).
    const METHODS_405 = ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const

    const baseHeaders = {
      'content-type': 'application/json',
      'origin': HOSTILE_ORIGIN,
      'cookie': HOSTILE_COOKIE,
      'authorization': 'Bearer attacker-jwt-token',
      'x-test-secret': SECRET, // mesmo com secret CORRETO, método inválido = 405
    }

    for (const method of METHODS_405) {
      // 2 tentativas idempotentes por método.
      for (let attempt = 1; attempt <= 2; attempt++) {
        const init: RequestInit = { method, headers: baseHeaders }
        // GET/HEAD não podem ter body; demais podem ter body vazio JSON.
        if (method !== 'GET' && method !== 'HEAD') {
          (init as RequestInit & { body: string }).body = '{}'
        }

        const res = await fetch(`${ctx.url}/`, init)
        await res.text() // consumir body sempre (HEAD retorna body vazio mas ainda exige consumo)

        // (1) Status esperado.
        assertEquals(
          res.status,
          405,
          `[${method}] tentativa ${attempt}: status esperado 405`,
        )

        // (2) Checagem canônica case-insensitive via Headers.get().
        assertEquals(
          res.headers.get('set-cookie'),
          null,
          `[${method}] tentativa ${attempt}: Set-Cookie NUNCA pode aparecer em 405`,
        )
        assertEquals(
          res.headers.get('set-cookie2'),
          null,
          `[${method}] tentativa ${attempt}: Set-Cookie2 NUNCA pode aparecer em 405`,
        )

        // (3) Headers.has() em todas as 15 variantes de casing.
        for (const variant of COOKIE_HEADER_VARIANTS) {
          assert(
            !res.headers.has(variant),
            `[${method}] tentativa ${attempt}: header "${variant}" NÃO PODE existir em 405`,
          )
        }

        // (4) Iteração case-insensitive sobre TODOS os headers — captura vazamentos não documentados.
        for (const [name] of res.headers) {
          const lower = name.toLowerCase()
          assert(
            lower !== 'set-cookie' && lower !== 'set-cookie2',
            `[${method}] tentativa ${attempt}: header "${name}" vazou cookie em 405`,
          )
        }

        // (5) Garantia complementar: 405 não pode conter Allow-Credentials
        // (incompatível com Allow-Origin: '*') nem ecoar Origin hostil.
        assertEquals(
          res.headers.get('access-control-allow-credentials'),
          null,
          `[${method}] tentativa ${attempt}: Allow-Credentials NUNCA pode aparecer em 405`,
        )
        const allowOrigin = res.headers.get('access-control-allow-origin')
        assert(
          allowOrigin === '*' || allowOrigin === null,
          `[${method}] tentativa ${attempt}: Allow-Origin deve ser '*' ou ausente, recebeu "${allowOrigin}"`,
        )
      }
    }

    // (6) Garantia final: nenhum createClient instanciado em qualquer 405.
    assertEquals(
      ctx._calls,
      0,
      'createClient NUNCA pode ser invocado em respostas 405',
    )
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS without Origin header — full CORS contract preserved (Allow-Headers + Max-Age + Allow-Methods + Allow-Origin)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Contrato esperado (literais do handler index.ts).
    const EXPECTED_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_ALLOW_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const EXPECTED_MAX_AGE = '86400'
    const EXPECTED_ALLOW_METHODS = 'POST, OPTIONS'
    const EXPECTED_ALLOW_ORIGIN = '*'

    // Cenários SEM Origin — simulam: same-origin browser, curl, healthcheck, server-to-server.
    // O handler NÃO deve ramificar comportamento por presença de Origin: contrato é uniforme.
    const scenarios: Array<{ name: string; init: RequestInit }> = [
      {
        name: 'OPTIONS puro sem Origin nem qualquer header',
        init: { method: 'OPTIONS' },
      },
      {
        name: 'OPTIONS sem Origin mas com Access-Control-Request-Method',
        init: {
          method: 'OPTIONS',
          headers: { 'access-control-request-method': 'POST' },
        },
      },
      {
        name: 'OPTIONS sem Origin mas com Access-Control-Request-Headers',
        init: {
          method: 'OPTIONS',
          headers: {
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'content-type, x-test-secret, authorization',
          },
        },
      },
      {
        name: 'OPTIONS sem Origin mas com Cookie hostil (server-to-server espião)',
        init: {
          method: 'OPTIONS',
          headers: {
            'cookie': 'sid=stolen; auth=fake-jwt; admin=true',
          },
        },
      },
      {
        name: 'OPTIONS sem Origin mas com Authorization Bearer',
        init: {
          method: 'OPTIONS',
          headers: { 'authorization': 'Bearer some-token' },
        },
      },
      {
        name: 'OPTIONS sem Origin com User-Agent custom (curl-like)',
        init: {
          method: 'OPTIONS',
          headers: { 'user-agent': 'curl/8.4.0' },
        },
      },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    for (const sc of scenarios) {
      // Sanidade: garantir que NÃO estamos enviando Origin acidentalmente.
      const sentHeaders = new Headers((sc.init.headers ?? {}) as HeadersInit)
      assert(
        !sentHeaders.has('origin'),
        `[${sc.name}] cenário inválido: Origin não pode estar presente`,
      )

      // 2 tentativas idempotentes — contrato deve ser determinístico.
      for (let attempt = 1; attempt <= 2; attempt++) {
        const res = await fetch(`${ctx.url}/`, sc.init)
        const body = await res.text()

        // (1) Status + body literal.
        assertEquals(res.status, 200, `[${sc.name}] tentativa ${attempt}: status deve ser 200`)
        assertEquals(body, 'ok', `[${sc.name}] tentativa ${attempt}: body deve ser literal "ok"`)

        // (2) Allow-Headers — contrato literal exato.
        const ah = res.headers.get('access-control-allow-headers')
        assertExists(ah, `[${sc.name}] tentativa ${attempt}: Allow-Headers deve estar presente`)
        assertEquals(
          ah,
          EXPECTED_ALLOW_HEADERS,
          `[${sc.name}] tentativa ${attempt}: Allow-Headers deve ser literal exato`,
        )
        const ahSet = new Set(parseList(ah))
        assertEquals(
          ahSet.size,
          EXPECTED_ALLOW_HEADERS_SET.size,
          `[${sc.name}] tentativa ${attempt}: Allow-Headers deve listar exatamente ${EXPECTED_ALLOW_HEADERS_SET.size} headers`,
        )
        for (const h of EXPECTED_ALLOW_HEADERS_SET) {
          assert(
            ahSet.has(h),
            `[${sc.name}] tentativa ${attempt}: Allow-Headers deve incluir "${h}"`,
          )
        }
        assert(
          !ahSet.has('*'),
          `[${sc.name}] tentativa ${attempt}: Allow-Headers NÃO PODE conter wildcard '*'`,
        )

        // (3) Max-Age — contrato literal + numérico válido + bounds sanos.
        const ma = res.headers.get('access-control-max-age')
        assertExists(ma, `[${sc.name}] tentativa ${attempt}: Max-Age deve estar presente`)
        assertEquals(
          ma,
          EXPECTED_MAX_AGE,
          `[${sc.name}] tentativa ${attempt}: Max-Age deve ser literal "${EXPECTED_MAX_AGE}"`,
        )
        assert(/^\d+$/.test(ma), `[${sc.name}] tentativa ${attempt}: Max-Age deve ser dígitos puros`)
        const n = Number(ma)
        assert(Number.isInteger(n) && n > 0 && n <= 86400,
          `[${sc.name}] tentativa ${attempt}: Max-Age deve ser inteiro em (0, 86400]`)

        // (4) Allow-Methods — contrato preservado mesmo sem Origin.
        assertEquals(
          res.headers.get('access-control-allow-methods'),
          EXPECTED_ALLOW_METHODS,
          `[${sc.name}] tentativa ${attempt}: Allow-Methods deve ser "${EXPECTED_ALLOW_METHODS}"`,
        )

        // (5) Allow-Origin — wildcard literal '*' (handler NÃO ecoa Origin, e aqui não há Origin para ecoar).
        assertEquals(
          res.headers.get('access-control-allow-origin'),
          EXPECTED_ALLOW_ORIGIN,
          `[${sc.name}] tentativa ${attempt}: Allow-Origin deve ser '*' literal`,
        )

        // (6) Headers proibidos — NUNCA presentes em preflight, mesmo sem Origin.
        assertEquals(
          res.headers.get('access-control-allow-credentials'),
          null,
          `[${sc.name}] tentativa ${attempt}: Allow-Credentials NUNCA pode aparecer`,
        )
        assertEquals(
          res.headers.get('access-control-expose-headers'),
          null,
          `[${sc.name}] tentativa ${attempt}: Expose-Headers NUNCA pode aparecer em preflight`,
        )
        assertEquals(
          res.headers.get('set-cookie'),
          null,
          `[${sc.name}] tentativa ${attempt}: Set-Cookie NUNCA pode aparecer`,
        )
        assertEquals(
          res.headers.get('set-cookie2'),
          null,
          `[${sc.name}] tentativa ${attempt}: Set-Cookie2 NUNCA pode aparecer`,
        )

        // (7) Vary — sem Origin/Cookie/Authorization (incompatível com Allow-Origin: '*').
        const vary = res.headers.get('vary')
        if (vary !== null) {
          const tokens = parseList(vary)
          for (const forbidden of ['origin', 'cookie', 'authorization', '*']) {
            assert(
              !tokens.includes(forbidden),
              `[${sc.name}] tentativa ${attempt}: Vary NÃO PODE conter "${forbidden}", recebeu "${vary}"`,
            )
          }
        }

        // (8) Leitura case-insensitive dos 4 headers CORS — funciona em qualquer casing.
        const caseVariants: Array<[string, string]> = [
          ['ACCESS-CONTROL-ALLOW-HEADERS', EXPECTED_ALLOW_HEADERS],
          ['Access-Control-Allow-Headers', EXPECTED_ALLOW_HEADERS],
          ['ACCESS-CONTROL-MAX-AGE', EXPECTED_MAX_AGE],
          ['Access-Control-Max-Age', EXPECTED_MAX_AGE],
          ['ACCESS-CONTROL-ALLOW-METHODS', EXPECTED_ALLOW_METHODS],
          ['ACCESS-CONTROL-ALLOW-ORIGIN', EXPECTED_ALLOW_ORIGIN],
        ]
        for (const [name, expected] of caseVariants) {
          assertEquals(
            res.headers.get(name),
            expected,
            `[${sc.name}] tentativa ${attempt}: header "${name}" deve retornar "${expected}"`,
          )
        }
      }
    }

    // (9) Garantia: nenhum createClient instanciado — preflight nunca toca Supabase.
    assertEquals(
      ctx._calls,
      0,
      'createClient NUNCA pode ser invocado em OPTIONS sem Origin',
    )
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: 405 method_not_allowed — CORS contract preserved across Origins and methods (Allow-Origin "*", Allow-Methods "POST, OPTIONS", NO Allow-Credentials)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Contrato esperado (literais do handler index.ts).
    const EXPECTED_ALLOW_ORIGIN = '*'
    const EXPECTED_ALLOW_METHODS = 'POST, OPTIONS'
    const EXPECTED_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_MAX_AGE = '86400'

    // Métodos que devem disparar 405 (handler aceita apenas POST/OPTIONS).
    const METHODS_405 = ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const

    // Diferentes Origens — todas devem receber o MESMO Allow-Origin: '*' literal,
    // sem eco do Origin recebido (handler não ramifica por Origin).
    const ORIGINS: Array<{ label: string; value: string | null }> = [
      { label: 'sem Origin', value: null },
      { label: 'same-origin produção', value: 'https://app.kubovibe.dev' },
      { label: 'same-origin lovable', value: 'https://kubovibe.lovable.app' },
      { label: 'cross-origin hostil', value: 'https://evil.example.com' },
      { label: 'cross-origin localhost dev', value: 'http://localhost:5173' },
      { label: 'Origin "null" (sandbox iframe / file://)', value: 'null' },
      { label: 'Origin com porta exótica', value: 'https://attacker.example.com:31337' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)

    for (const method of METHODS_405) {
      for (const origin of ORIGINS) {
        const headers: Record<string, string> = {
          'content-type': 'application/json',
          'x-test-secret': SECRET, // secret correto + método inválido = 405
        }
        if (origin.value !== null) headers['origin'] = origin.value

        const init: RequestInit = { method, headers }
        if (method !== 'GET' && method !== 'HEAD') {
          (init as RequestInit & { body: string }).body = '{}'
        }

        const res = await fetch(`${ctx.url}/`, init)
        await res.text()

        const ctxLabel = `[${method} | Origin: ${origin.label}]`

        // (1) Status 405.
        assertEquals(res.status, 405, `${ctxLabel}: status deve ser 405`)

        // (2) Allow-Origin — sempre '*' literal, NUNCA eco do Origin recebido.
        const allowOrigin = res.headers.get('access-control-allow-origin')
        assertEquals(
          allowOrigin,
          EXPECTED_ALLOW_ORIGIN,
          `${ctxLabel}: Allow-Origin deve ser '*' literal (sem eco do Origin)`,
        )
        // Defesa explícita: nunca pode igualar o Origin recebido (exceto no caso degenerado '*').
        if (origin.value !== null && origin.value !== '*') {
          assert(
            allowOrigin !== origin.value,
            `${ctxLabel}: Allow-Origin NÃO PODE ecoar o Origin recebido "${origin.value}"`,
          )
        }
        // Nunca retornar a string literal 'null' como Allow-Origin (vulnerabilidade conhecida).
        assert(
          allowOrigin !== 'null',
          `${ctxLabel}: Allow-Origin NÃO PODE ser literal 'null'`,
        )

        // (3) Allow-Methods — contrato literal exato.
        const allowMethods = res.headers.get('access-control-allow-methods')
        assertEquals(
          allowMethods,
          EXPECTED_ALLOW_METHODS,
          `${ctxLabel}: Allow-Methods deve ser "${EXPECTED_ALLOW_METHODS}"`,
        )
        // Parse + invariantes: exatamente 2 métodos, sem duplicatas, apenas POST e OPTIONS.
        const methods = parseList(allowMethods).map((m) => m.toUpperCase())
        assertEquals(methods.length, 2, `${ctxLabel}: Allow-Methods deve listar 2 métodos`)
        assertEquals(
          new Set(methods).size,
          2,
          `${ctxLabel}: Allow-Methods não pode conter duplicatas`,
        )
        assert(methods.includes('POST'), `${ctxLabel}: Allow-Methods deve incluir POST`)
        assert(methods.includes('OPTIONS'), `${ctxLabel}: Allow-Methods deve incluir OPTIONS`)
        // CRÍTICO: o método solicitado (que gerou 405) NÃO deve aparecer em Allow-Methods.
        assert(
          !methods.includes(method),
          `${ctxLabel}: Allow-Methods NÃO PODE listar o método rejeitado "${method}"`,
        )
        // Métodos perigosos NUNCA podem aparecer.
        for (const dangerous of ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'CONNECT', 'TRACE', '*']) {
          if (dangerous === 'POST' || dangerous === 'OPTIONS') continue
          assert(
            !methods.includes(dangerous),
            `${ctxLabel}: Allow-Methods NÃO PODE incluir "${dangerous}"`,
          )
        }

        // (4) Allow-Credentials — NUNCA presente (incompatível com Allow-Origin: '*').
        assertEquals(
          res.headers.get('access-control-allow-credentials'),
          null,
          `${ctxLabel}: Allow-Credentials NUNCA pode aparecer em 405`,
        )

        // (5) Allow-Headers + Max-Age — handler emite uniformemente (corsHeaders constante).
        assertEquals(
          res.headers.get('access-control-allow-headers'),
          EXPECTED_ALLOW_HEADERS,
          `${ctxLabel}: Allow-Headers deve ser literal exato`,
        )
        assertEquals(
          res.headers.get('access-control-max-age'),
          EXPECTED_MAX_AGE,
          `${ctxLabel}: Max-Age deve ser "${EXPECTED_MAX_AGE}"`,
        )

        // (6) Vary — sem Origin/Cookie/Authorization (incompatível com Allow-Origin: '*').
        const vary = res.headers.get('vary')
        if (vary !== null) {
          const tokens = vary.split(',').map((s) => s.trim().toLowerCase())
          for (const forbidden of ['origin', 'cookie', 'authorization', '*']) {
            assert(
              !tokens.includes(forbidden),
              `${ctxLabel}: Vary NÃO PODE conter "${forbidden}", recebeu "${vary}"`,
            )
          }
        }

        // (7) Expose-Headers + Set-Cookie — defesa adicional.
        assertEquals(
          res.headers.get('access-control-expose-headers'),
          null,
          `${ctxLabel}: Expose-Headers NUNCA pode aparecer em 405`,
        )
        assertEquals(
          res.headers.get('set-cookie'),
          null,
          `${ctxLabel}: Set-Cookie NUNCA pode aparecer em 405`,
        )

        // (8) Body JSON canônico do handler para 405.
        // (já consumido acima como text — recheck via headers de content-type)
        assertEquals(
          res.headers.get('content-type'),
          'application/json',
          `${ctxLabel}: Content-Type deve ser application/json`,
        )
      }
    }

    // (9) Garantia: nenhum createClient instanciado em qualquer 405 (Origin × method).
    assertEquals(
      ctx._calls,
      0,
      'createClient NUNCA pode ser invocado em respostas 405',
    )
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS without Origin — Access-Control-Request-Headers casing/spacing/comma variants — Allow-Headers stays LITERAL exact (no wildcard, no echo)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Contrato literal do handler index.ts.
    const EXPECTED_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])

    // Variantes de Access-Control-Request-Headers cobrindo:
    //   - casing (lower / Title / UPPER / mixed)
    //   - espaçamento (sem espaço, espaço único, múltiplos espaços, tab)
    //   - vírgulas (trailing, leading, duplicadas, com espaços)
    //   - quantidade (1 header, vários, todos, headers fora da allowlist)
    //   - tokens vazios entre vírgulas
    const REQUEST_HEADER_VARIANTS: Array<{ label: string; value: string }> = [
      { label: 'single lowercase',                 value: 'content-type' },
      { label: 'single Title-Case',                value: 'Content-Type' },
      { label: 'single UPPERCASE',                 value: 'CONTENT-TYPE' },
      { label: 'single mIxEd',                     value: 'CoNtEnT-TyPe' },
      { label: 'two lowercase, single space',      value: 'content-type, x-test-secret' },
      { label: 'two NO space after comma',         value: 'content-type,x-test-secret' },
      { label: 'two MULTIPLE spaces',              value: 'content-type,    x-test-secret' },
      { label: 'two tab separator',                value: 'content-type,\tx-test-secret' },
      { label: 'three mixed casing',               value: 'Content-Type, X-Test-Secret, Authorization' },
      { label: 'all 5 allowlisted',                value: 'authorization, x-client-info, apikey, content-type, x-test-secret' },
      { label: 'all 5 in UPPERCASE',               value: 'AUTHORIZATION, X-CLIENT-INFO, APIKEY, CONTENT-TYPE, X-TEST-SECRET' },
      { label: 'trailing comma',                   value: 'content-type, x-test-secret,' },
      { label: 'leading comma',                    value: ', content-type, x-test-secret' },
      { label: 'double comma (empty token)',       value: 'content-type,, x-test-secret' },
      { label: 'spaces around tokens',             value: '   content-type   ,   x-test-secret   ' },
      { label: 'header NOT in allowlist',          value: 'x-fake-header, x-evil-cookie' },
      { label: 'mix of allowed + not allowed',     value: 'content-type, x-fake-header, x-test-secret' },
      { label: 'wildcard requested by client',     value: '*' },
      { label: 'empty string',                     value: '' },
      { label: 'only commas',                      value: ',,,' },
      { label: 'only whitespace',                  value: '   ' },
      { label: 'header attempting injection',      value: 'content-type\r\nset-cookie: evil=1' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    for (const variant of REQUEST_HEADER_VARIANTS) {
      // Construir Headers manualmente — fetch sanitiza alguns valores, mas Deno aceita
      // a maioria via `Headers` literal. Wrap em try para variantes que o runtime rejeita
      // (ex: CRLF injection — fetch deve recusar, validando defesa do runtime).
      let res: Response
      try {
        res = await fetch(`${ctx.url}/`, {
          method: 'OPTIONS',
          headers: {
            // SEM Origin (foco do teste).
            'access-control-request-method': 'POST',
            'access-control-request-headers': variant.value,
          },
        })
      } catch (e) {
        // Se o runtime rejeita o header (ex: CRLF), isso já valida a defesa.
        // Esperamos rejeição apenas para a variante de injection.
        if (variant.label === 'header attempting injection') {
          assert(
            e instanceof TypeError,
            `[${variant.label}]: runtime deve rejeitar CRLF injection com TypeError`,
          )
          continue
        }
        throw new Error(`[${variant.label}]: fetch falhou inesperadamente: ${(e as Error).message}`)
      }
      await res.text()

      // (1) Status 200 — preflight sempre aceito (handler não valida Request-Headers).
      assertEquals(res.status, 200, `[${variant.label}]: preflight deve retornar 200`)

      // (2) Allow-Headers — LITERAL EXATO, sem importar o que o cliente pediu.
      const ah = res.headers.get('access-control-allow-headers')
      assertExists(ah, `[${variant.label}]: Allow-Headers deve estar presente`)
      assertEquals(
        ah,
        EXPECTED_ALLOW_HEADERS,
        `[${variant.label}]: Allow-Headers deve ser literal "${EXPECTED_ALLOW_HEADERS}" (NÃO ecoar Request-Headers)`,
      )

      // (3) Conjunto parseado bate exatamente — 5 headers, sem extras, sem omissões.
      const parsed = new Set(parseList(ah))
      assertEquals(
        parsed.size,
        EXPECTED_SET.size,
        `[${variant.label}]: Allow-Headers deve listar exatamente 5 headers`,
      )
      for (const h of EXPECTED_SET) {
        assert(parsed.has(h), `[${variant.label}]: Allow-Headers deve incluir "${h}"`)
      }

      // (4) NUNCA wildcard '*' — incompatível com credenciais e ambíguo para browsers.
      assert(
        !parsed.has('*'),
        `[${variant.label}]: Allow-Headers NÃO PODE conter wildcard '*'`,
      )

      // (5) NUNCA ecoar tokens não-allowlisted (ex: 'x-fake-header', 'x-evil-cookie',
      // 'set-cookie') que o cliente possa ter pedido em Request-Headers.
      const FORBIDDEN_ECHOES = [
        'x-fake-header', 'x-evil-cookie', 'set-cookie', 'set-cookie2',
        'cookie', 'host', 'origin',
      ]
      for (const f of FORBIDDEN_ECHOES) {
        assert(
          !parsed.has(f),
          `[${variant.label}]: Allow-Headers NÃO PODE ecoar token não-allowlisted "${f}"`,
        )
      }

      // (6) Sanidade: contrato CORS completo permanece estável independente da variante.
      assertEquals(
        res.headers.get('access-control-allow-origin'), '*',
        `[${variant.label}]: Allow-Origin deve permanecer '*'`,
      )
      assertEquals(
        res.headers.get('access-control-allow-methods'), 'POST, OPTIONS',
        `[${variant.label}]: Allow-Methods deve permanecer 'POST, OPTIONS'`,
      )
      assertEquals(
        res.headers.get('access-control-max-age'), '86400',
        `[${variant.label}]: Max-Age deve permanecer '86400'`,
      )
      assertEquals(
        res.headers.get('access-control-allow-credentials'), null,
        `[${variant.label}]: Allow-Credentials NUNCA pode aparecer`,
      )
    }

    // (7) Garantia: nenhum createClient instanciado em qualquer variante de preflight.
    assertEquals(
      ctx._calls,
      0,
      'createClient NUNCA pode ser invocado em OPTIONS preflight',
    )
  } finally {
    await ctx.stop()
  }
})
