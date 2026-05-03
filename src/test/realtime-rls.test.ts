/**
 * Testes automatizados de RLS + isolamento de tópicos Realtime.
 *
 * Garante que:
 *  - Um usuário só lê os próprios connector_activity_logs (REST RLS).
 *  - Um usuário NÃO pode inserir registros com user_id alheio (RLS WITH CHECK).
 *  - Um usuário NÃO recebe broadcasts no tópico Realtime de outro usuário
 *    (policy em realtime.messages restringindo por topic + auth.uid()).
 *
 * Os testes são auto-skip caso:
 *  - faltem variáveis de ambiente do Supabase
 *  - o projeto exija confirmação de email no signUp (sem sessão imediata)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
// Secret compartilhada com a edge function rls-test-create-user
const TEST_SECRET = (import.meta.env.VITE_RLS_TEST_SECRET ?? process.env.RLS_TEST_SECRET) as string | undefined
const PASSWORD = 'Test!Pass123#secure'

const rnd = () => Math.random().toString(36).slice(2, 10)
const mkEmail = () => `rls+${Date.now()}-${rnd()}@example.com`

type User = { client: SupabaseClient; userId: string; email: string }

async function createConfirmedUser(): Promise<User | null> {
  if (!URL || !ANON || !TEST_SECRET) return null
  const r = await fetch(`${URL}/functions/v1/rls-test-create-user`, {
    method: 'POST',
    headers: { 'x-test-secret': TEST_SECRET, apikey: ANON, Authorization: `Bearer ${ANON}` },
  })
  if (!r.ok) return null
  const body = await r.json() as { user_id: string; email: string; access_token: string; refresh_token: string }
  const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  await client.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token })
  return { client, userId: body.user_id, email: body.email }
}

async function signUpUser(): Promise<User | null> {
  if (!URL || !ANON) return null
  // Preferir o caminho confirmado (edge function) quando disponível
  const confirmed = await createConfirmedUser()
  if (confirmed) return confirmed

  const email = mkEmail()
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD })
  if (error || !data.user || !data.session) return null
  return { client, userId: data.user.id, email }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('Realtime + RLS isolation', () => {
  let A: User | null = null
  let B: User | null = null
  let skipReason = ''

  beforeAll(async () => {
    if (!URL || !ANON) { skipReason = 'Missing Supabase env vars'; return }
    A = await signUpUser()
    B = await signUpUser()
    if (!A || !B) {
      skipReason = 'signUp did not return a session (email confirmation may be required)'
    }
  }, 30_000)

  it('A only reads own connector_activity_logs (REST RLS)', async () => {
    if (skipReason || !A || !B) { console.warn('[skip]', skipReason); return }

    const insA = await A.client.from('connector_activity_logs').insert({
      user_id: A.userId, connector_slug: 'rls-test', event_type: 'ping', message: 'hello-A',
    })
    expect(insA.error).toBeNull()

    const insB = await B.client.from('connector_activity_logs').insert({
      user_id: B.userId, connector_slug: 'rls-test', event_type: 'ping', message: 'hello-B',
    })
    expect(insB.error).toBeNull()

    const sel = await A.client.from('connector_activity_logs').select('user_id')
    expect(sel.error).toBeNull()
    expect(sel.data ?? []).not.toHaveLength(0)
    for (const row of sel.data ?? []) {
      expect(row.user_id).toBe(A.userId)
    }
  }, 20_000)

  it('A cannot insert a log spoofing user_id of B (RLS WITH CHECK)', async () => {
    if (skipReason || !A || !B) { console.warn('[skip]', skipReason); return }
    const res = await A.client.from('connector_activity_logs').insert({
      user_id: B.userId, connector_slug: 'rls-test', event_type: 'spoof', message: 'should-fail',
    })
    expect(res.error).not.toBeNull()
  }, 15_000)

  it('A does NOT receive Realtime broadcasts on B\'s private topic', async () => {
    if (skipReason || !A || !B) { console.warn('[skip]', skipReason); return }

    const topicB = `connector_activity_logs:user:${B.userId}`
    let receivedByA = 0

    // A tenta espionar o tópico privado de B
    const spy = A.client.channel(topicB, { config: { private: true } })
      .on('broadcast', { event: '*' }, () => { receivedByA++ })

    await new Promise<void>((resolve) => {
      spy.subscribe((status) => { if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'CLOSED') resolve() })
      setTimeout(resolve, 3000)
    })

    // B publica no próprio tópico
    const pub = B.client.channel(topicB, { config: { private: true } })
    await new Promise<void>((resolve) => {
      pub.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await pub.send({ type: 'broadcast', event: 'ping', payload: { from: 'B' } })
          resolve()
        }
      })
      setTimeout(resolve, 3000)
    })

    await wait(2500)
    expect(receivedByA).toBe(0)

    await spy.unsubscribe()
    await pub.unsubscribe()
  }, 30_000)
})
