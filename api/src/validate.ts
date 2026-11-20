export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_JSON_BYTES = 32 * 1024
export const MAX_FILES_PER_REQUEST = 20

/** E.164 only. Accepts +9715XXXXXXXX (UAE mobile) and other international numbers. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.replace(/[\s\-()]/g, '')
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null
  if (s.startsWith('+971') && !/^\+9715\d{8}$/.test(s)) return null // UAE mobile numbers only
  return s
}

export type FileKind = { mime: 'application/pdf' | 'image/jpeg' | 'image/png'; ext: string }
export function sniffFile(b: Uint8Array): FileKind | null {
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return { mime: 'application/pdf', ext: 'pdf' }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return { mime: 'image/png', ext: 'png' }
  return null
}

/** Strip path parts, control and bidi-override characters; cap the length. */
export function safeFileName(raw: string | null | undefined, fallbackExt: string): string {
  let n = (raw ?? '').split(/[\\/]/).pop() ?? ''
  n = n.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩"<>:*?|]/g, '').trim().slice(0, 120)
  return n && n !== '.' && n !== '..' ? n : `document.${fallbackExt}`
}

export const REQUEST_STATUSES = ['draft', 'submitted', 'in_review', 'missing_documents', 'in_progress', 'completed', 'cancelled'] as const
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
export const isServiceId = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9][a-z0-9-]{1,63}$/.test(s)
