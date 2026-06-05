/**
 * Vite plugin: fail the build (and warn the dev server) when required
 * frontend env vars are missing or still hold template placeholder values.
 *
 * Mirrors `scripts/setup-env.sh --validate` and `src/lib/envCheck.ts`.
 *
 * Behavior:
 *   - `vite build`   → throws → build exits non-zero (CI-safe).
 *   - `vite` (dev)   → logs a warning (does not block hot-reload).
 *
 * Bypass for one-off builds:
 *   SKIP_ENV_CHECK=1 vite build
 */
import type { Plugin } from "vite";

const PLACEHOLDER_REGEX =
  /^(your-|sk_live_\.\.\.|sk-\.\.\.|sk-or-v1-\.\.\.|gsk_\.\.\.|fc-\.\.\.|whsec_\.\.\.|polar_\.\.\.|ghs_\.\.\.|GOCSPX-\.\.\.|xoxb-\.\.\.|lvb_\.\.\.|0x\.\.\.|eyJhbGciOiJIUzI1NiIs\.\.\.|base64-32-bytes\.\.\.|random-long-string|xxx\.apps\.googleusercontent\.com|Iv1\.xxxxxxxxxxxxxxxx|https:\/\/your-project-ref)/;

const REQUIRED = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PROJECT_ID",
] as const;

export function envCheckPlugin(): Plugin {
  return {
    name: "kubo-env-check",
    apply: undefined, // run in both dev + build
    configResolved(config) {
      if (process.env.SKIP_ENV_CHECK === "1") {
        config.logger.warn("[env-check] skipped (SKIP_ENV_CHECK=1)");
        return;
      }

      const env = { ...process.env, ...(config.env ?? {}) } as Record<string, string | undefined>;
      const missing: string[] = [];
      const placeholders: string[] = [];

      for (const key of REQUIRED) {
        const val = (env[key] ?? "").trim();
        if (!val) missing.push(key);
        else if (PLACEHOLDER_REGEX.test(val)) placeholders.push(key);
      }

      if (missing.length === 0 && placeholders.length === 0) return;

      const lines = ["env-check failed (frontend):"];
      if (missing.length) lines.push(`  • missing: ${missing.join(", ")}`);
      if (placeholders.length) lines.push(`  • placeholder: ${placeholders.join(", ")}`);
      lines.push("  ↳ fix: bun run setup:env  (then edit .env)");
      lines.push("  ↳ verify: bun run setup:env:check");
      lines.push("  ↳ bypass (not recommended): SKIP_ENV_CHECK=1");
      const msg = lines.join("\n");

      if (config.command === "build") {
        // Throw → vite build exits with code 1.
        throw new Error(msg);
      } else {
        config.logger.warn(`\n${msg}\n`);
      }
    },
  };
}
