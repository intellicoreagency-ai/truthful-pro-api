import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser'

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
export type Status = 'draft' | 'submitted' | 'review' | 'needs_documents' | 'ready_for_authority' | 'authority' | 'decision' | 'completed' | 'cancelled' | 'rejected'
export type Bi = { ar: string; en: string }
export type Stats = { byStatus: Partial<Record<Status, number>>; unassigned: number; mine: number }
export type ListItem = { id: string; serviceId: string; status: Status; title: Bi | null; customer: { id: string; name: string; phone: string }; assignee: { id: string; name: string } | null; createdAt: number; updatedAt: number; work?: { waitingOn: 'customer' | 'staff' | 'authority' | 'none'; next: { ar: string; en: string }; followUpAt: number | null; overdue: boolean } }
export type FileRow = { id: string; name: string; mime: string; size: number; kind: 'source' | 'final' | 'invoice'; label: string | null; created_at: number; delivery_id: string | null; extracted: string | null }
export type DeliveryRow = { id: string; version: number | null; status: 'draft' | 'published' | 'superseded'; published_at: number | null; created_at: number; acknowledged_at: number | null }
export type CheckRow = { id: string; file_id: string; rule_code: string; rule_version: string; outcome: 'pass' | 'fail' | 'manual_review'; evidence: string; created_at: number; superseded_at: number | null; override_reason: string | null; overridden_at: number | null }
export type EventRow = { id: string; actor: string; kind: string; text_ar: string; text_en: string; visible: number; created_at: number }
export type MissingRow = { id: string; label_ar: string; label_en: string; note_ar: string; note_en: string; replacement_file_id: string | null; resolved_at: number | null }
export type WorkInfo = { waitingOn: 'customer' | 'staff' | 'authority' | 'none'; next: { code: string; ar: string; en: string; role: string }; followUpAt: number | null; overdue: boolean; payment: { company: string; government: string }; delivery: { state: string; version: number }; openProblem: boolean }
export type LogRow = { id: string; from_status: string | null; to_status: string; actor_kind: string; actor_name: string | null; at: number; reason: string | null; internal_note: string | null; reference: string | null }
export type SubmissionRow = { id: string; number: number; reference: string; submitted_at: number; state: 'active' | 'returned' | 'decided'; returned_reason: string | null }
export type ProblemRow = { id: string; delivery_version: number; text: string; status: 'open' | 'resolved'; created_at: number; resolution: string | null }
export type Detail = {
  work: WorkInfo; log: LogRow[]; submissions: SubmissionRow[]; problems: ProblemRow[]
  request: { id: string; serviceId: string; status: Status; assigneeId: string | null; createdAt: number; updatedAt: number; version: number; deliveryVersion: number; acknowledgedVersion: number; acknowledgedAt: number | null; data: { title?: Bi; name?: string; phone?: string; fields?: Record<string, string>; termsVersion?: string; termsAcceptedAt?: string }; staff: { expectedAt?: string; completedAt?: string; issue?: string; authorityRef?: string; authorityAt?: string } }
  customer: { id: string; name: string; phone: string; email?: string | null; emailVerified?: boolean }; files: FileRow[]; deliveries: DeliveryRow[]; checks: CheckRow[]; blocked: { fileId: string; ruleCode: string; outcome: string }[]; events: EventRow[]; missing: MissingRow[]; transitions: Status[]
}
export type TeamRow = { id: string; name: string; role: Role; active: number; created_at: number }
export type Overview = {
  newToday: number; completedToday: number; open: number
  attention: { id: string; status: Status; title: Bi | null; customer: string; waitingHours: number }[]
  workload: { id: string; name: string; n: number }[]
  activity: { id: string; requestId: string; actor: string; kind: string; text_ar: string; text_en: string; internal: boolean; at: number; title: Bi | null; customer: string }[]
}
export type CustomerRow = { id: string; name: string; phone: string; joinedAt: number; requests: number; open: number; lastAt: number | null }
export type CustomerDetail = { customer: { id: string; name: string; phone: string; language: string; joinedAt: number }; requests: { id: string; status: Status; title: Bi | null; createdAt: number; updatedAt: number }[]; consents: { type: string; version: string; accepted: number; created_at: number }[] }
/** issued = sent to the customer and waiting for their approval; the invoice exists only once they accept (accepted). */
export type FinQuote = { id: string; version: number; status: 'draft' | 'issued' | 'accepted' | 'superseded'; number: string | null; invoiceNumber: string | null; total_fils: number; items: { kind: string; description_ar: string; description_en: string; amount_fils: number }[]; accepted_at: number | null; declined_at: number | null; decline_reason: string | null }
export type FinPayment = { id: string; kind: 'payment' | 'refund'; amount_fils: number; method: string; reference: string | null; status: 'pending_verification' | 'approved' | 'rejected'; created_by_kind: string; created_at: number; decision_note: string | null; reason: string | null; proof_file_id: string | null }
export type FinDoc = { id: string; doc_type: 'quote' | 'invoice' | 'receipt' | 'credit_note'; number: string; status: 'issued' | 'void'; void_reason: string | null; total_fils: number; created_at: number }
export type AuthPay = { id: string; amount_fils: number; reference: string; status: 'reported' | 'verified' | 'rejected'; reported_by_kind: string; created_at: number; note: string | null; proof_file_id: string | null }
export type RefundReq = { id: string; amount_fils: number; resolution: 'to_customer' | 'to_credit'; reason: string; status: 'requested' | 'approved' | 'rejected' | 'executed'; requested_by: string; requested_at: number; execution_ref: string | null }
export type Finance = { credit: { received: number; allocated: number; refundedOut: number; unallocated: number }; refundRequests: RefundReq[]; gov: { total: number; payUrl: string | null; verified: number; reported: number; remaining: number; state: string }; authorityPayments: AuthPay[]; quotes: FinQuote[]; payments: FinPayment[]; documents: FinDoc[]; totals: { total: number; paid: number; refunded: number; net: number; pending: number; remaining: number; state: string; invoice: { id: string; number: string } | null }; tax: { configured: boolean }; test: boolean }
export type QueuePayment = { id: string; requestId: string; amount_fils: number; method: string; reference: string | null; createdBy: string; createdAt: number; hasProof: boolean; title: Bi | null; customer: string }
export type QuoteLine = { kind: 'government_fee' | 'service_fee'; descriptionAr: string; descriptionEn: string; amountFils: number }
export type WaStart = { challengeId: string; pollToken: string; code: string; link: string; expiresIn: number }

