import type { Env } from './types'

// File safety gate. The rule that matters: a file is usable only after an explicit "clean" verdict.
// No scanner configured => the verdict stays "pending", which is NOT clean.
export type ScanStatus = 'pending' | 'clean' | 'infected' | 'error'

/** 'fake-test' exists only so tests can exercise the gate; it is ignored when ENVIRONMENT is production. No real engine is integrated yet. */
export const scannerMode = (env: Env): 'none' | 'fake-test' => (env.SCANNER_MODE === 'fake-test' && env.ENVIRONMENT !== 'production' ? 'fake-test' : 'none')

/** Live launch is refused until a real scanner is integrated: in production uploads are not accepted at all. */
export const uploadsBlocked = (env: Env): boolean => env.ENVIRONMENT === 'production' && scannerMode(env) === 'none'

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'

export function scanBytes(env: Env, bytes: Uint8Array): { status: ScanStatus; engine: string | null } {
  if (scannerMode(env) === 'fake-test') {
    const text = new TextDecoder('latin1').decode(bytes)
    return { status: text.includes(EICAR) ? 'infected' : 'clean', engine: 'fake-test' }
  }
  return { status: 'pending', engine: null } // no result is not a clean result
}
