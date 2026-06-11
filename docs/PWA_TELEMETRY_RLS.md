# PWA Telemetry — RLS Policies

This document describes the Row-Level Security (RLS) policies, Data API GRANTs,
and audit trail for the `pwa_telemetry_*` tables.

## Roles

Three roles in `public.user_roles` participate in PWA telemetry access:

| Role      | Read events | Manage own jobs | Read all jobs | Clear / Delete events | Change settings | Read audit logs |
|-----------|:-----------:|:---------------:|:-------------:|:---------------------:|:---------------:|:---------------:|
| `admin`   | ✅          | ✅              | ✅            | ✅                    | ✅              | ✅              |
| `analyst` | ✅          | ✅              | ✅            | ✅                    | own only        | ❌              |
| `viewer`  | ✅          | ✅              | ❌            | ❌                    | own only        | ❌              |
| (others)  | ❌          | own only*       | ❌            | ❌                    | own only        | ❌              |

\* The `pwa_telemetry_export_jobs` table allows any authenticated user to manage
their own jobs (`auth.uid() = user_id`), but the page is gated by the edge
function which requires admin/analyst/viewer for any read operation.

## Tables and policies

### `pwa_telemetry_events`
- **SELECT** `Telemetry readers can view` — `has_any_role(['admin','analyst','viewer'])`
- **INSERT** `Users can insert own telemetry` — `auth.uid() = user_id`
- **DELETE** `Telemetry admins can delete` — `has_any_role(['admin','analyst'])`

### `pwa_telemetry_export_jobs`
- **ALL** `Users can manage their own export jobs` — `auth.uid() = user_id`
  (validates RLS per job: a user can only update/cancel/retry their own rows)
- **SELECT** `Admins can view all jobs` — admin/analyst can read every user's jobs

### `pwa_telemetry_settings`
- **ALL** `Users can manage their own settings` — `auth.uid() = user_id`
- **SELECT** `Admins can view all settings` — admin

### `pwa_telemetry_audit_logs`
- **SELECT** `Admins can view audit logs` / `Admins can view clear logs` — admin
- **INSERT** allowed for any authenticated user (records "view_jobs", "clear", "export", "retry")

### `pwa_telemetry_metrics`
- **SELECT** `Admins can view metrics` — admin
- Inserted by edge function via service role

### `pwa_telemetry_webhooks`
- **ALL** `Admins can manage webhooks` — admin

## Data API GRANTs

Every table has the GRANTs required by PostgREST. Without these, RLS-allowed
queries would still fail with `permission denied`:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pwa_telemetry_events        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pwa_telemetry_export_jobs   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pwa_telemetry_settings      TO authenticated;
GRANT SELECT, INSERT                  ON public.pwa_telemetry_audit_logs   TO authenticated;
GRANT SELECT                          ON public.pwa_telemetry_metrics      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pwa_telemetry_webhooks      TO authenticated;
-- + GRANT ALL ON each table TO service_role
```

`anon` is intentionally **not** granted — every policy scopes to `auth.uid()`
or to a role check, so anonymous users have no business reading these tables.

## Audit trail

The following actions are recorded in `pwa_telemetry_audit_logs`:

| `action_type`  | When                                                 | Source             |
|----------------|------------------------------------------------------|--------------------|
| `view_jobs`    | A user opens the Export Jobs view                    | UI (`ExportJobsView`) |
| `export`       | Sync or background export started (mode: sync/background/retry) | Edge function |
| `clear`        | Telemetry events cleared via `/pwa-telemetry-clear`  | Edge function      |

Each row stores `actor_id`, `filters` (JSON payload), `deleted_count`, and `created_at`.

## Per-job RLS validation

`pwa_telemetry_export_jobs.Users can manage their own export jobs` uses
`USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`. This means:

- A user cannot read another user's job by guessing its `id`.
- A user cannot cancel or retry someone else's job.
- The edge function additionally re-validates `user_id = auth.uid()` server-side
  for `cancel` and `retry` actions as defense-in-depth.

## Failure UX

If the Data API ever returns `permission denied` (e.g. role was revoked, session
expired, or grants are missing), the UI shows a friendly error with two
actions: **Recarregar sessão** (refresh JWT) and, when the session is missing,
**Ir para login**.

## Test

See `src/test/pwa-telemetry-rls.test.ts` for the automated permission test
matrix.
