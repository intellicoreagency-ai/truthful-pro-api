import type { Env } from './types'
import { enqueueInvoiceEmail } from './mail'
import { LOGO_DATA_URI } from './logo'
import { sha256Hex } from './crypto'

// Money: integer fils (1 AED = 100 fils). No floating point, no tax. Tax is NOT configured: it is never treated as zero.
export const MAX_FILS = 100_000_000
export type ItemKind = 'government_fee' | 'service_fee' // 'extra' no longer exists: the company only charges its own fee
export type Item = { kind: ItemKind; ar: string; en: string; amount: number }
export type DocType = 'quote' | 'invoice' | 'receipt' | 'credit_note'

export const isFils = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= MAX_FILS

/**
 * Validates staff-entered statement lines.
 * - service_fee: the company's own fee (the only thing the company collects) -> `total`
 * - government_fee: the official tariff, paid by the customer straight to the authority -> `gov` (information only)
 */
export function parseItems(raw: unknown): { items: Item[]; total: number; gov: number } | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 30) return null
  const items: Item[] = []
  let total = 0, gov = 0
  for (const r of raw as Record<string, unknown>[]) {
    const kind = r?.kind
    if (kind !== 'government_fee' && kind !== 'service_fee') return null
    const ar = typeof r.descriptionAr === 'string' ? r.descriptionAr.trim() : '', en = typeof r.descriptionEn === 'string' ? r.descriptionEn.trim() : ''
    const amount = r.amountFils
    if (!ar || !en || ar.length > 200 || en.length > 200) return null
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0 || amount > MAX_FILS) return null // zero is allowed for a free line, never negative
    if (kind === 'service_fee') total += amount; else gov += amount
    if (total > MAX_FILS || gov > MAX_FILS) return null
    items.push({ kind, ar, en, amount })
  }
  return { items, total, gov }
}

