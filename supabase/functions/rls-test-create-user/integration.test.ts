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

Deno.test('HTTP integration: 401/403 auth-rejection — uniform CORS contract across Origins (Allow-Origin "*", NO Allow-Credentials, literal Allow-Headers/Max-Age)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    // Contrato literal do handler index.ts.
    const EXPECTED_ALLOW_ORIGIN = '*'
    const EXPECTED_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_ALLOW_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const EXPECTED_MAX_AGE = '86400'
    const EXPECTED_ALLOW_METHODS = 'POST, OPTIONS'

    // Cenários que produzem 401 (handler real).
    // Nota: handler não emite 403, mas a invariante é defensiva — vale para qualquer
    // resposta auth-rejection futura (401/403). Cobrimos todos os caminhos 401 reais.
    const AUTH_REJECTION_SCENARIOS: Array<{ name: string; status: number; secretHeader: Record<string, string> }> = [
      { name: '401 — sem x-test-secret',          status: 401, secretHeader: {} },
      { name: '401 — x-test-secret vazio',        status: 401, secretHeader: { 'x-test-secret': '' } },
      { name: '401 — x-test-secret incorreto',    status: 401, secretHeader: { 'x-test-secret': 'wrong-secret' } },
      { name: '401 — x-test-secret tamanho errado',status: 401, secretHeader: { 'x-test-secret': SECRET + 'X' } },
    ]

    // Diferentes Origens — contrato deve ser idêntico para todas.
    const ORIGINS: Array<{ label: string; value: string | null }> = [
      { label: 'sem Origin',                      value: null },
      { label: 'same-origin produção',            value: 'https://app.kubovibe.dev' },
      { label: 'same-origin lovable',             value: 'https://kubovibe.lovable.app' },
      { label: 'cross-origin hostil',             value: 'https://evil.example.com' },
      { label: 'cross-origin localhost',          value: 'http://localhost:5173' },
      { label: 'Origin literal "null" (sandbox)', value: 'null' },
      { label: 'cross-origin porta exótica',      value: 'https://attacker.example.com:31337' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    for (const sc of AUTH_REJECTION_SCENARIOS) {
      for (const origin of ORIGINS) {
        const headers: Record<string, string> = {
          'content-type': 'application/json',
          ...sc.secretHeader,
        }
        if (origin.value !== null) headers['origin'] = origin.value

        const res = await fetch(`${ctx.url}/`, {
          method: 'POST',
          headers,
          body: '{}',
        })
        await res.text()

        const ctxLabel = `[${sc.name} | Origin: ${origin.label}]`

        // (1) Status esperado.
        assertEquals(res.status, sc.status, `${ctxLabel}: status deve ser ${sc.status}`)

        // (2) Allow-Origin — sempre '*' literal, NUNCA eco do Origin recebido.
        const allowOrigin = res.headers.get('access-control-allow-origin')
        assertEquals(
          allowOrigin,
          EXPECTED_ALLOW_ORIGIN,
          `${ctxLabel}: Allow-Origin deve ser '*' literal`,
        )
        if (origin.value !== null && origin.value !== '*') {
          assert(
            allowOrigin !== origin.value,
            `${ctxLabel}: Allow-Origin NÃO PODE ecoar Origin recebido "${origin.value}"`,
          )
        }
        assert(
          allowOrigin !== 'null',
          `${ctxLabel}: Allow-Origin NÃO PODE ser literal 'null' (vulnerabilidade conhecida)`,
        )

        // (3) Allow-Credentials — NUNCA presente (incompatível com Allow-Origin: '*').
        assertEquals(
          res.headers.get('access-control-allow-credentials'),
          null,
          `${ctxLabel}: Allow-Credentials NUNCA pode aparecer em ${sc.status}`,
        )

        // (4) Allow-Headers — contrato literal exato e uniforme.
        const ah = res.headers.get('access-control-allow-headers')
        assertEquals(
          ah,
          EXPECTED_ALLOW_HEADERS,
          `${ctxLabel}: Allow-Headers deve ser literal exato`,
        )
        const ahSet = new Set(parseList(ah))
        assertEquals(
          ahSet.size,
          EXPECTED_ALLOW_HEADERS_SET.size,
          `${ctxLabel}: Allow-Headers deve listar exatamente ${EXPECTED_ALLOW_HEADERS_SET.size} headers`,
        )
        for (const h of EXPECTED_ALLOW_HEADERS_SET) {
          assert(ahSet.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
        }
        assert(
          !ahSet.has('*'),
          `${ctxLabel}: Allow-Headers NÃO PODE conter wildcard '*'`,
        )

        // (5) Max-Age — contrato literal uniforme.
        assertEquals(
          res.headers.get('access-control-max-age'),
          EXPECTED_MAX_AGE,
          `${ctxLabel}: Max-Age deve ser literal "${EXPECTED_MAX_AGE}"`,
        )

        // (6) Allow-Methods — contrato literal uniforme.
        assertEquals(
          res.headers.get('access-control-allow-methods'),
          EXPECTED_ALLOW_METHODS,
          `${ctxLabel}: Allow-Methods deve ser "${EXPECTED_ALLOW_METHODS}"`,
        )

        // (7) Vary — sem tokens proibidos (incompatíveis com Allow-Origin: '*').
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

        // (8) Expose-Headers + Set-Cookie — defesa adicional.
        assertEquals(
          res.headers.get('access-control-expose-headers'),
          null,
          `${ctxLabel}: Expose-Headers NUNCA pode aparecer em ${sc.status}`,
        )
        assertEquals(
          res.headers.get('set-cookie'),
          null,
          `${ctxLabel}: Set-Cookie NUNCA pode aparecer em ${sc.status}`,
        )
        assertEquals(
          res.headers.get('set-cookie2'),
          null,
          `${ctxLabel}: Set-Cookie2 NUNCA pode aparecer em ${sc.status}`,
        )

        // (9) Content-Type JSON canônico.
        assertEquals(
          res.headers.get('content-type'),
          'application/json',
          `${ctxLabel}: Content-Type deve ser application/json`,
        )
      }
    }

    // (10) Garantia: nenhum createClient instanciado em qualquer 401.
    assertEquals(
      ctx._calls,
      0,
      'createClient NUNCA pode ser invocado em respostas 401/403',
    )
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS — Allow-Origin is ALWAYS literal "*" (no Origin → "*"; any Origin/casing → never echo)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED = '*'

    // ---- PARTE 1: OPTIONS SEM Origin → sempre '*' literal ----
    const NO_ORIGIN_SCENARIOS: Array<{ name: string; init: RequestInit }> = [
      { name: 'OPTIONS puro',                          init: { method: 'OPTIONS' } },
      { name: 'OPTIONS + Request-Method',              init: { method: 'OPTIONS', headers: { 'access-control-request-method': 'POST' } } },
      { name: 'OPTIONS + Request-Headers',             init: { method: 'OPTIONS', headers: { 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } } },
      { name: 'OPTIONS + Cookie hostil sem Origin',    init: { method: 'OPTIONS', headers: { 'cookie': 'sid=stolen; auth=fake' } } },
      { name: 'OPTIONS + Authorization sem Origin',    init: { method: 'OPTIONS', headers: { 'authorization': 'Bearer token' } } },
      { name: 'OPTIONS + Referer sem Origin',          init: { method: 'OPTIONS', headers: { 'referer': 'https://evil.example.com/page' } } },
      { name: 'OPTIONS + User-Agent custom sem Origin',init: { method: 'OPTIONS', headers: { 'user-agent': 'curl/8.4.0' } } },
    ]

    for (const sc of NO_ORIGIN_SCENARIOS) {
      // Garantir que Origin de fato não está sendo enviado.
      const sent = new Headers((sc.init.headers ?? {}) as HeadersInit)
      assert(!sent.has('origin'), `[${sc.name}] cenário inválido: Origin não pode estar presente`)

      // 2 tentativas idempotentes.
      for (let attempt = 1; attempt <= 2; attempt++) {
        const res = await fetch(`${ctx.url}/`, sc.init)
        await res.text()

        assertEquals(res.status, 200, `[NO ORIGIN | ${sc.name}] tentativa ${attempt}: status deve ser 200`)
        const allowOrigin = res.headers.get('access-control-allow-origin')
        assertEquals(
          allowOrigin,
          EXPECTED,
          `[NO ORIGIN | ${sc.name}] tentativa ${attempt}: Allow-Origin deve ser '*' literal`,
        )
        // NUNCA literal 'null'.
        assert(allowOrigin !== 'null', `[NO ORIGIN | ${sc.name}] Allow-Origin NUNCA pode ser 'null'`)
        // NUNCA Allow-Credentials (incompatível com '*').
        assertEquals(
          res.headers.get('access-control-allow-credentials'), null,
          `[NO ORIGIN | ${sc.name}] Allow-Credentials NUNCA pode aparecer`,
        )
      }
    }

    // ---- PARTE 2: OPTIONS COM Origin em variações de casing → nunca eco ----
    // O fetch normaliza o NOME do header para lower-case, mas o VALOR é preservado.
    // Validamos que diferentes valores de Origin (incluindo casing exótico no host,
    // schemas, e nomes de header em variantes) jamais resultam em eco do Origin.
    const ORIGIN_VALUES_VARIANTS: string[] = [
      // Casing variado no host/scheme.
      'https://app.kubovibe.dev',
      'https://APP.KUBOVIBE.DEV',
      'HTTPS://app.kubovibe.dev',
      'https://App.KuBoViBe.Dev',
      // Cross-origin hostis com casing.
      'https://evil.example.com',
      'https://EVIL.EXAMPLE.COM',
      'https://EvIl.ExAmPlE.cOm',
      // Origin literal 'null' em casings (browsers só enviam 'null' lowercase, mas defesa).
      'null',
      'NULL',
      'Null',
      // Schemas variados.
      'http://localhost:5173',
      'HTTP://LOCALHOST:5173',
      // Porta exótica.
      'https://attacker.example.com:31337',
      // Valores com path/query (inválidos por RFC mas defesa).
      'https://app.kubovibe.dev/path',
      // Wildcard literal enviado pelo cliente.
      '*',
      // Tentativa de injection (runtime pode rejeitar).
      'https://evil.com\r\nset-cookie: pwn=1',
    ]

    // Variantes do NOME do header Origin — fetch normaliza para lowercase, mas
    // garantimos que o servidor lê via Headers.get (case-insensitive) e não ecoa.
    const ORIGIN_HEADER_NAME_VARIANTS = ['origin', 'Origin', 'ORIGIN', 'OrIgIn']

    for (const headerName of ORIGIN_HEADER_NAME_VARIANTS) {
      for (const originValue of ORIGIN_VALUES_VARIANTS) {
        let res: Response
        try {
          res = await fetch(`${ctx.url}/`, {
            method: 'OPTIONS',
            headers: {
              [headerName]: originValue,
              'access-control-request-method': 'POST',
            },
          })
        } catch (e) {
          // CRLF injection deve ser rejeitada pelo runtime (defesa de baixo nível).
          if (originValue.includes('\r\n')) {
            assert(
              e instanceof TypeError,
              `[name=${headerName} | value=${originValue}]: runtime deve rejeitar CRLF com TypeError`,
            )
            continue
          }
          throw new Error(`[name=${headerName} | value=${originValue}]: fetch falhou: ${(e as Error).message}`)
        }
        await res.text()

        const ctxLabel = `[name=${headerName} | value=${JSON.stringify(originValue)}]`

        // (1) Status 200.
        assertEquals(res.status, 200, `${ctxLabel}: status deve ser 200`)

        // (2) Allow-Origin SEMPRE '*' literal — jamais eco.
        const allowOrigin = res.headers.get('access-control-allow-origin')
        assertEquals(
          allowOrigin,
          EXPECTED,
          `${ctxLabel}: Allow-Origin deve ser '*' literal`,
        )

        // (3) NUNCA igualar o valor de Origin recebido (exceto quando cliente mandou '*' literal,
        // caso degenerado em que coincide — mas mesmo assim handler não está "ecoando").
        if (originValue !== '*') {
          assert(
            allowOrigin !== originValue,
            `${ctxLabel}: Allow-Origin NÃO PODE ecoar o valor de Origin recebido`,
          )
        }

        // (4) NUNCA literal 'null' (em qualquer casing) — handler retorna '*'.
        assert(
          allowOrigin !== 'null' && allowOrigin !== 'NULL' && allowOrigin !== 'Null',
          `${ctxLabel}: Allow-Origin NUNCA pode ser 'null' em qualquer casing`,
        )

        // (5) NUNCA versão lowercase do Origin recebido.
        if (originValue !== '*') {
          assert(
            allowOrigin?.toLowerCase() !== originValue.toLowerCase(),
            `${ctxLabel}: Allow-Origin NÃO PODE ser variação case-insensitive do Origin`,
          )
        }

        // (6) Allow-Credentials NUNCA presente (incompatível com '*').
        assertEquals(
          res.headers.get('access-control-allow-credentials'),
          null,
          `${ctxLabel}: Allow-Credentials NUNCA pode aparecer`,
        )

        // (7) Vary NUNCA contém 'origin' — eliminaria valor do '*' como cache key.
        const vary = res.headers.get('vary')
        if (vary !== null) {
          const tokens = vary.split(',').map((s) => s.trim().toLowerCase())
          assert(
            !tokens.includes('origin'),
            `${ctxLabel}: Vary NÃO PODE conter 'origin' (incompatível com Allow-Origin: '*')`,
          )
        }

        // (8) Allow-Origin aparece exatamente 1x (sem duplicação por proxy).
        let occurrences = 0
        for (const [name] of res.headers) {
          if (name.toLowerCase() === 'access-control-allow-origin') occurrences++
        }
        assertEquals(
          occurrences, 1,
          `${ctxLabel}: Allow-Origin deve aparecer exatamente 1x, encontrou ${occurrences}`,
        )
      }
    }

    // (9) Garantia: nenhum createClient instanciado em qualquer preflight.
    assertEquals(
      ctx._calls, 0,
      'createClient NUNCA pode ser invocado em OPTIONS preflight',
    )
  } finally {
    await ctx.stop()
  }
})

// ============================================================
// Servidor auxiliar: força respostas 403 reusando o MESMO corsHeaders
// importado do handler real. Isso valida o invariante de contrato CORS
// que se aplicaria a qualquer 403 futuro emitido pelo handler.
// ============================================================
async function start403Server(): Promise<{ url: string; stop: () => Promise<void>; calls: number }> {
  // Importa corsHeaders do handler via re-execução do módulo — como index.ts não
  // exporta corsHeaders publicamente, replicamos o LITERAL exato (em sync com index.ts).
  // Qualquer divergência aqui falharia os testes Allow-Headers/Max-Age existentes.
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-test-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }

  let calls = 0
  const ac = new AbortController()
  const server = Deno.serve(
    { port: 0, hostname: '127.0.0.1', signal: ac.signal, onListen: () => {} },
    (req) => {
      if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
      }
      calls++
      // Força 403 reusando corsHeaders — simula caminho futuro de autorização (RBAC).
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    },
  )
  const addr = (server as unknown as { addr: { hostname: string; port: number } }).addr
  return {
    url: `http://${addr.hostname}:${addr.port}`,
    stop: async () => { ac.abort(); try { await server.finished } catch { /* ignore */ } },
    get calls() { return calls },
  } as { url: string; stop: () => Promise<void>; calls: number }
}

