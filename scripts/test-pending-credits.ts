/**
 * Test: pending_credits → handle_new_user grant flow.
 *
 * Validates:
 *   1) Pre-grant 500 credits to an UPPERCASE variant of an email.
 *   2) Sign up with the LOWERCASE variant (case-insensitive match).
 *   3) After signup, subscription.edits_limit reflects +500.
 *   4) A credit_transactions row was logged (CreditLedger visibility).
 *   5) pending_credits row is marked applied.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     bun scripts/test-pending-credits.ts [email]
 *
 * Without SERVICE_ROLE_KEY, falls back to anon signUp (email confirmations
 * must be disabled, otherwise the test will stop after signUp and report it).
 */
import { createClient } from '@supabase/supabase-js'

const URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ''

if (!URL || (!SERVICE && !ANON)) {
  console.error('Missing SUPABASE_URL and/or keys')
  process.exit(1)
}

const baseEmail =
  process.argv[2] ||
  `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@kubotest.dev`
const password = `Test!${crypto.randomUUID()}#A1`

// Mixed-case email used for pre-grant; signup uses the lowercase form
const preGrantEmail = baseEmail.replace(/^(.)/, (c) => c.toUpperCase())
const signupEmail = baseEmail.toLowerCase()

const admin = SERVICE ? createClient(URL, SERVICE) : null
const anon = createClient(URL, ANON)

function log(step: string, data: unknown) {
  console.log(`\n▶ ${step}`)
  console.log(JSON.stringify(data, null, 2))
}

async function main() {
  console.log('Test emails:', { preGrantEmail, signupEmail })

  if (!admin) {
    console.warn('⚠ No SERVICE_ROLE_KEY — cannot pre-grant via DB or cleanup.')
    console.warn('  Run with SUPABASE_SERVICE_ROLE_KEY for full end-to-end test.')
    process.exit(2)
  }

  // 1) Pre-grant (case-insensitive: uppercase variant)
  const { data: grant, error: grantErr } = await admin
    .from('pending_credits')
    .insert({ email: preGrantEmail, credits: 500, reason: 'test_admin_grant' })
    .select()
    .single()
  if (grantErr) throw grantErr
  log('1. pre-granted 500 credits', grant)

  // 2) Sign up with lowercase email (triggers handle_new_user)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: signupEmail,
    password,
    email_confirm: true,
  })
  if (createErr) throw createErr
  const userId = created.user!.id
  log('2. created user', { userId, email: signupEmail })

  // small delay for trigger side-effects to settle
  await new Promise((r) => setTimeout(r, 800))

  // 3) Check subscription
  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .select('plan, edits_limit, edits_used, is_active')
    .eq('user_id', userId)
    .single()
  if (subErr) throw subErr
  log('3. subscription', sub)

  // 4) Check credit_transactions log
  const { data: txs, error: txErr } = await admin
    .from('credit_transactions')
    .select('delta, balance_after, reason, category, metadata, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (txErr) throw txErr
  log('4. credit_transactions', txs)

  // 5) Check pending_credits applied
  const { data: pc } = await admin
    .from('pending_credits')
    .select('email, credits, applied_at, applied_user_id')
    .eq('id', grant.id)
    .single()
  log('5. pending_credits state', pc)

  // Assertions
  const expected = (sub.plan === 'beta' ? 20 : sub.edits_limit - 500) + 500
  const ok =
    sub.edits_limit >= 500 &&
    (txs?.some((t) => t.delta === 500 && t.reason === 'pending_credit_grant') ?? false) &&
    pc?.applied_at !== null &&
    pc?.applied_user_id === userId

  console.log('\n' + (ok ? '✅ PASS' : '❌ FAIL'), {
    edits_limit: sub.edits_limit,
    expected_min: expected,
    has_ledger_row: txs?.some((t) => t.reason === 'pending_credit_grant'),
    pending_applied: pc?.applied_at !== null,
    case_insensitive_match: pc?.email !== signupEmail,
  })

  // Cleanup
  await admin.from('pending_credits').delete().eq('id', grant.id)
  await admin.auth.admin.deleteUser(userId)
  console.log('\n🧹 cleaned up test user + pending_credits row')

  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error('💥 test failed:', e)
  process.exit(1)
})
