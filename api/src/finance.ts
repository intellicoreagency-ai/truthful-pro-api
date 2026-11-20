import type { Env } from './types'
import { LOGO_DATA_URI } from './logo'
import { sha256Hex } from './crypto'

// Money: integer fils (1 AED = 100 fils). No floating point, no tax. Tax is NOT configured: it is never treated as zero.
export const MAX_FILS = 100_000_000
export type ItemKind = 'government_fee' | 'service_fee' | 'extra'
export type Item = { kind: ItemKind; ar: string; en: string; amount: number }
export type DocType = 'quote' | 'invoice' | 'receipt' | 'credit_note'

export const isFils = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= MAX_FILS

/** Validates staff-entered quote lines. Returns null when anything is off. */
export function parseItems(raw: unknown): { items: Item[]; total: number } | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 30) return null
  const items: Item[] = []
  let total = 0
  for (const r of raw as Record<string, unknown>[]) {
    const kind = r?.kind
    if (kind !== 'government_fee' && kind !== 'service_fee' && kind !== 'extra') return null
    const ar = typeof r.descriptionAr === 'string' ? r.descriptionAr.trim() : '', en = typeof r.descriptionEn === 'string' ? r.descriptionEn.trim() : ''
    const amount = r.amountFils
    if (!ar || !en || ar.length > 200 || en.length > 200) return null
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0 || amount > MAX_FILS) return null // zero is allowed for a free line, never negative
    total += amount
    if (total > MAX_FILS) return null
    items.push({ kind, ar, en, amount })
  }
  return { items, total }
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
  const year = dubaiYear(p.now), snap = JSON.stringify(p.snapshot)
  return [
    env.DB.prepare('INSERT OR IGNORE INTO doc_counters (doc_type,year,next) VALUES (?,?,0)').bind(p.type, year),
    env.DB.prepare('UPDATE doc_counters SET next=next+1 WHERE doc_type=? AND year=?').bind(p.type, year),
    env.DB.prepare(
      "INSERT INTO fin_documents (id,request_id,doc_type,number,related_id,total_fils,snapshot,snapshot_hash,created_by,created_at) VALUES (?,?,?,printf('T-%s-%d-%06d',?,?,(SELECT next FROM doc_counters WHERE doc_type=? AND year=?)),?,?,?,?,?,?)"
    ).bind(p.id, p.requestId, p.type, CODE[p.type], year, p.type, year, p.relatedId, p.totalFils, snap, await sha256Hex(snap), p.createdBy, p.now),
  ]
}

export type Totals = { invoice: { id: string; number: string; total: number } | null; total: number; paid: number; refunded: number; net: number; pending: number; remaining: number; state: 'unpriced' | 'awaiting_payment' | 'partial' | 'paid' | 'refunded' }
export async function totalsFor(env: Env, requestId: string): Promise<Totals> {
  const inv = await env.DB.prepare("SELECT id,number,total_fils FROM fin_documents WHERE request_id=? AND doc_type='invoice' AND status='issued'").bind(requestId).first<{ id: string; number: string; total_fils: number }>()
  if (!inv) return { invoice: null, total: 0, paid: 0, refunded: 0, net: 0, pending: 0, remaining: 0, state: 'unpriced' }
  const a = await env.DB.prepare(
    "SELECT COALESCE(SUM(CASE WHEN kind='payment' AND status='approved' THEN amount_fils END),0) paid, COALESCE(SUM(CASE WHEN kind='refund' AND status='approved' THEN amount_fils END),0) refunded, COALESCE(SUM(CASE WHEN kind='payment' AND status='pending_verification' THEN amount_fils END),0) pending FROM payments WHERE invoice_id=?"
  ).bind(inv.id).first<{ paid: number; refunded: number; pending: number }>()
  const paid = a?.paid ?? 0, refunded = a?.refunded ?? 0, net = paid - refunded
  const state = net <= 0 ? (refunded > 0 ? 'refunded' : 'awaiting_payment') : net < inv.total_fils ? 'partial' : 'paid'
  return { invoice: { id: inv.id, number: inv.number, total: inv.total_fils }, total: inv.total_fils, paid, refunded, net, pending: a?.pending ?? 0, remaining: inv.total_fils - net, state }
}