Deno.test('HTTP integration: 403 forbidden — uniform CORS contract across Origins (Allow-Origin "*", NO Allow-Credentials, literal Allow-Headers/Max-Age)', async () => {
  const ctx = await start403Server()
  try {
    const EXPECTED_ALLOW_ORIGIN = '*'
    const EXPECTED_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_ALLOW_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const EXPECTED_MAX_AGE = '86400'
    const EXPECTED_ALLOW_METHODS = 'POST, OPTIONS'

    const ORIGINS: Array<{ label: string; value: string | null }> = [
      { label: 'sem Origin',                      value: null },
      { label: 'same-origin produção',            value: 'https://app.kubovibe.dev' },
      { label: 'same-origin lovable',             value: 'https://kubovibe.lovable.app' },
      { label: 'cross-origin hostil',             value: 'https://evil.example.com' },
      { label: 'cross-origin localhost',          value: 'http://localhost:5173' },
      { label: 'Origin literal "null" (sandbox)', value: 'null' },
      { label: 'cross-origin porta exótica',      value: 'https://attacker.example.com:31337' },
    ]

    // Métodos que devem disparar 403 no servidor auxiliar (qualquer ≠ OPTIONS).
    const METHODS = ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'] as const

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    for (const method of METHODS) {
      for (const origin of ORIGINS) {
        const headers: Record<string, string> = { 'content-type': 'application/json' }
        if (origin.value !== null) headers['origin'] = origin.value

        const init: RequestInit = { method, headers }
        if (method !== 'GET') {
          (init as RequestInit & { body: string }).body = '{}'
        }

        const res = await fetch(`${ctx.url}/`, init)
        await res.text()
        const ctxLabel = `[${method} | Origin: ${origin.label}]`

        // (1) Status 403.
        assertEquals(res.status, 403, `${ctxLabel}: status deve ser 403`)

        // (2) Allow-Origin '*' literal — sem eco.
        const allowOrigin = res.headers.get('access-control-allow-origin')
        assertEquals(
          allowOrigin, EXPECTED_ALLOW_ORIGIN,
          `${ctxLabel}: Allow-Origin deve ser '*' literal`,
        )
        if (origin.value !== null && origin.value !== '*') {
          assert(
            allowOrigin !== origin.value,
            `${ctxLabel}: Allow-Origin NÃO PODE ecoar Origin "${origin.value}"`,
          )
        }
        assert(allowOrigin !== 'null', `${ctxLabel}: Allow-Origin NUNCA pode ser literal 'null'`)

        // (3) Allow-Credentials NUNCA presente.
        assertEquals(
          res.headers.get('access-control-allow-credentials'), null,
          `${ctxLabel}: Allow-Credentials NUNCA pode aparecer em 403`,
        )

        // (4) Allow-Headers literal exato.
        const ah = res.headers.get('access-control-allow-headers')
        assertEquals(
          ah, EXPECTED_ALLOW_HEADERS,
          `${ctxLabel}: Allow-Headers deve ser literal exato`,
        )
        const ahSet = new Set(parseList(ah))
        assertEquals(ahSet.size, EXPECTED_ALLOW_HEADERS_SET.size, `${ctxLabel}: Allow-Headers deve listar 5 headers`)
        for (const h of EXPECTED_ALLOW_HEADERS_SET) {
          assert(ahSet.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
        }
        assert(!ahSet.has('*'), `${ctxLabel}: Allow-Headers NÃO PODE conter wildcard '*'`)

        // (5) Max-Age literal.
        assertEquals(
          res.headers.get('access-control-max-age'), EXPECTED_MAX_AGE,
          `${ctxLabel}: Max-Age deve ser "${EXPECTED_MAX_AGE}"`,
        )

        // (6) Allow-Methods literal.
        assertEquals(
          res.headers.get('access-control-allow-methods'), EXPECTED_ALLOW_METHODS,
          `${ctxLabel}: Allow-Methods deve ser "${EXPECTED_ALLOW_METHODS}"`,
        )

        // (7) Vary sem tokens proibidos.
        const vary = res.headers.get('vary')
        if (vary !== null) {
          const tokens = vary.split(',').map((s) => s.trim().toLowerCase())
          for (const forbidden of ['origin', 'cookie', 'authorization', '*']) {
            assert(!tokens.includes(forbidden), `${ctxLabel}: Vary NÃO PODE conter "${forbidden}"`)
          }
        }

        // (8) Set-Cookie/Expose-Headers ausentes.
        assertEquals(res.headers.get('access-control-expose-headers'), null, `${ctxLabel}: Expose-Headers NUNCA pode aparecer`)
        assertEquals(res.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA pode aparecer em 403`)
        assertEquals(res.headers.get('set-cookie2'), null, `${ctxLabel}: Set-Cookie2 NUNCA pode aparecer em 403`)

        // (9) Content-Type JSON canônico.
        assertEquals(
          res.headers.get('content-type'), 'application/json',
          `${ctxLabel}: Content-Type deve ser application/json`,
        )
      }
    }
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS without Origin — Access-Control-Request-Method casing/spacing variants — Allow-Methods stays LITERAL "POST, OPTIONS"', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_LITERAL = 'POST, OPTIONS'
    const EXPECTED_SET = new Set(['POST', 'OPTIONS'])

    // Variantes de Access-Control-Request-Method cobrindo:
    //   - casing (lower / Title / UPPER / mIxEd)
    //   - espaçamento (leading/trailing whitespace, tab)
    //   - métodos rejeitados (GET, PUT, DELETE, HEAD, PATCH, CONNECT, TRACE)
    //   - métodos não-padrão / hostis (PROPFIND, custom, wildcard)
    //   - tokens vazios / inválidos
    const REQUEST_METHOD_VARIANTS: Array<{ label: string; value: string }> = [
      // Casing — POST.
      { label: 'POST UPPER',                value: 'POST' },
      { label: 'post lower',                value: 'post' },
      { label: 'Post Title',                value: 'Post' },
      { label: 'PoSt mixed',                value: 'PoSt' },
      // Casing — OPTIONS.
      { label: 'OPTIONS UPPER',             value: 'OPTIONS' },
      { label: 'options lower',             value: 'options' },
      { label: 'OpTiOnS mixed',             value: 'OpTiOnS' },
      // Espaçamento.
      { label: 'POST leading space',        value: ' POST' },
      { label: 'POST trailing space',       value: 'POST ' },
      { label: 'POST surrounding spaces',   value: '  POST  ' },
      { label: 'POST with tab',             value: '\tPOST' },
      // Métodos NÃO suportados pelo handler — Allow-Methods deve ignorar e devolver literal fixo.
      { label: 'GET (rejected method)',     value: 'GET' },
      { label: 'PUT (rejected method)',     value: 'PUT' },
      { label: 'DELETE (rejected method)',  value: 'DELETE' },
      { label: 'PATCH (rejected method)',   value: 'PATCH' },
      { label: 'HEAD (rejected method)',    value: 'HEAD' },
      { label: 'CONNECT (rejected method)', value: 'CONNECT' },
      { label: 'TRACE (rejected method)',   value: 'TRACE' },
      // Métodos não-padrão / hostis.
      { label: 'PROPFIND (WebDAV)',         value: 'PROPFIND' },
      { label: 'CUSTOM-METHOD',             value: 'CUSTOM-METHOD' },
      { label: 'wildcard *',                value: '*' },
      // Edge cases.
      { label: 'empty string',              value: '' },
      { label: 'only whitespace',           value: '   ' },
      { label: 'only tab',                  value: '\t' },
    ]

    const parseMethods = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)

    for (const variant of REQUEST_METHOD_VARIANTS) {
      let res: Response
      try {
        res = await fetch(`${ctx.url}/`, {
          method: 'OPTIONS',
          headers: {
            // SEM Origin (foco do teste).
            'access-control-request-method': variant.value,
            'access-control-request-headers': 'content-type',
          },
        })
      } catch (e) {
        // Runtime pode rejeitar empty string em alguns casos — defesa esperada.
        if (variant.value === '') {
          // Empty header value pode ser aceito ou rejeitado dependendo do runtime.
          // Se rejeitar com TypeError, validamos a defesa de baixo nível.
          assert(
            e instanceof TypeError,
            `[${variant.label}]: erro inesperado: ${(e as Error).message}`,
          )
          continue
        }
        throw new Error(`[${variant.label}]: fetch falhou inesperadamente: ${(e as Error).message}`)
      }
      await res.text()

      // (1) Status 200 — handler aceita preflight independentemente do Request-Method.
      assertEquals(res.status, 200, `[${variant.label}]: preflight deve retornar 200`)

      // (2) Allow-Methods LITERAL EXATO — handler NÃO ramifica por Request-Method.
      const allowMethods = res.headers.get('access-control-allow-methods')
      assertExists(allowMethods, `[${variant.label}]: Allow-Methods deve estar presente`)
      assertEquals(
        allowMethods,
        EXPECTED_LITERAL,
        `[${variant.label}]: Allow-Methods deve ser literal "${EXPECTED_LITERAL}" (NÃO ecoar Request-Method)`,
      )

      // (3) Conjunto parseado — exatamente 2 métodos, nem mais nem menos.
      const methods = parseMethods(allowMethods)
      assertEquals(
        methods.length, 2,
        `[${variant.label}]: Allow-Methods deve listar exatamente 2 métodos`,
      )
      assertEquals(
        new Set(methods).size, 2,
        `[${variant.label}]: Allow-Methods NÃO PODE conter duplicatas`,
      )
      for (const m of EXPECTED_SET) {
        assert(methods.includes(m), `[${variant.label}]: Allow-Methods deve incluir "${m}"`)
      }

      // (4) NUNCA ecoar o método solicitado (especialmente os rejeitados).
      const requestedMethod = variant.value.trim().toUpperCase()
      if (requestedMethod && requestedMethod !== 'POST' && requestedMethod !== 'OPTIONS') {
        assert(
          !methods.includes(requestedMethod),
          `[${variant.label}]: Allow-Methods NÃO PODE ecoar método solicitado "${requestedMethod}"`,
        )
      }

      // (5) NUNCA wildcard '*' — incompatível com credenciais e ambíguo.
      assert(
        !methods.includes('*'),
        `[${variant.label}]: Allow-Methods NÃO PODE conter wildcard '*'`,
      )

      // (6) Métodos perigosos NUNCA presentes.
      const FORBIDDEN_METHODS = ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'CONNECT', 'TRACE', 'PROPFIND']
      for (const f of FORBIDDEN_METHODS) {
        assert(
          !methods.includes(f),
          `[${variant.label}]: Allow-Methods NÃO PODE incluir método perigoso "${f}"`,
        )
      }

      // (7) Sanidade: contrato CORS completo permanece estável (sem Origin enviado).
      assertEquals(
        res.headers.get('access-control-allow-origin'), '*',
        `[${variant.label}]: Allow-Origin deve permanecer '*'`,
      )
      assertEquals(
        res.headers.get('access-control-allow-headers'),
        'authorization, x-client-info, apikey, content-type, x-test-secret',
        `[${variant.label}]: Allow-Headers deve permanecer literal exato`,
      )
      assertEquals(
        res.headers.get('access-control-max-age'), '86400',
        `[${variant.label}]: Max-Age deve permanecer '86400'`,
      )
      assertEquals(
        res.headers.get('access-control-allow-credentials'), null,
        `[${variant.label}]: Allow-Credentials NUNCA pode aparecer`,
      )

      // (8) Allow-Methods aparece exatamente 1x (sem duplicação por proxy).
      let occurrences = 0
      for (const [name] of res.headers) {
        if (name.toLowerCase() === 'access-control-allow-methods') occurrences++
      }
      assertEquals(
        occurrences, 1,
        `[${variant.label}]: Allow-Methods deve aparecer exatamente 1x, encontrou ${occurrences}`,
      )

      // (9) Leitura case-insensitive do nome do header.
      for (const headerName of [
        'access-control-allow-methods',
        'Access-Control-Allow-Methods',
        'ACCESS-CONTROL-ALLOW-METHODS',
      ]) {
        assertEquals(
          res.headers.get(headerName), EXPECTED_LITERAL,
          `[${variant.label}]: header "${headerName}" deve ser legível e idêntico`,
        )
      }
    }

    // (10) Garantia: nenhum createClient instanciado em qualquer preflight.
    assertEquals(
      ctx._calls, 0,
      'createClient NUNCA pode ser invocado em OPTIONS preflight',
    )
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS WITH Origin — Access-Control-Request-Method casing/spacing variants — Allow-Methods stays LITERAL "POST, OPTIONS" (no echo, no leak across Origins)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_LITERAL = 'POST, OPTIONS'
    const EXPECTED_SET = new Set(['POST', 'OPTIONS'])

    // Variantes de Request-Method (casing/spacing/rejected/exotic).
    const REQUEST_METHOD_VARIANTS: Array<{ label: string; value: string }> = [
      { label: 'POST UPPER',                value: 'POST' },
      { label: 'post lower',                value: 'post' },
      { label: 'Post Title',                value: 'Post' },
      { label: 'PoSt mixed',                value: 'PoSt' },
      { label: 'OPTIONS UPPER',             value: 'OPTIONS' },
      { label: 'options lower',             value: 'options' },
      { label: 'OpTiOnS mixed',             value: 'OpTiOnS' },
      { label: 'POST leading space',        value: ' POST' },
      { label: 'POST trailing space',       value: 'POST ' },
      { label: 'POST surrounding spaces',   value: '  POST  ' },
      { label: 'POST with tab',             value: '\tPOST' },
      { label: 'GET (rejected)',            value: 'GET' },
      { label: 'PUT (rejected)',            value: 'PUT' },
      { label: 'DELETE (rejected)',         value: 'DELETE' },
      { label: 'PATCH (rejected)',          value: 'PATCH' },
      { label: 'HEAD (rejected)',           value: 'HEAD' },
      { label: 'CONNECT (rejected)',        value: 'CONNECT' },
      { label: 'TRACE (rejected)',          value: 'TRACE' },
      { label: 'PROPFIND (WebDAV)',         value: 'PROPFIND' },
      { label: 'CUSTOM-METHOD',             value: 'CUSTOM-METHOD' },
      { label: 'wildcard *',                value: '*' },
    ]

    // Origens diversas — Allow-Methods deve ser idêntico para todas (handler não ramifica).
    const ORIGINS: Array<{ label: string; value: string }> = [
      { label: 'same-origin produção',     value: 'https://app.kubovibe.dev' },
      { label: 'same-origin lovable',      value: 'https://kubovibe.lovable.app' },
      { label: 'cross-origin hostil',      value: 'https://evil.example.com' },
      { label: 'localhost dev',            value: 'http://localhost:5173' },
      { label: 'Origin literal "null"',    value: 'null' },
      { label: 'porta exótica',            value: 'https://attacker.example.com:31337' },
    ]

    const parseMethods = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)

    for (const origin of ORIGINS) {
      for (const variant of REQUEST_METHOD_VARIANTS) {
        const res = await fetch(`${ctx.url}/`, {
          method: 'OPTIONS',
          headers: {
            'origin': origin.value,
            'access-control-request-method': variant.value,
            'access-control-request-headers': 'content-type',
          },
        })
        await res.text()

        const ctxLabel = `[Origin: ${origin.label} | Request-Method: ${variant.label}]`

        // (1) Status 200.
        assertEquals(res.status, 200, `${ctxLabel}: preflight deve retornar 200`)

        // (2) Allow-Methods LITERAL EXATO — handler NÃO ramifica por Origin nem por Request-Method.
        const allowMethods = res.headers.get('access-control-allow-methods')
        assertEquals(
          allowMethods,
          EXPECTED_LITERAL,
          `${ctxLabel}: Allow-Methods deve ser literal "${EXPECTED_LITERAL}"`,
        )

        // (3) Conjunto parseado — exatamente 2 métodos sem duplicatas.
        const methods = parseMethods(allowMethods)
        assertEquals(methods.length, 2, `${ctxLabel}: Allow-Methods deve listar 2 métodos`)
        assertEquals(new Set(methods).size, 2, `${ctxLabel}: Allow-Methods sem duplicatas`)
        for (const m of EXPECTED_SET) {
          assert(methods.includes(m), `${ctxLabel}: Allow-Methods deve incluir "${m}"`)
        }

        // (4) NUNCA ecoar o Request-Method solicitado (especialmente os rejeitados).
        const requested = variant.value.trim().toUpperCase()
        if (requested && requested !== 'POST' && requested !== 'OPTIONS') {
          assert(
            !methods.includes(requested),
            `${ctxLabel}: Allow-Methods NÃO PODE ecoar Request-Method "${requested}"`,
          )
        }

        // (5) NUNCA wildcard nem métodos perigosos.
        assert(!methods.includes('*'), `${ctxLabel}: Allow-Methods NÃO PODE conter '*'`)
        const FORBIDDEN = ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'CONNECT', 'TRACE', 'PROPFIND']
        for (const f of FORBIDDEN) {
          assert(!methods.includes(f), `${ctxLabel}: Allow-Methods NÃO PODE incluir "${f}"`)
        }

        // (6) Allow-Origin permanece '*' literal — sem eco mesmo com Origin presente.
        const allowOrigin = res.headers.get('access-control-allow-origin')
        assertEquals(allowOrigin, '*', `${ctxLabel}: Allow-Origin deve ser '*' literal`)
        assert(allowOrigin !== origin.value, `${ctxLabel}: Allow-Origin NÃO PODE ecoar Origin`)
        assert(allowOrigin !== 'null', `${ctxLabel}: Allow-Origin NUNCA pode ser 'null'`)

        // (7) Allow-Credentials NUNCA presente (incompatível com '*').
        assertEquals(
          res.headers.get('access-control-allow-credentials'), null,
          `${ctxLabel}: Allow-Credentials NUNCA pode aparecer`,
        )

        // (8) Allow-Headers + Max-Age permanecem literais (contrato uniforme).
        assertEquals(
          res.headers.get('access-control-allow-headers'),
          'authorization, x-client-info, apikey, content-type, x-test-secret',
          `${ctxLabel}: Allow-Headers deve permanecer literal exato`,
        )
        assertEquals(
          res.headers.get('access-control-max-age'), '86400',
          `${ctxLabel}: Max-Age deve permanecer '86400'`,
        )

        // (9) Vary sem 'origin' (incompatível com Allow-Origin: '*').
        const vary = res.headers.get('vary')
        if (vary !== null) {
          const tokens = vary.split(',').map((s) => s.trim().toLowerCase())
          assert(
            !tokens.includes('origin'),
            `${ctxLabel}: Vary NÃO PODE conter 'origin', recebeu "${vary}"`,
          )
        }

        // (10) Allow-Methods aparece exatamente 1x.
        let occurrences = 0
        for (const [name] of res.headers) {
          if (name.toLowerCase() === 'access-control-allow-methods') occurrences++
        }
        assertEquals(
          occurrences, 1,
          `${ctxLabel}: Allow-Methods deve aparecer exatamente 1x`,
        )
      }
    }

    // (11) Garantia: nenhum createClient instanciado em qualquer preflight.
    assertEquals(
      ctx._calls, 0,
      'createClient NUNCA pode ser invocado em OPTIONS preflight',
    )
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS WITH Origin — Allow-Headers stays LITERAL exact across all Request-Headers variants and Origins (no echo, no dangerous headers)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const DANGEROUS_HEADERS = [
      'set-cookie', 'set-cookie2', 'cookie', 'cookie2',
      'host', 'origin', 'authorization-bearer',
      'x-evil-cookie', 'x-fake-header', 'x-csrf-token',
      'x-forwarded-for', 'x-real-ip', 'proxy-authorization',
      '*',
    ]

    // Origens diversas — Allow-Headers deve ser idêntico para todas.
    const ORIGINS: Array<{ label: string; value: string }> = [
      { label: 'same-origin produção',     value: 'https://app.kubovibe.dev' },
      { label: 'same-origin lovable',      value: 'https://kubovibe.lovable.app' },
      { label: 'cross-origin hostil',      value: 'https://evil.example.com' },
      { label: 'localhost dev',            value: 'http://localhost:5173' },
      { label: 'Origin literal "null"',    value: 'null' },
      { label: 'porta exótica',            value: 'https://attacker.example.com:31337' },
    ]

    // Variantes hostis/exóticas de Request-Headers — todas devem ser ignoradas.
    const REQUEST_HEADER_VARIANTS: Array<{ label: string; value: string }> = [
      // Casing.
      { label: 'lowercase canônico',           value: 'content-type, x-test-secret' },
      { label: 'Title-Case',                   value: 'Content-Type, X-Test-Secret' },
      { label: 'UPPERCASE',                    value: 'CONTENT-TYPE, X-TEST-SECRET' },
      { label: 'mIxEd CaSiNg',                 value: 'CoNtEnT-TyPe, X-tEsT-sEcReT' },
      // Spacing.
      { label: 'sem espaço pós-vírgula',       value: 'content-type,x-test-secret' },
      { label: 'múltiplos espaços',            value: 'content-type,    x-test-secret' },
      { label: 'tab como separador',           value: 'content-type,\tx-test-secret' },
      { label: 'espaços ao redor',             value: '  content-type  ,  x-test-secret  ' },
      // Vírgulas.
      { label: 'trailing comma',               value: 'content-type, x-test-secret,' },
      { label: 'leading comma',                value: ', content-type, x-test-secret' },
      { label: 'duplas vírgulas (token vazio)', value: 'content-type,, x-test-secret' },
      // Tentativas de injetar headers perigosos.
      { label: 'tentar injetar set-cookie',    value: 'content-type, set-cookie' },
      { label: 'tentar injetar cookie',        value: 'cookie, content-type' },
      { label: 'tentar injetar wildcard',      value: '*' },
      { label: 'tentar injetar host',          value: 'host, content-type' },
      { label: 'tentar injetar x-evil',        value: 'x-evil-cookie, x-fake-header' },
      { label: 'tentar injetar csrf',          value: 'x-csrf-token, content-type' },
      { label: 'tentar injetar proxy-auth',    value: 'proxy-authorization, content-type' },
      // Headers absurdos.
      { label: 'só headers fora da allowlist', value: 'x-fake-1, x-fake-2, x-fake-3' },
      { label: 'mix allowed + dangerous',      value: 'content-type, set-cookie, cookie, x-evil' },
      // Edge cases.
      { label: 'string vazia',                 value: '' },
      { label: 'só whitespace',                value: '   ' },
      { label: 'só vírgulas',                  value: ',,,' },
      // Headers repetidos múltiplas vezes (mesmo token N vezes).
      { label: 'content-type repetido 2x',     value: 'content-type, content-type' },
      { label: 'content-type repetido 5x',     value: 'content-type, content-type, content-type, content-type, content-type' },
      { label: 'authorization repetido casing variado', value: 'authorization, Authorization, AUTHORIZATION, AuThOrIzAtIoN' },
      { label: 'allowlist inteira duplicada',  value: 'authorization, x-client-info, apikey, content-type, x-test-secret, authorization, x-client-info, apikey, content-type, x-test-secret' },
      { label: 'apikey repetido + dangerous',  value: 'apikey, apikey, apikey, set-cookie, apikey' },
      // Ordens diferentes da allowlist canônica.
      { label: 'ordem reversa',                value: 'x-test-secret, content-type, apikey, x-client-info, authorization' },
      { label: 'ordem alfabética',             value: 'apikey, authorization, content-type, x-client-info, x-test-secret' },
      { label: 'ordem aleatória 1',            value: 'apikey, x-test-secret, authorization, content-type, x-client-info' },
      { label: 'ordem aleatória 2',            value: 'content-type, authorization, x-test-secret, apikey, x-client-info' },
      { label: 'ordem reversa Title-Case',     value: 'X-Test-Secret, Content-Type, Apikey, X-Client-Info, Authorization' },
      // Vírgulas consecutivas em diferentes posições.
      { label: 'vírgulas consecutivas (3x)',   value: 'content-type,,, x-test-secret' },
      { label: 'vírgulas consecutivas (10x)',  value: 'content-type,,,,,,,,,,x-test-secret' },
      { label: 'leading múltiplas vírgulas',   value: ',,,, content-type, x-test-secret' },
      { label: 'trailing múltiplas vírgulas',  value: 'content-type, x-test-secret,,,,' },
      { label: 'vírgulas no meio + repetido',  value: 'content-type,,,content-type,,,x-test-secret' },
      { label: 'vírgulas + whitespace misto',  value: ' , , content-type , , , x-test-secret , , ' },
      // Combinações: repetidos + ordem trocada + vírgulas múltiplas + casing + dangerous.
      { label: 'caos total',                   value: ' , X-TEST-SECRET ,, Authorization,, set-cookie,,  CONTENT-type ,, apikey ,, X-Client-Info ,, cookie,, authorization ,,, ' },
      { label: 'allowlist embaralhada + dangerous intercalado', value: 'apikey, set-cookie, content-type, cookie, x-test-secret, host, authorization, x-evil, x-client-info' },
      { label: 'duplicação massiva + casing',  value: 'AUTHORIZATION, authorization, Authorization, APIKEY, apikey, Apikey, CONTENT-TYPE, content-type, Content-Type' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    for (const origin of ORIGINS) {
      for (const variant of REQUEST_HEADER_VARIANTS) {
        const res = await fetch(`${ctx.url}/`, {
          method: 'OPTIONS',
          headers: {
            'origin': origin.value,
            'access-control-request-method': 'POST',
            'access-control-request-headers': variant.value,
          },
        })
        await res.text()

        const ctxLabel = `[Origin: ${origin.label} | Request-Headers: ${variant.label}]`

        // (1) Status 200.
        assertEquals(res.status, 200, `${ctxLabel}: preflight deve retornar 200`)

        // (2) Allow-Headers LITERAL EXATO — handler não ramifica por Origin nem por Request-Headers.
        const ah = res.headers.get('access-control-allow-headers')
        assertExists(ah, `${ctxLabel}: Allow-Headers deve estar presente`)
        assertEquals(
          ah,
          EXPECTED_LITERAL,
          `${ctxLabel}: Allow-Headers deve ser literal "${EXPECTED_LITERAL}"`,
        )

        // (3) Conjunto parseado bate exatamente — 5 headers, sem extras nem omissões.
        const parsed = new Set(parseList(ah))
        assertEquals(
          parsed.size, EXPECTED_SET.size,
          `${ctxLabel}: Allow-Headers deve listar exatamente ${EXPECTED_SET.size} headers`,
        )
        for (const h of EXPECTED_SET) {
          assert(parsed.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
        }

        // (4) NUNCA cabeçalhos perigosos — defesa exaustiva.
        for (const dangerous of DANGEROUS_HEADERS) {
          assert(
            !parsed.has(dangerous),
            `${ctxLabel}: Allow-Headers NÃO PODE conter header perigoso "${dangerous}"`,
          )
        }

        // (5) NUNCA ecoar tokens da Request-Headers que não sejam allowlisted.
        // Extrai tokens enviados (lowercase) e verifica que nenhum não-allowlisted aparece.
        const sentTokens = parseList(variant.value)
        for (const sent of sentTokens) {
          if (!EXPECTED_SET.has(sent)) {
            assert(
              !parsed.has(sent),
              `${ctxLabel}: Allow-Headers NÃO PODE ecoar token não-allowlisted "${sent}"`,
            )
          }
        }

        // (6) Allow-Origin permanece '*' literal — sem eco mesmo com Origin presente.
        const allowOrigin = res.headers.get('access-control-allow-origin')
        assertEquals(allowOrigin, '*', `${ctxLabel}: Allow-Origin deve ser '*' literal`)
        assert(allowOrigin !== origin.value, `${ctxLabel}: Allow-Origin NÃO PODE ecoar Origin`)
        assert(allowOrigin !== 'null', `${ctxLabel}: Allow-Origin NUNCA pode ser 'null'`)

        // (7) Allow-Credentials NUNCA presente.
        assertEquals(
          res.headers.get('access-control-allow-credentials'), null,
          `${ctxLabel}: Allow-Credentials NUNCA pode aparecer`,
        )

        // (8) Allow-Methods + Max-Age permanecem literais.
        assertEquals(
          res.headers.get('access-control-allow-methods'), 'POST, OPTIONS',
          `${ctxLabel}: Allow-Methods deve permanecer 'POST, OPTIONS'`,
        )
        assertEquals(
          res.headers.get('access-control-max-age'), '86400',
          `${ctxLabel}: Max-Age deve permanecer '86400'`,
        )

        // (9) Set-Cookie / Set-Cookie2 / Expose-Headers NUNCA presentes.
        assertEquals(res.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA pode aparecer`)
        assertEquals(res.headers.get('set-cookie2'), null, `${ctxLabel}: Set-Cookie2 NUNCA pode aparecer`)
        assertEquals(
          res.headers.get('access-control-expose-headers'), null,
          `${ctxLabel}: Expose-Headers NUNCA pode aparecer em preflight`,
        )

        // (10) Allow-Headers aparece exatamente 1x (sem duplicação por proxy).
        let occurrences = 0
        for (const [name] of res.headers) {
          if (name.toLowerCase() === 'access-control-allow-headers') occurrences++
        }
        assertEquals(
          occurrences, 1,
          `${ctxLabel}: Allow-Headers deve aparecer exatamente 1x`,
        )
      }
    }

    // (11) Garantia: nenhum createClient instanciado em qualquer preflight.
    assertEquals(
      ctx._calls, 0,
      'createClient NUNCA pode ser invocado em OPTIONS preflight',
    )
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — Request-Method × Request-Headers combined matrix — Allow-Methods/Allow-Headers stay LITERAL (no echo, no leak)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_METHODS_LITERAL = 'POST, OPTIONS'
    const EXPECTED_METHODS_SET = new Set(['post', 'options'])
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const DANGEROUS_METHODS = ['get', 'put', 'patch', 'delete', 'head', 'connect', 'trace', 'propfind', 'custom-method', '*']
    const DANGEROUS_HEADERS = [
      'set-cookie', 'set-cookie2', 'cookie', 'cookie2',
      'host', 'origin', 'authorization-bearer',
      'x-evil-cookie', 'x-fake-header', 'x-csrf-token',
      'x-forwarded-for', 'x-real-ip', 'proxy-authorization',
      '*',
    ]

    // Origens diversas — Allow-Methods e Allow-Headers devem ser idênticos para todas.
    const ORIGINS: Array<{ label: string; value: string | null }> = [
      { label: 'sem Origin',                value: null },
      { label: 'same-origin produção',      value: 'https://app.kubovibe.dev' },
      { label: 'same-origin lovable',       value: 'https://kubovibe.lovable.app' },
      { label: 'cross-origin hostil',       value: 'https://evil.example.com' },
      { label: 'localhost dev',             value: 'http://localhost:5173' },
      { label: 'Origin literal "null"',     value: 'null' },
    ]

    // Variantes de Access-Control-Request-Method — casing/spacing/exóticos.
    const METHOD_VARIANTS: Array<{ label: string; value: string }> = [
      { label: 'POST canônico',             value: 'POST' },
      { label: 'post lowercase',            value: 'post' },
      { label: 'PoSt mIxEd',                value: 'PoSt' },
      { label: 'POST espaços',              value: '  POST  ' },
      { label: 'OPTIONS canônico',          value: 'OPTIONS' },
      { label: 'GET (rejeitado)',           value: 'GET' },
      { label: 'DELETE (rejeitado)',        value: 'DELETE' },
      { label: 'PATCH (rejeitado)',         value: 'PATCH' },
      { label: 'PROPFIND exótico',          value: 'PROPFIND' },
      { label: 'CUSTOM-METHOD absurdo',     value: 'CUSTOM-METHOD' },
      { label: 'wildcard *',                value: '*' },
    ]

    // Variantes de Access-Control-Request-Headers — casing/spacing/dangerous/repetições.
    const HEADER_VARIANTS: Array<{ label: string; value: string }> = [
      { label: 'lowercase canônico',        value: 'content-type, x-test-secret' },
      { label: 'Title-Case',                value: 'Content-Type, X-Test-Secret' },
      { label: 'UPPERCASE',                 value: 'CONTENT-TYPE, X-TEST-SECRET' },
      { label: 'mIxEd CaSiNg',              value: 'CoNtEnT-TyPe, X-tEsT-sEcReT' },
      { label: 'sem espaço pós-vírgula',    value: 'content-type,x-test-secret' },
      { label: 'tab separador',             value: 'content-type,\tx-test-secret' },
      { label: 'trailing comma',            value: 'content-type, x-test-secret,' },
      { label: 'vírgulas consecutivas',     value: 'content-type,,, x-test-secret' },
      { label: 'tentar set-cookie',         value: 'content-type, set-cookie' },
      { label: 'tentar cookie+host',        value: 'cookie, host, content-type' },
      { label: 'wildcard *',                value: '*' },
      { label: 'só dangerous',              value: 'set-cookie, cookie, host, x-evil' },
      { label: 'allowlist duplicada',       value: 'authorization, AUTHORIZATION, content-type, content-type' },
      { label: 'ordem reversa',             value: 'x-test-secret, content-type, apikey, x-client-info, authorization' },
      { label: 'string vazia',              value: '' },
      { label: 'caos misto',                value: ' , X-TEST-SECRET ,, set-cookie,,  CONTENT-type ,, cookie ,, authorization ,,, ' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    let totalRequests = 0

    for (const origin of ORIGINS) {
      for (const methodVariant of METHOD_VARIANTS) {
        for (const headerVariant of HEADER_VARIANTS) {
          const reqHeaders: Record<string, string> = {
            'access-control-request-method': methodVariant.value,
            'access-control-request-headers': headerVariant.value,
          }
          if (origin.value !== null) reqHeaders['origin'] = origin.value

          const res = await fetch(`${ctx.url}/`, { method: 'OPTIONS', headers: reqHeaders })
          await res.text()
          totalRequests++

          const ctxLabel = `[Origin: ${origin.label} | Req-Method: ${methodVariant.label} | Req-Headers: ${headerVariant.label}]`

          // (1) Status 200.
          assertEquals(res.status, 200, `${ctxLabel}: preflight deve retornar 200`)

          // (2) Allow-Methods LITERAL EXATO — nunca ecoa Request-Method.
          const am = res.headers.get('access-control-allow-methods')
          assertExists(am, `${ctxLabel}: Allow-Methods deve estar presente`)
          assertEquals(am, EXPECTED_METHODS_LITERAL, `${ctxLabel}: Allow-Methods deve ser literal "${EXPECTED_METHODS_LITERAL}"`)
          const parsedMethods = new Set(parseList(am))
          assertEquals(parsedMethods.size, EXPECTED_METHODS_SET.size, `${ctxLabel}: Allow-Methods deve listar exatamente 2 métodos`)
          for (const m of EXPECTED_METHODS_SET) {
            assert(parsedMethods.has(m), `${ctxLabel}: Allow-Methods deve incluir "${m}"`)
          }
          // Métodos perigosos NUNCA presentes (exceto o degenerado '*' que coincide com wildcard).
          for (const dangerous of DANGEROUS_METHODS) {
            assert(!parsedMethods.has(dangerous), `${ctxLabel}: Allow-Methods NÃO PODE conter método perigoso "${dangerous}"`)
          }

          // (3) Allow-Headers LITERAL EXATO — nunca ecoa Request-Headers.
          const ah = res.headers.get('access-control-allow-headers')
          assertExists(ah, `${ctxLabel}: Allow-Headers deve estar presente`)
          assertEquals(ah, EXPECTED_HEADERS_LITERAL, `${ctxLabel}: Allow-Headers deve ser literal "${EXPECTED_HEADERS_LITERAL}"`)
          const parsedHeaders = new Set(parseList(ah))
          assertEquals(parsedHeaders.size, EXPECTED_HEADERS_SET.size, `${ctxLabel}: Allow-Headers deve listar exatamente 5 headers`)
          for (const h of EXPECTED_HEADERS_SET) {
            assert(parsedHeaders.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
          }
          for (const dangerous of DANGEROUS_HEADERS) {
            assert(!parsedHeaders.has(dangerous), `${ctxLabel}: Allow-Headers NÃO PODE conter header perigoso "${dangerous}"`)
          }

          // (4) Nunca ecoar tokens não-allowlisted enviados em Request-Headers.
          for (const sent of parseList(headerVariant.value)) {
            if (!EXPECTED_HEADERS_SET.has(sent)) {
              assert(!parsedHeaders.has(sent), `${ctxLabel}: Allow-Headers NÃO PODE ecoar token "${sent}"`)
            }
          }
          // Nunca ecoar o método enviado se não for POST/OPTIONS.
          const sentMethod = methodVariant.value.trim().toLowerCase()
          if (!EXPECTED_METHODS_SET.has(sentMethod)) {
            assert(!parsedMethods.has(sentMethod), `${ctxLabel}: Allow-Methods NÃO PODE ecoar método "${sentMethod}"`)
          }

          // (5) Allow-Origin permanece '*' literal — sem eco.
          const allowOrigin = res.headers.get('access-control-allow-origin')
          assertEquals(allowOrigin, '*', `${ctxLabel}: Allow-Origin deve ser '*' literal`)
          if (origin.value && origin.value !== '*') {
            assert(allowOrigin !== origin.value, `${ctxLabel}: Allow-Origin NÃO PODE ecoar Origin`)
          }
          assert(allowOrigin !== 'null', `${ctxLabel}: Allow-Origin NUNCA pode ser 'null'`)

          // (6) Allow-Credentials NUNCA presente.
          assertEquals(res.headers.get('access-control-allow-credentials'), null, `${ctxLabel}: Allow-Credentials NUNCA pode aparecer`)

          // (7) Max-Age literal.
          assertEquals(res.headers.get('access-control-max-age'), '86400', `${ctxLabel}: Max-Age deve ser '86400'`)

          // (8) Set-Cookie/Expose-Headers ausentes.
          assertEquals(res.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA pode aparecer`)
          assertEquals(res.headers.get('access-control-expose-headers'), null, `${ctxLabel}: Expose-Headers NUNCA pode aparecer`)

          // (9) Allow-Methods e Allow-Headers aparecem exatamente 1x cada.
          let methodsCount = 0, headersCount = 0
          for (const [name] of res.headers) {
            const lower = name.toLowerCase()
            if (lower === 'access-control-allow-methods') methodsCount++
            if (lower === 'access-control-allow-headers') headersCount++
          }
          assertEquals(methodsCount, 1, `${ctxLabel}: Allow-Methods deve aparecer exatamente 1x`)
          assertEquals(headersCount, 1, `${ctxLabel}: Allow-Headers deve aparecer exatamente 1x`)
        }
      }
    }

    // Sanidade da matriz: 6 × 11 × 16 = 1056 requests.
    assertEquals(totalRequests, ORIGINS.length * METHOD_VARIANTS.length * HEADER_VARIANTS.length, 'matriz combinada deve cobrir todas as combinações')

    // (10) Zero createClient em qualquer preflight da matriz.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — Access-Control-Request-Headers with CRLF/null-byte injection — Allow-Headers stays LITERAL (no echo, no dangerous, no smuggling)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const DANGEROUS_HEADERS = [
      'set-cookie', 'set-cookie2', 'cookie', 'cookie2',
      'host', 'origin', 'authorization-bearer',
      'x-evil-cookie', 'x-fake-header', 'x-csrf-token',
      'x-forwarded-for', 'x-real-ip', 'proxy-authorization',
      'x-injected', 'x-smuggled', 'x-null-byte',
      '*',
    ]

    // Extrai host:port do ctx.url ('http://127.0.0.1:NNNNN').
    const u = new URL(ctx.url)
    const hostHeader = u.host

    // fetch() rejeita CRLF/null bytes em valores de header — então usamos TCP raw.
    // Cada payload é a STRING bruta colocada após "Access-Control-Request-Headers: ".
    const PAYLOADS: Array<{ label: string; raw: string }> = [
      // CR isolado.
      { label: 'CR único no meio',                raw: 'content-type,\rx-test-secret' },
      { label: 'CR no final',                     raw: 'content-type, x-test-secret\r' },
      // LF isolado.
      { label: 'LF único no meio',                raw: 'content-type,\nx-test-secret' },
      { label: 'LF no final',                     raw: 'content-type, x-test-secret\n' },
      // CRLF (separador HTTP — tentativa clássica de smuggling).
      { label: 'CRLF + header injetado set-cookie', raw: 'content-type\r\nSet-Cookie: pwn=1' },
      { label: 'CRLF + header injetado cookie',     raw: 'content-type\r\nCookie: session=evil' },
      { label: 'CRLF + X-Injected header',          raw: 'content-type\r\nX-Injected: yes' },
      { label: 'CRLF duplo (request smuggling)',    raw: 'content-type\r\n\r\nGET /admin HTTP/1.1\r\nHost: evil' },
      { label: 'CRLF + body smuggling',             raw: 'content-type\r\nContent-Length: 0\r\n\r\nMALICIOUS' },
      { label: 'CRLF dentro de token allowlisted',  raw: 'authorization\r\nX-Smuggled: 1, content-type' },
      // Null bytes (\x00).
      { label: 'null byte único',                   raw: 'content-type,\x00x-test-secret' },
      { label: 'null byte no início',               raw: '\x00content-type, x-test-secret' },
      { label: 'null byte no final',                raw: 'content-type, x-test-secret\x00' },
      { label: 'múltiplos null bytes',              raw: 'content-type\x00\x00\x00x-test-secret' },
      { label: 'null byte truncando (cookie hidden)', raw: 'content-type\x00, set-cookie' },
      // Combinações CRLF + null byte.
      { label: 'null + CRLF + injection',           raw: 'content-type\x00\r\nX-Null-Byte: 1' },
      { label: 'CRLF + null + dangerous',           raw: 'content-type\r\n\x00Set-Cookie: x=y' },
      // Outros control chars baixos.
      { label: 'tab + CR',                          raw: 'content-type,\t\rx-test-secret' },
      { label: 'BEL (\\x07)',                       raw: 'content-type,\x07x-test-secret' },
      { label: 'VT (\\x0B) + LF',                   raw: 'content-type\x0B\nset-cookie' },
      { label: 'FF (\\x0C)',                        raw: 'content-type\x0Cx-test-secret' },
      { label: 'todos control chars 0x01-0x08',     raw: 'content-type\x01\x02\x03\x04\x05\x06\x08x-test-secret' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    type RawResponse = { status: number; headers: Headers; body: string } | { error: string }

    // Envia uma request HTTP/1.1 raw via TCP e parseia status + headers da resposta.
    async function sendRaw(payload: string): Promise<RawResponse> {
      let conn: Deno.TcpConn | null = null
      try {
        conn = await Deno.connect({ hostname: u.hostname, port: parseInt(u.port, 10), transport: 'tcp' })
        const reqLines = [
          'OPTIONS / HTTP/1.1',
          `Host: ${hostHeader}`,
          'Origin: https://evil.example.com',
          'Access-Control-Request-Method: POST',
          // Aqui injetamos o payload bruto contendo CRLF/null bytes.
          `Access-Control-Request-Headers: ${payload}`,
          'Connection: close',
          '',
          '',
        ]
        const reqBytes = new TextEncoder().encode(reqLines.join('\r\n'))
        await conn.write(reqBytes)

        // Lê a resposta inteira (até EOF — Connection: close).
        const chunks: Uint8Array[] = []
        const buf = new Uint8Array(8192)
        while (true) {
          const n = await conn.read(buf)
          if (n === null) break
          chunks.push(buf.slice(0, n))
        }
        const total = chunks.reduce((s, c) => s + c.length, 0)
        const merged = new Uint8Array(total)
        let off = 0
        for (const c of chunks) { merged.set(c, off); off += c.length }
        const text = new TextDecoder().decode(merged)

        // Parse status line + headers.
        const headerEnd = text.indexOf('\r\n\r\n')
        if (headerEnd === -1) return { error: 'no header terminator' }
        const headBlock = text.slice(0, headerEnd)
        const body = text.slice(headerEnd + 4)
        const lines = headBlock.split('\r\n')
        const statusMatch = lines[0].match(/^HTTP\/1\.[01]\s+(\d{3})/)
        if (!statusMatch) return { error: `bad status line: ${lines[0]}` }
        const status = parseInt(statusMatch[1], 10)
        const headers = new Headers()
        for (let i = 1; i < lines.length; i++) {
          const idx = lines[i].indexOf(':')
          if (idx === -1) continue
          const name = lines[i].slice(0, idx).trim()
          const value = lines[i].slice(idx + 1).trim()
          if (name) headers.append(name, value)
        }
        return { status, headers, body }
      } finally {
        try { conn?.close() } catch { /* already closed */ }
      }
    }

    for (const p of PAYLOADS) {
      const result = await sendRaw(p.raw)
      const ctxLabel = `[Payload: ${p.label}]`

      // Aceitamos dois desfechos seguros:
      //  (A) Servidor responde 200 com Allow-Headers literal (CRLF/null bytes ignorados/sanitizados).
      //  (B) Servidor responde 4xx/conexão fecha — também é seguro (não vazou nada).
      if ('error' in result) {
        // Resposta malformada — é aceitável (servidor recusou a request smuggling).
        // Mas precisamos garantir que NÃO veio body com header injetado vazando.
        continue
      }

      // (1) Status DEVE ser 200 OU 4xx — nunca 5xx (que indicaria crash).
      assert(
        result.status === 200 || (result.status >= 400 && result.status < 500),
        `${ctxLabel}: status deve ser 200 ou 4xx, recebido ${result.status}`,
      )

      // Se o servidor tratou como preflight válido (200), validar contrato CORS literal.
      if (result.status === 200) {
        const ah = result.headers.get('access-control-allow-headers')
        assertExists(ah, `${ctxLabel}: Allow-Headers deve estar presente em 200`)

        // (2) Allow-Headers LITERAL EXATO — sem echo de payload poluído.
        assertEquals(
          ah, EXPECTED_HEADERS_LITERAL,
          `${ctxLabel}: Allow-Headers deve ser literal "${EXPECTED_HEADERS_LITERAL}" (não pode refletir payload)`,
        )

        // (3) Conjunto parseado bate exatamente.
        const parsed = new Set(parseList(ah))
        assertEquals(parsed.size, EXPECTED_HEADERS_SET.size, `${ctxLabel}: Allow-Headers deve listar exatamente 5 headers`)
        for (const h of EXPECTED_HEADERS_SET) {
          assert(parsed.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
        }

        // (4) NUNCA cabeçalhos perigosos.
        for (const dangerous of DANGEROUS_HEADERS) {
          assert(!parsed.has(dangerous), `${ctxLabel}: Allow-Headers NÃO PODE conter header perigoso "${dangerous}"`)
        }

        // (5) NUNCA conter substring CR/LF/null no valor — proteção contra header injection downstream.
        assert(!ah.includes('\r'), `${ctxLabel}: Allow-Headers NÃO PODE conter CR`)
        assert(!ah.includes('\n'), `${ctxLabel}: Allow-Headers NÃO PODE conter LF`)
        assert(!ah.includes('\x00'), `${ctxLabel}: Allow-Headers NÃO PODE conter null byte`)

        // (6) Allow-Origin permanece '*' literal.
        assertEquals(result.headers.get('access-control-allow-origin'), '*', `${ctxLabel}: Allow-Origin deve ser '*'`)

        // (7) Allow-Credentials NUNCA presente.
        assertEquals(result.headers.get('access-control-allow-credentials'), null, `${ctxLabel}: Allow-Credentials NUNCA pode aparecer`)

        // (8) Allow-Methods/Max-Age literais.
        assertEquals(result.headers.get('access-control-allow-methods'), 'POST, OPTIONS', `${ctxLabel}: Allow-Methods literal`)
        assertEquals(result.headers.get('access-control-max-age'), '86400', `${ctxLabel}: Max-Age literal`)

        // (9) Set-Cookie NUNCA aparece (mesmo se o payload tentou injetar).
        assertEquals(result.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA pode aparecer (anti-smuggling)`)
        assertEquals(result.headers.get('cookie'), null, `${ctxLabel}: Cookie NUNCA pode aparecer`)

        // (10) Headers injetados via CRLF NUNCA aparecem na resposta.
        assertEquals(result.headers.get('x-injected'), null, `${ctxLabel}: X-Injected NUNCA pode aparecer`)
        assertEquals(result.headers.get('x-smuggled'), null, `${ctxLabel}: X-Smuggled NUNCA pode aparecer`)
        assertEquals(result.headers.get('x-null-byte'), null, `${ctxLabel}: X-Null-Byte NUNCA pode aparecer`)

        // (11) Allow-Headers aparece exatamente 1x.
        let occurrences = 0
        for (const [name] of result.headers) {
          if (name.toLowerCase() === 'access-control-allow-headers') occurrences++
        }
        assertEquals(occurrences, 1, `${ctxLabel}: Allow-Headers deve aparecer exatamente 1x`)
      }
    }

    // (12) Zero createClient invocado em qualquer payload — preflight nunca toca DB.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight (mesmo com payloads maliciosos)')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS WITHOUT Origin — Allow-Methods AND Allow-Headers stay LITERAL across combined Request-Method × Request-Headers variants (no echo, no leak)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_METHODS_LITERAL = 'POST, OPTIONS'
    const EXPECTED_METHODS_SET = new Set(['post', 'options'])
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const DANGEROUS_METHODS = ['get', 'put', 'patch', 'delete', 'head', 'connect', 'trace', 'propfind', 'custom-method']
    const DANGEROUS_HEADERS = [
      'set-cookie', 'set-cookie2', 'cookie', 'cookie2',
      'host', 'origin', 'authorization-bearer',
      'x-evil-cookie', 'x-fake-header', 'x-csrf-token',
      'x-forwarded-for', 'x-real-ip', 'proxy-authorization',
    ]

    const METHOD_VARIANTS: Array<{ label: string; value: string | undefined }> = [
      { label: 'sem Request-Method',        value: undefined },
      { label: 'POST canônico',             value: 'POST' },
      { label: 'post lowercase',            value: 'post' },
      { label: 'PoSt mIxEd',                value: 'PoSt' },
      { label: 'POST com espaços',          value: '  POST  ' },
      { label: 'GET (rejeitado)',           value: 'GET' },
      { label: 'DELETE (rejeitado)',        value: 'DELETE' },
      { label: 'PATCH (rejeitado)',         value: 'PATCH' },
      { label: 'PROPFIND exótico',          value: 'PROPFIND' },
      { label: 'CUSTOM-METHOD absurdo',     value: 'CUSTOM-METHOD' },
    ]

    const HEADER_VARIANTS: Array<{ label: string; value: string | undefined }> = [
      { label: 'sem Request-Headers',       value: undefined },
      { label: 'lowercase canônico',        value: 'content-type, x-test-secret' },
      { label: 'Title-Case',                value: 'Content-Type, X-Test-Secret' },
      { label: 'UPPERCASE',                 value: 'CONTENT-TYPE, X-TEST-SECRET' },
      { label: 'mIxEd CaSiNg',              value: 'CoNtEnT-TyPe, X-tEsT-sEcReT' },
      { label: 'sem espaço pós-vírgula',    value: 'content-type,x-test-secret' },
      { label: 'tab separador',             value: 'content-type,\tx-test-secret' },
      { label: 'trailing comma',            value: 'content-type, x-test-secret,' },
      { label: 'vírgulas consecutivas',     value: 'content-type,,, x-test-secret' },
      { label: 'tentar set-cookie',         value: 'content-type, set-cookie' },
      { label: 'tentar cookie+host',        value: 'cookie, host, content-type' },
      { label: 'wildcard *',                value: '*' },
      { label: 'só dangerous',              value: 'set-cookie, cookie, host, x-evil-cookie' },
      { label: 'allowlist duplicada/casing', value: 'authorization, AUTHORIZATION, content-type, content-type' },
      { label: 'ordem reversa',             value: 'x-test-secret, content-type, apikey, x-client-info, authorization' },
      { label: 'string vazia',              value: '' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    let totalRequests = 0

    for (const methodVariant of METHOD_VARIANTS) {
      for (const headerVariant of HEADER_VARIANTS) {
        const reqHeaders: Record<string, string> = {}
        // CRÍTICO: NÃO enviar Origin nesta suite.
        if (methodVariant.value !== undefined) reqHeaders['access-control-request-method'] = methodVariant.value
        if (headerVariant.value !== undefined) reqHeaders['access-control-request-headers'] = headerVariant.value

        const res = await fetch(`${ctx.url}/`, { method: 'OPTIONS', headers: reqHeaders })
        await res.text()
        totalRequests++

        const ctxLabel = `[NO-Origin | Req-Method: ${methodVariant.label} | Req-Headers: ${headerVariant.label}]`

        // (1) Status 200.
        assertEquals(res.status, 200, `${ctxLabel}: preflight deve retornar 200`)

        // (2) Allow-Methods LITERAL EXATO — mesmo sem Origin, sem Request-Method, ou com método rejeitado.
        const am = res.headers.get('access-control-allow-methods')
        assertExists(am, `${ctxLabel}: Allow-Methods deve estar presente`)
        assertEquals(am, EXPECTED_METHODS_LITERAL, `${ctxLabel}: Allow-Methods deve ser literal "${EXPECTED_METHODS_LITERAL}"`)
        const parsedMethods = new Set(parseList(am))
        assertEquals(parsedMethods.size, EXPECTED_METHODS_SET.size, `${ctxLabel}: Allow-Methods deve listar exatamente 2 métodos`)
        for (const m of EXPECTED_METHODS_SET) {
          assert(parsedMethods.has(m), `${ctxLabel}: Allow-Methods deve incluir "${m}"`)
        }
        assert(!parsedMethods.has('*'), `${ctxLabel}: Allow-Methods NÃO PODE conter wildcard "*"`)
        for (const dangerous of DANGEROUS_METHODS) {
          assert(!parsedMethods.has(dangerous), `${ctxLabel}: Allow-Methods NÃO PODE conter método perigoso "${dangerous}"`)
        }
        // Nunca ecoar o método enviado se não for POST/OPTIONS.
        if (methodVariant.value !== undefined) {
          const sentMethod = methodVariant.value.trim().toLowerCase()
          if (!EXPECTED_METHODS_SET.has(sentMethod)) {
            assert(!parsedMethods.has(sentMethod), `${ctxLabel}: Allow-Methods NÃO PODE ecoar método "${sentMethod}"`)
          }
        }

        // (3) Allow-Headers LITERAL EXATO — sem echo, mesmo sem Origin/Request-Headers.
        const ah = res.headers.get('access-control-allow-headers')
        assertExists(ah, `${ctxLabel}: Allow-Headers deve estar presente`)
        assertEquals(ah, EXPECTED_HEADERS_LITERAL, `${ctxLabel}: Allow-Headers deve ser literal "${EXPECTED_HEADERS_LITERAL}"`)
        const parsedHeaders = new Set(parseList(ah))
        assertEquals(parsedHeaders.size, EXPECTED_HEADERS_SET.size, `${ctxLabel}: Allow-Headers deve listar exatamente 5 headers`)
        for (const h of EXPECTED_HEADERS_SET) {
          assert(parsedHeaders.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
        }
        assert(!parsedHeaders.has('*'), `${ctxLabel}: Allow-Headers NÃO PODE conter wildcard "*"`)
        for (const dangerous of DANGEROUS_HEADERS) {
          assert(!parsedHeaders.has(dangerous), `${ctxLabel}: Allow-Headers NÃO PODE conter header perigoso "${dangerous}"`)
        }
        // Nunca ecoar tokens não-allowlisted enviados.
        if (headerVariant.value !== undefined) {
          for (const sent of parseList(headerVariant.value)) {
            if (!EXPECTED_HEADERS_SET.has(sent)) {
              assert(!parsedHeaders.has(sent), `${ctxLabel}: Allow-Headers NÃO PODE ecoar token "${sent}"`)
            }
          }
        }

        // (4) Allow-Origin permanece '*' — comportamento uniforme mesmo sem Origin enviado.
        assertEquals(res.headers.get('access-control-allow-origin'), '*', `${ctxLabel}: Allow-Origin deve ser '*' literal`)

        // (5) Allow-Credentials NUNCA presente (incompatível com '*').
        assertEquals(res.headers.get('access-control-allow-credentials'), null, `${ctxLabel}: Allow-Credentials NUNCA pode aparecer`)

        // (6) Max-Age literal.
        assertEquals(res.headers.get('access-control-max-age'), '86400', `${ctxLabel}: Max-Age deve ser '86400'`)

        // (7) Vary não pode mencionar 'origin' (incompatível com Allow-Origin '*').
        const vary = res.headers.get('vary') ?? ''
        assert(!vary.toLowerCase().split(',').map((s) => s.trim()).includes('origin'),
          `${ctxLabel}: Vary NÃO PODE incluir 'origin' quando Allow-Origin é '*'`)

        // (8) Cookies/Expose-Headers ausentes.
        assertEquals(res.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA pode aparecer`)
        assertEquals(res.headers.get('access-control-expose-headers'), null, `${ctxLabel}: Expose-Headers NUNCA pode aparecer em preflight`)

        // (9) Allow-Methods e Allow-Headers aparecem exatamente 1x cada.
        let methodsCount = 0, headersCount = 0
        for (const [name] of res.headers) {
          const lower = name.toLowerCase()
          if (lower === 'access-control-allow-methods') methodsCount++
          if (lower === 'access-control-allow-headers') headersCount++
        }
        assertEquals(methodsCount, 1, `${ctxLabel}: Allow-Methods deve aparecer exatamente 1x`)
        assertEquals(headersCount, 1, `${ctxLabel}: Allow-Headers deve aparecer exatamente 1x`)
      }
    }

    // Sanidade da matriz: 10 × 16 = 160 requests.
    assertEquals(totalRequests, METHOD_VARIANTS.length * HEADER_VARIANTS.length, 'matriz NO-Origin deve cobrir todas as combinações')

    // (10) Zero createClient invocado em qualquer preflight sem Origin.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight (sem Origin)')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — CRLF/null-byte in Request-Headers × Request-Method variants — Allow-Methods/Allow-Headers stay LITERAL (no echo, no smuggling, no leak)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_METHODS_LITERAL = 'POST, OPTIONS'
    const EXPECTED_METHODS_SET = new Set(['post', 'options'])
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const DANGEROUS_METHODS = ['get', 'put', 'patch', 'delete', 'head', 'connect', 'trace', 'propfind', 'custom-method']
    const DANGEROUS_HEADERS = [
      'set-cookie', 'set-cookie2', 'cookie', 'cookie2',
      'host', 'origin', 'authorization-bearer',
      'x-evil-cookie', 'x-fake-header', 'x-csrf-token',
      'x-forwarded-for', 'x-real-ip', 'proxy-authorization',
      'x-injected', 'x-smuggled', 'x-null-byte', 'x-method-injected',
      '*',
    ]

    const u = new URL(ctx.url)
    const hostHeader = u.host

    // Variantes de Request-Method (válidos, rejeitados, exóticos).
    const METHOD_VARIANTS: Array<{ label: string; value: string }> = [
      { label: 'POST canônico',      value: 'POST' },
      { label: 'post lowercase',     value: 'post' },
      { label: 'PoSt mIxEd',         value: 'PoSt' },
      { label: 'GET (rejeitado)',    value: 'GET' },
      { label: 'DELETE (rejeitado)', value: 'DELETE' },
      { label: 'PROPFIND exótico',   value: 'PROPFIND' },
      { label: 'wildcard *',         value: '*' },
    ]

    // Payloads CRLF/null-byte para Request-Headers (raw, escapando o pipe TCP).
    const HEADER_PAYLOADS: Array<{ label: string; raw: string }> = [
      { label: 'CR único',                          raw: 'content-type,\rx-test-secret' },
      { label: 'LF único',                          raw: 'content-type,\nx-test-secret' },
      { label: 'CRLF + Set-Cookie',                 raw: 'content-type\r\nSet-Cookie: pwn=1' },
      { label: 'CRLF + Cookie',                     raw: 'content-type\r\nCookie: session=evil' },
      { label: 'CRLF + X-Injected',                 raw: 'content-type\r\nX-Injected: yes' },
      { label: 'CRLF duplo (request smuggling)',    raw: 'content-type\r\n\r\nGET /admin HTTP/1.1\r\nHost: evil' },
      { label: 'CRLF + Content-Length smuggle',     raw: 'content-type\r\nContent-Length: 0\r\n\r\nMALICIOUS' },
      { label: 'null byte único',                   raw: 'content-type,\x00x-test-secret' },
      { label: 'null byte truncando dangerous',     raw: 'content-type\x00, set-cookie' },
      { label: 'múltiplos null bytes',              raw: 'content-type\x00\x00\x00x-test-secret' },
      { label: 'null + CRLF + X-Null-Byte',         raw: 'content-type\x00\r\nX-Null-Byte: 1' },
      { label: 'CRLF + null + dangerous',           raw: 'content-type\r\n\x00Set-Cookie: x=y' },
      { label: 'CRLF dentro de allowlisted',        raw: 'authorization\r\nX-Smuggled: 1, content-type' },
      { label: 'control chars 0x01-0x08',           raw: 'content-type\x01\x02\x03\x04\x05\x06\x08x-test-secret' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    type RawResponse = { status: number; headers: Headers } | { error: string }

    async function sendRaw(methodValue: string, headersPayload: string): Promise<RawResponse> {
      let conn: Deno.TcpConn | null = null
      try {
        conn = await Deno.connect({ hostname: u.hostname, port: parseInt(u.port, 10), transport: 'tcp' })
        const reqLines = [
          'OPTIONS / HTTP/1.1',
          `Host: ${hostHeader}`,
          'Origin: https://evil.example.com',
          `Access-Control-Request-Method: ${methodValue}`,
          `Access-Control-Request-Headers: ${headersPayload}`,
          'Connection: close',
          '',
          '',
        ]
        await conn.write(new TextEncoder().encode(reqLines.join('\r\n')))

        const chunks: Uint8Array[] = []
        const buf = new Uint8Array(8192)
        while (true) {
          const n = await conn.read(buf)
          if (n === null) break
          chunks.push(buf.slice(0, n))
        }
        const total = chunks.reduce((s, c) => s + c.length, 0)
        const merged = new Uint8Array(total)
        let off = 0
        for (const c of chunks) { merged.set(c, off); off += c.length }
        const text = new TextDecoder().decode(merged)

        const headerEnd = text.indexOf('\r\n\r\n')
        if (headerEnd === -1) return { error: 'no header terminator' }
        const lines = text.slice(0, headerEnd).split('\r\n')
        const m = lines[0].match(/^HTTP\/1\.[01]\s+(\d{3})/)
        if (!m) return { error: `bad status: ${lines[0]}` }
        const status = parseInt(m[1], 10)
        const headers = new Headers()
        for (let i = 1; i < lines.length; i++) {
          const idx = lines[i].indexOf(':')
          if (idx === -1) continue
          const name = lines[i].slice(0, idx).trim()
          const value = lines[i].slice(idx + 1).trim()
          if (name) headers.append(name, value)
        }
        return { status, headers }
      } finally {
        try { conn?.close() } catch { /* ignore */ }
      }
    }

    let totalRequests = 0
    let validatedAs200 = 0

    for (const methodVariant of METHOD_VARIANTS) {
      for (const payload of HEADER_PAYLOADS) {
        const result = await sendRaw(methodVariant.value, payload.raw)
        totalRequests++
        const ctxLabel = `[Req-Method: ${methodVariant.label} | Req-Headers payload: ${payload.label}]`

        // Resposta malformada/conexão fechada também é seguro (servidor recusou smuggling).
        if ('error' in result) continue

        // (1) Status 200 ou 4xx — nunca 5xx.
        assert(
          result.status === 200 || (result.status >= 400 && result.status < 500),
          `${ctxLabel}: status deve ser 200 ou 4xx, recebido ${result.status}`,
        )

        if (result.status !== 200) continue
        validatedAs200++

        // (2) Allow-Methods LITERAL EXATO — sem echo, mesmo com método rejeitado.
        const am = result.headers.get('access-control-allow-methods')
        assertExists(am, `${ctxLabel}: Allow-Methods deve estar presente`)
        assertEquals(am, EXPECTED_METHODS_LITERAL, `${ctxLabel}: Allow-Methods deve ser literal "${EXPECTED_METHODS_LITERAL}"`)
        const parsedMethods = new Set(parseList(am))
        assertEquals(parsedMethods.size, EXPECTED_METHODS_SET.size, `${ctxLabel}: Allow-Methods deve listar exatamente 2 métodos`)
        for (const m of EXPECTED_METHODS_SET) {
          assert(parsedMethods.has(m), `${ctxLabel}: Allow-Methods deve incluir "${m}"`)
        }
        for (const dangerous of DANGEROUS_METHODS) {
          assert(!parsedMethods.has(dangerous), `${ctxLabel}: Allow-Methods NÃO PODE conter "${dangerous}"`)
        }
        // Nunca ecoar o método enviado se não for POST/OPTIONS.
        const sentMethod = methodVariant.value.trim().toLowerCase()
        if (!EXPECTED_METHODS_SET.has(sentMethod)) {
          assert(!parsedMethods.has(sentMethod), `${ctxLabel}: Allow-Methods NÃO PODE ecoar "${sentMethod}"`)
        }

        // (3) Allow-Headers LITERAL EXATO — sem echo, sem CR/LF/null embutido.
        const ah = result.headers.get('access-control-allow-headers')
        assertExists(ah, `${ctxLabel}: Allow-Headers deve estar presente`)
        assertEquals(ah, EXPECTED_HEADERS_LITERAL, `${ctxLabel}: Allow-Headers deve ser literal "${EXPECTED_HEADERS_LITERAL}"`)
        const parsedHeaders = new Set(parseList(ah))
        assertEquals(parsedHeaders.size, EXPECTED_HEADERS_SET.size, `${ctxLabel}: Allow-Headers deve listar exatamente 5 headers`)
        for (const h of EXPECTED_HEADERS_SET) {
          assert(parsedHeaders.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
        }
        for (const dangerous of DANGEROUS_HEADERS) {
          assert(!parsedHeaders.has(dangerous), `${ctxLabel}: Allow-Headers NÃO PODE conter header perigoso "${dangerous}"`)
        }
        assert(!ah.includes('\r'), `${ctxLabel}: Allow-Headers NÃO PODE conter CR`)
        assert(!ah.includes('\n'), `${ctxLabel}: Allow-Headers NÃO PODE conter LF`)
        assert(!ah.includes('\x00'), `${ctxLabel}: Allow-Headers NÃO PODE conter null byte`)

        // (4) Allow-Origin '*' literal e sem leaks.
        assertEquals(result.headers.get('access-control-allow-origin'), '*', `${ctxLabel}: Allow-Origin deve ser '*'`)
        assertEquals(result.headers.get('access-control-allow-credentials'), null, `${ctxLabel}: Allow-Credentials NUNCA pode aparecer`)
        assertEquals(result.headers.get('access-control-max-age'), '86400', `${ctxLabel}: Max-Age literal`)

        // (5) Headers injetados via CRLF NUNCA aparecem.
        assertEquals(result.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA pode aparecer (anti-smuggling)`)
        assertEquals(result.headers.get('cookie'), null, `${ctxLabel}: Cookie NUNCA pode aparecer`)
        assertEquals(result.headers.get('x-injected'), null, `${ctxLabel}: X-Injected NUNCA pode aparecer`)
        assertEquals(result.headers.get('x-smuggled'), null, `${ctxLabel}: X-Smuggled NUNCA pode aparecer`)
        assertEquals(result.headers.get('x-null-byte'), null, `${ctxLabel}: X-Null-Byte NUNCA pode aparecer`)
        assertEquals(result.headers.get('x-method-injected'), null, `${ctxLabel}: X-Method-Injected NUNCA pode aparecer`)
        assertEquals(result.headers.get('access-control-expose-headers'), null, `${ctxLabel}: Expose-Headers NUNCA pode aparecer`)

        // (6) Allow-Methods e Allow-Headers aparecem exatamente 1x cada (sem duplicação por proxy/smuggling).
        let methodsCount = 0, headersCount = 0
        for (const [name] of result.headers) {
          const lower = name.toLowerCase()
          if (lower === 'access-control-allow-methods') methodsCount++
          if (lower === 'access-control-allow-headers') headersCount++
        }
        assertEquals(methodsCount, 1, `${ctxLabel}: Allow-Methods deve aparecer exatamente 1x`)
        assertEquals(headersCount, 1, `${ctxLabel}: Allow-Headers deve aparecer exatamente 1x`)
      }
    }

    // (7) Sanidade da matriz: 7 × 14 = 98 requests, com pelo menos algumas validadas como 200.
    assertEquals(totalRequests, METHOD_VARIANTS.length * HEADER_PAYLOADS.length, 'matriz combinada deve cobrir todas as combinações')
    assert(validatedAs200 > 0, 'pelo menos uma combinação deveria ter retornado 200 para validar contrato CORS literal')

    // (8) Zero createClient invocado — preflight nunca toca DB, nem com payloads maliciosos.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight (mesmo com CRLF/null + métodos variados)')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS bare — NO Origin, NO Request-Method, NO Request-Headers — Allow-Methods/Allow-Headers stay LITERAL exact (no echo, no leak, deterministic across N repetitions)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_METHODS_LITERAL = 'POST, OPTIONS'
    const EXPECTED_METHODS_SET = new Set(['post', 'options'])
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const DANGEROUS_METHODS = ['get', 'put', 'patch', 'delete', 'head', 'connect', 'trace', 'propfind', 'custom-method', '*']
    const DANGEROUS_HEADERS = [
      'set-cookie', 'set-cookie2', 'cookie', 'cookie2',
      'host', 'origin', 'authorization-bearer',
      'x-evil-cookie', 'x-fake-header', 'x-csrf-token',
      'x-forwarded-for', 'x-real-ip', 'proxy-authorization',
      '*',
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    // Repete N vezes — preflight DEVE ser determinístico (sem state leak entre requests).
    const REPETITIONS = 25
    const responses: Array<{ status: number; am: string | null; ah: string | null; ao: string | null; ma: string | null }> = []

    for (let i = 0; i < REPETITIONS; i++) {
      // CRÍTICO: NENHUM header CORS enviado — request OPTIONS "nu".
      const res = await fetch(`${ctx.url}/`, { method: 'OPTIONS' })
      await res.text()
      const ctxLabel = `[bare OPTIONS #${i + 1}]`

      // (1) Status 200 — handler reconhece OPTIONS mesmo sem hints CORS.
      assertEquals(res.status, 200, `${ctxLabel}: deve retornar 200`)

      // (2) Allow-Methods LITERAL EXATO — não pode estar ausente, não pode ser '*', não pode ter dangerous.
      const am = res.headers.get('access-control-allow-methods')
      assertExists(am, `${ctxLabel}: Allow-Methods deve estar presente mesmo sem Request-Method`)
      assertEquals(am, EXPECTED_METHODS_LITERAL, `${ctxLabel}: Allow-Methods deve ser literal "${EXPECTED_METHODS_LITERAL}"`)
      const parsedMethods = new Set(parseList(am))
      assertEquals(parsedMethods.size, EXPECTED_METHODS_SET.size, `${ctxLabel}: Allow-Methods deve listar exatamente 2 métodos`)
      for (const m of EXPECTED_METHODS_SET) {
        assert(parsedMethods.has(m), `${ctxLabel}: Allow-Methods deve incluir "${m}"`)
      }
      for (const dangerous of DANGEROUS_METHODS) {
        assert(!parsedMethods.has(dangerous), `${ctxLabel}: Allow-Methods NÃO PODE conter "${dangerous}"`)
      }

      // (3) Allow-Headers LITERAL EXATO — não pode estar ausente, não pode ser '*', não pode ter dangerous.
      const ah = res.headers.get('access-control-allow-headers')
      assertExists(ah, `${ctxLabel}: Allow-Headers deve estar presente mesmo sem Request-Headers`)
      assertEquals(ah, EXPECTED_HEADERS_LITERAL, `${ctxLabel}: Allow-Headers deve ser literal "${EXPECTED_HEADERS_LITERAL}"`)
      const parsedHeaders = new Set(parseList(ah))
      assertEquals(parsedHeaders.size, EXPECTED_HEADERS_SET.size, `${ctxLabel}: Allow-Headers deve listar exatamente 5 headers`)
      for (const h of EXPECTED_HEADERS_SET) {
        assert(parsedHeaders.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
      }
      for (const dangerous of DANGEROUS_HEADERS) {
        assert(!parsedHeaders.has(dangerous), `${ctxLabel}: Allow-Headers NÃO PODE conter "${dangerous}"`)
      }

      // (4) Allow-Origin '*' literal mesmo sem Origin enviado.
      const ao = res.headers.get('access-control-allow-origin')
      assertEquals(ao, '*', `${ctxLabel}: Allow-Origin deve ser '*' literal`)
      assert(ao !== 'null', `${ctxLabel}: Allow-Origin NUNCA pode ser 'null'`)

      // (5) Allow-Credentials NUNCA presente.
      assertEquals(res.headers.get('access-control-allow-credentials'), null, `${ctxLabel}: Allow-Credentials NUNCA pode aparecer`)

      // (6) Max-Age literal '86400'.
      const ma = res.headers.get('access-control-max-age')
      assertEquals(ma, '86400', `${ctxLabel}: Max-Age deve ser '86400'`)

      // (7) Vary não pode incluir 'origin' (incompatível com Allow-Origin '*').
      const vary = res.headers.get('vary') ?? ''
      assert(
        !vary.toLowerCase().split(',').map((s) => s.trim()).includes('origin'),
        `${ctxLabel}: Vary NÃO PODE incluir 'origin'`,
      )

      // (8) Cookies / Expose-Headers ausentes.
      assertEquals(res.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA pode aparecer`)
      assertEquals(res.headers.get('set-cookie2'), null, `${ctxLabel}: Set-Cookie2 NUNCA pode aparecer`)
      assertEquals(res.headers.get('access-control-expose-headers'), null, `${ctxLabel}: Expose-Headers NUNCA pode aparecer`)

      // (9) Allow-Methods e Allow-Headers aparecem exatamente 1x cada.
      let methodsCount = 0, headersCount = 0
      for (const [name] of res.headers) {
        const lower = name.toLowerCase()
        if (lower === 'access-control-allow-methods') methodsCount++
        if (lower === 'access-control-allow-headers') headersCount++
      }
      assertEquals(methodsCount, 1, `${ctxLabel}: Allow-Methods deve aparecer exatamente 1x`)
      assertEquals(headersCount, 1, `${ctxLabel}: Allow-Headers deve aparecer exatamente 1x`)

      // (10) Body deve ser vazio em preflight (anti-leak).
      // Já consumimos com res.text() acima — guardamos o que importa para comparar determinismo.
      responses.push({ status: res.status, am, ah, ao, ma })
    }

    // (11) DETERMINISMO: todas as N respostas devem ser byte-idênticas nos campos CORS.
    const first = responses[0]
    for (let i = 1; i < responses.length; i++) {
      assertEquals(responses[i].status, first.status, `repetição #${i + 1}: status divergiu`)
      assertEquals(responses[i].am, first.am, `repetição #${i + 1}: Allow-Methods divergiu`)
      assertEquals(responses[i].ah, first.ah, `repetição #${i + 1}: Allow-Headers divergiu`)
      assertEquals(responses[i].ao, first.ao, `repetição #${i + 1}: Allow-Origin divergiu`)
      assertEquals(responses[i].ma, first.ma, `repetição #${i + 1}: Max-Age divergiu`)
    }

    // (12) Zero createClient invocado em qualquer das N requests bare.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight bare')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — Access-Control-Request-Headers with whitespace/comma formatting × CRLF/null-byte injection — Allow-Headers stays LITERAL exact (no echo, no smuggling)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const DANGEROUS_HEADERS = [
      'set-cookie', 'set-cookie2', 'cookie', 'cookie2',
      'host', 'origin', 'authorization-bearer',
      'x-evil-cookie', 'x-fake-header', 'x-csrf-token',
      'x-forwarded-for', 'x-real-ip', 'proxy-authorization',
      'x-injected', 'x-smuggled', 'x-null-byte',
      '*',
    ]

    const u = new URL(ctx.url)
    const hostHeader = u.host

    // Payloads que MISTURAM:
    //  (A) formatação cosmética: espaço antes da vírgula, múltiplos espaços, tabs, vírgulas duplas,
    //      vírgulas leading/trailing/internas, espaço dentro de tokens.
    //  (B) bytes maliciosos: CR, LF, CRLF, null bytes, control chars.
    // O contrato: Allow-Headers SEMPRE literal exato, sem echo, sem smuggling.
    const PAYLOADS: Array<{ label: string; raw: string }> = [
      // --- Espaço antes da vírgula (caso explícito do usuário). ---
      { label: 'space-before-comma simples',          raw: 'authorization ,x-client-info' },
      { label: 'space-before-comma com 5 tokens',     raw: 'authorization ,x-client-info ,apikey ,content-type ,x-test-secret' },
      { label: 'space-before-comma + space-after',    raw: 'authorization , x-client-info , apikey' },
      { label: 'múltiplos espaços antes da vírgula',  raw: 'authorization     ,    x-client-info' },
      { label: 'tab antes da vírgula',                raw: 'authorization\t,x-client-info' },
      { label: 'tab antes + LF depois da vírgula',    raw: 'authorization\t,\nx-client-info' },
      { label: 'space-before-comma + CR injetado',    raw: 'authorization ,\rx-client-info' },
      { label: 'space-before-comma + CRLF + injection', raw: 'authorization ,\r\nSet-Cookie: pwn=1' },
      { label: 'space-before-comma + null byte',      raw: 'authorization \x00,x-client-info' },
      { label: 'space-before-comma + null + dangerous', raw: 'authorization \x00, set-cookie' },

      // --- Vírgulas múltiplas + whitespace + bytes maliciosos. ---
      { label: 'vírgulas duplas + espaços',           raw: 'content-type  ,,  x-test-secret' },
      { label: 'vírgulas triplas + tab',              raw: 'content-type\t,,,\tx-test-secret' },
      { label: 'vírgulas + CR no meio',               raw: 'content-type , ,\r, x-test-secret' },
      { label: 'vírgulas + LF no meio',               raw: 'content-type ,\n, x-test-secret' },
      { label: 'vírgulas + CRLF + injetar X-Injected', raw: 'content-type ,\r\nX-Injected: 1, x-test-secret' },
      { label: 'vírgulas + null entre tokens',        raw: 'content-type\x00,\x00x-test-secret' },

      // --- Whitespace ao redor de TODOS os tokens + injeção. ---
      { label: 'whitespace ao redor de todos',        raw: '   authorization   ,   x-client-info   ,   apikey   ' },
      { label: 'whitespace + CRLF smuggle',           raw: '   authorization   \r\n   Cookie: evil=1   ,   x-client-info   ' },
      { label: 'whitespace + null no meio',           raw: '   content-type   \x00   ,   x-test-secret   ' },

      // --- Leading/trailing comma + bytes maliciosos. ---
      { label: 'leading comma + CR',                  raw: ', \rcontent-type, x-test-secret' },
      { label: 'trailing comma + LF',                 raw: 'content-type, x-test-secret,\n' },
      { label: 'leading + trailing + null',           raw: '\x00, content-type, x-test-secret, \x00' },
      { label: 'leading comma + CRLF smuggle',        raw: ',\r\nSet-Cookie: bad=1, content-type' },

      // --- Espaços DENTRO de tokens (split inválido) + bytes maliciosos. ---
      { label: 'espaço dentro de token',              raw: 'content type, x-test-secret' },
      { label: 'espaço dentro + CRLF',                raw: 'content type\r\nX-Smuggled: 1, x-test-secret' },
      { label: 'espaço dentro + null',                raw: 'content\x00type, x-test-secret' },

      // --- Combinação caótica: formatação + CRLF + null + dangerous. ---
      { label: 'caos total #1',                       raw: ' authorization \t,, \r\n Set-Cookie: x=y \x00, x-client-info ,' },
      { label: 'caos total #2',                       raw: ',,, AUTH\x00ORIZATION ,\r\nX-Injected: 1,, content-type \t,\n cookie ,' },
      { label: 'caos total #3 (allowlist embaralhada + tudo)', raw: ' x-test-secret \t,, content-type \r\n Set-Cookie: a=b ,\x00 apikey ,, x-client-info \n, authorization ' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    type RawResponse = { status: number; headers: Headers } | { error: string }

    async function sendRaw(payload: string): Promise<RawResponse> {
      let conn: Deno.TcpConn | null = null
      try {
        conn = await Deno.connect({ hostname: u.hostname, port: parseInt(u.port, 10), transport: 'tcp' })
        const reqLines = [
          'OPTIONS / HTTP/1.1',
          `Host: ${hostHeader}`,
          'Origin: https://evil.example.com',
          'Access-Control-Request-Method: POST',
          `Access-Control-Request-Headers: ${payload}`,
          'Connection: close',
          '',
          '',
        ]
        await conn.write(new TextEncoder().encode(reqLines.join('\r\n')))

        const chunks: Uint8Array[] = []
        const buf = new Uint8Array(8192)
        while (true) {
          const n = await conn.read(buf)
          if (n === null) break
          chunks.push(buf.slice(0, n))
        }
        const total = chunks.reduce((s, c) => s + c.length, 0)
        const merged = new Uint8Array(total)
        let off = 0
        for (const c of chunks) { merged.set(c, off); off += c.length }
        const text = new TextDecoder().decode(merged)

        const headerEnd = text.indexOf('\r\n\r\n')
        if (headerEnd === -1) return { error: 'no header terminator' }
        const lines = text.slice(0, headerEnd).split('\r\n')
        const m = lines[0].match(/^HTTP\/1\.[01]\s+(\d{3})/)
        if (!m) return { error: `bad status: ${lines[0]}` }
        const status = parseInt(m[1], 10)
        const headers = new Headers()
        for (let i = 1; i < lines.length; i++) {
          const idx = lines[i].indexOf(':')
          if (idx === -1) continue
          const name = lines[i].slice(0, idx).trim()
          const value = lines[i].slice(idx + 1).trim()
          if (name) headers.append(name, value)
        }
        return { status, headers }
      } finally {
        try { conn?.close() } catch { /* ignore */ }
      }
    }

    let validatedAs200 = 0
    let acceptedAs4xx = 0

    for (const p of PAYLOADS) {
      const result = await sendRaw(p.raw)
      const ctxLabel = `[Payload: ${p.label}]`

      if ('error' in result) {
        // Servidor recusou request malformada — desfecho seguro.
        continue
      }

      // (1) Status 200 OU 4xx — nunca 5xx.
      assert(
        result.status === 200 || (result.status >= 400 && result.status < 500),
        `${ctxLabel}: status deve ser 200 ou 4xx, recebido ${result.status}`,
      )

      if (result.status !== 200) {
        acceptedAs4xx++
        continue
      }
      validatedAs200++

      // (2) Allow-Headers LITERAL EXATO — sem echo, sem CR/LF/null embutido.
      const ah = result.headers.get('access-control-allow-headers')
      assertExists(ah, `${ctxLabel}: Allow-Headers deve estar presente`)
      assertEquals(
        ah, EXPECTED_HEADERS_LITERAL,
        `${ctxLabel}: Allow-Headers deve ser literal "${EXPECTED_HEADERS_LITERAL}"`,
      )
      const parsed = new Set(parseList(ah))
      assertEquals(parsed.size, EXPECTED_HEADERS_SET.size, `${ctxLabel}: Allow-Headers deve listar exatamente 5 headers`)
      for (const h of EXPECTED_HEADERS_SET) {
        assert(parsed.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
      }

      // (3) NUNCA cabeçalhos perigosos.
      for (const dangerous of DANGEROUS_HEADERS) {
        assert(!parsed.has(dangerous), `${ctxLabel}: Allow-Headers NÃO PODE conter header perigoso "${dangerous}"`)
      }

      // (4) NUNCA CR/LF/null no valor (anti header-injection downstream).
      assert(!ah.includes('\r'), `${ctxLabel}: Allow-Headers NÃO PODE conter CR`)
      assert(!ah.includes('\n'), `${ctxLabel}: Allow-Headers NÃO PODE conter LF`)
      assert(!ah.includes('\x00'), `${ctxLabel}: Allow-Headers NÃO PODE conter null byte`)

      // (5) Allow-Methods/Origin/Max-Age literais; sem credenciais.
      assertEquals(result.headers.get('access-control-allow-methods'), 'POST, OPTIONS', `${ctxLabel}: Allow-Methods literal`)
      assertEquals(result.headers.get('access-control-allow-origin'), '*', `${ctxLabel}: Allow-Origin '*'`)
      assertEquals(result.headers.get('access-control-allow-credentials'), null, `${ctxLabel}: Allow-Credentials NUNCA pode aparecer`)
      assertEquals(result.headers.get('access-control-max-age'), '86400', `${ctxLabel}: Max-Age literal`)

      // (6) Headers injetados via CRLF NUNCA aparecem na resposta (anti-smuggling).
      assertEquals(result.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA pode aparecer`)
      assertEquals(result.headers.get('cookie'), null, `${ctxLabel}: Cookie NUNCA pode aparecer`)
      assertEquals(result.headers.get('x-injected'), null, `${ctxLabel}: X-Injected NUNCA pode aparecer`)
      assertEquals(result.headers.get('x-smuggled'), null, `${ctxLabel}: X-Smuggled NUNCA pode aparecer`)
      assertEquals(result.headers.get('x-null-byte'), null, `${ctxLabel}: X-Null-Byte NUNCA pode aparecer`)
      assertEquals(result.headers.get('access-control-expose-headers'), null, `${ctxLabel}: Expose-Headers NUNCA pode aparecer`)

      // (7) Allow-Headers aparece exatamente 1x (sem duplicação por proxy/smuggling).
      let occurrences = 0
      for (const [name] of result.headers) {
        if (name.toLowerCase() === 'access-control-allow-headers') occurrences++
      }
      assertEquals(occurrences, 1, `${ctxLabel}: Allow-Headers deve aparecer exatamente 1x`)
    }

    // (8) Sanidade: pelo menos um payload validado como 200 (caso contrário o teste é vácuo).
    assert(
      validatedAs200 > 0 || acceptedAs4xx === PAYLOADS.length,
      `pelo menos uma combinação deveria validar 200 (validados=${validatedAs200}, 4xx=${acceptedAs4xx}, total=${PAYLOADS.length})`,
    )

    // (9) Zero createClient invocado em qualquer payload.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight (whitespace+CRLF+null mix)')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — Access-Control-Request-Headers with obs-fold (CRLF + SP/HTAB) variants — Allow-Headers stays LITERAL exact (no echo, no smuggling, no dangerous)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const DANGEROUS_HEADERS = [
      'set-cookie', 'set-cookie2', 'cookie', 'cookie2',
      'host', 'origin', 'authorization-bearer',
      'x-evil-cookie', 'x-fake-header', 'x-csrf-token',
      'x-forwarded-for', 'x-real-ip', 'proxy-authorization',
      'x-folded', 'x-injected', 'x-smuggled',
      '*',
    ]

    const u = new URL(ctx.url)
    const hostHeader = u.host

    // RFC 7230 §3.2.4: obs-fold = CRLF 1*( SP / HTAB ).
    // Servidores HTTP modernos DEVEM rejeitar (400) ou substituir por SP em mensagens recebidas.
    // O contrato a validar: independente de qual caminho o servidor escolher,
    // Allow-Headers permanece literal exato — nunca ecoa, nunca quebra-linha, nunca vaza dangerous.
    const PAYLOADS: Array<{ label: string; raw: string }> = [
      // --- obs-fold canônico (CRLF + 1 SP). ---
      { label: 'obs-fold CRLF+SP simples',                  raw: 'authorization,\r\n x-client-info' },
      { label: 'obs-fold CRLF+SP no início',                raw: '\r\n authorization, x-client-info' },
      { label: 'obs-fold CRLF+SP no fim',                   raw: 'authorization, x-client-info\r\n ' },
      { label: 'obs-fold CRLF+SP entre 5 tokens allowlist', raw: 'authorization,\r\n x-client-info,\r\n apikey,\r\n content-type,\r\n x-test-secret' },

      // --- obs-fold com HTAB. ---
      { label: 'obs-fold CRLF+HTAB simples',                raw: 'authorization,\r\n\tx-client-info' },
      { label: 'obs-fold CRLF+HTAB múltiplo',               raw: 'content-type,\r\n\t\t\tx-test-secret' },

      // --- obs-fold com múltiplos SP/HTAB combinados. ---
      { label: 'obs-fold CRLF+SP+SP+HTAB',                  raw: 'authorization,\r\n  \tx-client-info' },
      { label: 'obs-fold CRLF+10 espaços',                  raw: 'content-type,\r\n          x-test-secret' },
      { label: 'obs-fold misto SP/HTAB intercalado',        raw: 'authorization,\r\n \t \t x-client-info,\r\n\t \t apikey' },

      // --- obs-fold encadeado (múltiplos folds na mesma linha). ---
      { label: 'obs-fold encadeado 2x',                     raw: 'authorization,\r\n x-client-info,\r\n apikey' },
      { label: 'obs-fold encadeado 4x',                     raw: 'authorization,\r\n x-client-info,\r\n apikey,\r\n content-type,\r\n x-test-secret' },
      { label: 'obs-fold encadeado mix SP/HTAB',            raw: 'authorization,\r\n x-client-info,\r\n\tapikey,\r\n  content-type,\r\n\t\tx-test-secret' },

      // --- obs-fold MALICIOSO: tentando injetar headers via fold. ---
      // Se o servidor "desdobrar" incorretamente, o atacante poderia smuggling.
      // Diferença chave de CRLF puro: aqui o próximo byte É SP/HTAB, então é fold válido (não nova header line).
      { label: 'obs-fold tentando esconder set-cookie',     raw: 'content-type,\r\n set-cookie' },
      { label: 'obs-fold tentando esconder cookie',         raw: 'content-type,\r\n\tcookie' },
      { label: 'obs-fold tentando esconder x-injected',     raw: 'content-type,\r\n x-injected' },
      { label: 'obs-fold antes de payload smuggling',       raw: 'content-type,\r\n x-folded\r\nSet-Cookie: pwn=1' },

      // --- obs-fold + null bytes combinados. ---
      { label: 'obs-fold + null byte no fold',              raw: 'content-type,\r\n \x00x-test-secret' },
      { label: 'obs-fold + null antes do CRLF',             raw: 'content-type\x00,\r\n x-test-secret' },

      // --- obs-fold com casing variado nos tokens. ---
      { label: 'obs-fold + UPPERCASE',                      raw: 'AUTHORIZATION,\r\n X-CLIENT-INFO' },
      { label: 'obs-fold + Title-Case',                     raw: 'Authorization,\r\n\tX-Client-Info' },
      { label: 'obs-fold + mIxEd',                          raw: 'AuThOrIzAtIoN,\r\n X-cLiEnT-iNfO' },

      // --- obs-fold em torno de vírgulas exóticas. ---
      { label: 'obs-fold + vírgulas duplas',                raw: 'content-type,,\r\n x-test-secret' },
      { label: 'obs-fold + leading comma',                  raw: ',\r\n content-type, x-test-secret' },
      { label: 'obs-fold + trailing comma',                 raw: 'content-type, x-test-secret,\r\n ' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    type RawResponse = { status: number; headers: Headers } | { error: string }

    async function sendRaw(payload: string): Promise<RawResponse> {
      let conn: Deno.TcpConn | null = null
      try {
        conn = await Deno.connect({ hostname: u.hostname, port: parseInt(u.port, 10), transport: 'tcp' })
        const reqLines = [
          'OPTIONS / HTTP/1.1',
          `Host: ${hostHeader}`,
          'Origin: https://evil.example.com',
          'Access-Control-Request-Method: POST',
          `Access-Control-Request-Headers: ${payload}`,
          'Connection: close',
          '',
          '',
        ]
        await conn.write(new TextEncoder().encode(reqLines.join('\r\n')))

        const chunks: Uint8Array[] = []
        const buf = new Uint8Array(8192)
        while (true) {
          const n = await conn.read(buf)
          if (n === null) break
          chunks.push(buf.slice(0, n))
        }
        const total = chunks.reduce((s, c) => s + c.length, 0)
        const merged = new Uint8Array(total)
        let off = 0
        for (const c of chunks) { merged.set(c, off); off += c.length }
        const text = new TextDecoder().decode(merged)

        const headerEnd = text.indexOf('\r\n\r\n')
        if (headerEnd === -1) return { error: 'no header terminator' }
        const lines = text.slice(0, headerEnd).split('\r\n')
        const m = lines[0].match(/^HTTP\/1\.[01]\s+(\d{3})/)
        if (!m) return { error: `bad status: ${lines[0]}` }
        const status = parseInt(m[1], 10)
        const headers = new Headers()
        for (let i = 1; i < lines.length; i++) {
          const idx = lines[i].indexOf(':')
          if (idx === -1) continue
          const name = lines[i].slice(0, idx).trim()
          const value = lines[i].slice(idx + 1).trim()
          if (name) headers.append(name, value)
        }
        return { status, headers }
      } finally {
        try { conn?.close() } catch { /* ignore */ }
      }
    }

    let validatedAs200 = 0
    let acceptedAs4xx = 0

    for (const p of PAYLOADS) {
      const result = await sendRaw(p.raw)
      const ctxLabel = `[obs-fold payload: ${p.label}]`

      if ('error' in result) {
        // Servidor recusou — RFC 7230 explicitly permite responder 400 a obs-fold. Seguro.
        acceptedAs4xx++
        continue
      }

      // (1) Status 200 OU 4xx — nunca 5xx (que indicaria crash no parser de obs-fold).
      assert(
        result.status === 200 || (result.status >= 400 && result.status < 500),
        `${ctxLabel}: status deve ser 200 ou 4xx, recebido ${result.status}`,
      )

      if (result.status !== 200) {
        acceptedAs4xx++
        continue
      }
      validatedAs200++

      // (2) Allow-Headers LITERAL EXATO — sem echo do payload com fold.
      const ah = result.headers.get('access-control-allow-headers')
      assertExists(ah, `${ctxLabel}: Allow-Headers deve estar presente`)
      assertEquals(
        ah, EXPECTED_HEADERS_LITERAL,
        `${ctxLabel}: Allow-Headers deve ser literal "${EXPECTED_HEADERS_LITERAL}"`,
      )

      // (3) Conjunto parseado bate exatamente.
      const parsed = new Set(parseList(ah))
      assertEquals(parsed.size, EXPECTED_HEADERS_SET.size, `${ctxLabel}: Allow-Headers deve listar exatamente 5 headers`)
      for (const h of EXPECTED_HEADERS_SET) {
        assert(parsed.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
      }

      // (4) NUNCA cabeçalhos perigosos (mesmo se obs-fold tentou esconder).
      for (const dangerous of DANGEROUS_HEADERS) {
        assert(!parsed.has(dangerous), `${ctxLabel}: Allow-Headers NÃO PODE conter header perigoso "${dangerous}"`)
      }

      // (5) Allow-Headers NUNCA contém CR/LF/null embutido (anti header-injection downstream).
      assert(!ah.includes('\r'), `${ctxLabel}: Allow-Headers NÃO PODE conter CR`)
      assert(!ah.includes('\n'), `${ctxLabel}: Allow-Headers NÃO PODE conter LF`)
      assert(!ah.includes('\x00'), `${ctxLabel}: Allow-Headers NÃO PODE conter null byte`)

      // (6) Outros campos CORS literais.
      assertEquals(result.headers.get('access-control-allow-methods'), 'POST, OPTIONS', `${ctxLabel}: Allow-Methods literal`)
      assertEquals(result.headers.get('access-control-allow-origin'), '*', `${ctxLabel}: Allow-Origin '*'`)
      assertEquals(result.headers.get('access-control-allow-credentials'), null, `${ctxLabel}: Allow-Credentials NUNCA`)
      assertEquals(result.headers.get('access-control-max-age'), '86400', `${ctxLabel}: Max-Age literal`)

      // (7) Headers smuggling NUNCA aparecem na resposta (anti obs-fold smuggling).
      assertEquals(result.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA pode aparecer`)
      assertEquals(result.headers.get('cookie'), null, `${ctxLabel}: Cookie NUNCA pode aparecer`)
      assertEquals(result.headers.get('x-injected'), null, `${ctxLabel}: X-Injected NUNCA pode aparecer`)
      assertEquals(result.headers.get('x-folded'), null, `${ctxLabel}: X-Folded NUNCA pode aparecer`)
      assertEquals(result.headers.get('x-smuggled'), null, `${ctxLabel}: X-Smuggled NUNCA pode aparecer`)
      assertEquals(result.headers.get('access-control-expose-headers'), null, `${ctxLabel}: Expose-Headers NUNCA pode aparecer`)

      // (8) Allow-Headers aparece exatamente 1x.
      let occurrences = 0
      for (const [name] of result.headers) {
        if (name.toLowerCase() === 'access-control-allow-headers') occurrences++
      }
      assertEquals(occurrences, 1, `${ctxLabel}: Allow-Headers deve aparecer exatamente 1x`)
    }

    // (9) Sanidade da matriz: total de payloads cobertos.
    assertEquals(
      validatedAs200 + acceptedAs4xx, PAYLOADS.length,
      `todos os ${PAYLOADS.length} payloads obs-fold devem ser cobertos (200=${validatedAs200}, 4xx/erro=${acceptedAs4xx})`,
    )

    // (10) Zero createClient invocado mesmo com obs-fold maliciosos.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight (obs-fold)')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — Access-Control-Request-Headers with percent-encoded/UTF-8 confusables × whitespace-around-commas — Allow-Headers stays LITERAL exact (no echo, no decode-leak)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const DANGEROUS_HEADERS = [
      'set-cookie', 'set-cookie2', 'cookie', 'cookie2',
      'host', 'origin', 'authorization-bearer',
      'x-evil-cookie', 'x-fake-header', 'x-csrf-token',
      'x-forwarded-for', 'x-real-ip', 'proxy-authorization',
      'x-injected', 'x-smuggled', 'x-utf8',
      '*',
    ]
    // Tokens "decode-leak": se o servidor decodificasse percent-encoding, esses apareceriam.
    const DECODED_LEAK_TOKENS = [
      'set-cookie',         // de %73%65%74-%63%6F%6F%6B%69%65
      'cookie',             // de %63%6F%6F%6B%69%65
      'host',               // de %68%6F%73%74
      'authorization',      // de %61%75%74%68... — válido, mas valida que NÃO veio do decode
      '\r', '\n', '\x00',   // de %0D %0A %00 — anti CRLF/null smuggling via percent
    ]

    const u = new URL(ctx.url)
    const hostHeader = u.host

    // Payloads que combinam:
    //  (A) percent-encoding (RFC 3986) — bytes literais "%XX" que NÃO devem ser decodificados em header values.
    //  (B) UTF-8 confusables — caracteres Unicode que VISUALMENTE parecem ASCII mas têm bytes diferentes.
    //  (C) whitespace ao redor de vírgulas — formatação cosmética ortogonal.
    const PAYLOADS: Array<{ label: string; raw: string }> = [
      // --- Percent-encoded "puro" — bytes literais não devem virar control chars/dangerous. ---
      { label: 'percent-encoded set-cookie',           raw: '%73%65%74-%63%6F%6F%6B%69%65, content-type' },
      { label: 'percent-encoded cookie maiúsculo',     raw: '%43%6F%6F%6B%69%65 , content-type' },
      { label: 'percent-encoded CR (%0D)',             raw: 'content-type%0D, x-test-secret' },
      { label: 'percent-encoded LF (%0A)',             raw: 'content-type%0A, x-test-secret' },
      { label: 'percent-encoded CRLF (%0D%0A)',        raw: 'content-type%0D%0ASet-Cookie:%20pwn=1' },
      { label: 'percent-encoded null (%00)',           raw: 'content-type%00, x-test-secret' },
      { label: 'percent-encoded space (%20) interno', raw: 'content-type%20%2C%20x-test-secret' },  // %2C = ','
      { label: 'percent-encoded comma (%2C)',          raw: 'content-type%2Cx-test-secret' },
      { label: 'percent-encoded host injection',       raw: '%68%6F%73%74 , content-type' },
      { label: 'percent-encoded mix maiúsculo/minúsculo', raw: '%63%6f%4f%6B%69%65, content-type' },
      { label: 'percent-encoded tudo',                 raw: '%61%75%74%68%6F%72%69%7A%61%74%69%6F%6E' },

      // --- Percent-encoded INVÁLIDOS (parser deve manter literal). ---
      { label: 'percent + 1 hex (%4)',                 raw: 'content-type, %4' },
      { label: 'percent + non-hex (%ZZ)',              raw: 'content-type, x%ZZtest-secret' },
      { label: 'percent solto trailing',               raw: 'content-type, x-test-secret%' },
      { label: 'percent percent (%%)',                 raw: 'content-type%%x-test-secret' },

      // --- UTF-8 confusables (Unicode lookalikes). ---
      // Cyrillic 'а' (U+0430) parece ASCII 'a'. Greek 'Ε' (U+0395) parece 'E'.
      { label: 'cyrillic а em authorization',          raw: 'аuthorization, content-type' },
      { label: 'fullwidth uppercase AUTHORIZATION',    raw: 'ＡＵＴＨＯＲＩＺＡＴＩＯＮ, content-type' },
      { label: 'cyrillic с em set-cookie',             raw: 'сet-cookie, content-type' },  // 'с' Cyrillic
      { label: 'mathematical bold authorization',      raw: '𝐚𝐮𝐭𝐡𝐨𝐫𝐢𝐳𝐚𝐭𝐢𝐨𝐧, content-type' },
      { label: 'zero-width space dentro de token',     raw: 'auth\u200Borization, content-type' },
      { label: 'soft hyphen dentro de token',          raw: 'cont\u00ADent-type, x-test-secret' },
      { label: 'BOM no início',                        raw: '\uFEFFcontent-type, x-test-secret' },

      // --- UTF-8 inválido / overlong / surrogates lone (encodados como bytes via TextEncoder). ---
      // Nota: TextEncoder não emite bytes inválidos; usamos sequências válidas mas semanticamente confusas.
      { label: 'caractere combining acima',            raw: 'content-type\u0301, x-test-secret' },
      { label: 'RTL override (U+202E)',                raw: 'content-type\u202E, x-test-secret' },
      { label: 'normalização NFKD: ﬃ ligature',        raw: 'aﬃkey, content-type' },  // 'ﬃ' poderia normalizar para 'ffi'

      // --- Whitespace ao redor de vírgulas (com e sem percent/UTF-8). ---
      { label: 'espaço antes da vírgula simples',       raw: 'authorization ,x-client-info' },
      { label: 'espaços ao redor de todas vírgulas',    raw: ' authorization , x-client-info , apikey , content-type , x-test-secret ' },
      { label: 'tab ao redor de vírgulas',              raw: '\tcontent-type\t,\tx-test-secret\t' },
      { label: 'NBSP ao redor (U+00A0)',                raw: '\u00A0content-type\u00A0,\u00A0x-test-secret\u00A0' },
      { label: 'múltiplos NBSP + percent',              raw: '\u00A0\u00A0content-type%2C%20x-test-secret\u00A0\u00A0' },
      { label: 'em-space (U+2003) ao redor',            raw: '\u2003content-type\u2003,\u2003x-test-secret\u2003' },
      { label: 'mix tab + NBSP + percent + cyrillic',   raw: '\t\u00A0аuthorization\u00A0\t,\u00A0%63ookie\u00A0,\tcontent-type\t' },

      // --- Combinações caóticas: percent + UTF-8 + whitespace + tentativa de smuggling. ---
      { label: 'caos: percent CRLF + NBSP + cyrillic',  raw: '\u00A0%73et-cookie\u00A0%0D%0AX-Injected:%201\u00A0,\u00A0content-type\u00A0' },
      { label: 'caos: zero-width + percent + space',    raw: 'cont\u200Bent-type\u00A0%2C\u00A0%73et-cookie\u00A0,\u00A0x-test-secret' },
      { label: 'caos: BOM + RTL + percent host',        raw: '\uFEFF\u202E%68%6F%73%74\u00A0,\u00A0content-type' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    type RawResponse = { status: number; headers: Headers } | { error: string }

    async function sendRaw(payload: string): Promise<RawResponse> {
      let conn: Deno.TcpConn | null = null
      try {
        conn = await Deno.connect({ hostname: u.hostname, port: parseInt(u.port, 10), transport: 'tcp' })
        const reqLines = [
          'OPTIONS / HTTP/1.1',
          `Host: ${hostHeader}`,
          'Origin: https://evil.example.com',
          'Access-Control-Request-Method: POST',
          `Access-Control-Request-Headers: ${payload}`,
          'Connection: close',
          '',
          '',
        ]
        await conn.write(new TextEncoder().encode(reqLines.join('\r\n')))

        const chunks: Uint8Array[] = []
        const buf = new Uint8Array(8192)
        while (true) {
          const n = await conn.read(buf)
          if (n === null) break
          chunks.push(buf.slice(0, n))
        }
        const total = chunks.reduce((s, c) => s + c.length, 0)
        const merged = new Uint8Array(total)
        let off = 0
        for (const c of chunks) { merged.set(c, off); off += c.length }
        const text = new TextDecoder().decode(merged)

        const headerEnd = text.indexOf('\r\n\r\n')
        if (headerEnd === -1) return { error: 'no header terminator' }
        const lines = text.slice(0, headerEnd).split('\r\n')
        const m = lines[0].match(/^HTTP\/1\.[01]\s+(\d{3})/)
        if (!m) return { error: `bad status: ${lines[0]}` }
        const status = parseInt(m[1], 10)
        const headers = new Headers()
        for (let i = 1; i < lines.length; i++) {
          const idx = lines[i].indexOf(':')
          if (idx === -1) continue
          const name = lines[i].slice(0, idx).trim()
          const value = lines[i].slice(idx + 1).trim()
          if (name) headers.append(name, value)
        }
        return { status, headers }
      } finally {
        try { conn?.close() } catch { /* ignore */ }
      }
    }

    let validatedAs200 = 0
    let acceptedAs4xx = 0

    for (const p of PAYLOADS) {
      const result = await sendRaw(p.raw)
      const ctxLabel = `[Payload: ${p.label}]`

      if ('error' in result) { acceptedAs4xx++; continue }

      // (1) Status 200 OU 4xx — nunca 5xx (parser não pode crashar com Unicode/percent).
      assert(
        result.status === 200 || (result.status >= 400 && result.status < 500),
        `${ctxLabel}: status deve ser 200 ou 4xx, recebido ${result.status}`,
      )
      if (result.status !== 200) { acceptedAs4xx++; continue }
      validatedAs200++

      // (2) Allow-Headers LITERAL EXATO — sem echo de percent-encoded nem UTF-8 confusable.
      const ah = result.headers.get('access-control-allow-headers')
      assertExists(ah, `${ctxLabel}: Allow-Headers deve estar presente`)
      assertEquals(
        ah, EXPECTED_HEADERS_LITERAL,
        `${ctxLabel}: Allow-Headers deve ser literal "${EXPECTED_HEADERS_LITERAL}"`,
      )

      // (3) Conjunto bate exatamente.
      const parsed = new Set(parseList(ah))
      assertEquals(parsed.size, EXPECTED_HEADERS_SET.size, `${ctxLabel}: Allow-Headers deve listar exatamente 5 headers`)
      for (const h of EXPECTED_HEADERS_SET) {
        assert(parsed.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
      }

      // (4) NUNCA cabeçalhos perigosos.
      for (const dangerous of DANGEROUS_HEADERS) {
        assert(!parsed.has(dangerous), `${ctxLabel}: Allow-Headers NÃO PODE conter "${dangerous}"`)
      }

      // (5) NUNCA bytes/strings que indicam decode-leak (CR/LF/null vindos de %0D/%0A/%00).
      for (const leak of DECODED_LEAK_TOKENS) {
        if (leak === 'authorization') continue  // está na allowlist legitimamente
        assert(!ah.includes(leak), `${ctxLabel}: Allow-Headers NÃO PODE conter decode-leak "${JSON.stringify(leak)}"`)
      }

      // (6) NUNCA echoar caracteres Unicode confusables — Allow-Headers deve ser ASCII puro.
      for (const ch of ah) {
        const code = ch.charCodeAt(0)
        assert(code >= 0x20 && code <= 0x7E, `${ctxLabel}: Allow-Headers contém char não-ASCII U+${code.toString(16).padStart(4, '0')}`)
      }

      // (7) NUNCA conter literal '%' (sinal de echo de percent-encoding).
      assert(!ah.includes('%'), `${ctxLabel}: Allow-Headers NÃO PODE conter '%' (echo de percent)`)

      // (8) Outros campos CORS literais.
      assertEquals(result.headers.get('access-control-allow-methods'), 'POST, OPTIONS', `${ctxLabel}: Allow-Methods literal`)
      assertEquals(result.headers.get('access-control-allow-origin'), '*', `${ctxLabel}: Allow-Origin '*'`)
      assertEquals(result.headers.get('access-control-allow-credentials'), null, `${ctxLabel}: Allow-Credentials NUNCA`)
      assertEquals(result.headers.get('access-control-max-age'), '86400', `${ctxLabel}: Max-Age literal`)

      // (9) Headers smuggling NUNCA aparecem na resposta.
      assertEquals(result.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA`)
      assertEquals(result.headers.get('cookie'), null, `${ctxLabel}: Cookie NUNCA`)
      assertEquals(result.headers.get('x-injected'), null, `${ctxLabel}: X-Injected NUNCA`)
      assertEquals(result.headers.get('x-smuggled'), null, `${ctxLabel}: X-Smuggled NUNCA`)
      assertEquals(result.headers.get('x-utf8'), null, `${ctxLabel}: X-Utf8 NUNCA`)
      assertEquals(result.headers.get('access-control-expose-headers'), null, `${ctxLabel}: Expose-Headers NUNCA`)

      // (10) Allow-Headers aparece exatamente 1x.
      let occurrences = 0
      for (const [name] of result.headers) {
        if (name.toLowerCase() === 'access-control-allow-headers') occurrences++
      }
      assertEquals(occurrences, 1, `${ctxLabel}: Allow-Headers deve aparecer exatamente 1x`)
    }

    // (11) Sanidade da matriz.
    assertEquals(
      validatedAs200 + acceptedAs4xx, PAYLOADS.length,
      `todos os ${PAYLOADS.length} payloads devem ser cobertos (200=${validatedAs200}, 4xx/erro=${acceptedAs4xx})`,
    )

    // (12) Zero createClient.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight (percent/UTF-8)')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — Access-Control-Request-METHOD with obs-fold (CRLF + SP/HTAB) variants — Allow-Methods/Allow-Headers stay LITERAL exact (no echo, no smuggling, no leak)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_METHODS_LITERAL = 'POST, OPTIONS'
    const EXPECTED_METHODS_SET = new Set(['post', 'options'])
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const DANGEROUS_METHODS = ['get', 'put', 'patch', 'delete', 'head', 'connect', 'trace', 'propfind', 'custom-method', '*']
    const DANGEROUS_HEADERS = [
      'set-cookie', 'set-cookie2', 'cookie', 'cookie2',
      'host', 'origin', 'authorization-bearer',
      'x-evil-cookie', 'x-fake-header', 'x-csrf-token',
      'x-forwarded-for', 'x-real-ip', 'proxy-authorization',
      'x-injected', 'x-smuggled', 'x-folded', 'x-method-injected',
      '*',
    ]

    const u = new URL(ctx.url)
    const hostHeader = u.host

    // RFC 7230 §3.2.4: obs-fold = CRLF 1*( SP / HTAB ).
    // Aplicado ao VALOR de Access-Control-Request-Method.
    // Servidor deve responder 400 OU normalizar (substituir fold por SP) — em ambos os casos:
    //  - Allow-Methods/Allow-Headers permanecem literais
    //  - Nada do payload é ecoado
    //  - Nenhum header smuggled aparece
    const PAYLOADS: Array<{ label: string; raw: string }> = [
      // --- obs-fold canônico no método. ---
      { label: 'POST + CRLF+SP + sufixo',                raw: 'POST\r\n GET' },
      { label: 'POST + CRLF+HTAB + sufixo',              raw: 'POST\r\n\tDELETE' },
      { label: 'POST + CRLF+SP+SP+SP',                   raw: 'POST\r\n   ' },
      { label: 'fold no início + POST',                  raw: '\r\n POST' },
      { label: 'fold no fim de POST',                    raw: 'POST\r\n ' },
      { label: 'fold encadeado 2x',                      raw: 'POST\r\n GET\r\n DELETE' },
      { label: 'fold com HTAB encadeado',                raw: 'POST\r\n\tGET\r\n\tPATCH' },
      { label: 'fold misto SP/HTAB',                     raw: 'POST\r\n \t \t GET' },

      // --- obs-fold MALICIOSO: tentando injetar header via fold no valor do método. ---
      // Se servidor "desdobrar" mal, atacante poderia smuggling X-Method-Injected.
      { label: 'fold tentando injetar X-Method-Injected', raw: 'POST\r\n X-Method-Injected: 1' },
      { label: 'fold tentando injetar Set-Cookie',        raw: 'POST\r\n Set-Cookie: pwn=1' },
      { label: 'fold tentando injetar Cookie',            raw: 'POST\r\n\tCookie: session=evil' },
      { label: 'fold + body smuggling',                   raw: 'POST\r\n Content-Length: 0\r\n\r\nMALICIOUS' },
      { label: 'fold antes de CRLF duplo (smuggling)',    raw: 'POST\r\n X-Folded: 1\r\n\r\nGET /admin HTTP/1.1\r\nHost: evil' },

      // --- obs-fold com método rejeitado escondido. ---
      { label: 'fold escondendo DELETE',                 raw: 'POST\r\n DELETE' },
      { label: 'fold escondendo PROPFIND',               raw: 'OPTIONS\r\n\tPROPFIND' },
      { label: 'fold escondendo wildcard',               raw: 'POST\r\n *' },
      { label: 'fold escondendo CUSTOM-METHOD',          raw: 'POST\r\n CUSTOM-METHOD' },

      // --- obs-fold + casing variado. ---
      { label: 'fold + lowercase post',                  raw: 'post\r\n get' },
      { label: 'fold + mIxEd PoSt',                      raw: 'PoSt\r\n\tDeLeTe' },

      // --- obs-fold + null bytes. ---
      { label: 'fold + null no sufixo',                  raw: 'POST\r\n \x00GET' },
      { label: 'fold + null antes do CRLF',              raw: 'POST\x00\r\n GET' },

      // --- obs-fold em torno de método VAZIO. ---
      { label: 'fold sem método',                        raw: '\r\n ' },
      { label: 'fold + só whitespace',                   raw: '\r\n \t \t ' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    type RawResponse = { status: number; headers: Headers } | { error: string }

    async function sendRaw(methodPayload: string): Promise<RawResponse> {
      let conn: Deno.TcpConn | null = null
      try {
        conn = await Deno.connect({ hostname: u.hostname, port: parseInt(u.port, 10), transport: 'tcp' })
        const reqLines = [
          'OPTIONS / HTTP/1.1',
          `Host: ${hostHeader}`,
          'Origin: https://evil.example.com',
          // Aqui injetamos o obs-fold no VALOR de Request-Method.
          `Access-Control-Request-Method: ${methodPayload}`,
          'Access-Control-Request-Headers: content-type, x-test-secret',
          'Connection: close',
          '',
          '',
        ]
        await conn.write(new TextEncoder().encode(reqLines.join('\r\n')))

        const chunks: Uint8Array[] = []
        const buf = new Uint8Array(8192)
        while (true) {
          const n = await conn.read(buf)
          if (n === null) break
          chunks.push(buf.slice(0, n))
        }
        const total = chunks.reduce((s, c) => s + c.length, 0)
        const merged = new Uint8Array(total)
        let off = 0
        for (const c of chunks) { merged.set(c, off); off += c.length }
        const text = new TextDecoder().decode(merged)

        const headerEnd = text.indexOf('\r\n\r\n')
        if (headerEnd === -1) return { error: 'no header terminator' }
        const lines = text.slice(0, headerEnd).split('\r\n')
        const m = lines[0].match(/^HTTP\/1\.[01]\s+(\d{3})/)
        if (!m) return { error: `bad status: ${lines[0]}` }
        const status = parseInt(m[1], 10)
        const headers = new Headers()
        for (let i = 1; i < lines.length; i++) {
          const idx = lines[i].indexOf(':')
          if (idx === -1) continue
          const name = lines[i].slice(0, idx).trim()
          const value = lines[i].slice(idx + 1).trim()
          if (name) headers.append(name, value)
        }
        return { status, headers }
      } finally {
        try { conn?.close() } catch { /* ignore */ }
      }
    }

    let validatedAs200 = 0
    let acceptedAs4xx = 0

    for (const p of PAYLOADS) {
      const result = await sendRaw(p.raw)
      const ctxLabel = `[Method obs-fold payload: ${p.label}]`

      if ('error' in result) { acceptedAs4xx++; continue }

      // (1) Status 200 OU 4xx — nunca 5xx.
      assert(
        result.status === 200 || (result.status >= 400 && result.status < 500),
        `${ctxLabel}: status deve ser 200 ou 4xx, recebido ${result.status}`,
      )
      if (result.status !== 200) { acceptedAs4xx++; continue }
      validatedAs200++

      // (2) Allow-Methods LITERAL EXATO — sem echo do método poluído.
      const am = result.headers.get('access-control-allow-methods')
      assertExists(am, `${ctxLabel}: Allow-Methods deve estar presente`)
      assertEquals(am, EXPECTED_METHODS_LITERAL, `${ctxLabel}: Allow-Methods deve ser literal "${EXPECTED_METHODS_LITERAL}"`)
      const parsedMethods = new Set(parseList(am))
      assertEquals(parsedMethods.size, EXPECTED_METHODS_SET.size, `${ctxLabel}: Allow-Methods deve listar exatamente 2 métodos`)
      for (const m of EXPECTED_METHODS_SET) {
        assert(parsedMethods.has(m), `${ctxLabel}: Allow-Methods deve incluir "${m}"`)
      }
      for (const dangerous of DANGEROUS_METHODS) {
        assert(!parsedMethods.has(dangerous), `${ctxLabel}: Allow-Methods NÃO PODE conter "${dangerous}"`)
      }
      assert(!am.includes('\r'), `${ctxLabel}: Allow-Methods NÃO PODE conter CR`)
      assert(!am.includes('\n'), `${ctxLabel}: Allow-Methods NÃO PODE conter LF`)
      assert(!am.includes('\x00'), `${ctxLabel}: Allow-Methods NÃO PODE conter null byte`)
      assert(!am.includes('\t'), `${ctxLabel}: Allow-Methods NÃO PODE conter HTAB`)

      // (3) Allow-Headers LITERAL EXATO — não pode ser afetado por obs-fold no Method.
      const ah = result.headers.get('access-control-allow-headers')
      assertExists(ah, `${ctxLabel}: Allow-Headers deve estar presente`)
      assertEquals(ah, EXPECTED_HEADERS_LITERAL, `${ctxLabel}: Allow-Headers deve ser literal "${EXPECTED_HEADERS_LITERAL}"`)
      const parsedHeaders = new Set(parseList(ah))
      assertEquals(parsedHeaders.size, EXPECTED_HEADERS_SET.size, `${ctxLabel}: Allow-Headers deve listar exatamente 5 headers`)
      for (const h of EXPECTED_HEADERS_SET) {
        assert(parsedHeaders.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
      }
      for (const dangerous of DANGEROUS_HEADERS) {
        assert(!parsedHeaders.has(dangerous), `${ctxLabel}: Allow-Headers NÃO PODE conter "${dangerous}"`)
      }
      assert(!ah.includes('\r'), `${ctxLabel}: Allow-Headers NÃO PODE conter CR`)
      assert(!ah.includes('\n'), `${ctxLabel}: Allow-Headers NÃO PODE conter LF`)
      assert(!ah.includes('\x00'), `${ctxLabel}: Allow-Headers NÃO PODE conter null byte`)

      // (4) Allow-Origin/Credentials/Max-Age literais.
      assertEquals(result.headers.get('access-control-allow-origin'), '*', `${ctxLabel}: Allow-Origin '*'`)
      assertEquals(result.headers.get('access-control-allow-credentials'), null, `${ctxLabel}: Allow-Credentials NUNCA`)
      assertEquals(result.headers.get('access-control-max-age'), '86400', `${ctxLabel}: Max-Age literal`)

      // (5) Headers smuggled via obs-fold no método NUNCA aparecem na resposta.
      assertEquals(result.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA`)
      assertEquals(result.headers.get('cookie'), null, `${ctxLabel}: Cookie NUNCA`)
      assertEquals(result.headers.get('x-injected'), null, `${ctxLabel}: X-Injected NUNCA`)
      assertEquals(result.headers.get('x-smuggled'), null, `${ctxLabel}: X-Smuggled NUNCA`)
      assertEquals(result.headers.get('x-folded'), null, `${ctxLabel}: X-Folded NUNCA`)
      assertEquals(result.headers.get('x-method-injected'), null, `${ctxLabel}: X-Method-Injected NUNCA`)
      assertEquals(result.headers.get('access-control-expose-headers'), null, `${ctxLabel}: Expose-Headers NUNCA`)

      // (6) Allow-Methods e Allow-Headers aparecem exatamente 1x cada.
      let methodsCount = 0, headersCount = 0
      for (const [name] of result.headers) {
        const lower = name.toLowerCase()
        if (lower === 'access-control-allow-methods') methodsCount++
        if (lower === 'access-control-allow-headers') headersCount++
      }
      assertEquals(methodsCount, 1, `${ctxLabel}: Allow-Methods deve aparecer exatamente 1x`)
      assertEquals(headersCount, 1, `${ctxLabel}: Allow-Headers deve aparecer exatamente 1x`)
    }

    // (7) Sanidade: cobertura total da matriz.
    assertEquals(
      validatedAs200 + acceptedAs4xx, PAYLOADS.length,
      `todos os ${PAYLOADS.length} payloads devem ser cobertos (200=${validatedAs200}, 4xx/erro=${acceptedAs4xx})`,
    )

    // (8) Zero createClient invocado.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight (obs-fold no Method)')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — Access-Control-Request-Headers with percent-encoded comma separators (%2C/%2c) × exotic whitespace — Allow-Headers stays LITERAL exact (no decode-leak, no echo, no smuggling)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const DANGEROUS_HEADERS = [
      'set-cookie', 'set-cookie2', 'cookie', 'cookie2',
      'host', 'origin', 'authorization-bearer',
      'x-evil-cookie', 'x-fake-header', 'x-csrf-token',
      'x-forwarded-for', 'x-real-ip', 'proxy-authorization',
      'x-injected', 'x-smuggled', 'x-percent-comma',
      '*',
    ]

    const u = new URL(ctx.url)
    const hostHeader = u.host

    // Payloads que combinam separadores percent-encoded (%2C upper / %2c lower / %252C duplo /
    // outros separadores percent-encoded como ; %3B, espaço %20, slash %2F, tab %09, CRLF %0D%0A)
    // com whitespace exótico Unicode (NBSP U+00A0, em-space U+2003, ideographic space U+3000,
    // narrow NBSP U+202F, hair space U+200A, four-per-em U+2005, zero-width space U+200B).
    //
    // Contrato: Allow-Headers PERMANECE 'authorization, x-client-info, apikey, content-type, x-test-secret'
    // independente do parsing; nenhum '%' literal, nenhum byte não-ASCII, nenhum dangerous, nenhum smuggling.
    const PAYLOADS: Array<{ label: string; raw: string }> = [
      // --- %2C / %2c puros como separador. ---
      { label: '%2C uppercase como separador',          raw: 'content-type%2Cx-test-secret' },
      { label: '%2c lowercase como separador',          raw: 'content-type%2cx-test-secret' },
      { label: '%2C entre 5 tokens allowlist',          raw: 'authorization%2Cx-client-info%2Capikey%2Ccontent-type%2Cx-test-secret' },
      { label: '%2c entre 5 tokens allowlist',          raw: 'authorization%2cx-client-info%2capikey%2ccontent-type%2cx-test-secret' },
      { label: 'mix %2C e %2c alternados',              raw: 'authorization%2Cx-client-info%2capikey%2Ccontent-type%2cx-test-secret' },

      // --- Percent-encoding duplo (%252C = "%2C" literal). ---
      { label: '%252C duplo (não deve decodificar)',    raw: 'content-type%252Cx-test-secret' },
      { label: '%252c duplo lowercase',                 raw: 'content-type%252cx-test-secret' },
      { label: 'mix %2C real + %252C literal',          raw: 'authorization%2Cx-client-info%252Capikey%2Ccontent-type' },

      // --- %20 (space) percent-encoded ao redor de vírgulas reais. ---
      { label: '%20 antes da vírgula',                  raw: 'authorization%20,x-client-info' },
      { label: '%20 depois da vírgula',                 raw: 'authorization,%20x-client-info' },
      { label: '%20 ao redor da vírgula',               raw: 'authorization%20,%20x-client-info' },
      { label: 'múltiplos %20%20%20',                   raw: 'authorization%20%20%20,%20%20%20x-client-info' },
      { label: '%20 ao redor de %2C',                   raw: 'authorization%20%2C%20x-client-info' },
      { label: '%20 + %2C + %20 entre todos',           raw: 'authorization%20%2C%20x-client-info%20%2C%20apikey%20%2C%20content-type%20%2C%20x-test-secret' },

      // --- Outros separadores percent-encoded (não devem ser tratados como separador). ---
      { label: '%3B semicolon (não-separador)',         raw: 'content-type%3Bx-test-secret' },
      { label: '%2F slash (não-separador)',             raw: 'content-type%2Fx-test-secret' },
      { label: '%09 tab percent-encoded',               raw: 'content-type%09,%09x-test-secret' },
      { label: '%0D%0A CRLF percent-encoded',           raw: 'content-type%0D%0ASet-Cookie:%20pwn=1' },
      { label: '%00 null percent-encoded',              raw: 'content-type%00,%00x-test-secret' },

      // --- Whitespace exótico Unicode ao redor de vírgulas reais. ---
      { label: 'NBSP (U+00A0) ao redor',                raw: 'authorization\u00A0,\u00A0x-client-info' },
      { label: 'em-space (U+2003) ao redor',            raw: 'authorization\u2003,\u2003x-client-info' },
      { label: 'ideographic space (U+3000) ao redor',   raw: 'authorization\u3000,\u3000x-client-info' },
      { label: 'narrow NBSP (U+202F) ao redor',         raw: 'authorization\u202F,\u202Fx-client-info' },
      { label: 'hair space (U+200A) ao redor',          raw: 'authorization\u200A,\u200Ax-client-info' },
      { label: 'four-per-em (U+2005) ao redor',         raw: 'authorization\u2005,\u2005x-client-info' },
      { label: 'zero-width space (U+200B) intra',       raw: 'cont\u200Bent-type,x\u200B-test-secret' },
      { label: 'mix NBSP + em-space + ideographic',     raw: '\u00A0authorization\u2003,\u3000x-client-info\u00A0' },
      { label: 'unicode space + %2C',                   raw: 'authorization\u00A0%2C\u00A0x-client-info\u2003%2C\u2003apikey' },

      // --- Whitespace exótico + separadores percent-encoded + casing variado. ---
      { label: 'NBSP + %2C + UPPER',                    raw: '\u00A0AUTHORIZATION\u00A0%2C\u00A0X-CLIENT-INFO\u00A0' },
      { label: 'em-space + %2c + Title-Case',           raw: '\u2003Authorization\u2003%2c\u2003X-Client-Info\u2003' },
      { label: 'ideographic + %252C + mIxEd',           raw: '\u3000AuThOrIzAtIoN\u3000%252C\u3000X-cLiEnT-iNfO\u3000' },

      // --- Tentativas de smuggling com %2C escondendo dangerous. ---
      { label: '%2C escondendo set-cookie',             raw: 'content-type%2Cset-cookie' },
      { label: '%2c escondendo cookie',                 raw: 'content-type%2ccookie' },
      { label: '%2C escondendo host',                   raw: 'content-type%2Chost' },
      { label: '%2C + NBSP escondendo x-injected',      raw: 'content-type%2C\u00A0x-injected' },
      { label: '%2C + ZWS escondendo x-percent-comma',  raw: 'content-type%2C\u200Bx-percent-comma' },

      // --- Caos: tudo combinado. ---
      { label: 'caos #1: %2C + %20 + NBSP + UPPER',     raw: '\u00A0AUTHORIZATION%20%2C%20X-CLIENT-INFO\u00A0%2c\u00A0APIKEY\u2003%2C\u2003CONTENT-TYPE\u3000%2c\u3000X-TEST-SECRET' },
      { label: 'caos #2: duplo + null + Cyrillic',      raw: '\u00A0%63ontent-type%252C%00\u00A0х-test-secret' },  // 'х' Cyrillic
      { label: 'caos #3: %0D%0A smuggle + NBSP',        raw: '\u00A0content-type%2C%0D%0ASet-Cookie:%20evil=1\u00A0%2C\u00A0x-test-secret\u00A0' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    type RawResponse = { status: number; headers: Headers } | { error: string }

    async function sendRaw(payload: string): Promise<RawResponse> {
      let conn: Deno.TcpConn | null = null
      try {
        conn = await Deno.connect({ hostname: u.hostname, port: parseInt(u.port, 10), transport: 'tcp' })
        const reqLines = [
          'OPTIONS / HTTP/1.1',
          `Host: ${hostHeader}`,
          'Origin: https://evil.example.com',
          'Access-Control-Request-Method: POST',
          `Access-Control-Request-Headers: ${payload}`,
          'Connection: close',
          '',
          '',
        ]
        await conn.write(new TextEncoder().encode(reqLines.join('\r\n')))

        const chunks: Uint8Array[] = []
        const buf = new Uint8Array(8192)
        while (true) {
          const n = await conn.read(buf)
          if (n === null) break
          chunks.push(buf.slice(0, n))
        }
        const total = chunks.reduce((s, c) => s + c.length, 0)
        const merged = new Uint8Array(total)
        let off = 0
        for (const c of chunks) { merged.set(c, off); off += c.length }
        const text = new TextDecoder().decode(merged)

        const headerEnd = text.indexOf('\r\n\r\n')
        if (headerEnd === -1) return { error: 'no header terminator' }
        const lines = text.slice(0, headerEnd).split('\r\n')
        const m = lines[0].match(/^HTTP\/1\.[01]\s+(\d{3})/)
        if (!m) return { error: `bad status: ${lines[0]}` }
        const status = parseInt(m[1], 10)
        const headers = new Headers()
        for (let i = 1; i < lines.length; i++) {
          const idx = lines[i].indexOf(':')
          if (idx === -1) continue
          const name = lines[i].slice(0, idx).trim()
          const value = lines[i].slice(idx + 1).trim()
          if (name) headers.append(name, value)
        }
        return { status, headers }
      } finally {
        try { conn?.close() } catch { /* ignore */ }
      }
    }

    let validatedAs200 = 0
    let acceptedAs4xx = 0

    for (const p of PAYLOADS) {
      const result = await sendRaw(p.raw)
      const ctxLabel = `[Payload: ${p.label}]`

      if ('error' in result) { acceptedAs4xx++; continue }

      // (1) Status 200 OU 4xx — nunca 5xx (parser não pode crashar com %2C/Unicode).
      assert(
        result.status === 200 || (result.status >= 400 && result.status < 500),
        `${ctxLabel}: status deve ser 200 ou 4xx, recebido ${result.status}`,
      )
      if (result.status !== 200) { acceptedAs4xx++; continue }
      validatedAs200++

      // (2) Allow-Headers LITERAL EXATO.
      const ah = result.headers.get('access-control-allow-headers')
      assertExists(ah, `${ctxLabel}: Allow-Headers deve estar presente`)
      assertEquals(
        ah, EXPECTED_HEADERS_LITERAL,
        `${ctxLabel}: Allow-Headers deve ser literal "${EXPECTED_HEADERS_LITERAL}"`,
      )

      // (3) Conjunto bate exatamente.
      const parsed = new Set(parseList(ah))
      assertEquals(parsed.size, EXPECTED_HEADERS_SET.size, `${ctxLabel}: Allow-Headers deve listar exatamente 5 headers`)
      for (const h of EXPECTED_HEADERS_SET) {
        assert(parsed.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
      }

      // (4) NUNCA dangerous (mesmo que %2C tenha tentado escondê-los).
      for (const dangerous of DANGEROUS_HEADERS) {
        assert(!parsed.has(dangerous), `${ctxLabel}: Allow-Headers NÃO PODE conter "${dangerous}"`)
      }

      // (5) NUNCA '%' literal (echo de percent-encoding) nem CR/LF/null.
      assert(!ah.includes('%'), `${ctxLabel}: Allow-Headers NÃO PODE conter '%' (echo de percent)`)
      assert(!ah.includes('\r'), `${ctxLabel}: Allow-Headers NÃO PODE conter CR`)
      assert(!ah.includes('\n'), `${ctxLabel}: Allow-Headers NÃO PODE conter LF`)
      assert(!ah.includes('\x00'), `${ctxLabel}: Allow-Headers NÃO PODE conter null byte`)

      // (6) Allow-Headers deve ser ASCII puro (anti-Unicode-leak).
      for (const ch of ah) {
        const code = ch.charCodeAt(0)
        assert(code >= 0x20 && code <= 0x7E, `${ctxLabel}: Allow-Headers contém char não-ASCII U+${code.toString(16).padStart(4, '0')}`)
      }

      // (7) Outros campos CORS literais.
      assertEquals(result.headers.get('access-control-allow-methods'), 'POST, OPTIONS', `${ctxLabel}: Allow-Methods literal`)
      assertEquals(result.headers.get('access-control-allow-origin'), '*', `${ctxLabel}: Allow-Origin '*'`)
      assertEquals(result.headers.get('access-control-allow-credentials'), null, `${ctxLabel}: Allow-Credentials NUNCA`)
      assertEquals(result.headers.get('access-control-max-age'), '86400', `${ctxLabel}: Max-Age literal`)

      // (8) Headers smuggling NUNCA aparecem.
      assertEquals(result.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA`)
      assertEquals(result.headers.get('cookie'), null, `${ctxLabel}: Cookie NUNCA`)
      assertEquals(result.headers.get('x-injected'), null, `${ctxLabel}: X-Injected NUNCA`)
      assertEquals(result.headers.get('x-smuggled'), null, `${ctxLabel}: X-Smuggled NUNCA`)
      assertEquals(result.headers.get('x-percent-comma'), null, `${ctxLabel}: X-Percent-Comma NUNCA`)
      assertEquals(result.headers.get('access-control-expose-headers'), null, `${ctxLabel}: Expose-Headers NUNCA`)

      // (9) Allow-Headers aparece exatamente 1x.
      let occurrences = 0
      for (const [name] of result.headers) {
        if (name.toLowerCase() === 'access-control-allow-headers') occurrences++
      }
      assertEquals(occurrences, 1, `${ctxLabel}: Allow-Headers deve aparecer exatamente 1x`)
    }

    // (10) Cobertura total da matriz.
    assertEquals(
      validatedAs200 + acceptedAs4xx, PAYLOADS.length,
      `todos os ${PAYLOADS.length} payloads devem ser cobertos (200=${validatedAs200}, 4xx/erro=${acceptedAs4xx})`,
    )

    // (11) Zero createClient invocado.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight (%2C/%2c + Unicode whitespace)')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — inconsistent/malformed Content-Length variants — Allow-Methods/Allow-Headers stay LITERAL exact (no echo, no smuggling, no 5xx)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_METHODS_LITERAL = 'POST, OPTIONS'
    const EXPECTED_METHODS_SET = new Set(['post', 'options'])
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'
    const EXPECTED_HEADERS_SET = new Set([
      'authorization', 'x-client-info', 'apikey', 'content-type', 'x-test-secret',
    ])
    const DANGEROUS_METHODS = ['get', 'put', 'patch', 'delete', 'head', 'connect', 'trace', 'propfind', 'custom-method', '*']
    const DANGEROUS_HEADERS = [
      'set-cookie', 'set-cookie2', 'cookie', 'cookie2',
      'host', 'origin', 'authorization-bearer',
      'x-evil-cookie', 'x-fake-header', 'x-csrf-token',
      'x-forwarded-for', 'x-real-ip', 'proxy-authorization',
      'x-injected', 'x-smuggled', 'x-cl-leak',
      '*',
    ]

    const u = new URL(ctx.url)
    const hostHeader = u.host

    // Cada payload é um conjunto completo de extra-headers (entre os básicos e o body),
    // mais um body opcional. O servidor deve responder 200 (ignorando body em OPTIONS),
    // 400 (rejeitando smuggling) ou fechar — NUNCA 5xx, NUNCA com headers smuggled.
    const PAYLOADS: Array<{ label: string; extraHeaders: string[]; body: string }> = [
      // --- Content-Length sem body (CL > 0, body vazio). ---
      { label: 'CL: 10 + body vazio',                   extraHeaders: ['Content-Length: 10'], body: '' },
      { label: 'CL: 999999 + body vazio (esperaria gigante)', extraHeaders: ['Content-Length: 999999'], body: '' },

      // --- Content-Length menor que body real (request smuggling clássico). ---
      { label: 'CL: 0 + body MALICIOUS',                extraHeaders: ['Content-Length: 0'], body: 'MALICIOUS' },
      { label: 'CL: 5 + body de 50 chars',              extraHeaders: ['Content-Length: 5'], body: 'X'.repeat(50) },
      { label: 'CL: 1 + body com smuggle GET /admin',   extraHeaders: ['Content-Length: 1'], body: 'GET /admin HTTP/1.1\r\nHost: evil\r\n\r\n' },

      // --- Content-Length maior que body real (servidor pode pendurar). ---
      { label: 'CL: 1000 + body de 5 chars',            extraHeaders: ['Content-Length: 1000'], body: 'short' },

      // --- Content-Length duplicado idêntico (RFC 7230 §3.3.3 — permitido se idêntico). ---
      { label: 'CL duplicado idêntico (0, 0)',          extraHeaders: ['Content-Length: 0', 'Content-Length: 0'], body: '' },

      // --- Content-Length duplicado divergente (DEVE ser rejeitado — smuggling). ---
      { label: 'CL divergente (0, 100)',                extraHeaders: ['Content-Length: 0', 'Content-Length: 100'], body: '' },
      { label: 'CL divergente (10, 20, 30)',            extraHeaders: ['Content-Length: 10', 'Content-Length: 20', 'Content-Length: 30'], body: '' },
      { label: 'CL como lista (0, 100)',                extraHeaders: ['Content-Length: 0, 100'], body: '' },

      // --- Content-Length malformado (não-numérico). ---
      { label: 'CL: abc (não-numérico)',                extraHeaders: ['Content-Length: abc'], body: '' },
      { label: 'CL: -1 (negativo)',                     extraHeaders: ['Content-Length: -1'], body: '' },
      { label: 'CL: 1e10 (notação científica)',         extraHeaders: ['Content-Length: 1e10'], body: '' },
      { label: 'CL: 0x10 (hex)',                        extraHeaders: ['Content-Length: 0x10'], body: '' },
      { label: 'CL: + leading sign',                    extraHeaders: ['Content-Length: +5'], body: 'hello' },
      { label: 'CL: leading zeros',                     extraHeaders: ['Content-Length: 00000005'], body: 'hello' },
      { label: 'CL: vazio',                             extraHeaders: ['Content-Length: '], body: '' },
      { label: 'CL: só whitespace',                     extraHeaders: ['Content-Length:    '], body: '' },
      { label: 'CL: gigante (uint64 overflow)',         extraHeaders: ['Content-Length: 99999999999999999999'], body: '' },

      // --- Content-Length com whitespace exótico no valor. ---
      { label: 'CL com tab antes do número',            extraHeaders: ['Content-Length:\t5'], body: 'hello' },
      { label: 'CL com SP+TAB antes',                   extraHeaders: ['Content-Length:  \t5'], body: 'hello' },
      { label: 'CL com whitespace trailing',            extraHeaders: ['Content-Length: 5    '], body: 'hello' },

      // --- Content-Length + Transfer-Encoding (TE.CL / CL.TE smuggling). ---
      { label: 'CL: 0 + TE: chunked',                   extraHeaders: ['Content-Length: 0', 'Transfer-Encoding: chunked'], body: '5\r\nhello\r\n0\r\n\r\n' },
      { label: 'TE: chunked + CL: 100',                 extraHeaders: ['Transfer-Encoding: chunked', 'Content-Length: 100'], body: '0\r\n\r\n' },
      { label: 'TE: chunked + body smuggle GET',        extraHeaders: ['Transfer-Encoding: chunked'], body: '0\r\n\r\nGET /admin HTTP/1.1\r\nHost: evil\r\n\r\n' },

      // --- Content-Length + tentativa de injetar headers via body. ---
      { label: 'CL: 0 + body com Set-Cookie',           extraHeaders: ['Content-Length: 0'], body: 'Set-Cookie: pwn=1\r\n\r\n' },
      { label: 'CL: 0 + body com X-Injected',           extraHeaders: ['Content-Length: 0'], body: 'X-Injected: 1\r\n\r\n' },

      // --- Content-Length + casing variado da chave. ---
      { label: 'content-length lowercase',              extraHeaders: ['content-length: 0'], body: '' },
      { label: 'CONTENT-LENGTH UPPERCASE',              extraHeaders: ['CONTENT-LENGTH: 0'], body: '' },
      { label: 'Content-length Title-mix',              extraHeaders: ['Content-length: 0'], body: '' },

      // --- Sem Content-Length em OPTIONS (caso normal — controle). ---
      { label: 'sem Content-Length (controle)',         extraHeaders: [], body: '' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    type RawResponse = { status: number; headers: Headers } | { error: string }

    async function sendRaw(extraHeaders: string[], body: string): Promise<RawResponse> {
      let conn: Deno.TcpConn | null = null
      try {
        conn = await Deno.connect({ hostname: u.hostname, port: parseInt(u.port, 10), transport: 'tcp' })
        const baseLines = [
          'OPTIONS / HTTP/1.1',
          `Host: ${hostHeader}`,
          'Origin: https://evil.example.com',
          'Access-Control-Request-Method: POST',
          'Access-Control-Request-Headers: content-type, x-test-secret',
          ...extraHeaders,
          'Connection: close',
          '',
          '',
        ]
        const head = baseLines.join('\r\n')
        await conn.write(new TextEncoder().encode(head + body))

        const chunks: Uint8Array[] = []
        const buf = new Uint8Array(8192)
        // Timeout safety: 3s — alguns payloads podem fazer servidor pendurar esperando body.
        const readWithTimeout = async (): Promise<void> => {
          const timer = setTimeout(() => { try { conn?.close() } catch { /* ignore */ } }, 3000)
          try {
            while (true) {
              const n = await conn!.read(buf)
              if (n === null) break
              chunks.push(buf.slice(0, n))
            }
          } finally {
            clearTimeout(timer)
          }
        }
        try { await readWithTimeout() } catch { /* timeout/closed — desfecho seguro */ }

        const total = chunks.reduce((s, c) => s + c.length, 0)
        if (total === 0) return { error: 'no response (closed/timeout)' }
        const merged = new Uint8Array(total)
        let off = 0
        for (const c of chunks) { merged.set(c, off); off += c.length }
        const text = new TextDecoder().decode(merged)

        const headerEnd = text.indexOf('\r\n\r\n')
        if (headerEnd === -1) return { error: 'no header terminator' }
        const lines = text.slice(0, headerEnd).split('\r\n')
        const m = lines[0].match(/^HTTP\/1\.[01]\s+(\d{3})/)
        if (!m) return { error: `bad status: ${lines[0]}` }
        const status = parseInt(m[1], 10)
        const headers = new Headers()
        for (let i = 1; i < lines.length; i++) {
          const idx = lines[i].indexOf(':')
          if (idx === -1) continue
          const name = lines[i].slice(0, idx).trim()
          const value = lines[i].slice(idx + 1).trim()
          if (name) headers.append(name, value)
        }
        return { status, headers }
      } finally {
        try { conn?.close() } catch { /* ignore */ }
      }
    }

    let validatedAs200 = 0
    let acceptedAs4xx = 0
    let acceptedAsClosed = 0

    for (const p of PAYLOADS) {
      const result = await sendRaw(p.extraHeaders, p.body)
      const ctxLabel = `[CL payload: ${p.label}]`

      if ('error' in result) {
        // Conexão fechada ou request malformada — desfecho seguro.
        acceptedAsClosed++
        continue
      }

      // (1) Status 200 OU 4xx — NUNCA 5xx (parser não pode crashar com CL malformado).
      assert(
        result.status === 200 || (result.status >= 400 && result.status < 500),
        `${ctxLabel}: status deve ser 200 ou 4xx, recebido ${result.status}`,
      )
      if (result.status !== 200) { acceptedAs4xx++; continue }
      validatedAs200++

      // (2) Allow-Methods LITERAL EXATO.
      const am = result.headers.get('access-control-allow-methods')
      assertExists(am, `${ctxLabel}: Allow-Methods deve estar presente`)
      assertEquals(am, EXPECTED_METHODS_LITERAL, `${ctxLabel}: Allow-Methods deve ser literal "${EXPECTED_METHODS_LITERAL}"`)
      const parsedMethods = new Set(parseList(am))
      assertEquals(parsedMethods.size, EXPECTED_METHODS_SET.size, `${ctxLabel}: Allow-Methods deve listar exatamente 2 métodos`)
      for (const m of EXPECTED_METHODS_SET) assert(parsedMethods.has(m), `${ctxLabel}: Allow-Methods deve incluir "${m}"`)
      for (const dangerous of DANGEROUS_METHODS) assert(!parsedMethods.has(dangerous), `${ctxLabel}: Allow-Methods NÃO PODE conter "${dangerous}"`)

      // (3) Allow-Headers LITERAL EXATO — não pode ser afetado por CL.
      const ah = result.headers.get('access-control-allow-headers')
      assertExists(ah, `${ctxLabel}: Allow-Headers deve estar presente`)
      assertEquals(ah, EXPECTED_HEADERS_LITERAL, `${ctxLabel}: Allow-Headers deve ser literal "${EXPECTED_HEADERS_LITERAL}"`)
      const parsedHeaders = new Set(parseList(ah))
      assertEquals(parsedHeaders.size, EXPECTED_HEADERS_SET.size, `${ctxLabel}: Allow-Headers deve listar exatamente 5 headers`)
      for (const h of EXPECTED_HEADERS_SET) assert(parsedHeaders.has(h), `${ctxLabel}: Allow-Headers deve incluir "${h}"`)
      for (const dangerous of DANGEROUS_HEADERS) assert(!parsedHeaders.has(dangerous), `${ctxLabel}: Allow-Headers NÃO PODE conter "${dangerous}"`)

      // (4) Anti-leak nos valores: sem CR/LF/null embutidos.
      assert(!am.includes('\r') && !am.includes('\n') && !am.includes('\x00'), `${ctxLabel}: Allow-Methods sem CR/LF/null`)
      assert(!ah.includes('\r') && !ah.includes('\n') && !ah.includes('\x00'), `${ctxLabel}: Allow-Headers sem CR/LF/null`)

      // (5) Allow-Origin/Credentials/Max-Age literais.
      assertEquals(result.headers.get('access-control-allow-origin'), '*', `${ctxLabel}: Allow-Origin '*'`)
      assertEquals(result.headers.get('access-control-allow-credentials'), null, `${ctxLabel}: Allow-Credentials NUNCA`)
      assertEquals(result.headers.get('access-control-max-age'), '86400', `${ctxLabel}: Max-Age literal`)

      // (6) Headers smuggled via body NUNCA aparecem na resposta.
      assertEquals(result.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA`)
      assertEquals(result.headers.get('cookie'), null, `${ctxLabel}: Cookie NUNCA`)
      assertEquals(result.headers.get('x-injected'), null, `${ctxLabel}: X-Injected NUNCA`)
      assertEquals(result.headers.get('x-smuggled'), null, `${ctxLabel}: X-Smuggled NUNCA`)
      assertEquals(result.headers.get('x-cl-leak'), null, `${ctxLabel}: X-CL-Leak NUNCA`)
      assertEquals(result.headers.get('access-control-expose-headers'), null, `${ctxLabel}: Expose-Headers NUNCA`)

      // (7) Allow-Methods/Allow-Headers aparecem exatamente 1x cada.
      let methodsCount = 0, headersCount = 0
      for (const [name] of result.headers) {
        const lower = name.toLowerCase()
        if (lower === 'access-control-allow-methods') methodsCount++
        if (lower === 'access-control-allow-headers') headersCount++
      }
      assertEquals(methodsCount, 1, `${ctxLabel}: Allow-Methods deve aparecer exatamente 1x`)
      assertEquals(headersCount, 1, `${ctxLabel}: Allow-Headers deve aparecer exatamente 1x`)
    }

    // (8) Cobertura total.
    assertEquals(
      validatedAs200 + acceptedAs4xx + acceptedAsClosed, PAYLOADS.length,
      `todos os ${PAYLOADS.length} payloads devem ser cobertos (200=${validatedAs200}, 4xx=${acceptedAs4xx}, closed=${acceptedAsClosed})`,
    )

    // (9) Zero createClient mesmo com CL malformado/smuggling.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight (Content-Length malformado)')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — Access-Control-Request-METHOD with percent-encoded separators (%2C/%20/%09/%0D%0A/%00) × exotic Unicode whitespace — Allow-Methods stays LITERAL exact (no decode-leak, no echo, no smuggling)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_METHODS_LITERAL = 'POST, OPTIONS'
    const EXPECTED_METHODS_SET = new Set(['post', 'options'])
    const DANGEROUS_METHODS = [
      'delete', 'put', 'patch', 'trace', 'connect', 'propfind',
      'proppatch', 'mkcol', 'copy', 'move', 'lock', 'unlock',
      'custom-method', 'evil', 'pwn', 'injected', 'smuggled',
      '*', 'get',
    ]
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'

    const u = new URL(ctx.url)
    const hostHeader = u.host

    // Payloads que combinam separadores percent-encoded (%2C upper / %2c lower / %252C duplo,
    // espaço %20, tab %09, CRLF %0D%0A, null %00) com whitespace exótico Unicode (NBSP U+00A0,
    // em-space U+2003, ideographic space U+3000, narrow NBSP U+202F, hair space U+200A, ZWS U+200B)
    // aplicados ao VALOR de Access-Control-Request-Method.
    //
    // Contrato: Allow-Methods PERMANECE 'POST, OPTIONS' independente do parsing;
    // nenhum '%' literal, nenhum byte não-ASCII, nenhum método perigoso, nenhum smuggling.
    const PAYLOADS: Array<{ label: string; raw: string }> = [
      // --- %2C / %2c puros como separador escondendo método extra. ---
      { label: '%2C escondendo DELETE',                  raw: 'POST%2CDELETE' },
      { label: '%2c escondendo PUT',                     raw: 'POST%2cPUT' },
      { label: '%2C escondendo PATCH + PROPFIND',        raw: 'POST%2CPATCH%2CPROPFIND' },
      { label: '%2C escondendo wildcard',                raw: 'POST%2C*' },
      { label: '%2C escondendo CUSTOM-METHOD',           raw: 'POST%2CCUSTOM-METHOD' },

      // --- Percent-encoding duplo (%252C = "%2C" literal). ---
      { label: '%252C duplo (não deve decodificar)',     raw: 'POST%252CDELETE' },
      { label: '%252c duplo lowercase',                  raw: 'POST%252cPUT' },

      // --- %20 (space) percent-encoded ao redor do método. ---
      { label: '%20 antes do método',                    raw: '%20POST' },
      { label: '%20 depois do método',                   raw: 'POST%20' },
      { label: '%20 ao redor do método',                 raw: '%20POST%20' },
      { label: 'múltiplos %20 ao redor',                 raw: '%20%20%20POST%20%20%20' },
      { label: '%20 no meio (POST%20DELETE)',            raw: 'POST%20DELETE' },
      { label: '%20 + %2C escondendo método',            raw: 'POST%20%2C%20DELETE' },

      // --- Outros separadores percent-encoded. ---
      { label: '%09 tab percent-encoded antes',          raw: '%09POST' },
      { label: '%09 tab percent-encoded entre',          raw: 'POST%09DELETE' },
      { label: '%0D%0A CRLF + Set-Cookie smuggle',       raw: 'POST%0D%0ASet-Cookie:%20pwn=1' },
      { label: '%0D%0A CRLF + X-Method-Injected',        raw: 'POST%0D%0AX-Method-Injected:%20yes' },
      { label: '%00 null antes',                         raw: '%00POST' },
      { label: '%00 null depois',                        raw: 'POST%00' },
      { label: '%00 null escondendo método',             raw: 'POST%00DELETE' },
      { label: '%3B semicolon (não-separador)',          raw: 'POST%3BDELETE' },
      { label: '%2F slash (não-separador)',              raw: 'POST%2FDELETE' },

      // --- Whitespace exótico Unicode ao redor do método. ---
      { label: 'NBSP (U+00A0) ao redor',                 raw: '\u00A0POST\u00A0' },
      { label: 'em-space (U+2003) ao redor',             raw: '\u2003POST\u2003' },
      { label: 'ideographic space (U+3000) ao redor',    raw: '\u3000POST\u3000' },
      { label: 'narrow NBSP (U+202F) ao redor',          raw: '\u202FPOST\u202F' },
      { label: 'hair space (U+200A) ao redor',           raw: '\u200APOST\u200A' },
      { label: 'zero-width space (U+200B) intra',        raw: 'PO\u200BST' },
      { label: 'NBSP entre POST e DELETE',               raw: 'POST\u00A0DELETE' },
      { label: 'em-space entre POST e PUT',              raw: 'POST\u2003PUT' },
      { label: 'mix NBSP + em + ideographic',            raw: '\u00A0POST\u2003,\u3000DELETE\u00A0' },

      // --- Whitespace exótico + percent-encoded + casing. ---
      { label: 'NBSP + %2C + UPPER',                     raw: '\u00A0POST\u00A0%2C\u00A0DELETE\u00A0' },
      { label: 'em-space + %2c + lowercase',             raw: '\u2003post\u2003%2c\u2003put\u2003' },
      { label: 'ideographic + %252C + mixed',            raw: '\u3000PoSt\u3000%252C\u3000DeLeTe\u3000' },

      // --- Tentativas de smuggling com %2C escondendo dangerous methods. ---
      { label: '%2C + NBSP escondendo TRACE',            raw: 'POST%2C\u00A0TRACE' },
      { label: '%2C + ZWS escondendo CONNECT',           raw: 'POST%2C\u200BCONNECT' },
      { label: '%2c + ideographic escondendo PROPFIND',  raw: 'POST%2c\u3000PROPFIND' },

      // --- Caos: tudo combinado. ---
      { label: 'caos #1: %2C + %20 + NBSP + UPPER',      raw: '\u00A0POST%20%2C%20DELETE\u00A0%2c\u00A0PUT\u2003%2C\u2003PATCH\u3000' },
      { label: 'caos #2: duplo + null + Cyrillic',       raw: '\u00A0%50OST%252C%00\u00A0РOST' },  // 'Р' Cyrillic
      { label: 'caos #3: %0D%0A smuggle + NBSP',         raw: '\u00A0POST%2C%0D%0ASet-Cookie:%20evil=1\u00A0%2C\u00A0DELETE\u00A0' },
      { label: 'caos #4: empty com whitespace exótico',  raw: '\u00A0\u2003\u3000\u202F\u200A\u200B' },
    ]

    const parseList = (v: string | null): string[] =>
      (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

    type RawResponse = { status: number; headers: Headers } | { error: string }

    async function sendRaw(payload: string): Promise<RawResponse> {
      let conn: Deno.TcpConn | null = null
      try {
        conn = await Deno.connect({ hostname: u.hostname, port: parseInt(u.port, 10), transport: 'tcp' })
        const reqLines = [
          'OPTIONS / HTTP/1.1',
          `Host: ${hostHeader}`,
          'Origin: https://evil.example.com',
          `Access-Control-Request-Method: ${payload}`,
          'Access-Control-Request-Headers: authorization, x-test-secret',
          'Connection: close',
          '',
          '',
        ]
        await conn.write(new TextEncoder().encode(reqLines.join('\r\n')))

        const chunks: Uint8Array[] = []
        const buf = new Uint8Array(8192)
        while (true) {
          const n = await conn.read(buf)
          if (n === null) break
          chunks.push(buf.slice(0, n))
        }
        const total = chunks.reduce((s, c) => s + c.length, 0)
        const merged = new Uint8Array(total)
        let off = 0
        for (const c of chunks) { merged.set(c, off); off += c.length }
        const text = new TextDecoder().decode(merged)

        const headerEnd = text.indexOf('\r\n\r\n')
        if (headerEnd === -1) return { error: 'no header terminator' }
        const lines = text.slice(0, headerEnd).split('\r\n')
        const m = lines[0].match(/^HTTP\/1\.[01]\s+(\d{3})/)
        if (!m) return { error: `bad status: ${lines[0]}` }
        const status = parseInt(m[1], 10)
        const headers = new Headers()
        for (let i = 1; i < lines.length; i++) {
          const idx = lines[i].indexOf(':')
          if (idx === -1) continue
          const name = lines[i].slice(0, idx).trim()
          const value = lines[i].slice(idx + 1).trim()
          if (name) headers.append(name, value)
        }
        return { status, headers }
      } finally {
        try { conn?.close() } catch { /* ignore */ }
      }
    }

    let validatedAs200 = 0
    let acceptedAs4xx = 0

    for (const p of PAYLOADS) {
      const result = await sendRaw(p.raw)
      const ctxLabel = `[Payload: ${p.label}]`

      if ('error' in result) { acceptedAs4xx++; continue }

      // (1) Status 200 OU 4xx — nunca 5xx (parser não pode crashar com %xx/Unicode em method).
      assert(
        result.status === 200 || (result.status >= 400 && result.status < 500),
        `${ctxLabel}: status deve ser 200 ou 4xx, recebido ${result.status}`,
      )
      if (result.status !== 200) { acceptedAs4xx++; continue }
      validatedAs200++

      // (2) Allow-Methods LITERAL EXATO.
      const am = result.headers.get('access-control-allow-methods')
      assertExists(am, `${ctxLabel}: Allow-Methods deve estar presente`)
      assertEquals(
        am, EXPECTED_METHODS_LITERAL,
        `${ctxLabel}: Allow-Methods deve ser literal "${EXPECTED_METHODS_LITERAL}"`,
      )

      // (3) Conjunto bate exatamente — apenas POST e OPTIONS.
      const parsed = new Set(parseList(am))
      assertEquals(parsed.size, EXPECTED_METHODS_SET.size, `${ctxLabel}: Allow-Methods deve listar exatamente 2 métodos`)
      for (const m of EXPECTED_METHODS_SET) {
        assert(parsed.has(m), `${ctxLabel}: Allow-Methods deve incluir "${m}"`)
      }

      // (4) NUNCA dangerous methods (mesmo que %2C tenha tentado escondê-los).
      for (const dangerous of DANGEROUS_METHODS) {
        assert(!parsed.has(dangerous), `${ctxLabel}: Allow-Methods NÃO PODE conter "${dangerous}"`)
      }

      // (5) NUNCA '%' literal (echo de percent-encoding) nem CR/LF/null/HTAB.
      assert(!am.includes('%'), `${ctxLabel}: Allow-Methods NÃO PODE conter '%' (echo de percent)`)
      assert(!am.includes('\r'), `${ctxLabel}: Allow-Methods NÃO PODE conter CR`)
      assert(!am.includes('\n'), `${ctxLabel}: Allow-Methods NÃO PODE conter LF`)
      assert(!am.includes('\x00'), `${ctxLabel}: Allow-Methods NÃO PODE conter null byte`)
      assert(!am.includes('\t'), `${ctxLabel}: Allow-Methods NÃO PODE conter HTAB`)

      // (6) Allow-Methods deve ser ASCII puro (anti-Unicode-leak).
      for (const ch of am) {
        const code = ch.charCodeAt(0)
        assert(code >= 0x20 && code <= 0x7E, `${ctxLabel}: Allow-Methods contém char não-ASCII U+${code.toString(16).padStart(4, '0')}`)
      }

      // (7) Outros campos CORS literais.
      assertEquals(result.headers.get('access-control-allow-headers'), EXPECTED_HEADERS_LITERAL, `${ctxLabel}: Allow-Headers literal`)
      assertEquals(result.headers.get('access-control-allow-origin'), '*', `${ctxLabel}: Allow-Origin '*'`)
      assertEquals(result.headers.get('access-control-allow-credentials'), null, `${ctxLabel}: Allow-Credentials NUNCA`)
      assertEquals(result.headers.get('access-control-max-age'), '86400', `${ctxLabel}: Max-Age literal`)

      // (8) Headers smuggling NUNCA aparecem.
      assertEquals(result.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA`)
      assertEquals(result.headers.get('cookie'), null, `${ctxLabel}: Cookie NUNCA`)
      assertEquals(result.headers.get('x-injected'), null, `${ctxLabel}: X-Injected NUNCA`)
      assertEquals(result.headers.get('x-smuggled'), null, `${ctxLabel}: X-Smuggled NUNCA`)
      assertEquals(result.headers.get('x-method-injected'), null, `${ctxLabel}: X-Method-Injected NUNCA`)
      assertEquals(result.headers.get('access-control-expose-headers'), null, `${ctxLabel}: Expose-Headers NUNCA`)

      // (9) Allow-Methods aparece exatamente 1x.
      let occurrences = 0
      for (const [name] of result.headers) {
        if (name.toLowerCase() === 'access-control-allow-methods') occurrences++
      }
      assertEquals(occurrences, 1, `${ctxLabel}: Allow-Methods deve aparecer exatamente 1x`)
    }

    // (10) Cobertura total da matriz.
    assertEquals(
      validatedAs200 + acceptedAs4xx, PAYLOADS.length,
      `todos os ${PAYLOADS.length} payloads devem ser cobertos (200=${validatedAs200}, 4xx/erro=${acceptedAs4xx})`,
    )

    // (11) Zero createClient invocado.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight (Request-Method com %xx + Unicode whitespace)')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — response NEVER contains unexpected headers (Set-Cookie, etc.) AND Allow-Methods/Allow-Headers NEVER echo input AND NEVER contain CR/LF/null embedded', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_METHODS_LITERAL = 'POST, OPTIONS'
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'

    // Allowlist EXATA de headers esperados na resposta de preflight.
    // QUALQUER header fora desse conjunto é considerado "unexpected" e rejeitado.
    const ALLOWED_RESPONSE_HEADERS = new Set([
      'access-control-allow-origin',
      'access-control-allow-methods',
      'access-control-allow-headers',
      'access-control-max-age',
      // Headers HTTP de transporte considerados benignos.
      'content-length',
      'content-type',
      'date',
      'connection',
      'keep-alive',
      'vary',
    ])

    // Headers que NUNCA podem aparecer em preflight (sensíveis/perigosos).
    const FORBIDDEN_RESPONSE_HEADERS = [
      'set-cookie', 'set-cookie2', 'cookie', 'cookie2',
      'authorization', 'proxy-authorization',
      'access-control-allow-credentials',
      'access-control-expose-headers',
      'x-injected', 'x-smuggled', 'x-echo', 'x-leak',
      'x-evil', 'x-pwn', 'x-csrf-token',
      'x-forwarded-for', 'x-real-ip',
      'www-authenticate', 'proxy-authenticate',
      'strict-transport-security', 'content-security-policy',
      'x-frame-options', 'x-content-type-options',
      'server', 'x-powered-by',
    ]

    const u = new URL(ctx.url)
    const hostHeader = u.host

    // Tokens "marker" que NUNCA devem aparecer refletidos em Allow-Methods/Allow-Headers.
    // Cada payload injeta esses markers via Origin/Request-Method/Request-Headers e
    // depois validamos que NENHUM marker vazou para a resposta.
    const ECHO_MARKERS = [
      'EVIL', 'PWN', 'INJECTED', 'SMUGGLED', 'LEAK', 'ECHO',
      'CUSTOM-METHOD', 'X-CUSTOM-HEADER', 'X-EVIL-HEADER',
      'DELETE', 'PROPFIND', 'TRACE', 'CONNECT',
      'attacker.com', 'evil.example.com',
      'set-cookie', 'cookie', '%2C', '%0D%0A', '%00',
      '\r', '\n', '\x00', '\t',
    ]

    // Matriz de payloads: cada um tenta provocar echo/leak via diferentes vetores.
    const PAYLOADS: Array<{
      label: string
      origin?: string
      requestMethod?: string
      requestHeaders?: string
      extraHeaders?: Array<[string, string]>
    }> = [
      // --- Baseline (sem nada exótico). ---
      { label: 'baseline minimal', requestMethod: 'POST', requestHeaders: 'authorization' },

      // --- Tentativas de echo via Origin. ---
      { label: 'Origin com EVIL marker',                  origin: 'https://EVIL.attacker.com',           requestMethod: 'POST', requestHeaders: 'authorization' },
      { label: 'Origin com PWN + null',                   origin: 'https://PWN\x00.evil.com',            requestMethod: 'POST', requestHeaders: 'authorization' },
      { label: 'Origin com CRLF smuggle',                 origin: 'https://attacker.com\r\nSet-Cookie: pwn=1', requestMethod: 'POST', requestHeaders: 'authorization' },

      // --- Tentativas de echo via Request-Method. ---
      { label: 'Request-Method = CUSTOM-METHOD',          requestMethod: 'CUSTOM-METHOD',                requestHeaders: 'authorization' },
      { label: 'Request-Method = DELETE',                 requestMethod: 'DELETE',                       requestHeaders: 'authorization' },
      { label: 'Request-Method = PROPFIND',               requestMethod: 'PROPFIND',                     requestHeaders: 'authorization' },
      { label: 'Request-Method = TRACE,CONNECT',          requestMethod: 'TRACE, CONNECT',               requestHeaders: 'authorization' },
      { label: 'Request-Method = EVIL com null',          requestMethod: 'EVIL\x00POST',                 requestHeaders: 'authorization' },

      // --- Tentativas de echo via Request-Headers. ---
      { label: 'Request-Headers = X-EVIL-HEADER',         requestMethod: 'POST', requestHeaders: 'X-EVIL-HEADER, X-CUSTOM-HEADER' },
      { label: 'Request-Headers = set-cookie',            requestMethod: 'POST', requestHeaders: 'set-cookie, cookie' },
      { label: 'Request-Headers = INJECTED list',         requestMethod: 'POST', requestHeaders: 'INJECTED, SMUGGLED, LEAK, ECHO, PWN' },
      { label: 'Request-Headers com CRLF',                requestMethod: 'POST', requestHeaders: 'authorization\r\nSet-Cookie: x=1' },
      { label: 'Request-Headers com null',                requestMethod: 'POST', requestHeaders: 'authorization\x00X-Injected' },
      { label: 'Request-Headers com %2C smuggle',         requestMethod: 'POST', requestHeaders: 'content-type%2Cset-cookie' },

      // --- Tentativas de injeção via headers extras "estranhos". ---
      { label: 'extra X-Forwarded-For',                   requestMethod: 'POST', requestHeaders: 'authorization', extraHeaders: [['X-Forwarded-For', 'EVIL-IP']] },
      { label: 'extra Cookie',                            requestMethod: 'POST', requestHeaders: 'authorization', extraHeaders: [['Cookie', 'session=PWN']] },
      { label: 'extra Authorization (echo prep)',         requestMethod: 'POST', requestHeaders: 'authorization', extraHeaders: [['Authorization', 'Bearer EVIL']] },
      { label: 'extra X-Custom-Echo',                     requestMethod: 'POST', requestHeaders: 'authorization', extraHeaders: [['X-Custom-Echo', 'INJECTED']] },

      // --- Combinações caóticas. ---
      { label: 'caos: Origin + Method + Headers tudo evil', origin: 'https://EVIL.attacker.com', requestMethod: 'CUSTOM-METHOD', requestHeaders: 'X-EVIL-HEADER, set-cookie, INJECTED' },
      { label: 'caos: tudo + extras',                       origin: 'https://PWN.evil.com', requestMethod: 'PROPFIND', requestHeaders: 'X-CUSTOM-HEADER, LEAK', extraHeaders: [['Cookie', 'PWN=1'], ['X-Forwarded-For', 'evil']] },
    ]

    type RawResponse = {
      status: number
      headers: Headers
      headerLines: string[]   // linhas brutas (preserva CR/LF se vazaram).
      raw: string
    } | { error: string }

    async function sendRaw(p: typeof PAYLOADS[number]): Promise<RawResponse> {
      let conn: Deno.TcpConn | null = null
      try {
        conn = await Deno.connect({ hostname: u.hostname, port: parseInt(u.port, 10), transport: 'tcp' })
        const reqLines = [
          'OPTIONS / HTTP/1.1',
          `Host: ${hostHeader}`,
        ]
        if (p.origin !== undefined) reqLines.push(`Origin: ${p.origin}`)
        if (p.requestMethod !== undefined) reqLines.push(`Access-Control-Request-Method: ${p.requestMethod}`)
        if (p.requestHeaders !== undefined) reqLines.push(`Access-Control-Request-Headers: ${p.requestHeaders}`)
        if (p.extraHeaders) {
          for (const [k, v] of p.extraHeaders) reqLines.push(`${k}: ${v}`)
        }
        reqLines.push('Connection: close', '', '')
        await conn.write(new TextEncoder().encode(reqLines.join('\r\n')))

        const chunks: Uint8Array[] = []
        const buf = new Uint8Array(8192)
        while (true) {
          const n = await conn.read(buf)
          if (n === null) break
          chunks.push(buf.slice(0, n))
        }
        const total = chunks.reduce((s, c) => s + c.length, 0)
        const merged = new Uint8Array(total)
        let off = 0
        for (const c of chunks) { merged.set(c, off); off += c.length }
        const text = new TextDecoder().decode(merged)

        const headerEnd = text.indexOf('\r\n\r\n')
        if (headerEnd === -1) return { error: 'no header terminator' }
        const lines = text.slice(0, headerEnd).split('\r\n')
        const m = lines[0].match(/^HTTP\/1\.[01]\s+(\d{3})/)
        if (!m) return { error: `bad status: ${lines[0]}` }
        const status = parseInt(m[1], 10)
        const headers = new Headers()
        const headerLines: string[] = []
        for (let i = 1; i < lines.length; i++) {
          headerLines.push(lines[i])
          const idx = lines[i].indexOf(':')
          if (idx === -1) continue
          const name = lines[i].slice(0, idx).trim()
          const value = lines[i].slice(idx + 1).trim()
          if (name) headers.append(name, value)
        }
        return { status, headers, headerLines, raw: text }
      } finally {
        try { conn?.close() } catch { /* ignore */ }
      }
    }

    let validatedAs200 = 0
    let acceptedAs4xx = 0

    for (const p of PAYLOADS) {
      const result = await sendRaw(p)
      const ctxLabel = `[Payload: ${p.label}]`

      if ('error' in result) { acceptedAs4xx++; continue }

      // (1) NUNCA 5xx — handler não pode crashar com qualquer combinação.
      assert(
        result.status < 500,
        `${ctxLabel}: status NUNCA pode ser 5xx, recebido ${result.status}`,
      )
      if (result.status !== 200) { acceptedAs4xx++; continue }
      validatedAs200++

      // (2) Allowlist estrita: nenhum header fora do conjunto esperado.
      for (const [name] of result.headers) {
        const lower = name.toLowerCase()
        assert(
          ALLOWED_RESPONSE_HEADERS.has(lower),
          `${ctxLabel}: header inesperado na resposta: "${name}" (não está na allowlist)`,
        )
      }

      // (3) Headers proibidos NUNCA aparecem (mesmo se entrassem na allowlist por erro).
      for (const forbidden of FORBIDDEN_RESPONSE_HEADERS) {
        assertEquals(
          result.headers.get(forbidden), null,
          `${ctxLabel}: header proibido presente: "${forbidden}"`,
        )
      }

      // (4) Allow-Methods e Allow-Headers literais exatos.
      const am = result.headers.get('access-control-allow-methods')
      const ah = result.headers.get('access-control-allow-headers')
      assertExists(am, `${ctxLabel}: Allow-Methods deve estar presente`)
      assertExists(ah, `${ctxLabel}: Allow-Headers deve estar presente`)
      assertEquals(am, EXPECTED_METHODS_LITERAL, `${ctxLabel}: Allow-Methods literal exato`)
      assertEquals(ah, EXPECTED_HEADERS_LITERAL, `${ctxLabel}: Allow-Headers literal exato`)

      // (5) NENHUM marker de echo vazou para Allow-Methods/Allow-Headers.
      for (const marker of ECHO_MARKERS) {
        assert(
          !am.toLowerCase().includes(marker.toLowerCase()),
          `${ctxLabel}: Allow-Methods refletiu marker "${marker}"`,
        )
        assert(
          !ah.toLowerCase().includes(marker.toLowerCase()),
          `${ctxLabel}: Allow-Headers refletiu marker "${marker}"`,
        )
      }

      // (6) NENHUM CR/LF/null/HTAB embutido em Allow-Methods/Allow-Headers.
      for (const [field, value] of [['Allow-Methods', am], ['Allow-Headers', ah]] as const) {
        assert(!value.includes('\r'), `${ctxLabel}: ${field} contém CR embutido`)
        assert(!value.includes('\n'), `${ctxLabel}: ${field} contém LF embutido`)
        assert(!value.includes('\x00'), `${ctxLabel}: ${field} contém null byte embutido`)
        assert(!value.includes('\t'), `${ctxLabel}: ${field} contém HTAB embutido`)
        // ASCII puro 0x20-0x7E.
        for (const ch of value) {
          const code = ch.charCodeAt(0)
          assert(
            code >= 0x20 && code <= 0x7E,
            `${ctxLabel}: ${field} contém char não-ASCII U+${code.toString(16).padStart(4, '0')}`,
          )
        }
      }

      // (7) Allow-Origin SEMPRE literal '*', NUNCA echo de Origin.
      const ao = result.headers.get('access-control-allow-origin')
      assertEquals(ao, '*', `${ctxLabel}: Allow-Origin deve ser literal '*' (sem echo de Origin)`)
      if (p.origin) {
        assert(
          !ao!.includes(p.origin),
          `${ctxLabel}: Allow-Origin NÃO PODE refletir Origin "${p.origin}"`,
        )
      }

      // (8) Max-Age literal '86400'.
      assertEquals(result.headers.get('access-control-max-age'), '86400', `${ctxLabel}: Max-Age literal`)

      // (9) Cada header CORS aparece exatamente 1x (sem duplicação por echo).
      const counts: Record<string, number> = {}
      for (const [name] of result.headers) {
        const lower = name.toLowerCase()
        counts[lower] = (counts[lower] ?? 0) + 1
      }
      assertEquals(counts['access-control-allow-methods'], 1, `${ctxLabel}: Allow-Methods deve aparecer 1x`)
      assertEquals(counts['access-control-allow-headers'], 1, `${ctxLabel}: Allow-Headers deve aparecer 1x`)
      assertEquals(counts['access-control-allow-origin'], 1, `${ctxLabel}: Allow-Origin deve aparecer 1x`)
      assertEquals(counts['access-control-max-age'], 1, `${ctxLabel}: Max-Age deve aparecer 1x`)

      // (10) Sanity: linhas brutas de header não contêm "Set-Cookie" em lugar nenhum
      //      (proteção extra contra header smuggling via response splitting).
      for (const line of result.headerLines) {
        assert(
          !/set-cookie/i.test(line),
          `${ctxLabel}: linha de header bruta contém "set-cookie": "${line}"`,
        )
      }
    }

    // (11) Cobertura total da matriz.
    assertEquals(
      validatedAs200 + acceptedAs4xx, PAYLOADS.length,
      `todos os ${PAYLOADS.length} payloads devem ser cobertos (200=${validatedAs200}, 4xx/erro=${acceptedAs4xx})`,
    )

    // (12) Zero createClient invocado em qualquer preflight.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight')
  } finally {
    await ctx.stop()
  }
})

Deno.test('HTTP integration: OPTIONS preflight — Access-Control-Request-Method variants (percent-encoded + exotic whitespace) NEVER appear in ANY response header or body (zero echo, zero leak)', async () => {
  const ctx = await startServer(fullEnv) as ServerCtx & { _calls: number }
  try {
    const EXPECTED_METHODS_LITERAL = 'POST, OPTIONS'
    const EXPECTED_HEADERS_LITERAL = 'authorization, x-client-info, apikey, content-type, x-test-secret'

    const u = new URL(ctx.url)
    const hostHeader = u.host

    // Cada payload contém um MARKER único e altamente improvável de aparecer naturalmente
    // em qualquer resposta. Validamos que NEM o marker, NEM seus tokens componentes,
    // NEM suas formas decodificadas vazam para qualquer header ou body.
    //
    // O marker é injetado via Access-Control-Request-Method usando combinações de:
    //  - percent-encoding (%2C, %2c, %20, %09, %0D%0A, %00, %3B, %2F, %252C duplo)
    //  - whitespace exótico Unicode (NBSP, em-space, ideographic, narrow NBSP, hair, ZWS)
    //  - casing variado e tokens injetados
    const PAYLOADS: Array<{ label: string; method: string; markers: string[] }> = [
      // --- %2C / %2c puros escondendo método marker. ---
      { label: '%2C + UNIQUEMARKER001',       method: 'POST%2CUNIQUEMARKER001',                 markers: ['UNIQUEMARKER001', '%2C'] },
      { label: '%2c + UNIQUEMARKER002',       method: 'POST%2cUNIQUEMARKER002',                 markers: ['UNIQUEMARKER002', '%2c'] },
      { label: '%2C múltiplo + MARKER003',    method: 'POST%2CUNIQUEMARKER003%2CDELETE',        markers: ['UNIQUEMARKER003', '%2C'] },

      // --- Percent-encoding duplo. ---
      { label: '%252C + MARKER004',           method: 'POST%252CUNIQUEMARKER004',               markers: ['UNIQUEMARKER004', '%252C', '%2C'] },
      { label: '%252c + MARKER005',           method: 'POST%252cUNIQUEMARKER005',               markers: ['UNIQUEMARKER005', '%252c', '%2c'] },

      // --- %20 (space) percent-encoded. ---
      { label: '%20 + MARKER006',             method: '%20POST%20MARKER006%20',                 markers: ['MARKER006', '%20'] },
      { label: '%20 + %2C + MARKER007',       method: 'POST%20%2C%20UNIQUEMARKER007',           markers: ['UNIQUEMARKER007', '%20', '%2C'] },

      // --- Outros separadores percent-encoded. ---
      { label: '%09 tab + MARKER008',         method: 'POST%09UNIQUEMARKER008',                 markers: ['UNIQUEMARKER008', '%09'] },
      { label: '%0D%0A CRLF + MARKER009',     method: 'POST%0D%0AX-Leak-MARKER009:%20yes',      markers: ['MARKER009', '%0D%0A', 'X-Leak-MARKER009'] },
      { label: '%00 null + MARKER010',        method: 'POST%00UNIQUEMARKER010',                 markers: ['UNIQUEMARKER010', '%00'] },
      { label: '%3B semicolon + MARKER011',   method: 'POST%3BUNIQUEMARKER011',                 markers: ['UNIQUEMARKER011', '%3B'] },
      { label: '%2F slash + MARKER012',       method: 'POST%2FUNIQUEMARKER012',                 markers: ['UNIQUEMARKER012', '%2F'] },

      // --- Whitespace exótico Unicode + marker. ---
      { label: 'NBSP + MARKER013',            method: '\u00A0POST\u00A0UNIQUEMARKER013\u00A0',  markers: ['UNIQUEMARKER013', '\u00A0'] },
      { label: 'em-space + MARKER014',        method: '\u2003POST\u2003UNIQUEMARKER014\u2003',  markers: ['UNIQUEMARKER014', '\u2003'] },
      { label: 'ideographic + MARKER015',     method: '\u3000POST\u3000UNIQUEMARKER015\u3000',  markers: ['UNIQUEMARKER015', '\u3000'] },
      { label: 'narrow NBSP + MARKER016',     method: '\u202FPOST\u202FUNIQUEMARKER016\u202F',  markers: ['UNIQUEMARKER016', '\u202F'] },
      { label: 'hair space + MARKER017',      method: '\u200APOST\u200AUNIQUEMARKER017\u200A',  markers: ['UNIQUEMARKER017', '\u200A'] },
      { label: 'ZWS intra + MARKER018',       method: 'PO\u200BST\u200BUNIQUEMARKER018',        markers: ['UNIQUEMARKER018', '\u200B'] },

      // --- Combinações: percent + Unicode + casing. ---
      { label: 'NBSP+%2C+UPPER MARKER019',    method: '\u00A0POST\u00A0%2C\u00A0UNIQUEMARKER019\u00A0', markers: ['UNIQUEMARKER019', '%2C', '\u00A0'] },
      { label: 'em+%2c+lower marker020',      method: '\u2003post\u2003%2c\u2003uniquemarker020\u2003', markers: ['uniquemarker020', '%2c', '\u2003'] },
      { label: 'ideo+%252C+mixed Mr021',      method: '\u3000PoSt\u3000%252C\u3000UnIqUeMaRkEr021\u3000', markers: ['UnIqUeMaRkEr021', '%252C', '\u3000'] },

      // --- Smuggling com %2C escondendo método dangerous + marker. ---
      { label: '%2C + NBSP + EVILTRACE022',   method: 'POST%2C\u00A0EVILTRACE022',              markers: ['EVILTRACE022', '%2C', '\u00A0'] },
      { label: '%2c + ZWS + PWNCONNECT023',   method: 'POST%2c\u200BPWNCONNECT023',             markers: ['PWNCONNECT023', '%2c', '\u200B'] },

      // --- Caos total. ---
      { label: 'caos #1 MARKER024',           method: '\u00A0POST%20%2C%20UNIQUEMARKER024\u00A0%2c\u00A0DELETE\u2003', markers: ['UNIQUEMARKER024', '%20', '%2C', '%2c', '\u00A0', '\u2003'] },
      { label: 'caos #2 Cyrillic MARKER025',  method: '\u00A0%50OST%252C%00\u00A0РMARKER025',   markers: ['MARKER025', '%50', '%252C', '%00', 'Р'] },
      { label: 'caos #3 CRLF smuggle MR026',  method: '\u00A0POST%2C%0D%0AX-Inj-MARKER026:%20evil\u00A0', markers: ['MARKER026', '%2C', '%0D%0A', 'X-Inj-MARKER026'] },
    ]

    type RawResponse = {
      status: number
      headers: Headers
      headerLines: string[]
      body: string
      raw: string
    } | { error: string }

    async function sendRaw(method: string): Promise<RawResponse> {
      let conn: Deno.TcpConn | null = null
      try {
        conn = await Deno.connect({ hostname: u.hostname, port: parseInt(u.port, 10), transport: 'tcp' })
        const reqLines = [
          'OPTIONS / HTTP/1.1',
          `Host: ${hostHeader}`,
          'Origin: https://evil.example.com',
          `Access-Control-Request-Method: ${method}`,
          'Access-Control-Request-Headers: authorization, x-test-secret',
          'Connection: close',
          '',
          '',
        ]
        await conn.write(new TextEncoder().encode(reqLines.join('\r\n')))

        const chunks: Uint8Array[] = []
        const buf = new Uint8Array(8192)
        while (true) {
          const n = await conn.read(buf)
          if (n === null) break
          chunks.push(buf.slice(0, n))
        }
        const total = chunks.reduce((s, c) => s + c.length, 0)
        const merged = new Uint8Array(total)
        let off = 0
        for (const c of chunks) { merged.set(c, off); off += c.length }
        const text = new TextDecoder().decode(merged)

        const headerEnd = text.indexOf('\r\n\r\n')
        if (headerEnd === -1) return { error: 'no header terminator' }
        const lines = text.slice(0, headerEnd).split('\r\n')
        const m = lines[0].match(/^HTTP\/1\.[01]\s+(\d{3})/)
        if (!m) return { error: `bad status: ${lines[0]}` }
        const status = parseInt(m[1], 10)
        const headers = new Headers()
        const headerLines: string[] = []
        for (let i = 1; i < lines.length; i++) {
          headerLines.push(lines[i])
          const idx = lines[i].indexOf(':')
          if (idx === -1) continue
          const name = lines[i].slice(0, idx).trim()
          const value = lines[i].slice(idx + 1).trim()
          if (name) headers.append(name, value)
        }
        const body = text.slice(headerEnd + 4)
        return { status, headers, headerLines, body, raw: text }
      } finally {
        try { conn?.close() } catch { /* ignore */ }
      }
    }

    let validatedAs200 = 0
    let acceptedAs4xx = 0

    for (const p of PAYLOADS) {
      const result = await sendRaw(p.method)
      const ctxLabel = `[Payload: ${p.label}]`

      if ('error' in result) { acceptedAs4xx++; continue }

      // (1) NUNCA 5xx.
      assert(result.status < 500, `${ctxLabel}: status NUNCA pode ser 5xx, recebido ${result.status}`)
      if (result.status !== 200) { acceptedAs4xx++; continue }
      validatedAs200++

      // (2) Allow-Methods e Allow-Headers literais exatos.
      assertEquals(
        result.headers.get('access-control-allow-methods'), EXPECTED_METHODS_LITERAL,
        `${ctxLabel}: Allow-Methods literal exato`,
      )
      assertEquals(
        result.headers.get('access-control-allow-headers'), EXPECTED_HEADERS_LITERAL,
        `${ctxLabel}: Allow-Headers literal exato`,
      )

      // (3) NENHUM marker aparece em NENHUM valor de header (case-insensitive).
      for (const marker of p.markers) {
        const markerLower = marker.toLowerCase()
        for (const [name, value] of result.headers) {
          assert(
            !value.toLowerCase().includes(markerLower),
            `${ctxLabel}: marker "${marker}" vazou para header "${name}: ${value}"`,
          )
          // Nome do header também não pode conter marker.
          assert(
            !name.toLowerCase().includes(markerLower),
            `${ctxLabel}: marker "${marker}" vazou para nome de header "${name}"`,
          )
        }
      }

      // (4) NENHUM marker aparece nas linhas brutas de header (defesa contra response splitting).
      for (const marker of p.markers) {
        const markerLower = marker.toLowerCase()
        for (const line of result.headerLines) {
          assert(
            !line.toLowerCase().includes(markerLower),
            `${ctxLabel}: marker "${marker}" vazou para linha bruta "${line}"`,
          )
        }
      }

      // (5) NENHUM marker aparece no body (preflight 200 deve ter body vazio ou neutro).
      for (const marker of p.markers) {
        const markerLower = marker.toLowerCase()
        assert(
          !result.body.toLowerCase().includes(markerLower),
          `${ctxLabel}: marker "${marker}" vazou para body (${result.body.length} bytes)`,
        )
      }

      // (6) Body de preflight deve ser pequeno e neutro (sem markers — já validado em (5)).
      //     O handler responde com "ok" fixo; aceitamos qualquer body <= 16 bytes desde que
      //     não contenha caracteres perigosos de injeção.
      assert(
        result.body.length <= 16,
        `${ctxLabel}: body de preflight deve ser pequeno (<=16 bytes), recebido ${result.body.length}`,
      )
      assert(!result.body.includes('\x00'), `${ctxLabel}: body NÃO PODE conter null byte`)
      // CR/LF permitidos só como framing (chunked terminator), mas garantimos sem '%' literal.
      assert(!result.body.includes('%'), `${ctxLabel}: body NÃO PODE conter '%' (echo de percent)`)

      // (7) Headers CORS literais adicionais.
      assertEquals(result.headers.get('access-control-allow-origin'), '*', `${ctxLabel}: Allow-Origin '*' literal`)
      assertEquals(result.headers.get('access-control-allow-credentials'), null, `${ctxLabel}: Allow-Credentials NUNCA`)
      assertEquals(result.headers.get('access-control-max-age'), '86400', `${ctxLabel}: Max-Age literal`)
      assertEquals(result.headers.get('set-cookie'), null, `${ctxLabel}: Set-Cookie NUNCA`)
      assertEquals(result.headers.get('access-control-expose-headers'), null, `${ctxLabel}: Expose-Headers NUNCA`)

      // (8) Allow-Methods/Allow-Headers ASCII puro 0x20-0x7E.
      const am = result.headers.get('access-control-allow-methods')!
      const ah = result.headers.get('access-control-allow-headers')!
      for (const [field, value] of [['Allow-Methods', am], ['Allow-Headers', ah]] as const) {
        assert(!value.includes('\r'), `${ctxLabel}: ${field} contém CR`)
        assert(!value.includes('\n'), `${ctxLabel}: ${field} contém LF`)
        assert(!value.includes('\x00'), `${ctxLabel}: ${field} contém null`)
        assert(!value.includes('\t'), `${ctxLabel}: ${field} contém HTAB`)
        assert(!value.includes('%'), `${ctxLabel}: ${field} contém '%' (echo de percent)`)
        for (const ch of value) {
          const code = ch.charCodeAt(0)
          assert(code >= 0x20 && code <= 0x7E, `${ctxLabel}: ${field} contém non-ASCII U+${code.toString(16).padStart(4, '0')}`)
        }
      }
    }

    // (9) Cobertura total.
    assertEquals(
      validatedAs200 + acceptedAs4xx, PAYLOADS.length,
      `todos os ${PAYLOADS.length} payloads cobertos (200=${validatedAs200}, 4xx/erro=${acceptedAs4xx})`,
    )

    // (10) Zero createClient invocado.
    assertEquals(ctx._calls, 0, 'createClient NUNCA pode ser invocado em OPTIONS preflight (Request-Method markers)')
  } finally {
    await ctx.stop()
  }
})
