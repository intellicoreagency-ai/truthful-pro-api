import type { Env } from './types'
import { hmacHex, newId, openText, randomToken, sha256Hex, sealText } from './crypto'

// Customer email: a welcome email (with the confirmation link) first, then the invoice when the customer starts the transaction.
// Nothing is sent unless EMAIL_MODE is configured ('brevo'); tests use 'capture'. Invoices go only to a CONFIRMED address.
export type Mail = { to: string; subject: string; html: string; text: string; template?: { kind: 'welcome' | 'invoice'; params: Record<string, string | boolean> } }
export const mailbox: Mail[] = [] // 'capture' mode only (never used in production)

export const emailMode = (env: Env): 'none' | 'brevo' | 'capture' =>
  env.EMAIL_MODE === 'brevo' && env.BREVO_API_KEY && env.EMAIL_FROM ? 'brevo' : env.EMAIL_MODE === 'capture' && env.ENVIRONMENT !== 'production' ? 'capture' : 'none'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
export const validEmail = (e: unknown): e is string => typeof e === 'string' && e.length <= 120 && /^[^\s@<>"',;:()\[\]\\]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(e)

async function transmit(env: Env, m: Mail): Promise<boolean> {
  const mode = emailMode(env)
  if (mode === 'capture') { mailbox.push(m); return true }
  if (mode !== 'brevo') return false
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': env.BREVO_API_KEY as string, 'content-type': 'application/json', accept: 'application/json' },
      // If the owner edits the design in Brevo (a transactional template id is configured), use it with the data as parameters; otherwise send the built-in HTML.
      body: JSON.stringify((() => { const tid = m.template ? Number(m.template.kind === 'welcome' ? env.EMAIL_TEMPLATE_WELCOME : env.EMAIL_TEMPLATE_INVOICE) : NaN
        return Number.isInteger(tid) && tid > 0 && m.template ? { to: [{ email: m.to }], templateId: tid, params: m.template.params } : { sender: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME ?? env.COMPANY_NAME_EN ?? 'Truthful Clearance Services' }, to: [{ email: m.to }], subject: m.subject, htmlContent: m.html, textContent: m.text } })()),
      signal: AbortSignal.timeout(15000),
    })
    return r.ok
  } catch { return false }
}

const wrap = (env: Env, ar: string, en: string) => {
  const co = [env.COMPANY_NAME_AR ?? 'تروثفل لخدمات التخليص ذ.م.م', env.COMPANY_NAME_EN ?? 'Truthful Clearance Services LLC']
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222"><div dir="rtl" style="text-align:right">${ar}</div><hr style="margin:18px 0;border:0;border-top:1px solid #ddd"><div dir="ltr" style="text-align:left">${en}</div><p style="color:#888;font-size:12px;margin-top:24px">${esc(co[0]!)} · ${esc(co[1]!)}</p></div>`
}

/** Sets (or replaces) the customer's email, un-confirms it and queues the welcome email that carries the confirmation link. */
export async function setCustomerEmail(env: Env, userId: string, email: string): Promise<void> {
  const token = randomToken(32), now = Date.now(), lower = email.trim().toLowerCase()
  const emailHash = await hmacHex(env.PEPPER, `email:${lower}`) // lets the customer sign in with this email (POST /v1/auth/login)
  const taken = await env.DB.prepare('SELECT id FROM users WHERE email_hash=? AND id!=? AND deleted_at IS NULL').bind(emailHash, userId).first()
  if (taken) throw new Error('email_taken')
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET email_enc=?, email_hash=?, email_verified_at=NULL, email_token_hash=?, email_token_expires=? WHERE id=?').bind(await sealText(env.DATA_KEY, `user-email:${userId}`, lower), emailHash, await sha256Hex(token), now + 7 * 86400000, userId),
    env.DB.prepare("DELETE FROM email_outbox WHERE user_id=? AND kind='welcome' AND status!='sent'").bind(userId),
    env.DB.prepare("INSERT OR IGNORE INTO email_outbox (id,user_id,kind,ref_id,created_at) VALUES (?,?,'welcome','',?)").bind(newId(), userId, now),
  ])
  pendingToken.set(userId, token) // the raw token lives only until the welcome email is composed
  await flushUser(env, userId)
}
const pendingToken = new Map<string, string>()

export async function enqueueInvoiceEmail(env: Env, userId: string, docId: string): Promise<void> {
  await env.DB.prepare("INSERT OR IGNORE INTO email_outbox (id,user_id,kind,ref_id,created_at) VALUES (?,?,'invoice',?,?)").bind(newId(), userId, docId, Date.now()).run()
  await flushUser(env, userId).catch(() => null)
}

/** Confirms the address from the link in the welcome email, then sends anything that was waiting. */
export async function confirmEmail(env: Env, token: string): Promise<boolean> {
  const h = await sha256Hex(token)
  const u = await env.DB.prepare('SELECT id FROM users WHERE email_token_hash=? AND email_token_expires>? AND deleted_at IS NULL').bind(h, Date.now()).first<{ id: string }>()
  if (!u) return false
  const r = await env.DB.prepare('UPDATE users SET email_verified_at=?, email_token_hash=NULL WHERE id=? AND email_token_hash=?').bind(Date.now(), u.id, h).run()
  if (!r.meta.changes) return false
  await flushUser(env, u.id).catch(() => null)
  return true
}

