
/**
 * Security utilities for KUBO Edge Functions.
 * Focus: SSRF prevention, input sanitization, and IP validation.
 */

/**
 * Validates a URL to prevent SSRF (Server-Side Request Forgery).
 * Blocks private, reserved, and loopback IP ranges, as well as metadata endpoints.
 * @param rawUrl The URL to validate
 * @throws Error if the URL is invalid or points to a restricted destination
 */
export function validatePublicUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('invalid_url_format');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('unsupported_protocol');
  }

  const host = parsed.hostname.toLowerCase();
  
  // Block common local/internal hostnames
  const blockedHosts = new Set([
    'localhost', 
    '0.0.0.0', 
    '::1', 
    'metadata.google.internal', 
    'instance-data',
    '169.254.169.254'
  ]);
  
  if (blockedHosts.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('restricted_host');
  }

  // Block private/reserved IPv4 ranges
  const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (isIPv4) {
    const p = host.split('.').map(Number);
    const isPrivate = 
      p[0] === 10 || // 10.0.0.0/8
      p[0] === 127 || // 127.0.0.0/8
      (p[0] === 169 && p[1] === 254) || // 169.254.0.0/16 (Metadata)
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || // 172.16.0.0/12
      (p[0] === 192 && p[1] === 168) || // 192.168.0.0/16
      p[0] === 0 || // 0.0.0.0/8
      p[0] >= 224; // Multicast/Reserved
      
    if (isPrivate) {
      throw new Error('restricted_ip_range');
    }
  }

  // Block IPv6 notation often used to bypass filters (e.g. [::])
  if (host.includes(':') || host.includes('[') || host.includes(']')) {
    throw new Error('ipv6_not_allowed_in_rpc');
  }

  return parsed;
}
