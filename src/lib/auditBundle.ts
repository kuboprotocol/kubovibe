import { supabase } from '@/integrations/supabase/client'
import type { PreviewLogEntry } from './iframePreview'

const ERROR_KINDS = ['error', 'exception', 'rejection', 'resource', 'network'] as const
type ErrKind = typeof ERROR_KINDS[number]
const isErr = (k: string): k is ErrKind => (ERROR_KINDS as readonly string[]).includes(k)

/** Convert network log entries to a HAR 1.2 document. */
export function entriesToHAR(entries: PreviewLogEntry[]): unknown {
  const net = entries.filter(e => e.kind === 'network')
  return {
    log: {
      version: '1.2',
      creator: { name: 'Kubo Vibe Preview Audit', version: '1.0' },
      browser: { name: 'iframe', version: typeof navigator !== 'undefined' ? navigator.userAgent : '' },
      pages: [{
        startedDateTime: new Date(entries[0]?.ts ?? Date.now()).toISOString(),
        id: 'preview',
        title: typeof location !== 'undefined' ? location.href : 'preview',
        pageTimings: { onContentLoad: -1, onLoad: -1 },
      }],
      entries: net.map(e => {
        const status = e.status ?? 0
        const startedDateTime = new Date(e.ts).toISOString()
        const time = e.duration ?? 0
        let url = e.url || ''
        try { url = new URL(url, location.origin).toString() } catch {}
        return {
          pageref: 'preview',
          startedDateTime,
          time,
          request: {
            method: e.method || 'GET', url,
            httpVersion: 'HTTP/1.1', cookies: [], headers: [],
            queryString: [], headersSize: -1, bodySize: -1,
          },
          response: {
            status, statusText: status >= 400 ? 'Error' : (status ? 'OK' : 'Failed'),
            httpVersion: 'HTTP/1.1', cookies: [], headers: [],
            content: { size: 0, mimeType: 'application/octet-stream', text: e.message },
            redirectURL: '', headersSize: -1, bodySize: -1,
            _kuboMessage: e.message,
          },
          cache: {},
          timings: { send: 0, wait: time, receive: 0 },
          serverIPAddress: '',
        }
      }),
    },
  }
}

export interface Correlation {
  error: PreviewLogEntry
  related: PreviewLogEntry[]
}

/** Pair each error with network/resource events within ±windowMs. */
export function correlateErrors(entries: PreviewLogEntry[], windowMs = 2000): Correlation[] {
  const errors = entries.filter(e => isErr(e.kind) && e.kind !== 'network')
  const net = entries.filter(e => e.kind === 'network' || e.kind === 'resource')
  return errors.map(error => ({
    error,
    related: net.filter(n => Math.abs(n.ts - error.ts) <= windowMs && n.id !== error.id),
  }))
}

export function correlationsToMarkdown(c: Correlation[]): string {
  if (c.length === 0) return '_Nenhuma correlação detectada._'
  return c.map((g, i) => {
    const lines = [
      `### [${i + 1}] ${g.error.kind.toUpperCase()} — ${new Date(g.error.ts).toISOString()}`,
      `> ${g.error.message}`,
      g.related.length === 0
        ? '_Nenhum evento de rede próximo._'
        : g.related.map(r => `- \`${new Date(r.ts).toISOString()}\` ${r.method ?? ''} ${r.url ?? ''} ${r.status ? `→ ${r.status}` : ''} (${r.duration ?? '–'}ms)`).join('\n'),
    ]
    return lines.join('\n')
  }).join('\n\n')
}

export interface SharedReport {
  id: string
  url: string
  expiresAt: string | null
  createdAt: string
  size: number
  label: string | null
}

/**
 * Upload a ZIP blob via secured edge function. Returns a `/share/audit/:id` URL
 * that requires the password to download.
 */
export async function shareReport(
  blob: Blob,
  opts: { password: string; expiresInSec?: number; label?: string | null },
): Promise<SharedReport> {
  const fd = new FormData()
  fd.append('file', blob, 'preview-bundle.zip')
  fd.append('password', opts.password)
  fd.append('expiresInSec', String(opts.expiresInSec ?? 7 * 24 * 60 * 60))
  if (opts.label) fd.append('label', opts.label)

  const { data, error } = await supabase.functions.invoke('audit-share-create', {
    body: fd,
  })
  if (error) throw error
  // Edge function returns the share URL using its own origin if request came from
  // another origin (rare). Force absolute on current origin to be safe.
  const id = (data as { id: string }).id
  const url = `${window.location.origin}/share/audit/${id}`
  return { ...(data as SharedReport), url }
}

export async function revokeShare(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('audit-share-revoke', { body: { id } })
  if (error) throw error
}

export interface ShareRow {
  id: string
  label: string | null
  size_bytes: number
  expires_at: string | null
  revoked_at: string | null
  download_count: number
  last_accessed_at: string | null
  created_at: string
}

export async function listShares(): Promise<ShareRow[]> {
  const { data, error } = await supabase
    .from('audit_shares')
    .select('id,label,size_bytes,expires_at,revoked_at,download_count,last_accessed_at,created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as ShareRow[]
}
