// Document rules. Results are internal review aids: a pass is NOT proof of authenticity and a pass/override is NOT a government acceptance.
export type Outcome = 'pass' | 'fail' | 'manual_review'
export const RULES: Record<string, { version: string; overridable: boolean }> = {
  file_signature: { version: '1', overridable: false }, // enforced at upload; a failing file is never stored
  file_size: { version: '1', overridable: false },
  malware_scan: { version: '1', overridable: false },   // never overridable by anyone
  passport_validity_6m: { version: '1', overridable: true },
  id_expiry: { version: '1', overridable: true },
  name_match: { version: '1', overridable: true },
  licence_active: { version: '1', overridable: true },
}

const pad = (n: number) => String(n).padStart(2, '0')
const daysIn = (y: number, m1: number) => new Date(Date.UTC(y, m1, 0)).getUTCDate() // m1 is 1-based

/** base + N calendar months, clamped to the last day of a shorter month (31 Aug + 6 months = 28/29 Feb). Dates are YYYY-MM-DD. */
export function addCalendarMonths(base: string, months: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base)
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo)) return null
  const idx = (y * 12 + (mo - 1)) + months
  const ny = Math.floor(idx / 12), nm = (idx % 12) + 1
  return `${ny}-${pad(nm)}-${pad(Math.min(d, daysIn(ny, nm)))}`
}

/** Passport validity: valid for at least `minimumMonths` calendar months from the base date (inclusive: expiry on the cutoff day passes). */
export function passportValidity(expiry: unknown, baseDate: string, minimumMonths = 6): { outcome: Outcome; evidence: Record<string, unknown> } {
  const cutoff = addCalendarMonths(baseDate, minimumMonths)
  const valid = typeof expiry === 'string' && addCalendarMonths(expiry, 0) === expiry
  if (!valid || !cutoff) return { outcome: 'manual_review', evidence: { reason: 'expiry_or_base_date_unreadable', expiry: expiry ?? null, baseDate } }
  return { outcome: expiry >= cutoff ? 'pass' : 'fail', evidence: { expiry, baseDate, minimumMonths, cutoff } }
}
