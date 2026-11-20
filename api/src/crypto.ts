const enc = new TextEncoder()
const dec = new TextDecoder()

export const b64 = (b: ArrayBuffer | Uint8Array): string => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b)
  let s = ''
  for (const x of u) s += String.fromCharCode(x)
  return btoa(s)
}
export const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
export const b64url = (b: ArrayBuffer | Uint8Array): string => b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const hex = (b: ArrayBuffer): string => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

export const randomToken = (bytes = 32): string => b64url(crypto.getRandomValues(new Uint8Array(bytes)))
export const newId = (): string => crypto.randomUUID()

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buf = typeof data === 'string' ? enc.encode(data) : data
  return hex(await crypto.subtle.digest('SHA-256', buf as BufferSource))
}

export async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', unb64(secret) as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a), y = enc.encode(b)
  let diff = x.length ^ y.length
  const n = Math.max(x.length, y.length)
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

// 6-digit code, uniform (rejection sampling).
export function otpCode(): string {
  const a = new Uint32Array(1)
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000
  do crypto.getRandomValues(a); while ((a[0] as number) >= limit)
  return String((a[0] as number) % 1_000_000).padStart(6, '0')
}

async function aesKey(dataKey: string, info: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', unb64(dataKey) as BufferSource, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode(info) },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/** AES-256-GCM. Output = iv(12) || ciphertext+tag. `info` binds the key to its purpose/owner. */
export async function seal(dataKey: string, info: string, plain: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(dataKey, info), plain as BufferSource))
  const out = new Uint8Array(12 + ct.length)
  out.set(iv); out.set(ct, 12)
  return out
}
export async function open(dataKey: string, info: string, sealed: Uint8Array): Promise<Uint8Array> {
  const iv = sealed.slice(0, 12), ct = sealed.slice(12)
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await aesKey(dataKey, info), ct as BufferSource))
}
export const sealText = async (k: string, info: string, t: string) => b64(await seal(k, info, enc.encode(t)))
export const openText = async (k: string, info: string, s: string) => dec.decode(await open(k, info, unb64(s)))

/** HMAC-SHA256 with a plain-text secret (Meta signs webhooks with the app secret as-is). */
export async function hmacHexText(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** TP-XXXXXXXX, 8 unambiguous characters (40 bits). */
export function waCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(8))
  return 'TP-' + [...b].map((x) => ALPHA[x % 32]).join('')
}