type Row = { id: string; kind: string; ref_id: string; attempts: number }
/** Sends this customer's queued emails in order: welcome first, then invoices (only to a confirmed address). Failures stay queued for the retry job. */
export async function flushUser(env: Env, userId: string): Promise<void> {
  if (emailMode(env) === 'none') return
  const u = await env.DB.prepare('SELECT email_enc,email_verified_at,language FROM users WHERE id=? AND deleted_at IS NULL').bind(userId).first<{ email_enc: string | null; email_verified_at: number | null; language: string }>()
  if (!u?.email_enc) return
  const to = await openText(env.DATA_KEY, `user-email:${userId}`, u.email_enc)
  const rows = (await env.DB.prepare("SELECT id,kind,ref_id,attempts FROM email_outbox WHERE user_id=? AND status='pending' AND attempts<6 ORDER BY CASE kind WHEN 'welcome' THEN 0 ELSE 1 END, created_at").bind(userId).all<Row>()).results
  for (const row of rows) {
    if (row.kind === 'invoice' && !u.email_verified_at) continue // wait until the address is confirmed
    const mail = row.kind === 'welcome' ? await welcomeMail(env, userId, to) : await invoiceMail(env, userId, row.ref_id, to)
    if (!mail) { await env.DB.prepare("UPDATE email_outbox SET status='skipped' WHERE id=?").bind(row.id).run(); continue }
    const ok = await transmit(env, mail)
    await env.DB.prepare(ok ? "UPDATE email_outbox SET status='sent', sent_at=?, attempts=attempts+1 WHERE id=?" : "UPDATE email_outbox SET attempts=attempts+1, last_error='send_failed' WHERE id=?").bind(...(ok ? [Date.now(), row.id] : [row.id])).run()
    if (!ok) break // keep the order: do not send the invoice before the welcome email
  }
}

/** Retry job (cron): everything still pending. */
export async function flushAll(env: Env): Promise<void> {
  const users = await env.DB.prepare("SELECT DISTINCT user_id FROM email_outbox WHERE status='pending' AND attempts<6 LIMIT 50").all<{ user_id: string }>()
  for (const u of users.results) await flushUser(env, u.user_id).catch(() => null)
}

async function welcomeMail(env: Env, userId: string, to: string): Promise<Mail | null> {
  let token = pendingToken.get(userId)
  if (!token) { // retry after a restart: issue a fresh confirmation link
    token = randomToken(32)
    await env.DB.prepare('UPDATE users SET email_token_hash=?, email_token_expires=? WHERE id=? AND email_verified_at IS NULL').bind(await sha256Hex(token), Date.now() + 7 * 86400000, userId).run()
  }
  const base = (env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '')
  const link = `${base}/v1/email/confirm?token=${encodeURIComponent(token)}`
  pendingToken.delete(userId)
  const co = env.COMPANY_NAME_EN ?? 'Truthful Clearance Services LLC'
  return {
    to, subject: `مرحباً بك في تروثفل · Welcome to ${co}`,
    html: wrap(env, `<h2>مرحباً بك!</h2><p>شكراً لتسجيلك لدينا. يرجى تأكيد بريدك الإلكتروني ليصلك عليه إصدار فواتير أتعابنا.</p><p><a href="${esc(link)}" style="background:#9a6b1f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">تأكيد البريد الإلكتروني</a></p>`,
      `<h2>Welcome!</h2><p>Thank you for registering. Please confirm your email so we can send you the invoice for our fee.</p><p><a href="${esc(link)}" style="background:#9a6b1f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Confirm my email</a></p>`),
    text: `Welcome to ${co}. Confirm your email: ${link}`,
    template: { kind: 'welcome', params: { confirm_url: link } },
  }
}

async function invoiceMail(env: Env, userId: string, docId: string, to: string): Promise<Mail | null> {
  const d = await env.DB.prepare("SELECT number,total_fils,snapshot,status FROM fin_documents WHERE id=? AND doc_type='invoice'").bind(docId).first<{ number: string; total_fils: number; snapshot: string; status: string }>()
  if (!d || d.status !== 'issued') return null // voided or missing: nothing to send
  let s: any = {}; try { s = JSON.parse(d.snapshot) } catch { /* */ }
  const aed = `AED ${(d.total_fils / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const title = s.requestTitle ?? {}
  const test = '<p style="color:#a3261a"><b>TEST COPY / نسخة تجريبية</b></p>'
  const bank = env.COMPANY_PAYMENT_NOTE ? esc(env.COMPANY_PAYMENT_NOTE) : ''
  return {
    to, subject: `فاتورة ${d.number} · Invoice ${d.number}`,
    html: wrap(env, `${test}<h2>فاتورة أتعاب الشركة</h2><p>الطلب: <b>${esc(title.ar ?? '')}</b><br>رقم الفاتورة: <b dir="ltr">${esc(d.number)}</b><br>المبلغ المستحق: <b dir="ltr">${aed}</b></p><p>الدفع مقدماً بالتحويل البنكي أو نقداً. ${bank}</p><p>الرسوم الحكومية تُدفع مباشرة للجهة عبر رابطها الرسمي ولا تشملها هذه الفاتورة. تجد الفاتورة الكاملة في التطبيق.</p>`,
      `${test}<h2>Invoice for the Company fee</h2><p>Request: <b>${esc(title.en ?? '')}</b><br>Invoice: <b>${esc(d.number)}</b><br>Amount due: <b>${aed}</b></p><p>Payable in advance by bank transfer or cash. ${bank}</p><p>Government fees are paid directly to the authority through its official link and are not part of this invoice. The full invoice is in the app.</p>`),
    text: `Invoice ${d.number}: ${aed}. Payable in advance by bank transfer or cash. Government fees are paid directly to the authority.`,
    template: { kind: 'invoice', params: { invoice_number: d.number, amount: aed, request_title_ar: String(title.ar ?? ''), request_title_en: String(title.en ?? ''), payment_note: env.COMPANY_PAYMENT_NOTE ?? '', is_test: true } },
  }
}
