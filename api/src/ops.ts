import type { Env } from './types'
import { creditFor, govFor, totalsFor } from './finance'
import { newId } from './crypto'

// The server is the reference for status, dates, money and files. This module records every move and answers two questions:
// staff: "what do I do now, who must act, and by when?"   customer: "where is my transaction, and is anything needed from me?"

export type Actor = { kind: 'customer' | 'staff' | 'system'; id: string | null }
const DAY = 86400000

/** Default follow-up date for the state a request has just entered (null = nothing to chase). */
const FOLLOW_UP_DAYS: Record<string, number> = { submitted: 1, review: 2, needs_documents: 3, ready_for_authority: 1, authority: 5, decision: 3, completed: 3 }

export async function recordTransition(env: Env, p: { requestId: string; from: string | null; to: string; actor: Actor; reason?: string | null; internalNote?: string | null; reference?: string | null; submissionId?: string | null; attachments?: string[]; now?: number; followUpAt?: number | null }): Promise<void> {
  const now = p.now ?? Date.now()
  const fu = p.followUpAt !== undefined ? p.followUpAt : FOLLOW_UP_DAYS[p.to] ? now + FOLLOW_UP_DAYS[p.to]! * DAY : null
  await env.DB.batch([
    env.DB.prepare('INSERT INTO request_transitions (id,request_id,from_status,to_status,actor_kind,actor_id,at,reason,internal_note,reference,submission_id,attachments) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(newId(), p.requestId, p.from, p.to, p.actor.kind, p.actor.id, now, p.reason?.slice(0, 300) ?? null, p.internalNote?.slice(0, 500) ?? null, p.reference ?? null, p.submissionId ?? null, p.attachments?.length ? JSON.stringify(p.attachments) : null),
    env.DB.prepare('UPDATE requests SET follow_up_at=? WHERE id=?').bind(fu, p.requestId),
  ])
}

/** A filing with the authority: a new row each time (history is kept); the reference and date are the evidence. */
export async function openSubmission(env: Env, requestId: string, reference: string, by: string, now: number): Promise<string> {
  const id = newId()
  await env.DB.prepare("INSERT INTO submissions (id,request_id,number,reference,submitted_at,submitted_by) SELECT ?,?,COALESCE(MAX(number),0)+1,?,?,? FROM submissions WHERE request_id=?").bind(id, requestId, reference, now, by, requestId).run()
  return id
}
export const activeSubmission = (env: Env, requestId: string) => env.DB.prepare("SELECT id,number,reference,submitted_at FROM submissions WHERE request_id=? AND state='active' ORDER BY number DESC LIMIT 1").bind(requestId).first<{ id: string; number: number; reference: string; submitted_at: number }>()

/** Renewal reminders from the approved expiry date: 90, 30 and 7 days before (only future ones). */
export async function scheduleReminders(env: Env, requestId: string, userId: string, expiresAt: number, now = Date.now()): Promise<number> {
  await env.DB.prepare("UPDATE reminders SET state='cancelled' WHERE request_id=? AND state='pending'").bind(requestId).run()
  let n = 0
  for (const d of [90, 30, 7]) {
    const due = expiresAt - d * DAY
    if (due <= now) continue
    await env.DB.prepare("INSERT INTO reminders (id,request_id,user_id,kind,due_at,days_before) VALUES (?,?,?,'renewal',?,?) ON CONFLICT(request_id,kind,days_before) DO UPDATE SET due_at=excluded.due_at, state='pending', fired_at=NULL").bind(newId(), requestId, userId, due, d).run()
    n++
  }
  return n
}

/** Cron: reminders that have come due become a message in the customer's timeline (email goes through the outbox once configured). */
export async function fireReminders(env: Env, now = Date.now()): Promise<number> {
  const due = (await env.DB.prepare("SELECT rm.id,rm.request_id,rm.days_before FROM reminders rm JOIN requests r ON r.id=rm.request_id WHERE rm.state='pending' AND rm.due_at<=? AND r.deleted_at IS NULL LIMIT 100").bind(now).all<{ id: string; request_id: string; days_before: number }>()).results
  for (const x of due) {
    const u = await env.DB.prepare("UPDATE reminders SET state='fired', fired_at=? WHERE id=? AND state='pending'").bind(now, x.id).run()
    if (!u.meta.changes) continue
    const renewed = await env.DB.prepare("SELECT 1 y FROM requests WHERE renewal_of=? AND deleted_at IS NULL AND status NOT IN ('cancelled','rejected')").bind(x.request_id).first()
    if (renewed) continue // already renewing: no need to nag
    await env.DB.prepare("INSERT INTO request_events (id,request_id,actor,kind,text_ar,text_en,visible,created_at) VALUES (?,?,'staff','status',?,?,1,?)").bind(newId(), x.request_id, `يقترب موعد انتهاء مستندك (خلال ${x.days_before} يوماً). يمكنك طلب التجديد من التطبيق.`, `Your document expires in about ${x.days_before} days. You can request a renewal in the app.`, now).run()
  }
  return due.length
}

export type Work = {
  waitingOn: 'customer' | 'staff' | 'authority' | 'none'
  next: { code: string; ar: string; en: string; role: 'agent' | 'finance' | 'manager' | 'none' }
  followUpAt: number | null; overdue: boolean
  payment: { company: string; government: string }
  delivery: { state: 'none' | 'draft' | 'awaiting_receipt' | 'received'; version: number }
  openProblem: boolean
  customer: { ar: string; en: string; actionRequired: boolean; action: string | null }
}

type Req = { id: string; user_id: string; service_id: string; status: string; assignee_id: string | null; follow_up_at: number | null; expires_at: number | null }
const T = (code: string, ar: string, en: string, role: Work['next']['role'] = 'agent') => ({ code, ar, en, role })

/** Computed, never stored: payment state, delivery state and the transaction status are independent of each other. */
export async function workFor(env: Env, r: Req, now = Date.now()): Promise<Work> {
  const [tot, gov] = [await totalsFor(env, r.id), await govFor(env, r.id)]
  const pol = await env.DB.prepare('SELECT pay_gate FROM service_policies WHERE service_id=?').bind(r.service_id).first<{ pay_gate: string }>()
  const gate = pol?.pay_gate ?? 'authority'
  const del = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM deliveries WHERE request_id=?1 AND status='draft') draft, COALESCE((SELECT MAX(version) FROM deliveries WHERE request_id=?1 AND status='published'),0) v, (SELECT COUNT(*) FROM receipt_acks a WHERE a.request_id=?1 AND a.delivery_version=(SELECT MAX(version) FROM deliveries WHERE request_id=?1 AND status='published')) acked, (SELECT COUNT(*) FROM delivery_problems WHERE request_id=?1 AND status='open') probs, (SELECT COUNT(*) FROM request_files WHERE request_id=?1 AND kind='source' AND deleted_at IS NULL AND scan_status!='clean') unscanned, (SELECT COUNT(*) FROM refund_requests WHERE request_id=?1 AND status IN ('requested','approved')) openRefunds").bind(r.id).first<{ draft: number; v: number; acked: number; probs: number; unscanned: number; openRefunds: number }>()
  const dState: Work['delivery']['state'] = del && del.v > 0 ? (del.acked > 0 ? 'received' : 'awaiting_receipt') : del && del.draft > 0 ? 'draft' : 'none'
  const pendingQuote = await env.DB.prepare("SELECT version FROM quotes WHERE request_id=? AND status='issued'").bind(r.id).first<{ version: number }>()
  const unpaidCompany = !!tot.invoice && tot.remaining > 0
  const govUnpaid = gov.total > 0 && gov.state !== 'paid'
  const payUnmet = gate === 'authority' ? (!tot.invoice || tot.remaining > 0 || tot.pending > 0 || govUnpaid) : false
  let waitingOn: Work['waitingOn'] = 'staff'
  let next = T('none', 'لا إجراء مطلوب', 'No action needed', 'none')
  const s = r.status
  if (s === 'submitted') next = r.assignee_id ? T('start_review', 'ابدأ مراجعة المستفيد والبيانات والملفات', 'Start reviewing the beneficiary, data and files') : T('assign', 'عيّن موظفاً مسؤولاً ثم ابدأ المراجعة', 'Assign an owner, then start the review', 'manager')
  else if (s === 'review') next = (del?.unscanned ?? 0) > 0 ? T('await_scan', 'بانتظار فحص الملفات الأمني', 'Waiting for the security scan', 'none') : pendingQuote && !tot.invoice ? T('await_quote_approval', 'بانتظار موافقة العميل على عرض السعر', 'Waiting for the customer to approve the quotation', 'none') : !tot.invoice ? T('send_quote', 'سعّر الطلب وأرسل عرض السعر للعميل للموافقة', 'Price the request and send the quotation for the customer\'s approval', 'finance') : T('finish_review', 'أكمل مراجعة الملفات: اعتمدها أو اطلب الاستكمال', 'Finish reviewing the files: accept them or request what is missing')
  else if (s === 'needs_documents') { waitingOn = 'customer'; next = T('chase_customer', 'تابع العميل لاستكمال النواقص', 'Follow up with the customer for the missing items') }
  else if (s === 'ready_for_authority') {
    if (pendingQuote) { waitingOn = 'customer'; next = T('await_quote_approval', 'بانتظار موافقة العميل على عرض السعر', 'Waiting for the customer to approve the quotation', 'none') }
    else if (tot.pending > 0) next = T('verify_payment', 'تحقق من دفعة العميل المعلّقة', 'Verify the customer\'s pending payment', 'finance')
    else if (payUnmet) { waitingOn = 'customer'; next = T('await_payment', govUnpaid && !unpaidCompany ? 'بانتظار دفع العميل الرسم الحكومي للجهة' : 'بانتظار دفع العميل أتعاب الشركة', govUnpaid && !unpaidCompany ? 'Waiting for the customer to pay the government fee' : 'Waiting for the customer to pay the Company fee', 'none') }
    else next = T('submit_authority', 'قدّم المعاملة للجهة وسجّل المرجع والتاريخ', 'Submit to the authority and record the reference and date')
  } else if (s === 'authority') { waitingOn = 'authority'; next = T('follow_authority', 'تابع الجهة؛ سجّل القرار أو طلبها لمستندات إضافية', 'Follow up with the authority; record the decision or its request for more documents') }
  else if (s === 'decision') { waitingOn = 'authority'; next = T('record_decision', 'سجّل قرار الجهة وأدلته', 'Record the authority\'s decision and evidence') }
  else if (s === 'completed') {
    if ((del?.probs ?? 0) > 0) next = T('fix_delivery', 'عالج مشكلة التسليم التي أبلغ عنها العميل', 'Resolve the delivery problem the customer reported')
    else if (dState === 'none') next = T('upload_final', 'ارفع الملفات النهائية في حزمة التسليم', 'Upload the final files to the delivery package')
    else if (dState === 'draft') next = T('publish', 'راجع الحزمة ثم انشرها للعميل', 'Review the package, then publish it')
    else if (dState === 'awaiting_receipt') { waitingOn = 'customer'; next = T('await_receipt', 'بانتظار تأكيد العميل لاستلام الملفات', 'Waiting for the customer to confirm receipt', 'none') }
    else if (!r.expires_at) next = T('set_expiry', 'سجّل تاريخ انتهاء المستند لجدولة التجديد', 'Record the document expiry date to schedule the renewal')
    else { waitingOn = 'none'; next = T('archived', 'مؤرشفة — لا إجراء', 'Archived — nothing to do', 'none') }
  } else if (s === 'rejected' || s === 'cancelled') {
    const refundable = tot.invoice ? tot.net > 0 : false
    if (refundable && (del?.openRefunds ?? 0) === 0) next = T('settle_money', 'سوِّ المبالغ: أنشئ طلب استرداد أو وثّق الأتعاب المستحقة', 'Settle the money: raise a refund request or document the fee earned', 'finance')
    else if (tot.invoice && tot.remaining > 0 && tot.net === 0) next = T('void_invoice', 'ألغِ الفاتورة غير المسددة', 'Cancel the unpaid invoice', 'finance')
    else { waitingOn = 'none'; next = T('closed', 'مغلقة — لا إجراء', 'Closed — nothing to do', 'none') }
  }
  // customer-facing: where am I, and is anything needed from me?
  let c = { ar: 'استلمنا طلبك وفريقنا يعمل عليه.', en: 'We have your request and our team is working on it.', actionRequired: false, action: null as string | null }
  if (s === 'needs_documents') c = { ar: 'مطلوب منك: أرسل المستندات المطلوبة لنكمل.', en: 'Needed from you: send the requested documents so we can continue.', actionRequired: true, action: 'send_documents' }
  else if (s === 'completed' && dState === 'awaiting_receipt') c = { ar: 'ملفاتك جاهزة: عاينها وأكد الاستلام.', en: 'Your files are ready: open them and confirm receipt.', actionRequired: true, action: 'confirm_receipt' }
  else if (pendingQuote && !['completed', 'rejected', 'cancelled'].includes(s)) c = { ar: 'مطلوب منك: راجع عرض السعر ووافق عليه أو اعتذر عنه.', en: 'Needed from you: review the quotation, then approve or decline it.', actionRequired: true, action: 'approve_quote' }
  else if (['submitted', 'review', 'needs_documents', 'ready_for_authority'].includes(s) && unpaidCompany && tot.pending === 0) c = { ar: 'مطلوب منك: ادفع أتعاب الشركة (تحويل بنكي أو نقداً) وارفع إثبات التحويل.', en: 'Needed from you: pay the Company fee (bank transfer or cash) and upload the transfer proof.', actionRequired: true, action: 'pay_company_fee' }
  else if (['ready_for_authority', 'authority'].includes(s) && govUnpaid && gov.reported === 0) c = { ar: 'مطلوب منك: ادفع الرسم الحكومي للجهة عبر الرابط الرسمي ثم أبلغنا.', en: 'Needed from you: pay the government fee to the authority through the official link, then tell us.', actionRequired: true, action: 'pay_government_fee' }
  else if (s === 'authority') c = { ar: 'قُدّمت معاملتك للجهة وننتظر ردها.', en: 'Your transaction is with the authority; we are waiting for its reply.', actionRequired: false, action: null }
  else if (s === 'decision') c = { ar: 'بانتظار قرار الجهة.', en: 'Waiting for the authority\'s decision.', actionRequired: false, action: null }
  else if (s === 'completed') c = { ar: 'اكتملت معاملتك.', en: 'Your transaction is complete.', actionRequired: false, action: null }
  else if (s === 'rejected') c = { ar: 'لم تُقبل المعاملة. اطّلع على السبب وتواصل معنا لخيارات التسوية.', en: 'The transaction was not accepted. See the reason and contact us for the options.', actionRequired: false, action: null }
  else if (s === 'cancelled') c = { ar: 'أُلغيت المعاملة.', en: 'The transaction was cancelled.', actionRequired: false, action: null }
  if ((del?.probs ?? 0) > 0) c = { ar: 'استلمنا بلاغك عن التسليم وفريقنا يعالجه.', en: 'We received your delivery problem report and are handling it.', actionRequired: false, action: null }
  const closed = s === 'cancelled' || s === 'rejected' || (s === 'completed' && waitingOn === 'none')
  return {
    waitingOn, next, followUpAt: r.follow_up_at, overdue: !closed && !!r.follow_up_at && r.follow_up_at < now,
    payment: { company: pendingQuote && !tot.invoice ? 'awaiting_approval' : tot.state, government: gov.state }, delivery: { state: dState, version: del?.v ?? 0 }, openProblem: (del?.probs ?? 0) > 0, customer: c,
  }
}
export { creditFor }

