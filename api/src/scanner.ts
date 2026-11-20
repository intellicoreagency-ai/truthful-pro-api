import type { Env } from './types'

// File safety gate. The rule that matters: a file is usable only after an explicit "clean" verdict.
// No scanner configured => the verdict stays "pending", which is NOT clean.
export type ScanStatus = 'pending' | 'clean' | 'infected' | 'error'

export type ScannerMode = 'none' | 'fake-test' | 'clamav-http'
/** 'fake-test' exists only so tests can exercise the gate and is ignored in production.
 *  'clamav-http' is the real engine: a ClamAV daemon behind the small HTTPS service in /scanner-service (SCANNER_URL + SCANNER_TOKEN). */
export const scannerMode = (env: Env): ScannerMode => {
  if (env.SCANNER_MODE === 'clamav-http' && env.SCANNER_URL && env.SCANNER_TOKEN) {
    const ok = env.SCANNER_URL.startsWith('https://') || (env.ENVIRONMENT !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(env.SCANNER_URL))
    return ok ? 'clamav-http' : 'none'
  }
  return env.SCANNER_MODE === 'fake-test' && env.ENVIRONMENT !== 'production' ? 'fake-test' : 'none'
}

/** Live launch is refused until a real scanner is integrated: in production uploads are not accepted at all. */
export const uploadsBlocked = (env: Env): boolean => env.ENVIRONMENT === 'production' && scannerMode(env) !== 'clamav-http'

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'

/** A verdict other than an explicit "clean"/"infected" (timeout, outage, odd answer) stays "pending": never clean. */
export async function scanBytes(env: Env, bytes: Uint8Array): Promise<{ status: ScanStatus; engine: string | null }> {
  const mode = scannerMode(env)
  if (mode === 'fake-test') {
    const text = new TextDecoder('latin1').decode(bytes)
    return { status: text.includes(EICAR) ? 'infected' : 'clean', engine: 'fake-test' }
  }
  if (mode === 'clamav-http') {
    try {
      const res = await fetch(env.SCANNER_URL as string, { method: 'POST', headers: { authorization: `Bearer ${env.SCANNER_TOKEN}`, 'content-type': 'application/octet-stream' }, body: bytes as BodyInit, signal: AbortSignal.timeout(20000) })
      if (res.ok) {
        const j = (await res.json()) as { status?: string }
        if (j.status === 'clean') return { status: 'clean', engine: 'clamav' }
        if (j.status === 'infected') return { status: 'infected', engine: 'clamav' }
      }
    } catch { /* timeout / network: fall through to pending */ }
  }
  return { status: 'pending', engine: null } // no result is not a clean result
}
