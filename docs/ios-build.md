# KUBO Mobile Agent — iOS / iPadOS build

The native app is a Capacitor wrapper around the `/m` client. Container sessions,
builds and deploys run remotely (KUBO Cloud), so the app is a rich client only.

## 1. Export and install

```bash
# after "Export to GitHub" + git clone
npm install
npm install @capacitor/push-notifications
npx cap add ios
npx cap update ios
npm run build
npx cap sync ios
npx cap open ios
```

## 2. Xcode

- Signing & Capabilities → select your Apple Team (free account works for device installs).
- Add the **Push Notifications** capability (build notifications).
- Select your iPhone/iPad as target and press Run to install.

On device, trust the developer profile in
Settings → General → VPN & Device Management.

## 3. Live reload during development

`capacitor.config.ts` points `server.url` at the hosted preview, so the installed
app always loads the latest deploy without rebuilding. Remove the `server` block
to ship a fully bundled binary for TestFlight/App Store.

## 4. Entry point

Native builds open `/m` automatically (`src/lib/nativeEntry.ts`). Deep links keep
the workspace shared with the desktop Vibe Code UI:

```
kubovibe://m?project=<uuid>&repo=<owner/repo>&branch=main
```

## APNs registration and "build finished" push

1. **Apple Developer portal** — enable the *Push Notifications* capability for
   `dev.kubovibe.app` and create an APNs **Auth Key (.p8)**. Note the Key ID and Team ID.
2. **Xcode** — after `npx cap add ios && npx cap sync ios`, open
   `ios/App/App.xcworkspace`, select the App target → *Signing & Capabilities* → add
   *Push Notifications* and *Background Modes → Remote notifications*.
3. **Plugin** — `npm i @capacitor/push-notifications` before `npx cap sync`. The client
   already calls it lazily in `src/hooks/useDeviceRegistration.ts`; on web it stays inert.
4. **Token registration** — on first launch the app requests permission, receives the APNs
   token and posts it to the `devices-register` function, which upserts into
   `mobile_devices` (`user_id`, `apns_token`, `platform`, `app_version`).
5. **Sending the push** — when `cloud-sessions` finishes a `build`/`deploy` it can look up
   the owner's tokens in `mobile_devices` and send an APNs `alert` payload signed with the
   `.p8` key (`APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` secrets). This matters
   because iOS suspends the app aggressively — the result must arrive even when it is
   backgrounded.
6. **Install on the iPhone** — connect the device, pick it as the run destination in Xcode
   and press Run (a free Apple ID works for a 7-day provisioning profile; a paid account
   or TestFlight is required for longer installs).

## End-to-end check

Open the app → *Session* tab → pick the project → **Open session** (charges 1 credit/min) →
*Preview* tab → **Run build** (2 credits) → logs and preview appear → tap **Vibe Code** in
the header to open the exact same project, branch and file on the desktop editor.
