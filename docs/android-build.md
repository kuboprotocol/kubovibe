# Building the Android client

The Android client is the same cloud-first Mobile Agent as iOS: the device never
executes code, it drives an ephemeral KUBO Cloud container. See
[KUBO Anywhere](./kubo-anywhere.md) for the architecture.

## Prerequisites

- Android Studio (latest stable) with an SDK platform and a device/emulator.
- Java 17.
- The project exported to your own GitHub repo (`Export to GitHub`), then cloned.

## Steps

```bash
npm install
npm install @capacitor/push-notifications
npx cap add android
npm run build
npx cap sync android
npx cap run android
```

Native builds boot straight into the `/m` client (see `src/lib/nativeEntry.ts`).

## Push notifications (FCM)

Build/deploy completion arrives through Firebase Cloud Messaging.

1. Create a Firebase project and add an Android app using the `appId` from
   `capacitor.config.ts` (`dev.kubovibe.app`).
2. Download `google-services.json` and place it in `android/app/`.
3. Re-run `npx cap sync android`.

The token is registered by `useDeviceRegistration`, which posts to the
`devices-register` function with `platform: "android"` — the same table
(`mobile_devices`) used by APNs on iOS.

## Optional: Termux advanced mode

Not part of v1. If the user already has Termux installed, the app may open an
Intent to run commands locally without spending container credits. It stays an
opt-in power-user path, never the default execution model.
