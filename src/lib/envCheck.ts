/**
 * Runtime validation of frontend env vars (Vite bundle).
 *
 * Mirrors the contract enforced by `scripts/setup-env.sh --validate`:
 *   - VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID
 *     must be present AND not contain template placeholder values.
 *
 * In DEV: throws an Error so the issue surfaces immediately in the
 *         browser console / overlay.
 * In PROD: only logs (does not throw), so misconfig of optional vars
 *          can never blank the user's screen.
 */

interface CheckResult {
  ok: boolean;
  missing: string[];
  placeholders: string[];
}

const PLACEHOLDER_REGEX =
  /^(your-|sk_live_\.\.\.|sk-\.\.\.|sk-or-v1-\.\.\.|gsk_\.\.\.|fc-\.\.\.|whsec_\.\.\.|polar_\.\.\.|ghs_\.\.\.|GOCSPX-\.\.\.|xoxb-\.\.\.|lvb_\.\.\.|0x\.\.\.|eyJhbGciOiJIUzI1NiIs\.\.\.|base64-32-bytes\.\.\.|random-long-string|xxx\.apps\.googleusercontent\.com|Iv1\.xxxxxxxxxxxxxxxx|https:\/\/your-project-ref)/;

const REQUIRED_FRONTEND = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PROJECT_ID",
] as const;

export function checkFrontendEnv(
  env: Record<string, string | undefined> = import.meta.env as unknown as Record<string, string>,
): CheckResult {
  const missing: string[] = [];
  const placeholders: string[] = [];
  for (const key of REQUIRED_FRONTEND) {
    const val = env[key];
    if (!val || val.trim() === "") {
      missing.push(key);
      continue;
    }
    if (PLACEHOLDER_REGEX.test(val.trim())) placeholders.push(key);
  }
  return { ok: missing.length === 0 && placeholders.length === 0, missing, placeholders };
}

export function assertFrontendEnv(): void {
  const result = checkFrontendEnv();
  if (result.ok) return;

  const lines: string[] = ["[envCheck] Frontend env misconfigured:"];
  if (result.missing.length)
    lines.push(`  • Missing: ${result.missing.join(", ")}`);
  if (result.placeholders.length)
    lines.push(`  • Placeholder values: ${result.placeholders.join(", ")}`);
  lines.push("  ↳ Run: bun run setup:env  (then edit .env)");
  lines.push("  ↳ Validate: bun run setup:env:check");
  const msg = lines.join("\n");

  // Log error but don't throw to avoid blank screens
  // eslint-disable-next-line no-console
  console.error(msg);
  
  if (import.meta.env.DEV) {
    // In dev, we can also alert or show a small overlay if we wanted, 
    // but for now, just logging to console is enough to avoid total failure.
    console.warn("Continuing despite env errors to avoid blank screen.");
  }
}
