import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2.4.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: userRes, error: userErr } = await userClient.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = userRes.user.id

    const form = await req.formData()
    const file = form.get('file') as File | null
    const password = (form.get('password') as string | null)?.trim() ?? ''
    const expiresInSec = Number(form.get('expiresInSec') ?? 7 * 24 * 60 * 60)
    const label = (form.get('label') as string | null)?.slice(0, 120) ?? null

    if (!file) return new Response(JSON.stringify({ error: 'file required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (!password || password.length < 4) return new Response(JSON.stringify({ error: 'password must be ≥ 4 chars' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (file.size > 25 * 1024 * 1024) return new Response(JSON.stringify({ error: 'file too large (max 25MB)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const id = crypto.randomUUID()
    const path = `${userId}/${id}.zip`
    const buf = new Uint8Array(await file.arrayBuffer())
    const { error: upErr } = await admin.storage.from('audit-reports').upload(path, buf, {
      contentType: 'application/zip', upsert: false,
    })
    if (upErr) throw upErr

    const password_hash = await bcrypt.hash(password, 10)
    const expires_at = expiresInSec > 0 ? new Date(Date.now() + expiresInSec * 1000).toISOString() : null

    const { data: row, error: insErr } = await admin.from('audit_shares').insert({
      id, user_id: userId, storage_path: path, password_hash,
      label, size_bytes: file.size, expires_at,
    }).select().single()
    if (insErr) throw insErr

    const origin = req.headers.get('origin') || ''
    const url = `${origin}/share/audit/${id}`
    return new Response(JSON.stringify({
      id, url, expiresAt: row.expires_at, createdAt: row.created_at, size: row.size_bytes, label: row.label,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = (e as Error).message
    const safeMessage = (msg.includes("database") || msg.includes("sql")) ? "Internal server error" : msg;
    return new Response(JSON.stringify({ error: safeMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
