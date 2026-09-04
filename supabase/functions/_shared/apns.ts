// APNs (Apple Push Notification service) token-based provider client.
// Uses the 4 build secrets: APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID.
// The .p8 key is an ES256 PKCS#8 private key — it is signed in-memory and never logged.

const APNS_PROD_HOST = "https://api.push.apple.com";
const APNS_SANDBOX_HOST = "https://api.sandbox.push.apple.com";

let cachedToken: { jwt: string; issuedAt: number } | null = null;

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

export function apnsConfigured(): boolean {
  return Boolean(
    Deno.env.get("APNS_KEY_P8") &&
      Deno.env.get("APNS_KEY_ID") &&
      Deno.env.get("APNS_TEAM_ID") &&
      Deno.env.get("APNS_BUNDLE_ID"),
  );
}

/** Provider JWT, valid for 1h — Apple rejects tokens older than 60 min and
 * throttles clients that mint a new one on every push, so we cache for 45 min. */
async function providerToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now - cachedToken.issuedAt < 45 * 60) return cachedToken.jwt;

  const p8 = Deno.env.get("APNS_KEY_P8")!.replace(/\\n/g, "\n");
  const keyId = Deno.env.get("APNS_KEY_ID")!;
  const teamId = Deno.env.get("APNS_TEAM_ID")!;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(p8),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const header = base64UrlEncode(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = base64UrlEncode(JSON.stringify({ iss: teamId, iat: now }));
  const signingInput = `${header}.${payload}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(signingInput),
    ),
  );

  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;
  cachedToken = { jwt, issuedAt: now };
  return jwt;
}

export interface ApnsPayload {
  title: string;
  body: string;
  /** Extra keys delivered to the app (deep-link target, build id, etc). */
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  threadId?: string;
}

export interface ApnsResult {
  token: string;
  ok: boolean;
  status: number;
  apnsId: string | null;
  reason: string | null;
}

/** Send one alert push. `sandbox` targets the Xcode/TestFlight-debug environment. */
export async function sendApns(
  deviceToken: string,
  payload: ApnsPayload,
  opts: { sandbox?: boolean; collapseId?: string } = {},
): Promise<ApnsResult> {
  const bundleId = Deno.env.get("APNS_BUNDLE_ID")!;
  const host = opts.sandbox ? APNS_SANDBOX_HOST : APNS_PROD_HOST;
  const jwt = await providerToken();

  const headers: Record<string, string> = {
    authorization: `bearer ${jwt}`,
    "apns-topic": bundleId,
    "apns-push-type": "alert",
    "apns-priority": "10",
    "content-type": "application/json",
  };
  if (opts.collapseId) headers["apns-collapse-id"] = opts.collapseId.slice(0, 64);

  const body = {
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: payload.sound ?? "default",
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
      ...(payload.threadId ? { "thread-id": payload.threadId } : {}),
    },
    ...(payload.data ?? {}),
  };

  const res = await fetch(`${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  let reason: string | null = null;
  if (res.status !== 200) {
    const text = await res.text().catch(() => "");
    try {
      reason = JSON.parse(text)?.reason ?? text.slice(0, 200) ?? null;
    } catch {
      reason = text.slice(0, 200) || null;
    }
  } else {
    await res.body?.cancel();
  }

  return {
    token: deviceToken,
    ok: res.status === 200,
    status: res.status,
    apnsId: res.headers.get("apns-id"),
    reason,
  };
}

/** Send to every registered iOS device of a user. Tries production first and
 * retries on sandbox when Apple answers `BadDeviceToken` (dev build tokens). */
export async function sendApnsToUser(
  admin: { from: (t: string) => any },
  userId: string,
  payload: ApnsPayload,
  opts: { collapseId?: string } = {},
): Promise<ApnsResult[]> {
  if (!apnsConfigured()) return [];

  const { data: devices } = await admin
    .from("mobile_devices")
    .select("id, apns_token, platform")
    .eq("user_id", userId)
    .in("platform", ["ios", "ipados"]);

  const results: ApnsResult[] = [];
  for (const device of devices ?? []) {
    let result = await sendApns(device.apns_token, payload, { ...opts, sandbox: false });
    if (!result.ok && result.reason === "BadDeviceToken") {
      result = await sendApns(device.apns_token, payload, { ...opts, sandbox: true });
    }
    // Apple says the token is dead — stop paying for it on every build.
    if (!result.ok && (result.reason === "Unregistered" || result.reason === "BadDeviceToken")) {
      await admin.from("mobile_devices").delete().eq("id", device.id);
    }
    results.push(result);
  }
  return results;
}
