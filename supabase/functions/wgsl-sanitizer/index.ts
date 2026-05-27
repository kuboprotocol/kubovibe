// WebGPU WGSL Shader Guardian — sanitizes user/AI-submitted WGSL before GPU compilation.
// Blocks DoS patterns (infinite loops, runaway workgroups, recursion, oversized arrays).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface SanitizeRequest {
  shader: string;
  stage?: 'vertex' | 'fragment' | 'compute';
}

interface ViolationReport {
  rule: string;
  severity: 'critical' | 'high' | 'medium';
  message: string;
}

const DANGEROUS_PATTERNS: Array<{ rule: string; pattern: RegExp; severity: ViolationReport['severity']; message: string }> = [
  { rule: 'INFINITE_WHILE_TRUE',     pattern: /while\s*\(\s*true\s*\)/i,                  severity: 'critical', message: 'Infinite while(true) loop forbidden' },
  { rule: 'INFINITE_LOOP_NO_BREAK',  pattern: /loop\s*\{(?![^}]*\bbreak\b)[^}]*\}/is,     severity: 'critical', message: 'loop {} without break is forbidden' },
  { rule: 'RUNAWAY_WORKGROUP',       pattern: /@workgroup_size\s*\(\s*(\d{4,}|\d{3,}\s*,\s*\d{3,})/i, severity: 'critical', message: 'Workgroup size exceeds safety budget' },
  { rule: 'RECURSION_HINT',          pattern: /fn\s+(\w+)\s*\([^)]*\)\s*->\s*[^{]*\{[^}]*\b\1\s*\(/s, severity: 'high',     message: 'Self-recursive function detected' },
  { rule: 'OVERSIZED_ARRAY',         pattern: /array<[^,>]+,\s*(\d{7,})\s*>/i,            severity: 'high',     message: 'Oversized fixed-size array' },
  { rule: 'WHILE_LITERAL_NONZERO',   pattern: /while\s*\(\s*[1-9]\d*\s*\)/i,              severity: 'critical', message: 'while(<nonzero literal>) effectively infinite' },
];

const MAX_SHADER_BYTES = 64 * 1024;

function sanitizeWGSLShader(src: string): { ok: boolean; violations: ViolationReport[]; sanitized: string } {
  const violations: ViolationReport[] = [];
  if (src.length > MAX_SHADER_BYTES) {
    violations.push({ rule: 'SIZE_LIMIT', severity: 'critical', message: `Shader exceeds ${MAX_SHADER_BYTES} bytes` });
  }
  for (const { rule, pattern, severity, message } of DANGEROUS_PATTERNS) {
    if (pattern.test(src)) violations.push({ rule, severity, message });
  }
  const critical = violations.some(v => v.severity === 'critical' || v.severity === 'high');
  return {
    ok: !critical,
    violations,
    sanitized: critical ? '' : src.replace(/\/\*[\s\S]*?\*\//g, '').trim(),
  };
}

const VALID_STAGES = ['vertex', 'fragment', 'compute'] as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as SanitizeRequest;

    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return new Response(JSON.stringify({ error: 'Request body must be a JSON object' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!('shader' in body)) {
      return new Response(JSON.stringify({ error: 'shader is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof body.shader !== 'string') {
      return new Response(JSON.stringify({ error: `shader must be a string, received ${typeof body.shader}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.shader.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'shader cannot be empty' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if ('stage' in body && !VALID_STAGES.includes(body.stage as any)) {
      return new Response(JSON.stringify({ error: `stage must be one of: ${VALID_STAGES.join(', ')}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = sanitizeWGSLShader(body.shader);

    if (!result.ok) {
      console.warn('[wgsl-sanitizer] BLOCKED', JSON.stringify(result.violations));
      return new Response(JSON.stringify({ blocked: true, ...result }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ blocked: false, ...result, stage: body.stage ?? 'fragment' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
