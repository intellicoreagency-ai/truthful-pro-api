// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) with WebCrypto. Compatible with Google/Microsoft Authenticator, Authy, 1Password, etc.
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const STEP = 30

export function base32(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = ''
  for (const b of bytes) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += ALPHA[(value >>> (bits - 5)) & 31]; bits -= 5 } }
  if (bits > 0) out += ALPHA[(value << (5 - bits)) & 31]
  return out
}
export function unbase32(s: string): Uint8Array {
  let bits = 0, value = 0; const out: number[] = []
  for (const ch of s.toUpperCase().replace(/=+$/, '')) {
    const i = ALPHA.indexOf(ch); if (i < 0) throw new Error('bad base32')
    value = (value << 5) | i; bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return new Uint8Array(out)
}
export const newSecret = () => base32(crypto.getRandomValues(new Uint8Array(20)))

export async function hotp(secretB32: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', unbase32(secretB32) as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const msg = new ArrayBuffer(8); const v = new DataView(msg)
  v.setUint32(0, Math.floor(counter / 2 ** 32)); v.setUint32(4, counter >>> 0)
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg))
  const o = (h[19] as number) & 15
  const n = (((h[o] as number) & 0x7f) << 24) | (((h[o + 1] as number) & 255) << 16) | (((h[o + 2] as number) & 255) << 8) | ((h[o + 3] as number) & 255)
  return String(n % 1_000_000).padStart(6, '0')
}

/** Returns the matching time step (accepting ±1 step of clock drift) or null. Caller must reject steps <= the last used one (replay). */
export async function verifyTotp(secretB32: string, code: string, nowMs = Date.now()): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null
  const step = Math.floor(nowMs / 1000 / STEP)
  let found: number | null = null
  for (const s of [step - 1, step, step + 1]) { // evaluate all three so timing does not reveal which matched
    if ((await hotp(secretB32, s)) === code && found === null) found = s
  }
  return found
}

export const otpauthUri = (secretB32: string, account: string) =>
  `otpauth://totp/${encodeURIComponent('TRUTHFUL PRO:' + account)}?secret=${secretB32}&issuer=${encodeURIComponent('TRUTHFUL PRO')}&algorithm=SHA1&digits=6&period=30`
