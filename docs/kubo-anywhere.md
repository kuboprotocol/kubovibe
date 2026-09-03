# KUBO Anywhere — multi-platform architecture

One workspace, two execution models. The project state (branch, open files, AI
conversation, Git history) lives in the backend, so nothing is ever trapped on a
single device. Continuity between phone, tablet and desktop is a consequence of
that, not a special "handoff" feature.

## Execution models

| Platform | Execution | Billing | Client |
| --- | --- | --- | --- |
| Windows | Local, on user hardware | Per AI action (same ledger as Vibe Code) | Local Agent daemon + VS Code / Cursor extension |
| macOS | Local + Xcode / Swift / Simulator | Per AI action | Same daemon, notarized, with Apple toolchain integrations |
| Linux | Local, systemd service | Per AI action | Same daemon binary |
| iOS / iPadOS | 100% remote container | Per container minute | Native shell over the `/m` client |
| Android | Remote container (Termux optional, advanced) | Per container minute | Capacitor client + FCM |

Source of truth in code: `src/lib/anywhereConfig.ts`. Cloud pricing is enforced
by `supabase/functions/cloud-sessions/index.ts`.

## Mobile — the device never executes code

Core principle: the iPhone/iPad only *commands* remote execution. No embedded
interpreter, no local shell, no simulated Linux environment. This is the same
model Blink Shell, Termius and Codespaces already use, so it is a proven,
store-compliant pattern.

On the device:

- Native code editor over a local copy of the files — editing works offline.
- Chat with Vibe Code / KUBO AI — same conversation and history as desktop.
- Terminal *client*: sends commands and streams output; execution happens in a
  KUBO Cloud container over a WebSocket session.
- Git through the GitMoom API (commit, push, branch, merge) — never a local
  `git` binary.
- Live preview rendered from the cloud build (WebView/iframe of the result).
- Push notification when a build or deploy finishes, because iOS kills
  background processes aggressively and the flow cannot depend on the app
  staying open.

Out of scope by design: Xcode/Swift/Simulator on the phone, real filesystem
access, and running the app locally on the device.

Backend: `cloud_sessions`, `session_builds` and `mobile_devices`, exposed via the
`cloud-sessions`, `git` and `devices-register` edge functions. Sessions bill one
credit per active minute with a heartbeat and a 15 minute idle timeout.

## Android

Identical architecture to iOS in v1 — same tables, same endpoints, same
per-minute billing. Only two swaps:

- FCM instead of APNs for build notifications (`platform: "android"` in
  `devices-register`).
- Kotlin/Compose native shell is the long-term target; the Capacitor client
  ships first.

Termux integration (local execution via an Android Intent, no container credits)
stays an opt-in advanced mode, never the default path, so support and cost stay
predictable.

## Desktop — KUBO Local Agent

A single background daemon (Rust, for low idle footprint) serving two clients at
once: the standalone app and an extension that works in both VS Code and Cursor
(shared extension API). The installer detects an existing editor and offers the
one-click bridge.

- Real terminal (PowerShell/zsh/bash), no intermediation.
- Real local `git` binary, syncing with GitMoom via normal push/pull.
- File watcher on the approved workspace, persistent connection to KUBO Core AI.

Requirements that cannot be skipped:

- Code signing (Authenticode on Windows, Apple notarization on macOS). Without
  it SmartScreen and Defender flag the installer and adoption dies before the
  product runs.
- Per-project folder permission. The daemon must never get unrestricted
  filesystem access by default.

Because execution runs on the user's own hardware, there is no container to
host, so billing reverts to per AI action. Desktop is materially cheaper to
operate than mobile — that difference belongs in pricing decisions.

## Windows/Linux daemon — implementation notes

The desktop Local Agent is a native binary and therefore lives outside this web repository.
Reference specification for the separate `kubo-agent` project:

- **Core:** Rust daemon (low idle footprint), built on the Vertal CLI as the execution layer.
  Watches the workspace folder, keeps a persistent WebSocket to KUBO Core AI, exposes a
  loopback JSON-RPC API on `127.0.0.1` with a per-launch token.
- **Permissions:** access is granted per project folder — never filesystem-wide. The daemon
  refuses paths outside the folders the user explicitly registered.
- **Code signing:** the Windows installer must be signed with an OV/EV certificate
  (`signtool sign /fd SHA256 /tr <timestamp> ...`), otherwise SmartScreen/Defender flag it.
  macOS builds need Developer ID signing plus notarization (`notarytool`).
- **Editor bridge:** a single VS Code extension (also loads in Cursor, same extension API)
  that surfaces the Vibe Code chat and applies AI suggestions to the open files through
  `WorkspaceEdit`, with a diff preview before apply. The installer detects an existing
  VS Code/Cursor install and offers one-click integration.
- **Billing:** per AI action on the existing ledger (chat 1, edit 2, agent run 4). Terminal
  and git are free because they run on the user's own hardware — see `src/lib/anywhereConfig.ts`.