// ---------- rendering (self-contained HTML; every value is escaped) ----------
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const TITLES: Record<DocType, [string, string]> = {
  quote: ['عرض سعر', 'Quotation'], invoice: ['فاتورة (نسخة تجريبية)', 'Invoice (test copy)'],
  receipt: ['إيصال استلام دفعة', 'Payment receipt'], credit_note: ['إشعار دائن / استرداد', 'Credit note / refund'],
}
const KIND: Record<ItemKind, [string, string]> = { government_fee: ['رسوم حكومية', 'Government fee'], service_fee: ['أتعاب الخدمة', 'Service fee'], extra: ['مصاريف إضافية', 'Extra expense'] }

export type DocRow = { doc_type: DocType; number: string; status: string; void_reason: string | null; created_at: number; total_fils: number; snapshot: string }
export function renderDocument(env: Env, row: DocRow): string {
  let s: any = {}; try { s = JSON.parse(row.snapshot) } catch { /* */ }
  const [tAr, tEn] = TITLES[row.doc_type]
  const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' }).format(new Date(row.created_at))
  const lines = (s.lines ?? []) as { kind: ItemKind; ar: string; en: string; amount: number }[]
  const rows = lines.map((l) => `<tr><td>${esc(KIND[l.kind]?.[0])}<br><small>${esc(KIND[l.kind]?.[1])}</small></td><td>${esc(l.ar)}<br><small dir="ltr">${esc(l.en)}</small></td><td class="n" dir="ltr">${esc(fmtAed(l.amount))}</td></tr>`).join('')
  const t = s.totals ?? {}
  const trow = (ar: string, en: string, v: number | undefined, strong = false) => v === undefined ? '' : `<tr class="${strong ? 'strong' : ''}"><td colspan="2">${esc(ar)} · <span dir="ltr">${esc(en)}</span></td><td class="n" dir="ltr">${esc(fmtAed(v))}</td></tr>`
  const x = s.extra ?? {}
  const meta = [
    x.quoteNumber ? ['عرض السعر', 'Quotation', x.quoteNumber] : null, x.invoiceNumber ? ['الفاتورة', 'Invoice', x.invoiceNumber] : null,
    x.originalNumber ? ['المستند الأصلي', 'Original document', x.originalNumber] : null, x.paymentMethod ? ['طريقة الدفع', 'Method', x.paymentMethod] : null,
    x.paymentRef ? ['المرجع', 'Reference', x.paymentRef] : null, x.reason ? ['السبب', 'Reason', x.reason] : null,
  ].filter(Boolean) as string[][]
  const co = [env.COMPANY_NAME_AR ?? 'تروثفل لخدمات التخليص ذ.م.م', env.COMPANY_NAME_EN ?? 'Truthful Clearance Services LLC']
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
${rows ? `<table><tr><td><b>النوع · Type</b></td><td><b>الوصف · Description</b></td><td class="n"><b>المبلغ · Amount</b></td></tr>${rows}</table>` : ''}
<table>${trow('الإجمالي', 'Total', t.total, true)}${trow('المدفوع', 'Paid', t.paid)}${trow('المسترد', 'Refunded', t.refunded)}${trow('المتبقي', 'Remaining', t.remaining, true)}${t.amount !== undefined ? trow('مبلغ هذا المستند', 'Amount of this document', t.amount, true) : ''}</table>
<div class="tax">الضريبة غير مهيأة في هذه المرحلة ولم تُحتسب، وهذا المستند ليس فاتورة ضريبية.<br><span dir="ltr">Tax is not configured and has not been calculated. This is not a tax invoice.</span></div>
</div></body></html>`
}

// ---------- payments: atomic, idempotent writes ----------
const NET_APPROVED = "COALESCE((SELECT SUM(CASE kind WHEN 'payment' THEN amount_fils ELSE -amount_fils END) FROM payments WHERE invoice_id=? AND status='approved'),0)"
const COMMITTED = "COALESCE((SELECT SUM(CASE kind WHEN 'payment' THEN amount_fils ELSE -amount_fils END) FROM payments WHERE invoice_id=? AND ((kind='payment' AND status IN ('approved','pending_verification')) OR (kind='refund' AND status='approved'))),0)"

export type PayInput = { id: string; requestId: string; invoiceId: string; amount: number; method: 'bank_transfer' | 'cash' | 'other'; reference: string | null; proofFileId: string | null; clientKey: string | null; byKind: 'customer' | 'staff'; by: string; now: number }
/** A payment is only accepted if, together with everything already approved or awaiting verification, it does not exceed the invoice. One statement, so two requests cannot both squeeze in. */
export async function insertPayment(env: Env, p: PayInput): Promise<{ ok: true } | { ok: false; error: 'exceeds_balance' | 'client_key_conflict' | 'reference_used' }> {
  try {
    const r = await env.DB.prepare(
      `INSERT INTO payments (id,request_id,invoice_id,kind,amount_fils,method,reference,proof_file_id,status,client_key,created_by_kind,created_by,created_at)
       SELECT ?,?,?,'payment',?,?,?,?,'pending_verification',?,?,?,?
       WHERE EXISTS (SELECT 1 FROM fin_documents WHERE id=? AND status='issued' AND request_id=?)
         AND ? <= (SELECT total_fils FROM fin_documents WHERE id=?) - ${COMMITTED}`
    ).bind(p.id, p.requestId, p.invoiceId, p.amount, p.method, p.reference, p.proofFileId, p.clientKey, p.byKind, p.by, p.now, p.invoiceId, p.requestId, p.amount, p.invoiceId, p.invoiceId).run()
    return r.meta.changes ? { ok: true } : { ok: false, error: 'exceeds_balance' }
  } catch (e) {
    const m = String((e as Error).message)
    if (m.includes('client_key')) return { ok: false, error: 'client_key_conflict' }
    if (m.includes('reference')) return { ok: false, error: 'reference_used' }
    throw e
  }
}

/** Approval is one conditional UPDATE: it succeeds only while the payment is pending AND still fits the invoice. */
export async function approvePayment(env: Env, paymentId: string, by: string, note: string | null, now: number): Promise<boolean> {
  const r = await env.DB.prepare(
    `UPDATE payments SET status='approved', decided_by=?, decided_at=?, decision_note=?
     WHERE id=? AND kind='payment' AND status='pending_verification'
       AND amount_fils <= (SELECT total_fils FROM fin_documents WHERE id=payments.invoice_id) - COALESCE((SELECT SUM(CASE kind WHEN 'payment' THEN amount_fils ELSE -amount_fils END) FROM payments p2 WHERE p2.invoice_id=payments.invoice_id AND p2.status='approved'),0)`
  ).bind(by, now, note, paymentId).run()
  return r.meta.changes > 0
}

/** A refund cannot exceed what is currently paid, nor what that specific payment received. */
export async function insertRefund(env: Env, p: { id: string; requestId: string; invoiceId: string; amount: number; reason: string; refundOf: string | null; by: string; now: number }): Promise<boolean> {
  const r = await env.DB.prepare(
    `INSERT INTO payments (id,request_id,invoice_id,kind,amount_fils,method,status,created_by_kind,created_by,created_at,decided_by,decided_at,reason,refund_of)
     SELECT ?,?,?,'refund',?,'other','approved','staff',?,?,?,?,?,?
     WHERE EXISTS (SELECT 1 FROM fin_documents WHERE id=? AND status='issued' AND request_id=?)
       AND ? <= ${NET_APPROVED}
       AND (? IS NULL OR ? <= COALESCE((SELECT amount_fils FROM payments WHERE id=? AND kind='payment' AND status='approved' AND invoice_id=?),0) - COALESCE((SELECT SUM(amount_fils) FROM payments WHERE refund_of=? AND kind='refund' AND status='approved'),0))`
  ).bind(p.id, p.requestId, p.invoiceId, p.amount, p.by, p.now, p.by, p.now, p.reason, p.refundOf, p.invoiceId, p.requestId, p.amount, p.invoiceId, p.refundOf, p.amount, p.refundOf, p.invoiceId, p.refundOf).run()
  return r.meta.changes > 0
}
