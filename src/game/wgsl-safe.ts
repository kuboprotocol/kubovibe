/**
 * WGSL Shader Sanitizer + safe WebGPU device wrapper.
 * Used by the WGSLSandbox UI and the wgsl-sanitizer edge function client.
 */

export interface Violation {
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
}

export interface SanitizeResult {
  blocked: boolean;
  sanitized: string;
  violations: Violation[];
}

export class WGSLBlockedError extends Error {
  violations: Violation[];
  constructor(violations: Violation[]) {
    super('WGSL blocked by guardian');
    this.name = 'WGSLBlockedError';
    this.violations = violations;
  }
}

const BLACKLIST: Array<{ pattern: RegExp; rule: string; severity: Violation['severity']; message: string }> = [
  { pattern: /while\s*\(\s*true\s*\)/, rule: 'no-unbound-loop', severity: 'critical', message: 'Unbounded while(true) loop is not allowed.' },
  { pattern: /loop\s*\{[^}]*\}/, rule: 'no-bare-loop', severity: 'high', message: 'Bare loop {} without break detected.' },
  { pattern: /textureStore\s*\(/, rule: 'restricted-texture-store', severity: 'medium', message: 'textureStore requires explicit review.' },
];

export async function sanitizeWGSL(code: string, stage: 'compute' | 'fragment' | 'vertex'): Promise<SanitizeResult> {
  const violations: Violation[] = [];
  for (const b of BLACKLIST) if (b.pattern.test(code)) violations.push({ rule: b.rule, severity: b.severity, message: b.message });

  const tag = stage === 'compute' ? '@compute' : stage === 'fragment' ? '@fragment' : '@vertex';
  if (!code.includes(tag)) {
    violations.push({ rule: 'missing-entry-point', severity: 'high', message: `Shader must declare ${tag} entry point.` });
  }

  const critical = violations.some(v => v.severity === 'critical' || v.severity === 'high');
  if (critical) throw new WGSLBlockedError(violations);

  return { blocked: false, sanitized: code, violations };
}

export async function requestSafeGPUDevice(): Promise<GPUDevice | null> {
  const nav = navigator as Navigator & { gpu?: GPU };
  if (!nav.gpu) return null;
  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) return null;
    return await adapter.requestDevice();
  } catch {
    return null;
  }
}

// Legacy class kept for compatibility with older callers.
export class WGSLSanitizer {
  sanitize(code: string) {
    try {
      // Best-effort sync check using the same blacklist.
      const violations: string[] = [];
      for (const b of BLACKLIST) if (b.pattern.test(code)) violations.push(`${b.rule}: ${b.message}`);
      const hasEntry = /@(compute|fragment|vertex)/.test(code);
      if (!hasEntry) violations.push('missing-entry-point');
      return { safe: violations.length === 0, code, errors: violations };
    } catch (e) {
      return { safe: false, code, errors: [(e as Error).message] };
    }
  }
}