/** Cheap version for lists (no money/delivery queries): who we are waiting on and the headline action. */
export function liteWork(r: { status: string; assignee_id: string | null; follow_up_at: number | null }, now = Date.now()): { waitingOn: Work['waitingOn']; next: { ar: string; en: string }; followUpAt: number | null; overdue: boolean } {
  const m: Record<string, [Work['waitingOn'], string, string]> = {
    submitted: ['staff', r.assignee_id ? 'ابدأ المراجعة' : 'عيّن موظفاً', r.assignee_id ? 'Start the review' : 'Assign an owner'],
    review: ['staff', 'أكمل المراجعة', 'Finish the review'], needs_documents: ['customer', 'تابع العميل للنواقص', 'Chase the customer'],
    ready_for_authority: ['staff', 'قدّم للجهة أو تحقق من الدفع', 'Submit, or verify payment'], authority: ['authority', 'تابع الجهة', 'Follow up with the authority'],
    decision: ['authority', 'سجّل القرار', 'Record the decision'], completed: ['staff', 'التسليم والاستلام', 'Delivery and receipt'],
    rejected: ['none', 'سوِّ المبالغ إن وجدت', 'Settle any money'], cancelled: ['none', 'سوِّ المبالغ إن وجدت', 'Settle any money'],
  }
  const [w, ar, en] = m[r.status] ?? ['none', '', '']
  return { waitingOn: w, next: { ar, en }, followUpAt: r.follow_up_at, overdue: !['completed', 'rejected', 'cancelled'].includes(r.status) && !!r.follow_up_at && r.follow_up_at < now }
}
