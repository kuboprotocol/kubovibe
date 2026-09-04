// Deno tests for github-signin-callback
// Run with: deno test --allow-net --allow-env supabase/functions/github-signin-callback/index_test.ts
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts'

// Set required env BEFORE importing the module so module-level reads work in handler
Deno.env.set('SUPABASE_URL', 'https://example.supabase.co')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
Deno.env.set('CONNECTOR_ENC_KEY', 'test-state-secret-1234567890')

const mod = await import('./index.ts')
const { handleRequest, __test } = mod as any
const { safeReturnPath, isAllowedOrigin } = __test

function makeReq(qs: Record<string, string>): Request {
  const u = new URL('https://example.supabase.co/functions/v1/github-signin-callback')
  for (const [k, v] of Object.entries(qs)) u.searchParams.set(k, v)
  return new Request(u.toString(), {
    method: 'GET',
    headers: { referer: 'https://kubovibe.dev/auth' },
  })
}

async function readRedirectTarget(res: Response): Promise<string> {
  const html = await res.text()
  const m = html.match(/url=([^"]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

Deno.test('safeReturnPath: defaults non-internal paths to /dashboard', () => {
  assertEquals(safeReturnPath(''), '/dashboard')
  assertEquals(safeReturnPath('//evil.com'), '/dashboard')
  assertEquals(safeReturnPath('https://evil.com'), '/dashboard')
  assertEquals(safeReturnPath('/dashboard'), '/dashboard')
  assertEquals(safeReturnPath('/connectors/github'), '/connectors/github')
  assertEquals(safeReturnPath('/random-unlisted'), '/dashboard')
})

Deno.test('isAllowedOrigin: accepts kubovibe + lovable + localhost; rejects others', () => {
  assert(isAllowedOrigin('https://kubovibe.dev'))
  assert(isAllowedOrigin('https://www.kubovibe.dev'))
  assert(isAllowedOrigin('https://kubovibe.dev'))
  assert(isAllowedOrigin('http://localhost:3000'))
  assertEquals(isAllowedOrigin('https://evil.com'), false)
})

Deno.test('callback: missing code+state redirects with missing_code_or_state', async () => {
  Deno.env.set('GITHUB_CLIENT_ID', 'cid')
  Deno.env.set('GITHUB_CLIENT_SECRET', 'csec')
  const res = await handleRequest(makeReq({}))
  const target = await readRedirectTarget(res)
  assert(target.includes('auth_error=missing_code_or_state'), `got: ${target}`)
})

Deno.test('callback: missing GitHub creds redirects with github_not_configured', async () => {
  Deno.env.delete('GITHUB_CLIENT_ID')
  Deno.env.delete('GITHUB_CLIENT_SECRET')
  const res = await handleRequest(makeReq({ code: 'x', state: 'y' }))
  const target = await readRedirectTarget(res)
  assert(target.includes('auth_error=github_not_configured'), `got: ${target}`)
})

Deno.test('callback: invalid state signature redirects with invalid_state', async () => {
  Deno.env.set('GITHUB_CLIENT_ID', 'cid')
  Deno.env.set('GITHUB_CLIENT_SECRET', 'csec')
  const res = await handleRequest(makeReq({ code: 'x', state: 'not-a-valid-state.signature' }))
  const target = await readRedirectTarget(res)
  assert(target.includes('auth_error=invalid_state'), `got: ${target}`)
})

Deno.test('callback: propagates GitHub oauth_error param', async () => {
  Deno.env.set('GITHUB_CLIENT_ID', 'cid')
  Deno.env.set('GITHUB_CLIENT_SECRET', 'csec')
  const res = await handleRequest(makeReq({ error: 'access_denied' }))
  const target = await readRedirectTarget(res)
  assert(target.includes('auth_error=access_denied'), `got: ${target}`)
})
