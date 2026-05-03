import type { Page, Request } from '@playwright/test'

/**
 * DF (Deterministic Flow) analytics helper.
 *
 * Centralizes the boilerplate of attaching a `page.on('request')` listener
 * that filters POSTs against `connector_activity_logs` by `event_type`,
 * so specs don't duplicate listener wiring (and don't leak handlers).
 *
 * Usage:
 *   const counter = trackConnectorEvents(page, [
 *     'filters_undo_banner_dismissed',
 *     'filters_undo_dismiss_modal_confirmed',
 *   ])
 *   // ...interact...
 *   await counter.waitFor('filters_undo_banner_dismissed')
 *   expect(counter.count('filters_undo_banner_dismissed')).toBe(1)
 *   counter.bodies('filters_undo_banner_dismissed').forEach(b => ...)
 *   counter.dispose()
 */

const LOGS_URL_RE = /\/rest\/v1\/connector_activity_logs/

export interface ConnectorEventCounter {
  /** Number of matching events seen so far for `eventType`. */
  count(eventType: string): number
  /** Total events across all tracked types. */
  total(): number
  /** Captured raw request bodies for `eventType` (in arrival order). */
  bodies(eventType: string): string[]
  /** Resolves when at least one event of `eventType` has been captured. */
  waitFor(eventType: string, timeout?: number): Promise<Request>
  /** Reset counters and bodies (listener stays attached). */
  reset(): void
  /** Detach the listener — call in afterEach or at end of test. */
  dispose(): void
}

export function trackConnectorEvents(
  page: Page,
  eventTypes: string[],
  opts: { defaultTimeout?: number } = {},
): ConnectorEventCounter {
  const wanted = new Set(eventTypes)
  const counts = new Map<string, number>()
  const bodies = new Map<string, string[]>()
  const requests = new Map<string, Request[]>()
  for (const t of eventTypes) {
    counts.set(t, 0)
    bodies.set(t, [])
    requests.set(t, [])
  }

  const onRequest = (req: Request) => {
    if (req.method() !== 'POST') return
    if (!LOGS_URL_RE.test(req.url())) return
    const body = req.postData() ?? ''
    for (const t of wanted) {
      // Match the JSON shape Supabase REST inserts emit.
      if (body.includes(`"event_type":"${t}"`)) {
        counts.set(t, (counts.get(t) ?? 0) + 1)
        bodies.get(t)!.push(body)
        requests.get(t)!.push(req)
      }
    }
  }
  page.on('request', onRequest)

  const defaultTimeout = opts.defaultTimeout ?? 5_000

  return {
    count: (eventType) => counts.get(eventType) ?? 0,
    total: () => Array.from(counts.values()).reduce((a, b) => a + b, 0),
    bodies: (eventType) => [...(bodies.get(eventType) ?? [])],
    async waitFor(eventType, timeout = defaultTimeout) {
      const existing = requests.get(eventType) ?? []
      if (existing.length > 0) return existing[0]
      // No event yet — wait via Playwright's matcher.
      return page.waitForRequest(
        (req) => {
          if (req.method() !== 'POST') return false
          if (!LOGS_URL_RE.test(req.url())) return false
          return (req.postData() ?? '').includes(`"event_type":"${eventType}"`)
        },
        { timeout },
      )
    },
    reset() {
      for (const t of wanted) {
        counts.set(t, 0)
        bodies.set(t, [])
        requests.set(t, [])
      }
    },
    dispose() {
      page.off('request', onRequest)
    },
  }
}
