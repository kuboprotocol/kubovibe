// Safe WGSL pipeline — every shader from user/AI input MUST pass through here
// before touching `device.createShaderModule()`. The sanitizer edge function blocks
// DoS patterns (infinite loops, runaway workgroups, recursion, oversized arrays, >64KB).
import { supabase } from '@/integrations/supabase/client';

export interface SanitizeResult {
  blocked: boolean;
  sanitized: string;
  violations: Array<{ rule: string; severity: 'critical' | 'high' | 'medium'; message: string }>;
  stage?: 'vertex' | 'fragment' | 'compute';
}

export class WGSLBlockedError extends Error {
  constructor(public violations: SanitizeResult['violations']) {
    super(`WGSL blocked by guardian: ${violations.map(v => `${v.rule}:${v.message}`).join(' | ')}`);
    this.name = 'WGSLBlockedError';
  }
}

/**
 * Sanitize WGSL source via the wgsl-sanitizer edge function.
 * Throws WGSLBlockedError if the shader contains forbidden patterns.
 */
export async function sanitizeWGSL(
  shader: string,
  stage: 'vertex' | 'fragment' | 'compute' = 'fragment',
): Promise<SanitizeResult> {
  const { data, error } = await supabase.functions.invoke('wgsl-sanitizer', {
    body: { shader, stage },
  });

  if (error) {
    // Edge function returned non-2xx (including 403 from the guardian).
    // The functions client surfaces the JSON body in error.context when available.
    const ctx = (error as { context?: { body?: unknown } }).context;
    const body = ctx?.body as SanitizeResult | undefined;
    if (body?.blocked && Array.isArray(body.violations)) {
      throw new WGSLBlockedError(body.violations);
    }
    throw new Error(`wgsl-sanitizer call failed: ${error.message}`);
  }

  const result = data as SanitizeResult;
  if (result?.blocked) throw new WGSLBlockedError(result.violations ?? []);
  return result;
}

/**
 * Sanitize and compile a WGSL shader into a GPUShaderModule.
 * Falls back gracefully when WebGPU is unavailable (e.g. preview sandbox without GPU).
 */
export async function compileSafeShaderModule(
  device: GPUDevice,
  shader: string,
  stage: 'vertex' | 'fragment' | 'compute' = 'fragment',
  label = 'kubo-shader',
): Promise<GPUShaderModule> {
  const { sanitized } = await sanitizeWGSL(shader, stage);
  return device.createShaderModule({ label, code: sanitized });
}

/**
 * Resolve a GPUDevice with proper sandbox fallbacks.
 * Returns null when WebGPU is not available — caller should show a "WebGPU not supported" UI.
 */
export async function requestSafeGPUDevice(): Promise<GPUDevice | null> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice().catch(() => null);
    if (!device) return null;
    device.lost.then((info) => {
      if (info.reason !== 'destroyed') {
        // eslint-disable-next-line no-console
        console.warn('[kubo-gpu] device lost:', info.message);
      }
    });
    return device;
  } catch {
    return null;
  }
}