/** Official payment links: https only, no credentials, host must end with an allowed suffix (default `.gov.ae`; extend with GOV_PAY_HOSTS). */
export function parseGovUrl(env: Env, raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw !== 'string' || raw.length > 500) return undefined
  let u: URL
  try { u = new URL(raw.trim()) } catch { return undefined }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return undefined
  const suffixes = ['.gov.ae', ...(env.GOV_PAY_HOSTS ?? '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => x.startsWith('.'))]
  const host = u.hostname.toLowerCase()
  return suffixes.some((suf) => host.endsWith(suf)) ? u.toString() : undefined
}

export const fmtAed = (fils: number): string => {
  const neg = fils < 0; const a = Math.abs(fils)
  return `${neg ? '-' : ''}AED ${String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(a % 100).padStart(2, '0')}`
}

const CODE: Record<DocType, string> = { quote: 'QUO', invoice: 'INV', receipt: 'RCT', credit_note: 'CRN' }
export const dubaiYear = (ms: number) => new Date(ms + 4 * 3600_000).getUTCFullYear()

/**
 * Statements (to run inside ONE db.batch) that take the next server-side number and store the document.
 * The number is read after the counter increment in the same transaction, so numbers are unique and gap-free;
 * if the insert fails (e.g. a document for that event already exists) the whole batch rolls back, counter included.
 * Numbers carry a T- prefix: every document is a TEST copy.
 */
export async function documentStatements(env: Env, p: { id: string; requestId: string; type: DocType; relatedId: string | null; totalFils: number; snapshot: object; createdBy: string; now: number }) {
  const year = dubaiYear(p.now)
  // the establishment's details are frozen into the document as they were when it was issued
  const snap = JSON.stringify({ ...p.snapshot, company: { nameAr: env.COMPANY_NAME_AR ?? 'تروثفل لخدمات التخليص ذ.م.م', nameEn: env.COMPANY_NAME_EN ?? 'Truthful Clearance Services LLC', taxConfigured: false } })
  return [
    env.DB.prepare('INSERT OR IGNORE INTO doc_counters (doc_type,year,next) VALUES (?,?,0)').bind(p.type, year),
    env.DB.prepare('UPDATE doc_counters SET next=next+1 WHERE doc_type=? AND year=?').bind(p.type, year),
    env.DB.prepare(
      "INSERT INTO fin_documents (id,request_id,doc_type,number,related_id,total_fils,snapshot,snapshot_hash,created_by,created_at) VALUES (?,?,?,printf('T-%s-%d-%06d',?,?,(SELECT next FROM doc_counters WHERE doc_type=? AND year=?)),?,?,?,?,?,?)"
    ).bind(p.id, p.requestId, p.type, CODE[p.type], year, p.type, year, p.relatedId, p.totalFils, snap, await sha256Hex(snap), p.createdBy, p.now),
  ]
}

export type Totals = { invoice: { id: string; number: string; total: number } | null; total: number; paid: number; refunded: number; net: number; pending: number; remaining: number; state: 'unpriced' | 'awaiting_payment' | 'partial' | 'paid' | 'refunded' }
/** Everything here is computed from the ledger (allocations) and the refund records; no stored "paid" figure exists to be edited. */
export async function totalsFor(env: Env, requestId: string): Promise<Totals> {
  const inv = await env.DB.prepare("SELECT id,number,total_fils FROM fin_documents WHERE request_id=? AND doc_type='invoice' AND status='issued'").bind(requestId).first<{ id: string; number: string; total_fils: number }>()
  if (!inv) return { invoice: null, total: 0, paid: 0, refunded: 0, net: 0, pending: 0, remaining: 0, state: 'unpriced' }
  const a = await env.DB.prepare(
    `SELECT COALESCE((SELECT SUM(CASE WHEN amount_fils>0 THEN amount_fils END) FROM allocations WHERE invoice_id=?1),0) gross,
            COALESCE((SELECT SUM(amount_fils) FROM allocations WHERE invoice_id=?1),0) net,
            COALESCE((SELECT SUM(amount_fils) FROM refund_requests WHERE invoice_id=?1 AND status='executed'),0) refunded,
            COALESCE((SELECT SUM(amount_fils) FROM payments WHERE request_id=?2 AND kind='payment' AND status='pending_verification'),0) pending`
  ).bind(inv.id, requestId).first<{ gross: number; net: number; refunded: number; pending: number }>()
  const net = a?.net ?? 0, refunded = a?.refunded ?? 0, gross = a?.gross ?? 0
  const state = net <= 0 ? (gross > 0 ? 'refunded' : 'awaiting_payment') : net < inv.total_fils ? 'partial' : 'paid'
  return { invoice: { id: inv.id, number: inv.number, total: inv.total_fils }, total: inv.total_fils, paid: gross, refunded, net, pending: a?.pending ?? 0, remaining: inv.total_fils - net, state }
}

/** The customer's money position, from the ledger: approved payments received, minus what is allocated to invoices, minus refunds paid out. */
export async function creditFor(env: Env, userId: string): Promise<{ received: number; allocated: number; refundedOut: number; unallocated: number }> {
  const a = await env.DB.prepare(
    `SELECT COALESCE((SELECT SUM(p.amount_fils) FROM payments p JOIN requests r ON r.id=p.request_id WHERE r.user_id=?1 AND p.kind='payment' AND p.status='approved'),0) received,
            COALESCE((SELECT SUM(al.amount_fils) FROM allocations al JOIN requests r ON r.id=al.request_id WHERE r.user_id=?1),0) allocated,
            COALESCE((SELECT SUM(rr.amount_fils) FROM refund_requests rr JOIN requests r ON r.id=rr.request_id WHERE r.user_id=?1 AND rr.status='executed' AND rr.resolution='to_customer'),0) refundedOut`
  ).bind(userId).first<{ received: number; allocated: number; refundedOut: number }>()
  const received = a?.received ?? 0, allocated = a?.allocated ?? 0, refundedOut = a?.refundedOut ?? 0
  return { received, allocated, refundedOut, unallocated: received - allocated - refundedOut }
}

// ---------- rendering (self-contained HTML; every value is escaped) ----------
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const TITLES: Record<DocType, [string, string]> = {
  quote: ['عرض أتعاب وبيان الرسوم الحكومية', 'Fee quotation & official fees statement'], invoice: ['فاتورة (نسخة تجريبية)', 'Invoice (test copy)'],
  receipt: ['إيصال استلام دفعة', 'Payment receipt'], credit_note: ['إشعار دائن / استرداد', 'Credit note / refund'],
}
const KIND: Record<ItemKind, [string, string]> = { government_fee: ['رسوم حكومية', 'Government fee'], service_fee: ['أتعاب الشركة', 'Company fee'] }

export type DocRow = { doc_type: DocType; number: string; status: string; void_reason: string | null; created_at: number; total_fils: number; snapshot: string }
export function renderDocument(env: Env, row: DocRow): string {
  let s: any = {}; try { s = JSON.parse(row.snapshot) } catch { /* */ }
  const [tAr, tEn] = TITLES[row.doc_type]
  const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' }).format(new Date(row.created_at))
  const all = (s.lines ?? []) as { kind: ItemKind; ar: string; en: string; amount: number }[]
  const lines = all.filter((l) => l.kind === 'service_fee'), govLines = all.filter((l) => l.kind === 'government_fee')
  const govRows = govLines.map((l) => `<tr><td>${esc(l.ar)}<br><small dir="ltr">${esc(l.en)}</small></td><td class="n" dir="ltr">${esc(fmtAed(l.amount))}</td></tr>`).join('')
  const rows = lines.map((l) => `<tr><td>${esc(KIND[l.kind]?.[0])}<br><small>${esc(KIND[l.kind]?.[1])}</small></td><td>${esc(l.ar)}<br><small dir="ltr">${esc(l.en)}</small></td><td class="n" dir="ltr">${esc(fmtAed(l.amount))}</td></tr>`).join('')
  const t = s.totals ?? {}
  const trow = (ar: string, en: string, v: number | undefined, strong = false) => v === undefined ? '' : `<tr class="${strong ? 'strong' : ''}"><td colspan="2">${esc(ar)} · <span dir="ltr">${esc(en)}</span></td><td class="n" dir="ltr">${esc(fmtAed(v))}</td></tr>`
  const x = s.extra ?? {}
  const meta = [
    x.quoteNumber ? ['عرض السعر', 'Quotation', x.quoteNumber] : null, x.invoiceNumber ? ['الفاتورة', 'Invoice', x.invoiceNumber] : null,
    x.originalNumber ? ['المستند الأصلي', 'Original document', x.originalNumber] : null, x.paymentMethod ? ['طريقة الدفع', 'Method', x.paymentMethod] : null,
    x.paymentRef ? ['المرجع', 'Reference', x.paymentRef] : null, x.reason ? ['السبب', 'Reason', x.reason] : null,
  ].filter(Boolean) as string[][]
  const co = [s.company?.nameAr ?? env.COMPANY_NAME_AR ?? 'تروثفل لخدمات التخليص ذ.م.م', s.company?.nameEn ?? env.COMPANY_NAME_EN ?? 'Truthful Clearance Services LLC']
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(tEn)} ${esc(row.number)}</title><style>
body{font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif;background:#fff8ee;color:#3c281b;margin:0;padding:16px;line-height:1.6}
.page{max-width:780px;margin:0 auto;background:#fffdf8;border:1px solid #ead9bf;border-radius:14px;padding:22px;position:relative;overflow:hidden}
.wm{position:fixed;inset:0;display:grid;place-items:center;pointer-events:none;z-index:0}
.wm div{transform:rotate(-24deg);font-size:34px;font-weight:800;color:rgba(163,38,26,.13);text-align:center;border:4px solid rgba(163,38,26,.13);padding:10px 24px;border-radius:12px}
.page>*{position:relative;z-index:1}
header{display:flex;gap:14px;align-items:center;justify-content:space-between;border-bottom:2px solid #bc945b;padding-bottom:12px}
header img{width:64px;height:64px;border-radius:50%;border:2px solid #bc945b}
h1{font-size:22px;margin:0}small{color:#8a7355}
.banner{margin:12px 0;padding:8px 12px;background:#fbe6e3;color:#a3261a;border:1px solid #e5b8b0;border-radius:10px;font-weight:700;text-align:center}
table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:8px;border-bottom:1px solid #ead9bf;vertical-align:top}td.n{text-align:end;white-space:nowrap;font-variant-numeric:tabular-nums}
tr.strong td{font-weight:800;background:#fff0d6}.meta td{border:0;padding:2px 8px}.void{color:#a3261a;font-weight:800}
.tax{margin-top:10px;padding:8px 12px;background:#fff0d6;border-radius:10px;font-size:13px}
@media print{body{background:#fff}}
</style></head><body><div class="wm"><div>نسخة تجريبية — غير صالحة للاستخدام المالي<br><span dir="ltr">TEST COPY — NOT VALID FOR FINANCIAL USE</span></div></div><div class="page">
<header><div><h1>${esc(tAr)} <small dir="ltr">· ${esc(tEn)}</small></h1><div dir="ltr"><b>${esc(row.number)}</b> · ${esc(date)}</div>${row.status === 'void' ? `<div class="void">ملغى · VOID — ${esc(row.void_reason)}</div>` : ''}</div><img src="${LOGO_DATA_URI}" alt=""></header>
<div class="banner">نسخة تجريبية — غير صالحة للاستخدام المالي · <span dir="ltr">TEST COPY — NOT VALID FOR FINANCIAL USE</span></div>
<table class="meta"><tr><td>${esc(co[0])}<br><small dir="ltr">${esc(co[1])}</small><br><small>بيانات المنشأة (الرخصة، العنوان) غير معتمدة بعد · Company details not yet approved</small></td><td>العميل · Customer<br><b>${esc(s.customerName || '—')}</b><br><small>${esc(s.requestTitle?.ar ?? '')} · <span dir="ltr">${esc(s.requestTitle?.en ?? '')}</span></small><br><small dir="ltr">Request #${esc(s.requestRef ?? '')}</small></td></tr>${meta.map((m) => `<tr><td>${esc(m[0])} · <span dir="ltr">${esc(m[1])}</span></td><td dir="ltr">${esc(m[2])}</td></tr>`).join('')}</table>
${rows ? `<table><tr><td colspan="3"><b>أتعاب الشركة (هي وحدها المطلوبة منك للشركة) · <span dir="ltr">Company fees (the only amount payable to the Company)</span></b></td></tr><tr><td><b>النوع · Type</b></td><td><b>الوصف · Description</b></td><td class="n"><b>المبلغ · Amount</b></td></tr>${rows}</table>` : ''}
<table>${trow('الإجمالي', 'Total', t.total, true)}${trow('المدفوع', 'Paid', t.paid)}${trow('المسترد', 'Refunded', t.refunded)}${trow('المتبقي', 'Remaining', t.remaining, true)}${t.amount !== undefined ? trow('مبلغ هذا المستند', 'Amount of this document', t.amount, true) : ''}</table>
${govRows ? `<table><tr><td colspan="2"><b>الرسوم الحكومية حسب التعرفة الرسمية — تُدفع مباشرة إلى الجهة الحكومية ولا تُحصّلها الشركة ولا تدخل في هذا المستند · <span dir="ltr">Official government fees — paid by you directly to the authority; not collected by the Company and not included in this document</span></b></td></tr>${govRows}<tr class="strong"><td>الإجمالي الحكومي · Government total</td><td class="n" dir="ltr">${esc(fmtAed(s.govTotal ?? 0))}</td></tr></table>` : ''}
<div class="tax">الضريبة غير مهيأة في هذه المرحلة ولم تُحتسب، وهذا المستند ليس فاتورة ضريبية.<br><span dir="ltr">Tax is not configured and has not been calculated. This is not a tax invoice.</span></div>
</div></body></html>`
}

// ---------- payments: atomic, idempotent writes ----------
export type PayInput = { id: string; requestId: string; invoiceId: string; amount: number; method: 'bank_transfer' | 'cash' | 'other'; reference: string | null; proofFileId: string | null; clientKey: string | null; byKind: 'customer' | 'staff'; by: string; now: number }
/** Reporting a payment never touches any balance. An amount above the invoice is allowed: the excess becomes the customer's unallocated credit once approved. */
export async function insertPayment(env: Env, p: PayInput): Promise<{ ok: true } | { ok: false; error: 'invoice_not_active' | 'client_key_conflict' | 'reference_used' }> {
  try {
    const r = await env.DB.prepare(
      `INSERT INTO payments (id,request_id,invoice_id,kind,amount_fils,method,reference,proof_file_id,status,client_key,created_by_kind,created_by,created_at)
       SELECT ?,?,?,'payment',?,?,?,?,'pending_verification',?,?,?,?
       WHERE EXISTS (SELECT 1 FROM fin_documents WHERE id=? AND status='issued' AND request_id=?)`
    ).bind(p.id, p.requestId, p.invoiceId, p.amount, p.method, p.reference, p.proofFileId, p.clientKey, p.byKind, p.by, p.now, p.invoiceId, p.requestId).run()
    return r.meta.changes ? { ok: true } : { ok: false, error: 'invoice_not_active' }
  } catch (e) {
    const m = String((e as Error).message)
    if (m.includes('client_key')) return { ok: false, error: 'client_key_conflict' }
    if (m.includes('reference')) return { ok: false, error: 'reference_used' }
    throw e
  }
}

/** Approval = one transaction: the payment becomes approved AND is allocated to its invoice (up to what the invoice still needs); anything above stays as unallocated credit. */
export async function approvePayment(env: Env, paymentId: string, by: string, note: string | null, now: number): Promise<boolean> {
  const [r] = await env.DB.batch([
    env.DB.prepare("UPDATE payments SET status='approved', decided_by=?, decided_at=?, decision_note=? WHERE id=? AND kind='payment' AND status='pending_verification'").bind(by, now, note, paymentId),
    env.DB.prepare(
      `INSERT INTO allocations (id,payment_id,request_id,invoice_id,amount_fils,kind,reason,created_by,created_at)
       SELECT ?, p.id, p.request_id, p.invoice_id, MIN(p.amount_fils, d.total_fils - COALESCE((SELECT SUM(amount_fils) FROM allocations WHERE invoice_id=p.invoice_id),0)), 'allocate','auto', ?, ?
       FROM payments p JOIN fin_documents d ON d.id=p.invoice_id
       WHERE p.id=? AND p.status='approved' AND d.status='issued' AND NOT EXISTS (SELECT 1 FROM allocations WHERE payment_id=p.id)
         AND d.total_fils - COALESCE((SELECT SUM(amount_fils) FROM allocations WHERE invoice_id=p.invoice_id),0) > 0`
    ).bind(crypto.randomUUID(), by, now, paymentId),
  ])
  return r!.meta.changes > 0
}

/** Allocates part of an approved payment's unallocated balance to an invoice of the same customer. The database refuses double allocation. */
export async function allocateManually(env: Env, p: { paymentId: string; requestId: string; amount: number; reason: string; by: string; now: number }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const pay = await env.DB.prepare("SELECT p.id,p.amount_fils,r.user_id FROM payments p JOIN requests r ON r.id=p.request_id WHERE p.id=? AND p.kind='payment' AND p.status='approved'").bind(p.paymentId).first<{ id: string; amount_fils: number; user_id: string }>()
  const inv = await env.DB.prepare("SELECT d.id FROM fin_documents d JOIN requests r ON r.id=d.request_id WHERE d.request_id=? AND d.doc_type='invoice' AND d.status='issued' AND r.user_id=?").bind(p.requestId, pay?.user_id ?? '').first<{ id: string }>()
  if (!pay || !inv) return { ok: false, error: 'not_found' }
  const id = crypto.randomUUID()
  try {
    await env.DB.prepare("INSERT INTO allocations (id,payment_id,request_id,invoice_id,amount_fils,kind,reason,created_by,created_at) VALUES (?,?,?,?,?,'allocate',?,?,?)").bind(id, pay.id, p.requestId, inv.id, p.amount, p.reason, p.by, p.now).run()
    return { ok: true, id }
  } catch (e) { return String((e as Error).message).includes('allocation exceeds') ? { ok: false, error: 'exceeds_available' } : (() => { throw e })() }
}

/** Reverses a ledger entry with a new, linked, negative entry (never an edit or delete). */
export async function reverseAllocation(env: Env, p: { allocationId: string; reason: string; by: string; now: number }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const a = await env.DB.prepare("SELECT id,payment_id,request_id,invoice_id,amount_fils,kind FROM allocations WHERE id=?").bind(p.allocationId).first<{ id: string; payment_id: string; request_id: string; invoice_id: string; amount_fils: number; kind: string }>()
  if (!a || a.amount_fils <= 0 || a.kind !== 'allocate') return { ok: false, error: 'not_reversible' }
  const id = crypto.randomUUID()
  try {
    await env.DB.prepare("INSERT INTO allocations (id,payment_id,request_id,invoice_id,amount_fils,kind,reverses_id,reason,created_by,created_at) VALUES (?,?,?,?,?,'reverse',?,?,?,?)").bind(id, a.payment_id, a.request_id, a.invoice_id, -a.amount_fils, a.id, p.reason, p.by, p.now).run()
    return { ok: true, id }
  } catch (e) { const m = String((e as Error).message); return m.includes('UNIQUE') || m.includes('allocation exceeds') ? { ok: false, error: 'already_reversed' } : (() => { throw e })() }
}

/** What can still be refunded for this invoice: net allocated minus open (requested/approved) refund requests. */
export async function refundable(env: Env, invoiceId: string): Promise<number> {
  const a = await env.DB.prepare("SELECT COALESCE((SELECT SUM(amount_fils) FROM allocations WHERE invoice_id=?1),0) - COALESCE((SELECT SUM(amount_fils) FROM refund_requests WHERE invoice_id=?1 AND status IN ('requested','approved')),0) v").bind(invoiceId).first<{ v: number }>()
  return Math.max(0, a?.v ?? 0)
}

// ---------- the customer's own payment to the authority (tracked; never part of the company's balance) ----------
export type GovState = 'none' | 'unpaid' | 'reported' | 'paid'
export async function govFor(env: Env, requestId: string) {
  // The government statement belongs to the quote the customer accepted when it was set; a later company-fee re-quote does not move it.
  const q0 = await env.DB.prepare("SELECT id,version,gov_fils,gov_pay_url,gov_beneficiary FROM quotes WHERE request_id=? AND accepted_at IS NOT NULL ORDER BY (gov_fils>0) DESC, version DESC LIMIT 1").bind(requestId).first<{ id: string; version: number; gov_fils: number; gov_pay_url: string | null; gov_beneficiary: string | null }>()
  const adj = q0 ? (await env.DB.prepare('SELECT COALESCE(SUM(delta_fils),0) d FROM gov_adjustments WHERE quote_id=?').bind(q0.id).first<{ d: number }>())?.d ?? 0 : 0
  const q = q0 ? { ...q0, expected: q0.gov_fils, adjustments: adj, gov_fils: q0.gov_fils + adj } : null
  if (!q || q.gov_fils <= 0) return { quoteId: q?.id ?? null, beneficiary: null as string | null, expected: 0, adjustments: 0, total: 0, payUrl: null as string | null, verified: 0, reported: 0, remaining: 0, state: 'none' as GovState }
  const a = await env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN status='verified' THEN amount_fils END),0) v, COALESCE(SUM(CASE WHEN status='reported' THEN amount_fils END),0) r FROM authority_payments WHERE quote_id=?").bind(q.id).first<{ v: number; r: number }>()
  const v = a?.v ?? 0, r = a?.r ?? 0
  return { quoteId: q.id, beneficiary: q.gov_beneficiary, expected: q.expected, adjustments: q.adjustments, total: q.gov_fils, payUrl: q.gov_pay_url, verified: v, reported: r, remaining: Math.max(0, q.gov_fils - v - r), state: (v >= q.gov_fils ? 'paid' : v + r > 0 ? 'reported' : 'unpaid') as GovState }
}

/** Registers a payment made to the authority. It cannot exceed the official total of the live statement together with what is already registered. */
export async function insertAuthorityPayment(env: Env, p: { id: string; requestId: string; quoteId: string; amount: number; reference: string; proofFileId: string | null; clientKey: string | null; byKind: 'customer' | 'staff'; by: string; now: number }): Promise<{ ok: true } | { ok: false; error: 'exceeds_government_total' | 'client_key_conflict' | 'reference_used' }> {
  try {
    const r = await env.DB.prepare(
      `INSERT INTO authority_payments (id,request_id,quote_id,amount_fils,reference,proof_file_id,status,client_key,reported_by_kind,reported_by,created_at)
       SELECT ?,?,?,?,?,?,'reported',?,?,?,?
       WHERE EXISTS (SELECT 1 FROM quotes WHERE id=? AND request_id=? AND accepted_at IS NOT NULL AND gov_fils>0)
         AND ? <= (SELECT gov_fils FROM quotes WHERE id=?) + COALESCE((SELECT SUM(delta_fils) FROM gov_adjustments WHERE quote_id=?),0) - COALESCE((SELECT SUM(amount_fils) FROM authority_payments WHERE quote_id=? AND status IN ('reported','verified')),0)`
    ).bind(p.id, p.requestId, p.quoteId, p.amount, p.reference, p.proofFileId, p.clientKey, p.byKind, p.by, p.now, p.quoteId, p.requestId, p.amount, p.quoteId, p.quoteId, p.quoteId).run()
    return r.meta.changes ? { ok: true } : { ok: false, error: 'exceeds_government_total' }
  } catch (e) {
    const m = String((e as Error).message)
    if (m.includes('client_key')) return { ok: false, error: 'client_key_conflict' }
    if (m.includes('reference')) return { ok: false, error: 'reference_used' }
    throw e
  }
}

/**
 * The customer accepts the quote that is waiting for them. ONE transaction:
 *   the quote becomes 'accepted' (any earlier accepted version is superseded) and the invoice is issued from exactly its lines.
 *   If an earlier invoice is active (a re-quote), it is voided with a credit note and the money already allocated to it is carried
 *   to the new invoice (reverse + allocate ledger entries); anything above the new total stays as the customer's unallocated credit.
 * Idempotent: accepting an already-accepted quote returns its invoice. Refused while payments wait for verification or a refund is open.
 */
export type AcceptResult = { ok: true; invoiceId: string; replay: boolean } | { ok: false; error: 'not_found' | 'not_pending' | 'stale_quote' | 'pending_payments' | 'open_refund' | 'conflict' }
export async function acceptQuote(env: Env, p: { requestId: string; quoteId: string; version: unknown; userId: string; now: number }): Promise<AcceptResult> {
  const q = await env.DB.prepare('SELECT q.id,q.version,q.status,q.total_fils,q.gov_fils,q.document_id FROM quotes q JOIN requests r ON r.id=q.request_id WHERE q.id=? AND q.request_id=? AND r.user_id=? AND r.deleted_at IS NULL')
    .bind(p.quoteId, p.requestId, p.userId).first<{ id: string; version: number; status: string; total_fils: number; gov_fils: number; document_id: string | null }>()
  if (!q) return { ok: false, error: 'not_found' }
  if (q.status === 'accepted' && q.document_id) return { ok: true, invoiceId: q.document_id, replay: true }
  if (q.status !== 'issued') return { ok: false, error: 'not_pending' }
  if (p.version !== q.version) return { ok: false, error: 'stale_quote' } // the customer approves the exact version they were shown
  const r = await env.DB.prepare("SELECT r.id,r.data,u.display_name FROM requests r JOIN users u ON u.id=r.user_id WHERE r.id=?").bind(p.requestId).first<{ id: string; data: string; display_name: string | null }>()
  const old = await env.DB.prepare("SELECT id,number,total_fils FROM fin_documents WHERE request_id=? AND doc_type='invoice' AND status='issued'").bind(p.requestId).first<{ id: string; number: string; total_fils: number }>()
  if (old) {
    const busy = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM payments WHERE invoice_id=?1 AND kind='payment' AND status='pending_verification') pend, (SELECT COUNT(*) FROM refund_requests WHERE invoice_id=?1 AND status IN ('requested','approved')) refunds").bind(old.id).first<{ pend: number; refunds: number }>()
    if ((busy?.pend ?? 0) > 0) return { ok: false, error: 'pending_payments' }
    if ((busy?.refunds ?? 0) > 0) return { ok: false, error: 'open_refund' }
  }
  const items = (await env.DB.prepare('SELECT kind,description_ar,description_en,amount_fils FROM quote_items WHERE quote_id=? ORDER BY position').bind(q.id).all<{ kind: string; description_ar: string; description_en: string; amount_fils: number }>()).results
  let d: any = {}; try { d = JSON.parse(r?.data ?? '{}') } catch { /* */ }
  const meta = { customerName: d.name || r?.display_name || '', requestTitle: d.title ?? null, requestRef: p.requestId.slice(0, 8) }
  const now = p.now, invId = crypto.randomUUID()
  const carried = old ? (await env.DB.prepare('SELECT payment_id, SUM(amount_fils) net FROM allocations WHERE invoice_id=? GROUP BY payment_id HAVING SUM(amount_fils)>0 ORDER BY MIN(created_at)').bind(old.id).all<{ payment_id: string; net: number }>()).results : []
  const paidBefore = carried.reduce((a, x) => a + x.net, 0)
  const snapshot = { ...meta, lines: items.map((i) => ({ kind: i.kind, ar: i.description_ar, en: i.description_en, amount: i.amount_fils })), totals: { total: q.total_fils, paid: Math.min(paidBefore, q.total_fils), refunded: 0, remaining: Math.max(0, q.total_fils - paidBefore) }, govTotal: q.gov_fils, extra: { version: q.version, acceptedByCustomer: true, ...(old ? { originalNumber: old.number } : {}) } }
  const stmts = [
    env.DB.prepare("UPDATE quotes SET status='superseded' WHERE request_id=? AND status='accepted'").bind(p.requestId),
    env.DB.prepare("UPDATE quotes SET status='accepted', accepted_at=?, accepted_by=?, document_id=? WHERE id=? AND status='issued'").bind(now, p.userId, invId, q.id),
    // guard: if the quote was not accepted by THIS statement (declined or accepted concurrently), insert a NULL into a NOT NULL column so the whole batch rolls back
    env.DB.prepare("INSERT INTO doc_counters (doc_type,year,next) SELECT 'guard',0,NULL WHERE NOT EXISTS (SELECT 1 FROM quotes WHERE id=? AND document_id=?)").bind(q.id, invId),
  ]
  if (old) {
    const reason = `Replaced by quotation version ${q.version}, accepted by the customer`
    stmts.push(env.DB.prepare("UPDATE fin_documents SET status='void', void_reason=?, voided_at=?, voided_by=? WHERE id=? AND status='issued'").bind(reason, now, p.userId, old.id))
    stmts.push(...(await documentStatements(env, { id: crypto.randomUUID(), requestId: p.requestId, type: 'credit_note', relatedId: old.id, totalFils: old.total_fils, snapshot: { ...meta, lines: [], totals: {}, extra: { originalNumber: old.number, reason } }, createdBy: p.userId, now })))
  }
  stmts.push(...(await documentStatements(env, { id: invId, requestId: p.requestId, type: 'invoice', relatedId: q.id, totalFils: q.total_fils, snapshot, createdBy: p.userId, now })))
  let room = q.total_fils
  for (const a of carried) {
    stmts.push(env.DB.prepare("INSERT INTO allocations (id,payment_id,request_id,invoice_id,amount_fils,kind,reason,created_by,created_at) VALUES (?,?,?,?,?,'reverse','moved to the new invoice',?,?)").bind(crypto.randomUUID(), a.payment_id, p.requestId, old!.id, -a.net, p.userId, now))
    const take = Math.min(a.net, room)
    if (take > 0) { stmts.push(env.DB.prepare("INSERT INTO allocations (id,payment_id,request_id,invoice_id,amount_fils,kind,reason,created_by,created_at) VALUES (?,?,?,?,?,'allocate','carried over from the replaced invoice',?,?)").bind(crypto.randomUUID(), a.payment_id, p.requestId, invId, take, p.userId, now)); room -= take }
  }
  stmts.push(env.DB.prepare("INSERT INTO request_events (id,request_id,actor,kind,text_ar,text_en,visible,created_at) VALUES (?,?,'customer','status',?,?,1,?)").bind(crypto.randomUUID(), p.requestId, `وافق العميل على عرض السعر (الإصدار ${q.version}) وصدرت الفاتورة (نسخة تجريبية)`, `The customer accepted the quotation (version ${q.version}); the invoice was issued (test copy)`, now))
  try { await env.DB.batch(stmts) } catch {
    const again = await env.DB.prepare("SELECT status,document_id FROM quotes WHERE id=?").bind(q.id).first<{ status: string; document_id: string | null }>()
    return again?.status === 'accepted' && again.document_id ? { ok: true, invoiceId: again.document_id, replay: true } : { ok: false, error: 'conflict' }
  }
  await enqueueInvoiceEmail(env, p.userId, invId).catch(() => null) // emailed once the customer's address is confirmed
  return { ok: true, invoiceId: invId, replay: false }
}

/** The customer declines the quote waiting for them, with an optional reason. The team can then send a new version. */
export async function declineQuote(env: Env, p: { requestId: string; quoteId: string; userId: string; reason: string | null; now: number }): Promise<{ ok: true; replay: boolean } | { ok: false; error: 'not_found' | 'not_pending' }> {
  const q = await env.DB.prepare('SELECT q.id,q.version,q.status,q.declined_at FROM quotes q JOIN requests r ON r.id=q.request_id WHERE q.id=? AND q.request_id=? AND r.user_id=? AND r.deleted_at IS NULL').bind(p.quoteId, p.requestId, p.userId).first<{ id: string; version: number; status: string; declined_at: number | null }>()
  if (!q) return { ok: false, error: 'not_found' }
  if (q.declined_at) return { ok: true, replay: true }
  if (q.status !== 'issued') return { ok: false, error: 'not_pending' }
  const [u] = await env.DB.batch([
    env.DB.prepare("UPDATE quotes SET status='superseded', declined_at=?, decline_reason=? WHERE id=? AND status='issued'").bind(p.now, p.reason, q.id),
    env.DB.prepare("INSERT INTO request_events (id,request_id,actor,kind,text_ar,text_en,visible,created_at) VALUES (?,?,'customer','status',?,?,1,?)").bind(crypto.randomUUID(), p.requestId, `اعتذر العميل عن عرض السعر (الإصدار ${q.version})`, `The customer declined the quotation (version ${q.version})`, p.now),
  ])
  return u!.meta.changes ? { ok: true, replay: false } : { ok: false, error: 'not_pending' }
}
