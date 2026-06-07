// Shared encryption/decryption helpers for connectors.
// Reuses CONNECTOR_ENC_KEY (32-byte base64).

function b64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(s: string) {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function importKey(usage: 'encrypt' | 'decrypt') {
  const raw = Deno.env.get('CONNECTOR_ENC_KEY')
  if (!raw) throw new Error('CONNECTOR_ENC_KEY not configured')
  const keyBytes = fromB64(raw)
  if (keyBytes.length !== 32) throw new Error('CONNECTOR_ENC_KEY must be 32 bytes base64')
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [usage])
}

export async function encryptSecret(plain: string): Promise<{ ciphertext: string; iv: string; tag: string }> {
  const key = await importKey('encrypt')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
  const all = new Uint8Array(cipherBuf)
  const tag = all.slice(all.length - 16)
  const ct = all.slice(0, all.length - 16)
  return { ciphertext: b64(ct), iv: b64(iv), tag: b64(tag) }
}

export async function decryptSecret(parts: { ciphertext: string; iv: string; tag: string }): Promise<string> {
  const key = await importKey('decrypt')
  const ct = fromB64(parts.ciphertext)
  const tag = fromB64(parts.tag)
  const iv = fromB64(parts.iv)
  const full = new Uint8Array(ct.length + tag.length)
  full.set(ct, 0); full.set(tag, ct.length)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, full)
  return new TextDecoder().decode(plain)
}
