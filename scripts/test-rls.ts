/**
 * Script de validação RLS + Realtime topic isolation
 *
 * Como rodar (local):
 *   1) garanta as variáveis (já presentes no .env):
 *      VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 *   2) bun run scripts/test-rls.ts   (ou: tsx scripts/test-rls.ts)
 *
 * Cobertura:
 *  - Cria 2 usuários efêmeros via signUp (email aleatório)
 *  - Cada um insere 1 registro em connector_activity_logs
 *  - Valida que SELECT só retorna o próprio registro (RLS REST)
 *  - Valida que tentativa de INSERT com user_id alheio é bloqueada
 *  - Valida que canal Realtime restrito ao tópico do user A não recebe
 *    eventos do user B (Realtime RLS por topic)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL!
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!

if (!URL || !ANON) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
  process.exit(1)
}

const PASSWORD = 'Test!Pass123#secure'
const rnd = () => Math.random().toString(36).slice(2, 10)
const mkEmail = () => `rls+${Date.now()}-${rnd()}@example.com`

let pass = 0
let fail = 0
const expect = (label: string, ok: boolean, extra?: unknown) => {
  if (ok) { pass++; console.log(`✅ ${label}`) }
  else { fail++; console.error(`❌ ${label}`, extra ?? '') }
}

async function signUp(): Promise<{ client: SupabaseClient; userId: string; email: string }> {
  const email = mkEmail()
  const client = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD })
  if (error || !data.user) throw new Error(`signUp ${email}: ${error?.message}`)
  // Tenta login (caso o projeto exija confirmação por email, isso pode falhar; testes seguem com a sessão do signUp)
  if (!data.session) {
    const r = await client.auth.signInWithPassword({ email, password: PASSWORD })
    if (r.error) console.warn('login warn:', r.error.message)
  }
  return { client, userId: data.user.id, email }
}

async function main() {
  console.log('🔧 Criando usuários A e B…')
  const A = await signUp()
  const B = await signUp()
  console.log(`   A=${A.userId.slice(0, 8)}  B=${B.userId.slice(0, 8)}`)

  // 1) Cada usuário insere 1 log
  const insA = await A.client.from('connector_activity_logs').insert({
    user_id: A.userId, connector_slug: 'rls-test', event_type: 'ping', message: 'hello-A',
  }).select('id').single()
  expect('A insere próprio log', !insA.error, insA.error)

  const insB = await B.client.from('connector_activity_logs').insert({
    user_id: B.userId, connector_slug: 'rls-test', event_type: 'ping', message: 'hello-B',
  }).select('id').single()
  expect('B insere próprio log', !insB.error, insB.error)

  // 2) RLS REST: A só vê próprios logs
  const selA = await A.client.from('connector_activity_logs').select('user_id, message')
  expect(
    'A não vê logs de B (REST SELECT)',
    !selA.error && (selA.data ?? []).every((r) => r.user_id === A.userId),
    selA.error ?? selA.data,
  )

  // 3) RLS WITH CHECK: A NÃO pode inserir com user_id de B
  const crossInsert = await A.client.from('connector_activity_logs').insert({
    user_id: B.userId, connector_slug: 'rls-test', event_type: 'spoof', message: 'should-fail',
  })
  expect('A bloqueado ao inserir log com user_id de B', !!crossInsert.error, crossInsert)

  // 4) Realtime topic isolation
  // A assina o tópico privado do PRÓPRIO usuário e tenta também o de B
  console.log('🔧 Testando isolamento de tópicos Realtime…')
  let receivedOnATopic = 0
  let receivedOnBTopicByA = 0

  const topicA = `connector_activity_logs:user:${A.userId}`
  const topicB = `connector_activity_logs:user:${B.userId}`

  const chA = A.client.channel(topicA, { config: { private: true } })
    .on('broadcast', { event: '*' }, () => { receivedOnATopic++ })
    .subscribe()

  const chBspy = A.client.channel(topicB, { config: { private: true } })
    .on('broadcast', { event: '*' }, () => { receivedOnBTopicByA++ })
    .subscribe()

  // pequena espera para handshake
  await new Promise((r) => setTimeout(r, 1500))

  // B publica no próprio tópico (deveria receber só se autorizado pela RLS de realtime.messages)
  await B.client.channel(topicB, { config: { private: true } })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await B.client.channel(topicB, { config: { private: true } })
          .send({ type: 'broadcast', event: 'ping', payload: { from: 'B' } })
      }
    })

  await new Promise((r) => setTimeout(r, 2500))

  expect('A NÃO recebeu broadcast no tópico de B (RLS realtime.messages)', receivedOnBTopicByA === 0, { receivedOnBTopicByA })

  await chA.unsubscribe()
  await chBspy.unsubscribe()

  console.log(`\n📊 Resultado: ${pass} passaram, ${fail} falharam`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('💥', e); process.exit(1) })
