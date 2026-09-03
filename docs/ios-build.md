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