export const api = {
  waStart: async (phone: string) => j<WaStart>(await call('POST', '/staff/v1/auth/wa/start', { auth: false, body: { phone } })),
  async waPoll(phone: string, c: WaStart): Promise<'pending' | 'expired' | 'verified'> {
    const r = await j<{ status: 'pending' | 'expired' | 'verified'; accessToken?: string; refreshToken?: string }>(
      await call('POST', '/staff/v1/auth/wa/poll', { auth: false, body: { phone, challengeId: c.challengeId, pollToken: c.pollToken } }))
    if (r.status === 'verified' && r.accessToken && r.refreshToken) store(r.accessToken, r.refreshToken)
    return r.status
  },
  async totpLogin(phone: string, code: string) {
    const r = await j<{ accessToken: string; refreshToken: string }>(await call('POST', '/staff/v1/auth/totp', { auth: false, body: { phone, code } }))
    store(r.accessToken, r.refreshToken)
  },
  setupStart: async (phone: string, setupKey: string) => j<{ secret: string; uri: string }>(await call('POST', '/staff/v1/auth/setup/start', { auth: false, body: { phone, setupKey } })),
  async setupConfirm(phone: string, code: string) {
    const r = await j<{ accessToken: string; refreshToken: string }>(await call('POST', '/staff/v1/auth/setup/confirm', { auth: false, body: { phone, code } }))
    store(r.accessToken, r.refreshToken)
  },
  passkeysSupported: () => browserSupportsWebAuthn(),
  async passkeyLogin() {
    const o = await j<{ challengeId: string; options: Parameters<typeof startAuthentication>[0]['optionsJSON'] }>(await call('POST', '/staff/v1/auth/passkey/options', { auth: false, body: {} }))
    const response = await startAuthentication({ optionsJSON: o.options })
    const r = await j<{ accessToken: string; refreshToken: string }>(await call('POST', '/staff/v1/auth/passkey/verify', { auth: false, body: { challengeId: o.challengeId, response } }))
    store(r.accessToken, r.refreshToken)
  },
  async passkeyRegister(deviceName: string) {
    const o = await j<{ challengeId: string; options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>(await call('POST', '/staff/v1/passkeys/register/options', { body: {} }))
    const response = await startRegistration({ optionsJSON: o.options })
    await call('POST', '/staff/v1/passkeys/register/verify', { body: { challengeId: o.challengeId, response, deviceName } })
  },
  passkeys: async () => (await j<{ passkeys: { id: string; device_name: string; created_at: number; last_used_at: number | null }[] }>(await call('GET', '/staff/v1/passkeys'))).passkeys,
  removePasskey: (id: string) => call('DELETE', `/staff/v1/passkeys/${id}`),
  methods: async () => j<{ passkey: boolean; authenticator: boolean; whatsappMessage: boolean; whatsappCode: boolean }>(await call('GET', '/staff/v1/auth/methods', { auth: false })),
  otpRequest: async (phone: string, language: 'ar' | 'en') => j<{ challengeId: string; expiresIn: number }>(await call('POST', '/staff/v1/auth/otp/request', { auth: false, body: { phone, language } })),
  async otpVerify(phone: string, challengeId: string, code: string) {
    const r = await j<{ accessToken: string; refreshToken: string }>(await call('POST', '/staff/v1/auth/otp/verify', { auth: false, body: { phone, challengeId, code } }))
    store(r.accessToken, r.refreshToken)
  },
  me: async () => j<{ staff: { id: string; name: string; role: Role } }>(await call('GET', '/staff/v1/me')),
  logout: async () => { try { await call('POST', '/staff/v1/auth/logout') } catch { /* */ } signOutLocal() },
  stats: async () => j<Stats>(await call('GET', '/staff/v1/stats')),
  requests: async (q: { status?: string; assignee?: string; q?: string; limit?: number }) => {
    const p = new URLSearchParams(); for (const [k, v] of Object.entries(q)) if (v) p.set(k, String(v))
    return (await j<{ requests: ListItem[] }>(await call('GET', '/staff/v1/requests?' + p))).requests
  },
  overview: async () => j<Overview>(await call('GET', '/staff/v1/overview')),
  customers: async (q: string) => (await j<{ customers: CustomerRow[] }>(await call('GET', '/staff/v1/customers?q=' + encodeURIComponent(q)))).customers,
  customer: async (id: string) => j<CustomerDetail>(await call('GET', `/staff/v1/customers/${id}`)),
  override: (id: string, body: { reason: string; status?: Status; expectedAt?: string; customerName?: string; expectedVersion?: number }) => call('POST', `/staff/v1/requests/${id}/override`, { body }),
  request: async (id: string) => j<Detail>(await call('GET', `/staff/v1/requests/${id}`)),
  assign: (id: string, staffId: string | null, expectedVersion?: number) => call('POST', `/staff/v1/requests/${id}/assign`, { body: { staffId, expectedVersion } }),
  setStatus: (id: string, status: Status, extra: { note?: string; expectedAt?: string; reason?: string; reference?: string; overrideReason?: string; expectedVersion?: number }) => call('POST', `/staff/v1/requests/${id}/status`, { body: { status, ...extra } }),
  /** `reason` is required by the server when the authority sent the request back (status authority/decision). */
  missing: (id: string, items: { labelAr: string; labelEn: string; noteAr?: string; noteEn?: string }[], expectedVersion?: number, reason?: string) => call('POST', `/staff/v1/requests/${id}/missing`, { body: { items, expectedVersion, reason } }),
  note: (id: string, text: string) => call('POST', `/staff/v1/requests/${id}/notes`, { body: { text } }),
  upload: (id: string, file: File, kind: 'final' | 'invoice', label: string) =>
    call('PUT', `/staff/v1/requests/${id}/files?kind=${kind}`, { raw: file, headers: { 'x-file-name': encodeURIComponent(file.name), 'x-file-label': encodeURIComponent(label) } }),
  publish: (id: string, expectedVersion?: number) => call('POST', `/staff/v1/requests/${id}/deliveries/publish`, { body: { expectedVersion } }),
  removeDraftFile: (fileId: string) => call('DELETE', `/staff/v1/files/${fileId}`),
  readPassport: (fileId: string, expiry: string) => call('POST', `/staff/v1/files/${fileId}/extracted`, { body: { docType: 'passport', expiry } }),
  manualCheck: (fileId: string, ruleCode: string, outcome: 'pass' | 'fail' | 'manual_review', note: string) => call('POST', `/staff/v1/files/${fileId}/checks`, { body: { ruleCode, outcome, note } }),
  overrideCheck: (fileId: string, checkId: string, reason: string) => call('POST', `/staff/v1/files/${fileId}/override`, { body: { checkId, reason } }),
  finance: async (id: string) => j<Finance>(await call('GET', `/staff/v1/requests/${id}/finance`)),
  draftQuote: (id: string, items: QuoteLine[], govPayUrl?: string) => call('POST', `/staff/v1/requests/${id}/quotes`, { body: { items, govPayUrl: govPayUrl ?? '' } }),
  fees: async () => j<{ placeholder: true; fees: { service_id: string; fee_fils: number; updated_at: number; is_placeholder: number }[] }>(await call('GET', '/staff/v1/fees')),
  setFee: (sid: string, feeFils: number | null) => call('PUT', `/staff/v1/fees/${sid}`, { body: { feeFils } }),
  setGovFee: (id: string, amountFils: number, url: string) => call('POST', `/staff/v1/requests/${id}/government-fee`, { body: { amountFils, url } }),
  setFollowUp: (id: string, date: string) => call('POST', `/staff/v1/requests/${id}/follow-up`, { body: { date } }),
  delay: (id: string, reason: string, expectedAt: string) => call('POST', `/staff/v1/requests/${id}/delay`, { body: { reason, expectedAt } }),
  resolveProblem: (pid: string, resolution: 'explained' | 'replaced' | 'refunded', note: string) => call('POST', `/staff/v1/problems/${pid}/resolve`, { body: { resolution, note } }),
  setPayLink: (qid: string, url: string) => call('PATCH', `/staff/v1/quotes/${qid}/pay-link`, { body: { url } }),
  verifyAuthority: (pid: string) => call('POST', `/staff/v1/authority-payments/${pid}/verify`, { body: {} }),
  rejectAuthority: (pid: string, reason: string) => call('POST', `/staff/v1/authority-payments/${pid}/reject`, { body: { reason } }),
  /** Sends the quote to the customer for approval (no invoice until they accept it in the app). */
  sendQuote: (qid: string) => call('POST', `/staff/v1/quotes/${qid}/issue`, { body: {} }),
  cancelInvoice: (docId: string, reason: string) => call('POST', `/staff/v1/invoices/${docId}/cancel`, { body: { reason } }),
  recordPayment: (id: string, body: { amountFils: number; method: string; reference?: string }) => call('POST', `/staff/v1/requests/${id}/payments`, { body }),
  approvePayment: (pid: string) => call('POST', `/staff/v1/payments/${pid}/approve`, { body: {} }),
  rejectPayment: (pid: string, reason: string) => call('POST', `/staff/v1/payments/${pid}/reject`, { body: { reason } }),
  requestRefund: (id: string, body: { amountFils: number; reason: string; resolution: 'to_customer' | 'to_credit'; paymentId?: string }) => call('POST', `/staff/v1/requests/${id}/refund-requests`, { body }),
  approveRefund: (rid: string) => call('POST', `/staff/v1/refund-requests/${rid}/approve`, { body: {} }),
  rejectRefund: (rid: string, reason: string) => call('POST', `/staff/v1/refund-requests/${rid}/reject`, { body: { reason } }),
  executeRefund: (rid: string, reference: string) => call('POST', `/staff/v1/refund-requests/${rid}/execute`, { body: { reference } }),
  cancellation: async (id: string) => j<{ companyFee: { invoiced: number; allocated: number; retainedPercent: number; earned: number; refundable: number }; governmentFee: { total: number; paidToAuthorityVerified: number }; policyApproved: boolean }>(await call('GET', `/staff/v1/requests/${id}/cancellation`)),
  reconciliation: async (date?: string) => j<Reconciliation>(await call('GET', `/staff/v1/finance/reconciliation${date ? `?date=${date}` : ''}`)),
  paymentQueue: async (status = 'pending_verification') => (await j<{ payments: QueuePayment[] }>(await call('GET', `/staff/v1/payments?status=${status}`))).payments,
  docBlob: async (docId: string) => (await call('GET', `/staff/v1/documents/${docId}`)).blob(),
  proofBlob: async (pid: string) => (await call('GET', `/staff/v1/payments/${pid}/proof`)).blob(),
  fileBlob: async (id: string) => (await call('GET', `/staff/v1/files/${id}`)).blob(),
  team: async () => (await j<{ team: TeamRow[] }>(await call('GET', '/staff/v1/team'))).team,
  addMember: async (phone: string, name: string, role: Role) => j<{ id: string; enrollKey: string; enrollExpiresInHours: number }>(await call('POST', '/staff/v1/team', { body: { phone, name, role } })),
  setMember: (id: string, patch: { role?: Role; active?: boolean }) => call('PATCH', `/staff/v1/team/${id}`, { body: patch }),
}

export type Reconciliation = { date: string; totals: { received: number; allocated: number; unallocated: number; refundsPaidOut: number; pendingOver24h: number }; payments: { id: string; requestId: string; amount_fils: number; method: string; reference: string | null; hasProof: boolean; receiptId: string | null; allocated: number; unallocated: number }[]; flags: { type: string; paymentId?: string; detail?: string }[] }
