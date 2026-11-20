export class ApiError extends Error { constructor(public status: number, public code: string) { super(code) } }

let access: string | undefined
let refresh: string | undefined = (() => { try { return sessionStorage.getItem('tp.staff.refresh') ?? undefined } catch { return undefined } })()
let onExpired: () => void = () => {}
export const setExpiredHandler = (f: () => void) => { onExpired = f }
export const signedIn = () => !!refresh

function store(a: string, r: string) { access = a; refresh = r; try { sessionStorage.setItem('tp.staff.refresh', r) } catch { /* private mode */ } }
export function signOutLocal() { access = refresh = undefined; try { sessionStorage.removeItem('tp.staff.refresh') } catch { /* */ } }

let refreshing: Promise<boolean> | null = null
function doRefresh(): Promise<boolean> {
  if (!refresh) return Promise.resolve(false)
  refreshing ??= (async () => {
    try {
      const r = await fetch('/staff/v1/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }) })
      if (!r.ok) { signOutLocal(); return false }
      const j = await r.json(); store(j.accessToken, j.refreshToken); return true
    } catch { return false } finally { refreshing = null }
  })()
  return refreshing
}

async function call(method: string, path: string, o: { body?: unknown; raw?: Blob | ArrayBuffer; headers?: Record<string, string>; auth?: boolean } = {}): Promise<Response> {
  const go = () => {
    const headers: Record<string, string> = { ...(o.headers ?? {}) }
    let body: BodyInit | undefined
    if (o.raw) body = o.raw as BodyInit
    else if (o.body !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(o.body) }
    if (o.auth !== false && access) headers.authorization = 'Bearer ' + access
    return fetch(path, { method, headers, body })
  }
  let r: Response
  try { r = await go() } catch { throw new ApiError(0, 'network') }
  if (r.status === 401 && o.auth !== false && refresh) {
    if (await doRefresh()) { try { r = await go() } catch { throw new ApiError(0, 'network') } }
    if (r.status === 401) { signOutLocal(); onExpired() }
  }
  if (!r.ok) { let code = 'error'; try { const b = await r.json(); code = b.error ?? b.status ?? code } catch { /* */ } throw new ApiError(r.status, code) }
  return r
}
const j = async <T,>(r: Response) => (await r.json()) as T

// ---- types ----
export type Role = 'owner' | 'manager' | 'agent' | 'accountant'
export type Status = 'draft' | 'submitted' | 'review' | 'needs_documents' | 'authority' | 'decision' | 'completed' | 'cancelled' | 'rejected'
export type Bi = { ar: string; en: string }
export type Stats = { byStatus: Partial<Record<Status, number>>; unassigned: number; mine: number }
export type ListItem = { id: string; serviceId: string; status: Status; title: Bi | null; customer: { id: string; name: string; phone: string }; assignee: { id: string; name: string } | null; createdAt: number; updatedAt: number }
export type FileRow = { id: string; name: string; mime: string; size: number; kind: 'source' | 'final' | 'invoice'; label: string | null; created_at: number }
export type EventRow = { id: string; actor: string; kind: string; text_ar: string; text_en: string; visible: number; created_at: number }
export type MissingRow = { id: string; label_ar: string; label_en: string; note_ar: string; note_en: string; replacement_file_id: string | null; resolved_at: number | null }
export type Detail = {
  request: { id: string; serviceId: string; status: Status; assigneeId: string | null; createdAt: number; updatedAt: number; data: { title?: Bi; name?: string; phone?: string; fields?: Record<string, string>; termsVersion?: string; termsAcceptedAt?: string }; staff: { expectedAt?: string; completedAt?: string; issue?: string } }
  customer: { id: string; name: string; phone: string }; files: FileRow[]; events: EventRow[]; missing: MissingRow[]; transitions: Status[]
}
export type TeamRow = { id: string; name: string; role: Role; active: number; created_at: number }
export type WaStart = { challengeId: string; pollToken: string; code: string; link: string; expiresIn: number }

export const api = {
  waStart: async (phone: string) => j<WaStart>(await call('POST', '/staff/v1/auth/wa/start', { auth: false, body: { phone } })),
  async waPoll(phone: string, c: WaStart): Promise<'pending' | 'expired' | 'verified'> {
    const r = await j<{ status: 'pending' | 'expired' | 'verified'; accessToken?: string; refreshToken?: string }>(
      await call('POST', '/staff/v1/auth/wa/poll', { auth: false, body: { phone, challengeId: c.challengeId, pollToken: c.pollToken } }))
    if (r.status === 'verified' && r.accessToken && r.refreshToken) store(r.accessToken, r.refreshToken)
    return r.status
  },
  me: async () => j<{ staff: { id: string; name: string; role: Role } }>(await call('GET', '/staff/v1/me')),
  logout: async () => { try { await call('POST', '/staff/v1/auth/logout') } catch { /* */ } signOutLocal() },
  stats: async () => j<Stats>(await call('GET', '/staff/v1/stats')),
  requests: async (q: { status?: string; assignee?: string; q?: string }) => {
    const p = new URLSearchParams(); for (const [k, v] of Object.entries(q)) if (v) p.set(k, v)
    return (await j<{ requests: ListItem[] }>(await call('GET', '/staff/v1/requests?' + p))).requests
  },
  request: async (id: string) => j<Detail>(await call('GET', `/staff/v1/requests/${id}`)),
  assign: (id: string, staffId: string | null) => call('POST', `/staff/v1/requests/${id}/assign`, { body: { staffId } }),
  setStatus: (id: string, status: Status, extra: { note?: string; expectedAt?: string; reason?: string }) => call('POST', `/staff/v1/requests/${id}/status`, { body: { status, ...extra } }),
  missing: (id: string, items: { labelAr: string; labelEn: string; noteAr?: string; noteEn?: string }[]) => call('POST', `/staff/v1/requests/${id}/missing`, { body: { items } }),
  note: (id: string, text: string) => call('POST', `/staff/v1/requests/${id}/notes`, { body: { text } }),
  upload: (id: string, file: File, kind: 'final' | 'invoice', label: string) =>
    call('PUT', `/staff/v1/requests/${id}/files?kind=${kind}`, { raw: file, headers: { 'x-file-name': encodeURIComponent(file.name), 'x-file-label': encodeURIComponent(label) } }),
  fileBlob: async (id: string) => (await call('GET', `/staff/v1/files/${id}`)).blob(),
  team: async () => (await j<{ team: TeamRow[] }>(await call('GET', '/staff/v1/team'))).team,
  addMember: (phone: string, name: string, role: Role) => call('POST', '/staff/v1/team', { body: { phone, name, role } }),
  setMember: (id: string, patch: { role?: Role; active?: boolean }) => call('PATCH', `/staff/v1/team/${id}`, { body: patch }),
}
