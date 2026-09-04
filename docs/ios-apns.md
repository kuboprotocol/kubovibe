# APNs: from the .p8 certificate to the build alert ringing on the iPhone

App published at https://kubovibe.dev. This guide covers only the push chain —
the Xcode build itself is in `docs/ios-build.md`.

Requirements: macOS + Xcode 15+, an Apple Developer Program membership
(99 USD/year), and a **physical** iPhone. The simulator never receives APNs.

## 1. Create the .p8 auth key

1. developer.apple.com → Certificates, Identifiers & Profiles → **Keys** → `+`.
2. Name it `KUBO APNs`, tick **Apple Push Notifications service (APNs)**,
   Continue → Register.
3. Download `AuthKey_XXXXXXXXXX.p8`. **It can only be downloaded once.**
4. Write down three values:
   - **Key ID** — the `XXXXXXXXXX` in the filename.
   - **Team ID** — top-right of the developer portal (10 chars).
   - **Bundle ID** — `dev.kubovibe.app`.

## 2. Enable the capability

In Xcode, target `App` → Signing & Capabilities → `+ Capability`:

- **Push Notifications**
- **Background Modes** → tick *Remote notifications*

Confirm the App ID in the portal (Identifiers → `dev.kubovibe.app`) also has
Push Notifications enabled, then regenerate the provisioning profile.

## 3. Store the credentials in the backend

Save these four as backend secrets (never in the repo):

| Secret | Value |
| --- | --- |
| `APNS_KEY_P8` | full contents of the `.p8`, including the BEGIN/END lines |
| `APNS_KEY_ID` | 10-char Key ID |
| `APNS_TEAM_ID` | 10-char Team ID |
| `APNS_BUNDLE_ID` | `dev.kubovibe.app` |

Ask me to add them and I open the secure form — do not paste the key in chat.

## 4. Register the device token

The app already calls `devices-register`. On first launch, after the permission
prompt, `mobile_devices` gets a row with `platform = 'ios'` and the APNs token.
Verify:

```sql
select id, platform, created_at from mobile_devices order by created_at desc limit 5;
```

Empty table → the prompt was denied, or the build is running on the simulator.

## 5. Send the push when the build finishes

`cloud-sessions` writes to `session_builds`. The push is sent from an edge
function that signs a JWT (ES256) with the `.p8` and posts to
`https://api.push.apple.com/3/device/<token>` — use
`api.sandbox.push.apple.com` for debug builds installed from Xcode, and the
production host for TestFlight/App Store builds. Sending a sandbox token to the
production host returns `BadDeviceToken`; that mismatch is the single most
common failure.

Payload:

```json
{
  "aps": { "alert": { "title": "Build finished", "body": "Team Test Project — succeeded" }, "sound": "default" },
  "session_id": "<uuid>",
  "build_id": "<uuid>"
}
```

## 6. End-to-end test

1. Install the app on the iPhone from Xcode, accept notifications.
2. Open `/admin/cloud` on the web, start a session and press **Build**.
3. `session_builds` gets a row → the function pushes → the alert rings on the
   iPhone, and tapping it deep-links to `/m?session=<id>`.

Troubleshooting: `403 InvalidProviderToken` → wrong Key/Team ID or the JWT is
older than 1h (regenerate it, cache for ~50 min). `400 BadDeviceToken` →
sandbox/production host mismatch. No alert but the API returns 200 → check
Focus mode and Settings → Notifications → KUBO on the device.
