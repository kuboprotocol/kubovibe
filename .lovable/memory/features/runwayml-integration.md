---
name: RunwayML integration
description: Server-only RunwayML key, edge function runway-generate dispatches all 4 endpoints, 28 credits per generation, exposed in Builder + Canvas
type: feature
---
# RunwayML

- Secret: `RUNWAYML_API_SECRET` (Deno.env, server-only). Never expose to frontend.
- Edge function: `supabase/functions/runway-generate/index.ts`
  - POST `{ endpoint, payload }` → starts task, debits **28 credits** via `execute_atomic_credit_deduction` (idempotency key = `runway:<userId>:<sha256(endpoint+payload)>` so retries don't double-charge), returns `{ taskId, status, balance_after }`.
  - GET `?id=<taskId>` → polls Runway task (free, no debit).
  - Endpoints supported: `text_to_image`, `image_to_video`, `video_upscale`, `character_performance`.
  - Headers required by Runway: `Authorization: Bearer <key>`, `X-Runway-Version: 2024-11-06`. Base URL: `https://api.dev.runwayml.com/v1`.
  - JWT validated via `auth.getUser()` (anon client w/ bearer header) before any work.
  - On Runway failure after credits are debited: **no automatic refund** (manual ops); idempotency prevents double-charge on client retry.
- Frontend:
  - Hook: `src/hooks/useRunway.ts` — `generate(endpoint, payload)` + auto-polling every 4s until SUCCEEDED/FAILED/CANCELLED. Auto-cleans timer on unmount.
  - Dialog: `src/components/runway/RunwayDialog.tsx` — 4 tabs, status overlay, video/image preview, download button, credit feedback.
  - Mounted in: `BuilderPage` (film icon next to Send; pastes result URL into the prompt) and `CanvasPage` (toolbar button between Export and Compartilhar).
- Cost: 28 Kubo credits per *generation start* (replay = 0). Runway's own credits are billed on the Runway dev account.
