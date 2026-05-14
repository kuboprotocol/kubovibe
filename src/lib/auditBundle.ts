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
        ? '_Nenhum evento de rede próximo (±2s)._'
        : g.related.map(r => `- \`${new Date(r.ts).toISOString()}\` ${r.method ?? ''} ${r.url ?? ''} ${r.status ? `→ ${r.status}` : ''} (${r.duration ?? '–'}ms)`).join('\n'),
    ]
    return lines.join('\n')
  }).join('\n\n')
}

export interface SharedReport {
  url: string
  path: string
  protected: boolean
  expiresAt: number | null
  createdAt: number
  size: number
}

/**
 * Upload a ZIP blob to Supabase storage and return a (optionally protected) link.
 * When `protect` is true, returns a time-limited signed URL instead of a public URL.
 */
export async function shareReport(
  blob: Blob,
  opts: { protect?: boolean; expiresInSec?: number } = {},
): Promise<SharedReport> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const path = `${id}.zip`
  const { error } = await supabase.storage
    .from('audit-reports')
    .upload(path, blob, { contentType: 'application/zip', upsert: false })
  if (error) throw error

  const protect = !!opts.protect
  const expiresInSec = opts.expiresInSec ?? 7 * 24 * 60 * 60 // 7 days
  let url: string
  let expiresAt: number | null = null

  if (protect) {
    const { data, error: signErr } = await supabase.storage
      .from('audit-reports')
      .createSignedUrl(path, expiresInSec)
    if (signErr) throw signErr
    url = data.signedUrl
    expiresAt = Date.now() + expiresInSec * 1000
  } else {
    url = supabase.storage.from('audit-reports').getPublicUrl(path).data.publicUrl
  }

  return { url, path, protected: protect, expiresAt, createdAt: Date.now(), size: blob.size }
}
