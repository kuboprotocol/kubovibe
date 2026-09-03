/**
 * On native (Capacitor) builds the app boots straight into the mobile agent
 * client at /m, preserving any deep-link workspace parameters.
 */
export function isNativePlatform(): boolean {
  const cap = (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export function redirectNativeToMobileClient(): void {
  if (typeof window === "undefined" || !isNativePlatform()) return;
  const path = window.location.pathname;
  if (path === "/m" || path.startsWith("/m/") || path === "/mobile") return;
  if (path !== "/" && path !== "/index.html") return;
  window.history.replaceState(null, "", `/m${window.location.search}`);
}
