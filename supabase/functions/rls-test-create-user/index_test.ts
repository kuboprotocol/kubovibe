// Deno tests para RLS + isolamento de tópicos Realtime.
// Executados via supabase--test_edge_functions (permissões --allow-net --allow-env).
// Usa SUPABASE_SERVICE_ROLE_KEY para criar 2 usuários efêmeros já confirmados.
import { assert, assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type User = { client: SupabaseClient; userId: string; email: string }

async function newUser(): Promise<User> {
  const admin = createClient(URL, SERVICE)
  const email = `rls-${Date.now()}-${crypto.randomUUID().slice(0, 6)}@rls-test.kubovibe.dev`
  const password = `Test!${crypto.randomUUID()}#`
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  assert(!error && created.user, `createUser failed: ${error?.message}`)
  const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: signed, error: signErr } = await client.auth.signInWithPassword({ email, password })
  assert(!signErr && signed.session, `signIn failed: ${signErr?.message}`)
  return { client, userId: created.user.id, email }
}

async function cleanup(userId: string) {
  try { await createClient(URL, SERVICE).auth.admin.deleteUser(userId) } catch { /* noop */ }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

Deno.test('RLS: A só lê os próprios connector_activity_logs', async () => {
  const A = await newUser(); const B = await newUser()
  try {
    const insA = await A.client.from('connector_activity_logs').insert({
      user_id: A.userId, connector_slug: 'rls-test', event_type: 'ping', message: 'hello-A',
    })
    assertEquals(insA.error, null)
    const insB = await B.client.from('connector_activity_logs').insert({
      user_id: B.userId, connector_slug: 'rls-test', event_type: 'ping', message: 'hello-B',
    })
    assertEquals(insB.error, null)

    const sel = await A.client.from('connector_activity_logs').select('user_id')
    assertEquals(sel.error, null)
    assert((sel.data ?? []).length > 0, 'A should see own rows')
    for (const row of sel.data ?? []) assertEquals(row.user_id, A.userId)
  } finally {
    await cleanup(A.userId); await cleanup(B.userId)
  }
})

Deno.test('RLS: A não consegue inserir log com user_id de B (WITH CHECK)', async () => {
  const A = await newUser(); const B = await newUser()
  try {
    const res = await A.client.from('connector_activity_logs').insert({
      user_id: B.userId, connector_slug: 'rls-test', event_type: 'spoof', message: 'should-fail',
    })
    assertNotEquals(res.error, null, 'spoofed insert must be rejected by RLS')
  } finally {
    await cleanup(A.userId); await cleanup(B.userId)
  }
})

Deno.test('Realtime: A não recebe broadcasts no tópico privado de B', async () => {
  const A = await newUser(); const B = await newUser()
  let receivedByA = 0
  const topicB = `connector_activity_logs:user:${B.userId}`

  const spy = A.client.channel(topicB, { config: { private: true } })
    .on('broadcast', { event: '*' }, () => { receivedByA++ })

  await new Promise<void>((resolve) => {
    spy.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'CLOSED') resolve()
    })
    setTimeout(resolve, 4000)
  })

  const pub = B.client.channel(topicB, { config: { private: true } })
  await new Promise<void>((resolve) => {
    pub.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await pub.send({ type: 'broadcast', event: 'ping', payload: { from: 'B' } })
        resolve()
      }
    })
    setTimeout(resolve, 4000)
  })

  await wait(2500)
  try {
    assertEquals(receivedByA, 0, 'A must not receive messages from B\'s private topic')
  } finally {
    await spy.unsubscribe(); await pub.unsubscribe()
    await cleanup(A.userId); await cleanup(B.userId)
  }
})
