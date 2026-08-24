# Plan - Implement Creative Panel with Fixed Cost AI Engine

Transition the Creative Economy panel to a fixed-cost model using **Featherless.ai** as the primary engine for text/simple tasks, while maintaining **OpenRouter** for frontier quality models and **Sogni** for video/music via MusKAI.

## User Review Required

> [!IMPORTANT]
> - **API Keys**: I will need the `FEATHERLESS_API_KEY` to be added via `add_secret` before the edge functions can fully function.
> - **MusKAI Pricing**: Credit costs for video are estimated at ~36 credits based on Sogni's Spark/API pricing. This will be finalized once the default video duration is confirmed.
> - **Featherless Concurrency**: The Premium tier ($25) allows 4 concurrent requests. I will implement a queuing system in the edge function to handle overflows.

## Proposed Changes

### Backend (Edge Functions)

#### 1. New `creative-router` Function
- **Provider Orchestration**: Centralized routing for all Creative Panel tasks.
- **Featherless Integration**: Connect to `https://api.featherless.ai/v1` (OpenAI-compatible).
- **Concurrency Management**: Simple memory-based queue (or brief sleep/retry) to respect Featherless request limits.
- **Tier-based Routing**:
    - **Free/Basic**: Featherless (Llama/Mistral) + Pollinations (Image).
    - **Premium/Enterprise**: Featherless for volume + OpenRouter (Claude 3.5 Sonnet / GPT-4o) for complex requests.
- **Safety**: Hard caps on output tokens (1500) and video duration (180s rejection).

#### 2. Update Shared Helpers (`supabase/functions/_shared/creative.ts`)
- Refactor `deductCredits` and `recordAsset` to work seamlessly with the new router.
- Ensure the credit ledger remains agnostic to the underlying provider cost structure.

### Frontend (Creative Panel)

#### 1. UI Updates (`src/pages/CreativePage.tsx` & `src/components/creative/CreativeToolInterface.tsx`)
- **Engine Selection**: Update the "Orchestrator" logic to prefer the new `creative-router`.
- **Transparency**: Display credit costs to users before generation, especially for expensive tasks like video.
- **Feature Cleanup**: Remove direct Puter.js calls where Featherless now takes over.
- **Redirection**: Update "Create Video" and "Create Music" to redirect to the MusKAI external product as per the new strategy.

#### 2. Specialized Tool Modules
- **PDF & Docs**: Implement local utility modules for creation/conversion (no generative cost).
- **Image/Video Editing**: Implement local processing (Canvas/FFmpeg-wasm where possible) for basic crops/cuts.

### Infrastructure & Configuration
- **Plan Config**: Update `src/lib/planConfig.ts` if needed to reflect the new daily credit allotments or tier access.

## Technical Details

- **Featherless Base URL**: `https://api.featherless.ai/v1`
- **Models to use (Featherless)**: `meta-llama/llama-3.1-70b-instruct`, `mistralai/mistral-7b-instruct-v0.3`.
- **MusKAI Redirects**: Use external URLs for specialized video/music generation.
- **Error Handling**: Implement 429 (Too Many Requests) handling for Featherless concurrency limits with automatic fallback to OpenRouter for paid tiers.

## Verification Plan

### Automated Tests
- **Smoke Tests**: Verify the `creative-router` can reach Featherless and OpenRouter.
- **Credit Deductions**: Test that credits are deducted correctly even when the backend provider cost is "fixed".

### Manual Verification
- Test "Free" user experience (Featherless path).
- Test "Pro" user experience (OpenRouter frontier path).
- Verify redirects to MusKAI work correctly.
- Check UI responsiveness when switching between tools.
