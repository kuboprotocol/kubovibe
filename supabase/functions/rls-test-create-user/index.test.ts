// Testes unitários do handler do edge function rls-test-create-user.
// Foco: garantir que createClient é invocado com os envs CORRETOS:
//   - admin client  -> (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
//   - user client   -> (SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
// e que envs ausentes resultam em 503 com lista de missing.
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handle, safeEqual, type CreateClientFn, type EnvGetter } from './index.ts'

const SECRET = 'super-secret-test-value'
const URL_ENV = 'https://example.supabase.co'
const SERVICE = 'service-role-key-XYZ'
const ANON = 'anon-key-ABC'

const fullEnv: Record<string, string> = {
  SUPABASE_URL: URL_ENV,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE,
  SUPABASE_ANON_KEY: ANON,
  RLS_TEST_SECRET: SECRET,
}
const envGetterFrom = (m: Record<string, string>): EnvGetter => (n) => m[n]

type Call = { url: string; key: string; opts?: unknown }

function makeFakeClient() {
  return {
    auth: {
      admin: {
        createUser: async (_args: unknown) => ({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      signInWithPassword: async (_args: unknown) => ({
        data: { session: { access_token: 'at', refresh_token: 'rt' } },
        error: null,
      }),
    },
  }
}

function makeCreateClientSpy(): { fn: CreateClientFn; calls: Call[] } {
  const calls: Call[] = []
  const fn: CreateClientFn = (url, key, opts) => {
    calls.push({ url, key, opts })
    return makeFakeClient()
  }
  return { fn, calls }
}

const postWithSecret = (secret = SECRET) =>
  new Request('http://local/test', {
    method: 'POST',
    headers: { 'x-test-secret': secret },
  })

Deno.test('safeEqual: equal and unequal strings', () => {
  assert(safeEqual('abc', 'abc'))
  assert(!safeEqual('abc', 'abd'))
  assert(!safeEqual('abc', 'abcd'))
})

Deno.test('handle: createClient receives SERVICE_ROLE_KEY for admin and ANON_KEY for user client', async () => {
  const spy = makeCreateClientSpy()
  const res = await handle(postWithSecret(), {
    createClient: spy.fn,
    getEnv: envGetterFrom(fullEnv),
    now: () => 1700000000000,
    randomId: () => '00000000-0000-0000-0000-000000000000',
  })

  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(body.user_id, 'user-123')
  assertEquals(body.access_token, 'at')
  assertEquals(body.refresh_token, 'rt')

  // Exatamente 2 createClient: admin + userClient
  assertEquals(spy.calls.length, 2)

  const [adminCall, userCall] = spy.calls

  // admin client: URL + SERVICE_ROLE_KEY, sem opts (uso default)
  assertEquals(adminCall.url, URL_ENV)
  assertEquals(adminCall.key, SERVICE, 'admin client deve receber SUPABASE_SERVICE_ROLE_KEY')
  assertEquals(adminCall.opts, undefined)

  // user client: URL + ANON_KEY + persistSession:false
  assertEquals(userCall.url, URL_ENV)
  assertEquals(userCall.key, ANON, 'user client deve receber SUPABASE_ANON_KEY (não service role)')
  assertEquals(userCall.opts, { auth: { persistSession: false } })

  // Garantia extra: ANON nunca é usada como key do admin, e SERVICE nunca como key do user.
  assert(adminCall.key !== ANON, 'admin não pode usar ANON_KEY')
  assert(userCall.key !== SERVICE, 'user client não pode vazar SERVICE_ROLE_KEY')
})

Deno.test('handle: returns 503 with missing envs listed when SERVICE_ROLE_KEY is absent', async () => {
  const spy = makeCreateClientSpy()
  const env = { ...fullEnv }
  delete (env as Record<string, string>).SUPABASE_SERVICE_ROLE_KEY

  const res = await handle(postWithSecret(), {
    createClient: spy.fn,
    getEnv: envGetterFrom(env),
  })
  assertEquals(res.status, 503)
  const body = await res.json()
  assertEquals(body.error, 'not_configured')
  assert(Array.isArray(body.missing))
  assert(body.missing.includes('SUPABASE_SERVICE_ROLE_KEY'))
  // Não deve ter tentado instanciar nenhum cliente quando faltam envs.
  assertEquals(spy.calls.length, 0)
})

Deno.test('handle: returns 503 listing all missing envs when none are set', async () => {
  const spy = makeCreateClientSpy()
  const res = await handle(postWithSecret(), {
    createClient: spy.fn,
    getEnv: envGetterFrom({}),
  })
  assertEquals(res.status, 503)
  const body = await res.json()
  assertEquals(body.error, 'not_configured')
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'RLS_TEST_SECRET']) {
    assert(body.missing.includes(k), `missing should include ${k}`)
  }
  assertEquals(spy.calls.length, 0)
})

Deno.test('handle: 401 when x-test-secret header is missing or wrong (no createClient call)', async () => {
  const spy = makeCreateClientSpy()

  const noHeader = new Request('http://local/test', { method: 'POST' })
  const r1 = await handle(noHeader, { createClient: spy.fn, getEnv: envGetterFrom(fullEnv) })
  assertEquals(r1.status, 401)

  const r2 = await handle(postWithSecret('wrong'), { createClient: spy.fn, getEnv: envGetterFrom(fullEnv) })
  assertEquals(r2.status, 401)

  assertEquals(spy.calls.length, 0)
})

Deno.test('handle: wrong x-test-secret -> 401 unauthorized and createClient is NOT called', async () => {
  const spy = makeCreateClientSpy()
  const res = await handle(postWithSecret('definitely-not-the-secret'), {
    createClient: spy.fn,
    getEnv: envGetterFrom(fullEnv),
  })

  assertEquals(res.status, 401)
  const body = await res.json()
  assertEquals(body.error, 'unauthorized')

  // Garantia: nenhum cliente Supabase foi instanciado — sem chance de vazar SERVICE_ROLE_KEY.
  assertEquals(spy.calls.length, 0, 'createClient must not be called when secret is invalid')
})

Deno.test('handle: rejects non-POST methods with 405', async () => {
  const spy = makeCreateClientSpy()
  const res = await handle(new Request('http://local/test', { method: 'GET' }), {
    createClient: spy.fn,
    getEnv: envGetterFrom(fullEnv),
  })
  assertEquals(res.status, 405)
  assertEquals(spy.calls.length, 0)
})
