/**
 * RLS smoke tests para tabelas críticas.
 *
 * Para cada tabela com dados sensíveis por usuário:
 *  1. Usuário A insere/possui um registro (quando aplicável).
 *  2. Usuário B (autenticado, diferente) NÃO deve enxergar registros de A.
 *  3. Usuário B NÃO deve conseguir alterar/deletar dados de A.
 *
 * Os testes são auto-skip se não houver configuração de Supabase nem
 * a edge function `rls-test-create-user` disponível.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const TEST_SECRET = (import.meta.env.VITE_RLS_TEST_SECRET ?? process.env.RLS_TEST_SECRET) as string | undefined

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

describe('Critical tables — RLS cross-user isolation', () => {
  let A: User | null = null
  let B: User | null = null
  let skipReason = ''

  beforeAll(async () => {
    if (!URL || !ANON) { skipReason = 'Missing Supabase env vars'; return }
    A = await createConfirmedUser()
    B = await createConfirmedUser()
    if (!A || !B) skipReason = 'rls-test-create-user not available (set RLS_TEST_SECRET)'
  }, 30_000)

  const guard = () => {
    if (skipReason || !A || !B) {
      console.warn('[skip]', skipReason)
      return false
    }
    return true
  }

  it('profiles: B cannot read A\'s profile row by id', async () => {
    if (!guard()) return
    const sel = await B!.client.from('profiles').select('id, display_name').eq('id', A!.userId)
    expect(sel.error).toBeNull()
    expect(sel.data ?? []).toHaveLength(0)
  })

  it('profiles: B cannot update A\'s profile', async () => {
    if (!guard()) return
    const upd = await B!.client.from('profiles').update({ display_name: 'pwned' }).eq('id', A!.userId).select()
    // Either an explicit error or an empty result (RLS silently filters update)
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true)
  })

  it('subscriptions: B cannot read A\'s subscription', async () => {
    if (!guard()) return
    const sel = await B!.client.from('subscriptions').select('id, user_id').eq('user_id', A!.userId)
    expect(sel.error).toBeNull()
    expect(sel.data ?? []).toHaveLength(0)
  })

  it('subscriptions: B cannot bump A\'s credits', async () => {
    if (!guard()) return
    const upd = await B!.client.from('subscriptions')
      .update({ edits_limit: 999999 }).eq('user_id', A!.userId).select()
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true)
  })

  it('credit_transactions: B cannot read A\'s ledger', async () => {
    if (!guard()) return
    const sel = await B!.client.from('credit_transactions').select('id, user_id').eq('user_id', A!.userId)
    expect(sel.error).toBeNull()
    expect(sel.data ?? []).toHaveLength(0)
  })

  it('credit_transactions: B cannot insert a ledger row spoofing A', async () => {
    if (!guard()) return
    const ins = await B!.client.from('credit_transactions').insert({
      user_id: A!.userId, delta: 9999, balance_after: 9999, reason: 'spoof', category: 'attack',
    })
    expect(ins.error).not.toBeNull()
  })

  it('projects: B cannot read A\'s projects', async () => {
    if (!guard()) return
    // A creates a project (best-effort; schema may vary)
    const ins = await A!.client.from('projects').insert({
      user_id: A!.userId, name: 'rls-test-' + Date.now(),
    }).select('id').single()
    if (ins.error) { console.warn('[skip] projects insert:', ins.error.message); return }
    const sel = await B!.client.from('projects').select('id').eq('id', ins.data!.id)
    expect(sel.error).toBeNull()
    expect(sel.data ?? []).toHaveLength(0)
  })

  it('connector_activity_logs: B does not see A\'s logs', async () => {
    if (!guard()) return
    await A!.client.from('connector_activity_logs').insert({
      user_id: A!.userId, connector_slug: 'rls-crit', event_type: 'ping', message: 'A',
    })
    const sel = await B!.client.from('connector_activity_logs')
      .select('user_id').eq('user_id', A!.userId)
    expect(sel.error).toBeNull()
    expect(sel.data ?? []).toHaveLength(0)
  })

  it('referrals: B does not see referrals where A is referrer or referred', async () => {
    if (!guard()) return
    const sel = await B!.client.from('referrals').select('referrer_id, referred_id')
      .or(`referrer_id.eq.${A!.userId},referred_id.eq.${A!.userId}`)
    expect(sel.error).toBeNull()
    expect(sel.data ?? []).toHaveLength(0)
  })

  it('github_connections: B cannot read A\'s GitHub tokens', async () => {
    if (!guard()) return
    const sel = await B!.client.from('github_connections').select('user_id').eq('user_id', A!.userId)
    expect(sel.error).toBeNull()
    expect(sel.data ?? []).toHaveLength(0)
  })

  it('web3_connections: B cannot read A\'s wallet connections', async () => {
    if (!guard()) return
    const sel = await B!.client.from('web3_connections').select('user_id').eq('user_id', A!.userId)
    expect(sel.error).toBeNull()
    expect(sel.data ?? []).toHaveLength(0)
  })

  it('api_credentials: B cannot read A\'s credentials', async () => {
    if (!guard()) return
    const sel = await B!.client.from('api_credentials').select('user_id').eq('user_id', A!.userId)
    expect(sel.error).toBeNull()
    expect(sel.data ?? []).toHaveLength(0)
  })

  it('security_audit_logs: B cannot read A\'s audit trail', async () => {
    if (!guard()) return
    const sel = await B!.client.from('security_audit_logs')
      .select('actor_user_id').eq('actor_user_id', A!.userId)
    expect(sel.error).toBeNull()
    expect(sel.data ?? []).toHaveLength(0)
  })

  it('security_audit_logs: authenticated client cannot insert directly', async () => {
    if (!guard()) return
    const ins = await A!.client.from('security_audit_logs').insert({
      actor_user_id: A!.userId, actor_role: 'admin',
      action: 'forge', resource_type: 'admin',
    })
    expect(ins.error).not.toBeNull()
  })
})
