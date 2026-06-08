import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2.4.3'
import { corsHeaders, sanitizeError } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { id, password } = await req.json().catch(() => ({}))
    if (!id || !password) {
      return new Response(JSON.stringify({ error: 'id and password required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    
    // Rate limit password attempts per share (max 5 attempts per minute)
    const { data: countData } = await admin.rpc('bump_rate_limit', {
      _bucket: 'audit_share_password',
      _user: id,
      _window_seconds: 60
    })
    
    if (typeof countData === 'number' && countData > 5) {
      return new Response(JSON.stringify({ error: 'too_many_attempts' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: share, error } = await admin.from('audit_shares').select('*').eq('id', id).maybeSingle()
    if (error || !share) {
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (share.revoked_at) {
      return new Response(JSON.stringify({ error: 'revoked' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: 'expired' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const ok = await bcrypt.compare(password, share.password_hash)
    if (!ok) {
      return new Response(JSON.stringify({ error: 'invalid_password' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const { data: signed, error: signErr } = await admin.storage
      .from('audit-reports').createSignedUrl(share.storage_path, 60)
    if (signErr) throw signErr

    await admin.from('audit_shares').update({
      download_count: (share.download_count ?? 0) + 1,
      last_accessed_at: new Date().toISOString(),
    }).eq('id', id)

    return new Response(JSON.stringify({
      url: signed.signedUrl,
      label: share.label,
      size: share.size_bytes,
      createdAt: share.created_at,
      expiresAt: share.expires_at,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[audit-share-access] error:', e);
    return new Response(JSON.stringify({ error: sanitizeError(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
