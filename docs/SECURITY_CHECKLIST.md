# Security Policy & Public Tables Checklist

This document maintains a checklist of table visibility and RLS requirements.

## 🔓 Intentionally Public (Leaderboard / Discovery)
The following tables/views are designed for public or widespread consumption (read-only for non-owners):

- **`leaderboard_profiles`**: View exposing only `id`, `display_name`, `avatar_url`. 
  - *Reason*: Shared social experience. `referral_code` is hidden.
- **`leaderboard_streaks`**: Public access to user streak counts.
  - *Reason*: Gamification / Leaderboards.
- **`leaderboard_badges`**: Public access to user badges earned.
  - *Reason*: Gamification.
- **`profiles` (limited)**: Basic profile info is public, but sensitive columns are restricted via Column-Level Security or separate RPCs.

## 🛡️ Strict RLS (Private / Admin)
These tables require strict `auth.uid() = user_id` or `role = 'admin'` checks:

- **`pwa_telemetry_*`**: All telemetry data. Only admins/analysts can see aggregated data; users see only their own jobs.
- **`orchestrator_config`**: Critical system configuration. **Admin only**.
- **`agent_jobs`**: Job tracking. Owner-scoped + Admin access.
- **`kubo_domain_transfers`**: Domain transfer codes. **Highly sensitive**. Select access restricted even for authenticated users.
- **`rate_limit_counters`**: System utility. **Service role only**.

## 🚀 CI Security Gate
Our pipeline (`.github/workflows/ci.yml`) enforces:
1. No `SECURITY DEFINER` functions without `search_path`.
2. No `SECURITY DEFINER` functions executable by `PUBLIC` unless explicitly justified.
3. No tables in `public` schema without RLS enabled.
4. No broad `GRANT ALL` to `authenticated` or `anon`.

## 🛠️ Security Hardening Checklist
- [x] All `SECURITY DEFINER` functions have `SET search_path = public`.
- [x] Internal triggers have `REVOKE EXECUTE FROM PUBLIC`.
- [x] Sensitive columns (e.g., `referral_code`, `auth_code`) are not exposed in broad SELECT policies.
- [x] Tables with temporary data (e.g., `rate_limit_counters`) have TTL cleanup triggers.
