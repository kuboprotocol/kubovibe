/**
 * Shared helper to wrap user-generated HTML for safe full-screen rendering
 * inside an iframe AND inject a small instrumentation script that forwards
 * runtime errors / console messages to the parent window via postMessage.
 *
 * Parent listens for messages of shape:
 *   { source: 'kubo-preview', kind: 'log'|'error'|'warn'|'info'|'debug'|'exception'|'rejection'|'resource'|'ready', ... }
 */

export type PreviewLogKind =
  | 'log' | 'info' | 'warn' | 'error' | 'debug'
  | 'exception' | 'rejection' | 'resource' | 'ready' | 'network'

export interface PreviewLogEntry {
  id: string
  ts: number
  kind: PreviewLogKind
  message: string
  stack?: string
  source?: string
  line?: number
  col?: number
  url?: string
  method?: string
  status?: number
  duration?: number
}

const INSTRUMENTATION = `
<script>
(function(){
  try {
    var send = function(payload){
      try { parent.postMessage(Object.assign({source:'kubo-preview'}, payload), '*'); } catch(e){}
    };
    var stringify = function(args){
      try {
        return Array.prototype.map.call(args, function(a){
          if (a instanceof Error) return a.stack || (a.name+': '+a.message);
          if (typeof a === 'string') return a;
          try { return JSON.stringify(a); } catch(e){ return String(a); }
        }).join(' ');
      } catch(e){ return String(args); }
    };
    ['log','info','warn','error','debug'].forEach(function(level){
      var orig = console[level];
      console[level] = function(){
        try { send({kind: level, message: stringify(arguments)}); } catch(e){}
        try { return orig.apply(console, arguments); } catch(e){}
      };
    });
    window.addEventListener('error', function(ev){
      if (ev && ev.target && ev.target !== window && (ev.target.tagName === 'IMG' || ev.target.tagName === 'SCRIPT' || ev.target.tagName === 'LINK')) {
        send({kind:'resource', message:(ev.target.tagName+' failed: '+(ev.target.src||ev.target.href||''))});
        return;
      }
      send({kind:'exception', message: ev.message || 'Uncaught error', stack: ev.error && ev.error.stack, source: ev.filename, line: ev.lineno, col: ev.colno});
    }, true);
    window.addEventListener('unhandledrejection', function(ev){
      var r = ev && ev.reason;
      send({kind:'rejection', message: (r && (r.message || String(r))) || 'Unhandled rejection', stack: r && r.stack});
    });
    send({kind:'ready', message: location.href});
  } catch(e){}
})();
</script>`

/**
 * Wraps user code so it always renders full-screen with a white background
 * and instrumented error capture. Detects whether code is a fragment or a
 * full HTML document and injects the instrumentation in the right place.
 */
export function wrapPreviewHtml(code: string, opts: { instrument?: boolean } = {}): string {
  const instrument = opts.instrument !== false
  const src = code || ''
  const hasDoctype = /<!doctype\s+html/i.test(src)
  const hasHtmlTag = /<html[\s>]/i.test(src)
  const inject = instrument ? INSTRUMENTATION : ''

  if (hasDoctype || hasHtmlTag) {
    if (!instrument) return src
    // Inject before </head> if present, otherwise before </body>, else append.
    if (/<\/head>/i.test(src)) return src.replace(/<\/head>/i, `${inject}</head>`)
    if (/<\/body>/i.test(src)) return src.replace(/<\/body>/i, `${inject}</body>`)
    return src + inject
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:#ffffff;color:#111;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;min-height:100vh}</style>${inject}</head><body>${src}</body></html>`
}

/**
 * Subscribe to preview messages. Returns an unsubscribe function.
 */
export function subscribePreviewLogs(handler: (entry: PreviewLogEntry) => void): () => void {
  const listener = (ev: MessageEvent) => {
    const data = ev.data
    if (!data || typeof data !== 'object' || data.source !== 'kubo-preview') return
    handler({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      kind: data.kind,
      message: String(data.message ?? ''),
      stack: data.stack,
      source: data.source,
      line: data.line,
      col: data.col,
    })
  }
  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}
