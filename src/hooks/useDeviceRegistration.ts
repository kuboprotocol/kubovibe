import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PushState = "unsupported" | "idle" | "registering" | "registered" | "denied";

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function capacitor(): CapacitorGlobal | undefined {
  return (globalThis as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNativeApp(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

export function nativePlatform(): string {
  return capacitor()?.getPlatform?.() ?? "web";
}

/**
 * Registers the device push token with the `/devices` endpoint so the backend can
 * notify the user when a remote build or deploy finishes in the background.
 * On web it stays inert — the hook only activates inside the native shell.
 */
export function useDeviceRegistration() {
  const [state, setState] = useState<PushState>(isNativeApp() ? "idle" : "unsupported");
  const [token, setToken] = useState<string | null>(null);

  const register = useCallback(async () => {
    if (!isNativeApp()) return;
    setState("registering");
    try {
      // Resolved at runtime only — the plugin exists in the native shell build.
      const pluginId = "@capacitor/push-notifications";
      const mod = (await import(/* @vite-ignore */ pluginId)) as {
        PushNotifications: {
          requestPermissions: () => Promise<{ receive: string }>;
          addListener: (event: string, cb: (payload: { value: string }) => void) => void;
          register: () => Promise<void>;
        };
      };
      const PushNotifications = mod.PushNotifications;
      const perm = await PushNotifications.requestPermissions();

      if (perm.receive !== "granted") {
        setState("denied");
        return;
      }
      PushNotifications.addListener("registration", async ({ value }: { value: string }) => {
        setToken(value);
        await supabase.functions.invoke("devices-register", {
          body: {
            apns_token: value,
            platform: nativePlatform() === "android" ? "android" : "ios",
            app_version: "1.0.0",
          },
        });
        setState("registered");
      });
      PushNotifications.addListener("registrationError", () => setState("denied"));
      await PushNotifications.register();
    } catch {
      setState("unsupported");
    }
  }, []);

  const unregister = useCallback(async () => {
    if (!token) return;
    await supabase.functions.invoke("devices-register", {
      body: { action: "unregister", apns_token: token },
    });
    setToken(null);
    setState("idle");
  }, [token]);

  useEffect(() => {
    if (isNativeApp()) void register();
  }, [register]);

  return { state, token, register, unregister, native: isNativeApp(), platform: nativePlatform() };
}
