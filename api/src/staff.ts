import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { Env, Vars } from './types'
import { hmacHex, newId, open, openText, randomToken, seal, sealText, sha256Hex, timingSafeEqual } from './crypto'
import { MAX_FILE_BYTES, isUuid, normalizePhone, safeFileName, sniffFile } from './validate'
import { allow, audit, clientIp, jsonBody, type C } from './security'
import { RULES, passportValidity } from './rules'
import { scanBytes, uploadsBlocked } from './scanner'
import { approvePayment, documentStatements, govFor, insertAuthorityPayment, insertPayment, insertRefund, isFils, parseGovUrl, parseItems, renderDocument, totalsFor, type DocRow } from './finance'
import { newSecret, otpauthUri, verifyTotp } from './totp'
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server'
import { b64, unb64, otpCode } from './crypto'
import { sendWhatsAppCode } from './sms'

type Role = Vars['staffRole']
const ACCESS_TTL = 15 * 60 * 1000
const REFRESH_TTL = 12 * 3600 * 1000 // staff sessions are shorter than customers'

export const staff = new Hono<{ Bindings: Env; Variables: Vars }>()

// ---------- status machine ----------
export const TRANSITIONS: Record<string, string[]> = {
  submitted: ['review', 'rejected', 'cancelled'],
  review: ['needs_documents', 'ready_for_authority', 'rejected', 'cancelled'],
  needs_documents: ['review', 'rejected', 'cancelled'],
  ready_for_authority: ['authority', 'needs_documents', 'review', 'rejected', 'cancelled'],
  authority: ['decision', 'needs_documents', 'completed', 'rejected'],
  decision: ['completed', 'authority', 'rejected'],
}
const LABEL: Record<string, [string, string]> = {
  review: ['قيد المراجعة', 'Under review'], needs_documents: ['مطلوب استكمال', 'Action required'], ready_for_authority: ['جاهزة للتقديم', 'Ready to submit'], authority: ['لدى الجهة', 'With authority'],
  decision: ['بانتظار القرار', 'Decision pending'], completed: ['منجزة', 'Completed'], rejected: ['مرفوضة', 'Rejected'], cancelled: ['ملغاة', 'Cancelled'],
}

// ---------- auth ----------
async function staffByPhone(env: Env, phoneHash: string) {
  return env.DB.prepare('SELECT id,role,active FROM staff WHERE phone_hash=?').bind(phoneHash).first<{ id: string; role: Role; active: number }>()
}

staff.post('/auth/wa/start', async (c) => {
  const body = await jsonBody(c)
  const phone = normalizePhone(body?.phone)
  if (!phone) return c.json({ error: 'invalid_phone' }, 400)
  if (!c.env.WA_BUSINESS_NUMBER) return c.json({ error: 'not_configured' }, 503)
  const phoneHash = await hmacHex(c.env.PEPPER, `phone:${phone}`)
  if (!(await allow(c.env, `swa:p:${phoneHash}`, 5, 600)) || !(await allow(c.env, `swa:i:${clientIp(c)}`, 20, 600))) return c.json({ error: 'too_many_requests' }, 429)
  const { waCode } = await import('./crypto')
  const code = waCode(), poll = randomToken(24), id = newId(), now = Date.now()
  await c.env.DB.prepare("INSERT INTO wa_challenges (id,phone_hash,code_hash,poll_hash,expires_at,created_at,purpose) VALUES (?,?,?,?,?,?,'staff')")
    .bind(id, phoneHash, await hmacHex(c.env.PEPPER, `wa:${code}`), await sha256Hex(poll), now + 600_000, now).run()
  const text = `تأكيد دخول فريق تروثفل: ${code}`
  return c.json({ challengeId: id, pollToken: poll, code, expiresIn: 600, link: `https://wa.me/${c.env.WA_BUSINESS_NUMBER}?text=${encodeURIComponent(text)}` })
})

staff.post('/auth/wa/poll', async (c) => {
  const body = await jsonBody(c)
  const id = typeof body?.challengeId === 'string' ? body.challengeId : ''
  const poll = typeof body?.pollToken === 'string' ? body.pollToken : ''
  const phone = normalizePhone(body?.phone)
  if (!isUuid(id) || !/^[A-Za-z0-9_-]{20,64}$/.test(poll) || !phone) return c.json({ error: 'invalid_request' }, 400)
  if (!(await allow(c.env, `swapoll:${clientIp(c)}`, 300, 600))) return c.json({ error: 'too_many_requests' }, 429)
  const phoneHash = await hmacHex(c.env.PEPPER, `phone:${phone}`)
  const ch = await c.env.DB.prepare("SELECT poll_hash,phone_hash,expires_at,verified_at,consumed_at FROM wa_challenges WHERE id=? AND purpose='staff'").bind(id)
    .first<{ poll_hash: string; phone_hash: string; expires_at: number; verified_at: number | null; consumed_at: number | null }>()
  if (!ch || !timingSafeEqual(ch.poll_hash, await sha256Hex(poll)) || ch.phone_hash !== phoneHash) return c.json({ error: 'invalid_request' }, 400)
  if (ch.consumed_at || ch.expires_at < Date.now()) return c.json({ status: 'expired' })
  if (!ch.verified_at) return c.json({ status: 'pending' })
  const used = await c.env.DB.prepare('UPDATE wa_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL').bind(Date.now(), id).run()
  if (!used.meta.changes) return c.json({ status: 'expired' })

  let member = await staffByPhone(c.env, phoneHash)
  if (!member && c.env.OWNER_PHONE && phone === c.env.OWNER_PHONE) {
    const any = await c.env.DB.prepare('SELECT 1 x FROM staff LIMIT 1').first()
    if (!any) { // bootstrap: the very first sign-in by the configured owner number
      const sid = newId()
      await c.env.DB.prepare("INSERT INTO staff (id,phone_hash,phone_enc,name,role,created_at) VALUES (?,?,?,?,'owner',?)")
        .bind(sid, phoneHash, await sealText(c.env.DATA_KEY, 'staff-phone', phone), 'Owner', Date.now()).run()
      member = { id: sid, role: 'owner', active: 1 }
    }
  }
  if (!member || !member.active) { await audit(c, 'staff.denied', null); return c.json({ status: 'not_staff' }, 403) }
  return openSession(c, member.id, member.role)
})

async function openSession(c: C, staffId: string, role: Role) {
  const access = randomToken(32), refresh = randomToken(32), now = Date.now()
  await c.env.DB.prepare('INSERT INTO staff_sessions (id,staff_id,access_hash,refresh_hash,access_expires_at,refresh_expires_at,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(newId(), staffId, await sha256Hex(access), await sha256Hex(refresh), now + ACCESS_TTL, now + REFRESH_TTL, now).run()
  await audit(c, 'staff.login', null, { staffId })
  return c.json({ status: 'verified', accessToken: access, refreshToken: refresh, expiresIn: ACCESS_TTL / 1000, role })
}

// ---------- authenticator-app sign-in (free, no WhatsApp/SMS needed) ----------
const ENROLL_TTL = 24 * 3600 * 1000
const tooMany = async (c: C, phoneHash: string, tag: string) =>
  !(await allow(c.env, `${tag}:p:${phoneHash}`, 8, 900)) || !(await allow(c.env, `${tag}:i:${clientIp(c)}`, 30, 900))

/** Step 1 of enrolment: prove you hold the one-time setup key, receive the authenticator secret (shown once). */
staff.post('/auth/setup/start', async (c) => {
  const b = await jsonBody(c)
  const phone = normalizePhone(b?.phone), key = typeof b?.setupKey === 'string' ? b.setupKey : ''
  if (!phone || key.length < 12) return c.json({ error: 'invalid_request' }, 400)
  const phoneHash = await hmacHex(c.env.PEPPER, `phone:${phone}`)
  if (await tooMany(c, phoneHash, 'tsetup')) return c.json({ error: 'too_many_requests' }, 429)
  let m = await c.env.DB.prepare('SELECT id,role,active,totp_enabled,enroll_hash,enroll_expires FROM staff WHERE phone_hash=?').bind(phoneHash)
    .first<{ id: string; role: Role; active: number; totp_enabled: number; enroll_hash: string | null; enroll_expires: number | null }>()
  let ok = false
  if (!m) { // first-ever owner: configured number + setup key, and only while no staff exists
    const any = await c.env.DB.prepare('SELECT 1 x FROM staff LIMIT 1').first()
    ok = !any && !!c.env.OWNER_PHONE && phone === c.env.OWNER_PHONE && !!c.env.OWNER_SETUP_KEY && timingSafeEqual(key, c.env.OWNER_SETUP_KEY)
    if (ok) {
      const sid = newId()
      await c.env.DB.prepare("INSERT INTO staff (id,phone_hash,phone_enc,name,role,created_at) VALUES (?,?,?,?,'owner',?)")
        .bind(sid, phoneHash, await sealText(c.env.DATA_KEY, 'staff-phone', phone), 'Owner', Date.now()).run()
      m = { id: sid, role: 'owner', active: 1, totp_enabled: 0, enroll_hash: null, enroll_expires: null }
    }
  } else if (m.active && !m.totp_enabled) { // a member added by the owner, holding their one-time enrolment key
    ok = !!m.enroll_hash && (m.enroll_expires ?? 0) > Date.now() && timingSafeEqual(await sha256Hex(key), m.enroll_hash)
    if (!ok && m.role === 'owner' && c.env.OWNER_SETUP_KEY && timingSafeEqual(key, c.env.OWNER_SETUP_KEY)) ok = true // owner re-trying before finishing
  }
  if (!ok || !m) { await audit(c, 'staff.setup_denied', null); return c.json({ error: 'invalid_setup' }, 403) } // same answer for every failure
  const secret = newSecret()
  await c.env.DB.prepare('UPDATE staff SET totp_secret_enc=?, totp_last_step=0 WHERE id=?').bind(await sealText(c.env.DATA_KEY, 'staff-totp', secret), m.id).run()
  await audit(c, 'staff.setup_start', null, { staffId: m.id })
  return c.json({ secret, uri: otpauthUri(secret, phone) })
})

/** Step 2: enter the first code from the app. Enables authenticator sign-in, burns the setup key and opens a session. */
staff.post('/auth/setup/confirm', async (c) => {
  const b = await jsonBody(c)
  const phone = normalizePhone(b?.phone), code = typeof b?.code === 'string' ? b.code.trim() : ''
  if (!phone) return c.json({ error: 'invalid_request' }, 400)
  const phoneHash = await hmacHex(c.env.PEPPER, `phone:${phone}`)
  if (await tooMany(c, phoneHash, 'tconf')) return c.json({ error: 'too_many_requests' }, 429)
  const m = await c.env.DB.prepare('SELECT id,role,active,totp_enabled,totp_secret_enc FROM staff WHERE phone_hash=?').bind(phoneHash)
    .first<{ id: string; role: Role; active: number; totp_enabled: number; totp_secret_enc: string | null }>()
  if (!m || !m.active || m.totp_enabled || !m.totp_secret_enc) return c.json({ error: 'invalid_code' }, 401)
  const step = await verifyTotp(await openText(c.env.DATA_KEY, 'staff-totp', m.totp_secret_enc), code)
  if (step === null) { await audit(c, 'staff.totp_fail', null); return c.json({ error: 'invalid_code' }, 401) }
  const r = await c.env.DB.prepare('UPDATE staff SET totp_enabled=1, totp_last_step=?, enroll_hash=NULL, enroll_expires=NULL WHERE id=? AND totp_enabled=0').bind(step, m.id).run()
  if (!r.meta.changes) return c.json({ error: 'invalid_code' }, 401)
  return openSession(c, m.id, m.role)
})

staff.post('/auth/totp', async (c) => {
  const b = await jsonBody(c)
  const phone = normalizePhone(b?.phone), code = typeof b?.code === 'string' ? b.code.trim() : ''
  if (!phone || !/^\d{6}$/.test(code)) return c.json({ error: 'invalid_code' }, 401)
  const phoneHash = await hmacHex(c.env.PEPPER, `phone:${phone}`)
  if (await tooMany(c, phoneHash, 'totp')) return c.json({ error: 'too_many_requests' }, 429)
  const m = await c.env.DB.prepare('SELECT id,role,active,totp_enabled,totp_secret_enc,totp_last_step FROM staff WHERE phone_hash=?').bind(phoneHash)
    .first<{ id: string; role: Role; active: number; totp_enabled: number; totp_secret_enc: string | null; totp_last_step: number }>()
  // Unknown number, disabled member and wrong code all look identical.
  const secret = m?.active && m.totp_enabled && m.totp_secret_enc ? await openText(c.env.DATA_KEY, 'staff-totp', m.totp_secret_enc) : null
  const step = secret ? await verifyTotp(secret, code) : await verifyTotp('JBSWY3DPEHPK3PXP', code)
  if (!m || !secret || step === null || step <= m.totp_last_step) { await audit(c, 'staff.totp_fail', null); return c.json({ error: 'invalid_code' }, 401) }
  const r = await c.env.DB.prepare('UPDATE staff SET totp_last_step=? WHERE id=? AND totp_last_step<?').bind(step, m.id, step).run() // a code works once
  if (!r.meta.changes) return c.json({ error: 'invalid_code' }, 401)
  return openSession(c, m.id, m.role)
})

staff.post('/auth/refresh', async (c) => {
  const body = await jsonBody(c)
  const token = typeof body?.refreshToken === 'string' ? body.refreshToken : ''
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return c.json({ error: 'invalid_request' }, 400)
  const hash = await sha256Hex(token), now = Date.now()
  const reuse = await c.env.DB.prepare('SELECT id FROM staff_sessions WHERE prev_refresh_hash=? AND revoked_at IS NULL').bind(hash).first<{ id: string }>()
  if (reuse) { await c.env.DB.prepare('UPDATE staff_sessions SET revoked_at=? WHERE id=?').bind(now, reuse.id).run(); return c.json({ error: 'unauthorized' }, 401) }
  const s = await c.env.DB.prepare('SELECT s.id FROM staff_sessions s JOIN staff m ON m.id=s.staff_id WHERE s.refresh_hash=? AND s.revoked_at IS NULL AND s.refresh_expires_at>? AND m.active=1').bind(hash, now).first<{ id: string }>()
  if (!s) return c.json({ error: 'unauthorized' }, 401)
  const access = randomToken(32), refresh = randomToken(32)
  const r = await c.env.DB.prepare('UPDATE staff_sessions SET access_hash=?,refresh_hash=?,prev_refresh_hash=?,access_expires_at=? WHERE id=? AND refresh_hash=?')
    .bind(await sha256Hex(access), await sha256Hex(refresh), hash, now + ACCESS_TTL, s.id, hash).run()
  if (!r.meta.changes) return c.json({ error: 'unauthorized' }, 401)
  return c.json({ accessToken: access, refreshToken: refresh, expiresIn: ACCESS_TTL / 1000 }) // refresh window is NOT extended: re-login after 12 h
})

const requireStaff: MiddlewareHandler<{ Bindings: Env; Variables: Vars }> = async (c, next) => {
  const m = /^Bearer ([A-Za-z0-9_-]{40,64})$/.exec(c.req.header('authorization') ?? '')
  if (!m) return c.json({ error: 'unauthorized' }, 401)
  const row = await c.env.DB.prepare(
    'SELECT s.id sid, m.id staff_id, m.role FROM staff_sessions s JOIN staff m ON m.id=s.staff_id WHERE s.access_hash=? AND s.revoked_at IS NULL AND s.access_expires_at>? AND m.active=1'
  ).bind(await sha256Hex(m[1] as string), Date.now()).first<{ sid: string; staff_id: string; role: Role }>()
  if (!row) return c.json({ error: 'unauthorized' }, 401)
  c.set('sessionId', row.sid); c.set('staffId', row.staff_id); c.set('staffRole', row.role)
  await next()
}
const roles = (...allowed: Role[]): MiddlewareHandler<{ Bindings: Env; Variables: Vars }> => async (c, next) => {
  if (!allowed.includes(c.get('staffRole'))) return c.json({ error: 'forbidden' }, 403)
  await next()
}
const OPS: Role[] = ['owner', 'manager', 'agent']

const guarded = new Hono<{ Bindings: Env; Variables: Vars }>()
guarded.use('*', requireStaff)

guarded.get('/me', async (c) => {
  const m = await c.env.DB.prepare('SELECT id,name,role FROM staff WHERE id=?').bind(c.get('staffId')).first()
  return c.json({ staff: m })
})
guarded.post('/auth/logout', async (c) => {
  await c.env.DB.prepare('UPDATE staff_sessions SET revoked_at=? WHERE id=?').bind(Date.now(), c.get('sessionId')).run()
  return c.json({ ok: true })
})

// ---------- staff management (owner) ----------
guarded.get('/team', roles('owner', 'manager'), async (c) => {
  const r = await c.env.DB.prepare('SELECT id,name,role,active,created_at FROM staff ORDER BY created_at').all()
  return c.json({ team: r.results })
})
guarded.post('/team', roles('owner'), async (c) => {
  const b = await jsonBody(c)
  const phone = normalizePhone(b?.phone)
  const name = typeof b?.name === 'string' ? b.name.trim().slice(0, 80) : ''
  if (!phone || !name || !['manager', 'agent', 'accountant'].includes(b?.role as string)) return c.json({ error: 'invalid_request' }, 400)
  const phoneHash = await hmacHex(c.env.PEPPER, `phone:${phone}`)
  if (await staffByPhone(c.env, phoneHash)) return c.json({ error: 'exists' }, 409)
  const id = newId()
  await c.env.DB.prepare('INSERT INTO staff (id,phone_hash,phone_enc,name,role,created_at) VALUES (?,?,?,?,?,?)')
    .bind(id, phoneHash, await sealText(c.env.DATA_KEY, 'staff-phone', phone), name, b?.role, Date.now()).run()
  const enrollKey = randomToken(18)
  await c.env.DB.prepare('UPDATE staff SET enroll_hash=?, enroll_expires=? WHERE id=?').bind(await sha256Hex(enrollKey), Date.now() + ENROLL_TTL, id).run()
  await audit(c, 'staff.add', null, { staffId: id, by: c.get('staffId') })
  return c.json({ id, enrollKey, enrollExpiresInHours: 24 }, 201) // shown once; give it to the new member privately
})
guarded.patch('/team/:id', roles('owner'), async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id) || id === c.get('staffId')) return c.json({ error: 'invalid_request' }, 400) // an owner cannot demote/disable themselves
  const b = await jsonBody(c)
  const role = ['manager', 'agent', 'accountant'].includes(b?.role as string) ? (b?.role as string) : null
  const active = typeof b?.active === 'boolean' ? (b.active ? 1 : 0) : null
  const target = await c.env.DB.prepare('SELECT role FROM staff WHERE id=?').bind(id).first<{ role: Role }>()
  if (!target || target.role === 'owner') return c.json({ error: 'not_found' }, 404)
  await c.env.DB.prepare('UPDATE staff SET role=COALESCE(?,role), active=COALESCE(?,active) WHERE id=?').bind(role, active, id).run()
  if (active === 0) await c.env.DB.prepare('UPDATE staff_sessions SET revoked_at=? WHERE staff_id=?').bind(Date.now(), id).run()
  await audit(c, 'staff.update', null, { staffId: id, by: c.get('staffId') })
  return c.json({ ok: true })
})

// ---------- requests ----------
type Row = { version: number; delivery_version: number; id: string; user_id: string; service_id: string; status: string; data: string; staff_data: string; assignee_id: string | null; created_at: number; updated_at: number; display_name: string | null; phone_enc: string; assignee_name?: string | null }
const canSee = (c: C, assignee: string | null) => c.get('staffRole') !== 'agent' || assignee === null || assignee === c.get('staffId')

guarded.get('/stats', roles(...OPS), async (c) => {
  const r = await c.env.DB.prepare("SELECT status, COUNT(*) n FROM requests WHERE deleted_at IS NULL AND status!='draft' GROUP BY status").all<{ status: string; n: number }>()
  const un = await c.env.DB.prepare("SELECT COUNT(*) n FROM requests WHERE deleted_at IS NULL AND status!='draft' AND assignee_id IS NULL AND status IN ('submitted','review','needs_documents','authority','decision')").first<{ n: number }>()
  const mine = await c.env.DB.prepare("SELECT COUNT(*) n FROM requests WHERE deleted_at IS NULL AND assignee_id=? AND status IN ('submitted','review','needs_documents','authority','decision')").bind(c.get('staffId')).first<{ n: number }>()
  return c.json({ byStatus: Object.fromEntries(r.results.map((x) => [x.status, x.n])), unassigned: un?.n ?? 0, mine: mine?.n ?? 0 })
})

guarded.get('/requests', roles(...OPS), async (c) => {
  const status = c.req.query('status'), who = c.req.query('assignee')
  const limit = Math.min(Number(c.req.query('limit') ?? 50) || 50, 100), offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0)
  const where = ["r.deleted_at IS NULL", "r.status!='draft'"], args: unknown[] = []
  if (status && /^[a-z_]+$/.test(status)) { where.push('r.status=?'); args.push(status) }
  if (who === 'me') { where.push('r.assignee_id=?'); args.push(c.get('staffId')) } else if (who === 'unassigned') where.push('r.assignee_id IS NULL')
  if (c.get('staffRole') === 'agent') { where.push('(r.assignee_id IS NULL OR r.assignee_id=?)'); args.push(c.get('staffId')) }
  const rows = await c.env.DB.prepare(
    `SELECT r.id,r.user_id,r.service_id,r.status,r.data,r.staff_data,r.assignee_id,r.created_at,r.updated_at,u.display_name,u.phone_enc,m.name assignee_name
     FROM requests r JOIN users u ON u.id=r.user_id LEFT JOIN staff m ON m.id=r.assignee_id
     WHERE ${where.join(' AND ')} ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`).bind(...args, limit, offset).all<Row>()
  const q = (c.req.query('q') ?? '').trim().toLowerCase()
  const out = []
  for (const r of rows.results) {
    let d: any = {}; try { d = JSON.parse(r.data) } catch {}
    const phone = await openText(c.env.DATA_KEY, 'user-phone', r.phone_enc).catch(() => '')
    const item = { id: r.id, serviceId: r.service_id, status: r.status, title: d.title ?? null, customer: { id: r.user_id, name: d.name || r.display_name || '', phone }, assignee: r.assignee_id ? { id: r.assignee_id, name: r.assignee_name } : null, createdAt: r.created_at, updatedAt: r.updated_at }
    if (!q || JSON.stringify([item.title, item.customer.name, item.customer.phone, r.id, r.service_id]).toLowerCase().includes(q)) out.push(item)
  }
  return c.json({ requests: out })
})

async function loadRequest(c: C, id: string) {
  if (!isUuid(id)) return null
  const r = await c.env.DB.prepare(
    `SELECT r.id,r.user_id,r.service_id,r.status,r.data,r.staff_data,r.assignee_id,r.created_at,r.updated_at,r.version,r.delivery_version,u.display_name,u.phone_enc
     FROM requests r JOIN users u ON u.id=r.user_id WHERE r.id=? AND r.deleted_at IS NULL AND r.status!='draft'`).bind(id).first<Row>()
  return r && canSee(c, r.assignee_id) ? r : null
}

/** Optimistic lock: when the client says which version it saw, a newer change by someone else is a conflict, never an overwrite. */
const conflict = (c: C, r: Row, b: Record<string, unknown> | null) =>
  b && typeof b.expectedVersion === 'number' && b.expectedVersion !== r.version ? c.json({ error: 'version_conflict', current: r.version }, 409) : null


/** Source documents with a failed / manual-review check that nobody has resolved (re-run or internally accepted). */
async function blockedFiles(c: C, requestId: string): Promise<{ fileId: string; ruleCode: string; outcome: string }[]> {
  const r = await c.env.DB.prepare(
    `SELECT k.file_id,k.rule_code,k.outcome FROM document_checks k JOIN request_files f ON f.id=k.file_id
     WHERE k.request_id=? AND f.kind='source' AND f.deleted_at IS NULL AND k.outcome!='pass' AND k.superseded_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM document_overrides o WHERE o.check_id=k.id)`).bind(requestId).all<{ file_id: string; rule_code: string; outcome: string }>()
  return r.results.map((x) => ({ fileId: x.file_id, ruleCode: x.rule_code, outcome: x.outcome }))
}

async function addEvent(c: C, requestId: string, kind: string, ar: string, en: string, visible: boolean) {
  await c.env.DB.prepare('INSERT INTO request_events (id,request_id,actor,staff_id,kind,text_ar,text_en,visible,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(newId(), requestId, 'staff', c.get('staffId'), kind, ar, en, visible ? 1 : 0, Date.now()).run()
}

guarded.get('/requests/:id', roles(...OPS), async (c) => {
  const r = await loadRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const files = await c.env.DB.prepare('SELECT id,name,mime,size,kind,label,created_at,delivery_id,extracted FROM request_files WHERE request_id=? AND deleted_at IS NULL ORDER BY created_at').bind(r.id).all()
  const deliveries = await c.env.DB.prepare('SELECT d.id,d.version,d.status,d.published_at,d.created_at,(SELECT acknowledged_at FROM receipt_acks a WHERE a.request_id=d.request_id AND a.delivery_version=d.version) acknowledged_at FROM deliveries d WHERE d.request_id=? ORDER BY COALESCE(d.version, 1000000), d.created_at').bind(r.id).all()
  const checks = await c.env.DB.prepare('SELECT k.id,k.file_id,k.rule_code,k.rule_version,k.outcome,k.evidence,k.created_at,k.superseded_at,o.reason override_reason,o.created_at overridden_at FROM document_checks k LEFT JOIN document_overrides o ON o.check_id=k.id WHERE k.request_id=? ORDER BY k.created_at').bind(r.id).all()
  const blocked = await blockedFiles(c, r.id)
  const events = await c.env.DB.prepare('SELECT id,actor,kind,text_ar,text_en,visible,created_at FROM request_events WHERE request_id=? ORDER BY created_at').bind(r.id).all()
  const missing = await c.env.DB.prepare('SELECT id,label_ar,label_en,note_ar,note_en,replacement_file_id,resolved_at FROM missing_documents WHERE request_id=? ORDER BY created_at').bind(r.id).all()
  let data: any = {}, sd: any = {}; try { data = JSON.parse(r.data) } catch {} try { sd = JSON.parse(r.staff_data) } catch {}
  const ackV = await c.env.DB.prepare('SELECT MAX(delivery_version) v, MAX(acknowledged_at) at FROM receipt_acks WHERE request_id=?').bind(r.id).first<{ v: number | null; at: number | null }>()
  const phone = await openText(c.env.DATA_KEY, 'user-phone', r.phone_enc).catch(() => '')
  await audit(c, 'staff.view_request', null, { requestId: r.id, by: c.get('staffId') })
  return c.json({ request: { id: r.id, serviceId: r.service_id, status: r.status, assigneeId: r.assignee_id, createdAt: r.created_at, updatedAt: r.updated_at, version: r.version, deliveryVersion: r.delivery_version, acknowledgedVersion: ackV?.v ?? 0, acknowledgedAt: ackV?.at ?? null, data, staff: sd }, customer: { id: r.user_id, name: data.name || r.display_name || '', phone }, files: files.results, deliveries: deliveries.results, checks: checks.results, blocked, events: events.results, missing: missing.results, transitions: TRANSITIONS[r.status] ?? [] })
})

guarded.post('/requests/:id/assign', roles(...OPS), async (c) => {
  const r = await loadRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const cf = conflict(c, r, b); if (cf) return cf
  let to: string | null = typeof b?.staffId === 'string' ? b.staffId : null
  if (c.get('staffRole') === 'agent') to = to === null || to === c.get('staffId') ? to : 'forbidden' // agents may only take or release their own
  if (to === 'forbidden') return c.json({ error: 'forbidden' }, 403)
  if (to) {
    const m = await c.env.DB.prepare('SELECT name FROM staff WHERE id=? AND active=1 AND role IN (?,?,?)').bind(to, 'owner', 'manager', 'agent').first<{ name: string }>()
    if (!m) return c.json({ error: 'invalid_request' }, 400)
  }
  await c.env.DB.prepare('UPDATE requests SET assignee_id=?, version=version+1, updated_at=? WHERE id=?').bind(to, Date.now(), r.id).run()
  await addEvent(c, r.id, 'assign', to ? 'تم إسناد الطلب لموظف' : 'أُلغي إسناد الطلب', to ? 'Request assigned' : 'Request unassigned', false)
  return c.json({ ok: true })
})

guarded.post('/requests/:id/status', roles(...OPS), async (c) => {
  const r = await loadRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const cf = conflict(c, r, b); if (cf) return cf
  const to = typeof b?.status === 'string' ? b.status : ''
  if (!(TRANSITIONS[r.status] ?? []).includes(to)) return c.json({ error: 'invalid_transition', allowed: TRANSITIONS[r.status] ?? [] }, 409)
  let sd: any = {}; try { sd = JSON.parse(r.staff_data) } catch {}
  const now = new Date().toISOString()
  if (to === 'ready_for_authority') { // internal approval to submit: no unresolved failed document check may remain
    const blocked = await blockedFiles(c, r.id)
    if (blocked.length) return c.json({ error: 'documents_blocked', files: blocked }, 409)
    const unscanned = await c.env.DB.prepare("SELECT id FROM request_files WHERE request_id=? AND kind='source' AND deleted_at IS NULL AND scan_status!='clean'").bind(r.id).all<{ id: string }>()
    if (unscanned.results.length) return c.json({ error: 'scan_pending', files: unscanned.results.map((x) => x.id) }, 409)
  }
  // Our fee is agreed and paid in advance (bank transfer or cash, verified), and the government fee is paid by the customer to the authority: both before we submit.
  if (to === 'authority') {
    const [tot, gov] = [await totalsFor(c.env, r.id), await govFor(c.env, r.id)]
    const unmet: string[] = []
    if (!tot.invoice || tot.remaining > 0 || tot.pending > 0) unmet.push('company_fee')
    if (gov.total > 0 && gov.state !== 'paid') unmet.push('government_fee')
    if (unmet.length) {
      const why = typeof b?.overrideReason === 'string' ? b.overrideReason.trim() : ''
      if (!(c.get('staffRole') === 'owner' || c.get('staffRole') === 'manager')) return c.json({ error: 'payment_required', unmet }, 409)
      if (why.length < 10) return c.json({ error: 'payment_required', unmet, overridable: true }, 409)
      await audit(c, 'staff.payment_gate_override', null, { requestId: r.id, unmet, reason: why.slice(0, 300), by: c.get('staffId') })
      await addEvent(c, r.id, 'note', `Payment gate overridden (${unmet.join(', ')}): ${why.slice(0, 300)}`, `Payment gate overridden (${unmet.join(', ')}): ${why.slice(0, 300)}`, false)
    }
  }
  // "With authority" is a fact that needs evidence of the actual submission; a rejection needs an understandable reason.
  if (to === 'authority') {
    const ref = typeof b?.reference === 'string' ? b.reference.trim() : ''
    if (ref.length < 3 || ref.length > 100) return c.json({ error: 'reference_required' }, 400)
    sd.authorityRef = ref; sd.authorityAt = now
  }
  if (to === 'rejected') {
    const why = typeof b?.reason === 'string' ? b.reason.trim() : ''
    if (why.length < 3) return c.json({ error: 'reason_required' }, 400)
    sd.issue = why.slice(0, 300)
  }
  if (typeof b?.expectedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.expectedAt)) sd.expectedAt = b.expectedAt
  if (to === 'completed') sd.completedAt = now
  await c.env.DB.prepare('UPDATE requests SET status=?, staff_data=?, assignee_id=COALESCE(assignee_id,?), version=version+1, updated_at=? WHERE id=?').bind(to, JSON.stringify(sd), c.get('staffId'), Date.now(), r.id).run()
  const [ar, en] = LABEL[to] as [string, string]
  await addEvent(c, r.id, 'status', ar, en, true)
  if (to === 'authority') await addEvent(c, r.id, 'note', `Submitted to authority. Reference: ${sd.authorityRef}`, `Submitted to authority. Reference: ${sd.authorityRef}`, false)
  if (typeof b?.note === 'string' && b.note.trim()) await addEvent(c, r.id, 'note', b.note.trim().slice(0, 500), b.note.trim().slice(0, 500), false)
  await audit(c, 'staff.status', null, { requestId: r.id, to, by: c.get('staffId') })
  return c.json({ ok: true, status: to, version: r.version + 1 })
})

guarded.post('/requests/:id/missing', roles(...OPS), async (c) => {
  const r = await loadRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  if (!(TRANSITIONS[r.status] ?? []).includes('needs_documents')) return c.json({ error: 'invalid_transition' }, 409)
  const b = await jsonBody(c)
  const cf = conflict(c, r, b); if (cf) return cf
  const items = Array.isArray(b?.items) ? (b.items as any[]).slice(0, 10) : []
  const ok = items.length > 0 && items.every((i) => typeof i?.labelAr === 'string' && typeof i?.labelEn === 'string' && i.labelAr.trim() && i.labelEn.trim())
  if (!ok) return c.json({ error: 'invalid_request' }, 400)
  const stmts = items.map((i) => c.env.DB.prepare('INSERT INTO missing_documents (id,request_id,label_ar,label_en,note_ar,note_en,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(newId(), r.id, String(i.labelAr).slice(0, 120), String(i.labelEn).slice(0, 120), String(i.noteAr ?? '').slice(0, 300), String(i.noteEn ?? '').slice(0, 300), Date.now()))
  stmts.push(c.env.DB.prepare("UPDATE requests SET status='needs_documents', version=version+1, updated_at=? WHERE id=?").bind(Date.now(), r.id))
  await c.env.DB.batch(stmts)
  await addEvent(c, r.id, 'missing', 'طُلب استكمال مستندات', 'Additional documents requested', true)
  return c.json({ ok: true })
})

guarded.post('/requests/:id/notes', roles(...OPS), async (c) => {
  const r = await loadRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const text = typeof b?.text === 'string' ? b.text.trim().slice(0, 1000) : ''
  if (!text) return c.json({ error: 'invalid_request' }, 400)
  await addEvent(c, r.id, 'note', text, text, false) // internal: never shown to the customer
  return c.json({ ok: true })
})

// ---------- documents ----------
guarded.get('/files/:fileId', roles(...OPS), async (c) => {
  const fid = c.req.param('fileId')
  if (!isUuid(fid)) return c.json({ error: 'not_found' }, 404)
  if (!(await allow(c.env, `sdl:${c.get('staffId')}`, 120, 3600))) return c.json({ error: 'too_many_requests' }, 429)
  const f = await c.env.DB.prepare('SELECT f.r2_key,f.name,f.mime,f.user_id,f.request_id,f.scan_status,r.assignee_id FROM request_files f JOIN requests r ON r.id=f.request_id WHERE f.id=? AND f.deleted_at IS NULL').bind(fid)
    .first<{ r2_key: string; name: string; mime: string; user_id: string; request_id: string; scan_status: string; assignee_id: string | null }>()
  if (!f || !canSee(c, f.assignee_id) || f.scan_status === 'infected' || f.scan_status === 'error') return c.json({ error: 'not_found' }, 404)
  if (f.scan_status !== 'clean') return c.json({ error: 'scan_pending' }, 423) // no verdict yet is not a clean verdict: staff cannot open it
  const obj = await c.env.DOCS.get(f.r2_key)
  if (!obj) return c.json({ error: 'not_found' }, 404)
  const plain = await open(c.env.DATA_KEY, `file:${f.user_id}:${fid}`, new Uint8Array(await obj.arrayBuffer()))
  await audit(c, 'staff.file_view', null, { fileId: fid, requestId: f.request_id, by: c.get('staffId') })
  return new Response(plain as BufferSource, { headers: { 'content-type': f.mime, 'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; frame-ancestors 'self'", 'x-frame-options': 'SAMEORIGIN' } })
})

guarded.put('/requests/:id/files', roles(...OPS), async (c) => {
  const r = await loadRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const kind = c.req.query('kind') === 'invoice' ? 'invoice' : 'final'
  if (Number(c.req.header('content-length') ?? '0') > MAX_FILE_BYTES) return c.json({ error: 'too_large' }, 413)
  const bytes = new Uint8Array(await c.req.arrayBuffer())
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) return c.json({ error: 'too_large' }, 413)
  if (uploadsBlocked(c.env)) return c.json({ error: 'scanner_unavailable' }, 503)
  const t = sniffFile(bytes)
  if (!t) return c.json({ error: 'unsupported_type' }, 415)
  const scan = scanBytes(c.env, bytes)
  if (scan.status === 'infected') return c.json({ error: 'infected' }, 422)
  // Files go to the request's DRAFT delivery package. The customer sees nothing until the package is published.
  let draft = await c.env.DB.prepare("SELECT id FROM deliveries WHERE request_id=? AND status='draft'").bind(r.id).first<{ id: string }>()
  if (!draft) {
    const did = newId()
    await c.env.DB.prepare("INSERT INTO deliveries (id,request_id,status,created_by,created_at) VALUES (?,?,'draft',?,?)").bind(did, r.id, c.get('staffId'), Date.now()).run()
    draft = { id: did }
  }
  const fid = newId(), key = `u/${r.user_id}/${fid}`
  await c.env.DOCS.put(key, await seal(c.env.DATA_KEY, `file:${r.user_id}:${fid}`, bytes), { httpMetadata: { contentType: 'application/octet-stream' } })
  const name = safeFileName(c.req.header('x-file-name') ? decodeURIComponent(c.req.header('x-file-name') as string) : null, t.ext)
  const label = (c.req.header('x-file-label') ? decodeURIComponent(c.req.header('x-file-label') as string) : '').slice(0, 120) || null
  await c.env.DB.prepare('INSERT INTO request_files (id,request_id,user_id,r2_key,name,mime,size,sha256,created_at,kind,label,delivery_id,scan_status,scan_engine,scanned_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(fid, r.id, r.user_id, key, name, t.mime, bytes.length, await sha256Hex(bytes), Date.now(), kind, label, draft.id, scan.status, scan.engine, scan.status === 'pending' ? null : Date.now()).run()
  await addEvent(c, r.id, 'file', 'أُضيف ملف إلى مسودة التسليم', 'File added to the draft delivery', false) // internal until published
  await audit(c, 'staff.file_upload', null, { fileId: fid, requestId: r.id, kind, by: c.get('staffId') })
  return c.json({ id: fid, name, kind, deliveryId: draft.id, published: false }, 201)
})

/** Staff can remove a file from the DRAFT package; published packages are immutable (replace by publishing a new version). */
guarded.delete('/files/:fileId', roles(...OPS), async (c) => {
  const fid = c.req.param('fileId')
  if (!isUuid(fid)) return c.json({ error: 'not_found' }, 404)
  const f = await c.env.DB.prepare("SELECT f.r2_key,f.request_id,r.assignee_id,d.status ds FROM request_files f JOIN requests r ON r.id=f.request_id LEFT JOIN deliveries d ON d.id=f.delivery_id WHERE f.id=? AND f.deleted_at IS NULL AND f.kind IN ('final','invoice')").bind(fid)
    .first<{ r2_key: string; request_id: string; assignee_id: string | null; ds: string | null }>()
  if (!f || !canSee(c, f.assignee_id)) return c.json({ error: 'not_found' }, 404)
  if (f.ds !== 'draft') return c.json({ error: 'published_is_immutable' }, 409)
  await c.env.DOCS.delete(f.r2_key)
  await c.env.DB.prepare('UPDATE request_files SET deleted_at=?, r2_key=? WHERE id=?').bind(Date.now(), 'deleted', fid).run()
  await audit(c, 'staff.draft_file_remove', null, { fileId: fid, by: c.get('staffId') })
  return c.json({ ok: true })
})

/** Explicit publish: freezes the draft as the next delivery version, supersedes the previous one, and shows it to the customer. */
guarded.post('/requests/:id/deliveries/publish', roles(...OPS), async (c) => {
  const r = await loadRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const cf = conflict(c, r, b); if (cf) return cf
  const draft = await c.env.DB.prepare("SELECT id FROM deliveries WHERE request_id=? AND status='draft'").bind(r.id).first<{ id: string }>()
  const items = draft ? (await c.env.DB.prepare('SELECT id,kind,sha256 FROM request_files WHERE delivery_id=? AND deleted_at IS NULL ORDER BY id').bind(draft.id).all<{ id: string; kind: string; sha256: string }>()).results : []
  if (!draft || !items.some((x) => x.kind === 'final')) return c.json({ error: 'no_final_files' }, 409) // nothing to publish without a final file
  const unscanned = await c.env.DB.prepare("SELECT COUNT(*) n FROM request_files WHERE delivery_id=? AND deleted_at IS NULL AND scan_status!='clean'").bind(draft.id).first<{ n: number }>()
  if ((unscanned?.n ?? 0) > 0) return c.json({ error: 'scan_pending' }, 409) // nothing is published until every file has a clean verdict
  if (r.status !== 'decision' && r.status !== 'completed') return c.json({ error: 'authority_not_finished' }, 409) // deliver only once the authority has finished
  const mx = await c.env.DB.prepare('SELECT MAX(version) v FROM deliveries WHERE request_id=?').bind(r.id).first<{ v: number | null }>()
  const version = (mx?.v ?? 0) + 1
  const manifest = await sha256Hex(items.map((x) => `${x.id}:${x.sha256}`).join('|'))
  const now = Date.now()
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE deliveries SET status='superseded' WHERE request_id=? AND status='published'").bind(r.id),
    c.env.DB.prepare("UPDATE deliveries SET status='published', version=?, manifest_hash=?, published_by=?, published_at=? WHERE id=?").bind(version, manifest, c.get('staffId'), now, draft.id),
    c.env.DB.prepare('UPDATE requests SET delivery_version=?, version=version+1, updated_at=? WHERE id=?').bind(version, now, r.id),
  ])
  await addEvent(c, r.id, 'file', 'ملفات التسليم جاهزة', `Delivery files published (version ${version})`, true)
  await audit(c, 'staff.delivery_publish', null, { requestId: r.id, version, by: c.get('staffId') })
  return c.json({ ok: true, version, manifestHash: manifest }, 201)
})

// ---------- document checks (internal review aids) and overrides ----------
const loadFile = async (c: C, fid: string) => {
  if (!isUuid(fid)) return null
  const f = await c.env.DB.prepare("SELECT f.id,f.request_id,f.kind,f.user_id,f.scan_status,r.assignee_id,r.created_at FROM request_files f JOIN requests r ON r.id=f.request_id WHERE f.id=? AND f.deleted_at IS NULL AND r.deleted_at IS NULL").bind(fid)
    .first<{ id: string; request_id: string; kind: string; user_id: string; scan_status: string; assignee_id: string | null; created_at: number }>()
  return f && canSee(c, f.assignee_id) ? f : null
}
const newCheck = async (c: C, f: { id: string; request_id: string }, rule: string, outcome: string, evidence: unknown) => {
  const now = Date.now()
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE document_checks SET superseded_at=? WHERE file_id=? AND rule_code=? AND superseded_at IS NULL').bind(now, f.id, rule), // a re-run replaces the previous result, history kept
    c.env.DB.prepare('INSERT INTO document_checks (id,file_id,request_id,rule_code,rule_version,outcome,evidence,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(newId(), f.id, f.request_id, rule, (RULES[rule] as { version: string }).version, outcome, JSON.stringify(evidence).slice(0, 1000), c.get('staffId'), now),
  ])
}

/** Staff records what they read from a document; the system evaluates the rules (the passport rule uses calendar months). */
guarded.post('/files/:fileId/extracted', roles(...OPS), async (c) => {
  const f = await loadFile(c, c.req.param('fileId'))
  if (!f || f.kind !== 'source') return c.json({ error: 'not_found' }, 404)
  if (f.scan_status !== 'clean') return c.json({ error: 'scan_pending' }, 423)
  const b = await jsonBody(c)
  const type = b?.docType
  if (!['passport', 'id', 'licence'].includes(type as string)) return c.json({ error: 'invalid_request' }, 400)
  const expiry = typeof b?.expiry === 'string' ? b.expiry : null
  const defaultBase = new Date(f.created_at + 4 * 3600_000).toISOString().slice(0, 10) // request creation day in Dubai
  const base = typeof b?.baseDate === 'string' && c.get('staffRole') !== 'agent' ? b.baseDate : defaultBase // only owner/manager may choose another reference date
  await c.env.DB.prepare('UPDATE request_files SET extracted=? WHERE id=?').bind(JSON.stringify({ docType: type, expiry, holder: typeof b?.holder === 'string' ? b.holder.slice(0, 80) : null, source: 'manual', by: c.get('staffId') }), f.id).run()
  let result: { outcome: string; evidence: unknown } | null = null
  if (type === 'passport') {
    result = passportValidity(expiry, base, 6)
    if (result.outcome === 'pass' && c.get('staffRole') === 'agent') { // an agent cannot turn an unresolved failure into a pass by re-reading the document
      const live = await c.env.DB.prepare("SELECT 1 x FROM document_checks WHERE file_id=? AND rule_code='passport_validity_6m' AND superseded_at IS NULL AND outcome!='pass' AND NOT EXISTS (SELECT 1 FROM document_overrides o WHERE o.check_id=document_checks.id) LIMIT 1").bind(f.id).first()
      if (live) return c.json({ error: 'manager_required' }, 403)
    }
    await newCheck(c, f, 'passport_validity_6m', result.outcome, result.evidence)
  }
  await audit(c, 'staff.doc_extracted', null, { fileId: f.id, by: c.get('staffId') }) // no document numbers in the log
  return c.json({ ok: true, result })
})

/** Staff records a manual rule outcome (e.g. a name mismatch found on review). */
guarded.post('/files/:fileId/checks', roles(...OPS), async (c) => {
  const f = await loadFile(c, c.req.param('fileId'))
  if (!f || f.kind !== 'source') return c.json({ error: 'not_found' }, 404)
  if (f.scan_status !== 'clean') return c.json({ error: 'scan_pending' }, 423)
  const b = await jsonBody(c)
  const rule = typeof b?.ruleCode === 'string' ? b.ruleCode : ''
  if (!RULES[rule] || !['pass', 'fail', 'manual_review'].includes(b?.outcome as string)) return c.json({ error: 'invalid_request' }, 400)
  if (['file_signature', 'file_size', 'malware_scan'].includes(rule)) return c.json({ error: 'system_rule' }, 400) // only the system records these
  const outcome = b?.outcome as string
  if (outcome === 'pass') {
    // A failed/under-review result is lifted only through the audited override (owner/manager + reason), never by recording a manual pass.
    const live = await c.env.DB.prepare("SELECT 1 x FROM document_checks WHERE file_id=? AND rule_code=? AND superseded_at IS NULL AND outcome!='pass' AND NOT EXISTS (SELECT 1 FROM document_overrides o WHERE o.check_id=document_checks.id) LIMIT 1").bind(f.id, rule).first()
    if (live) return c.json({ error: 'use_override' }, 409)
    if (c.get('staffRole') === 'agent') return c.json({ error: 'manager_required' }, 403)
  }
  await newCheck(c, f, rule, outcome, { note: typeof b?.note === 'string' ? b.note.slice(0, 300) : '' })
  return c.json({ ok: true })
})

/** Internal acceptance of a document that a rule failed, after review. Owner/manager only; reason, rule, rule version, member and time are recorded. Never for malware/signature/size. */
guarded.post('/files/:fileId/override', roles('owner', 'manager'), async (c) => {
  const f = await loadFile(c, c.req.param('fileId'))
  if (!f || f.kind !== 'source') return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const reason = typeof b?.reason === 'string' ? b.reason.trim().slice(0, 500) : ''
  if (reason.length < 10) return c.json({ error: 'reason_required' }, 400)
  const chk = typeof b?.checkId === 'string' && isUuid(b.checkId)
    ? await c.env.DB.prepare('SELECT id,rule_code,rule_version,outcome FROM document_checks WHERE id=? AND file_id=? AND superseded_at IS NULL').bind(b.checkId, f.id).first<{ id: string; rule_code: string; rule_version: string; outcome: string }>() : null
  if (!chk || chk.outcome === 'pass') return c.json({ error: 'not_found' }, 404)
  if (!RULES[chk.rule_code]?.overridable) return c.json({ error: 'not_overridable' }, 400)
  try {
    await c.env.DB.prepare('INSERT INTO document_overrides (id,check_id,file_id,request_id,rule_code,rule_version,staff_id,reason,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(newId(), chk.id, f.id, f.request_id, chk.rule_code, chk.rule_version, c.get('staffId'), reason, Date.now()).run()
  } catch { return c.json({ error: 'already_overridden' }, 409) }
  const me = await c.env.DB.prepare('SELECT name FROM staff WHERE id=?').bind(c.get('staffId')).first<{ name: string }>()
  const txt = `Document accepted internally after review: rule ${chk.rule_code} v${chk.rule_version} overridden by ${me?.name ?? c.get('staffId')}. Reason: ${reason}. (Internal approval only: not proof of authenticity or of government acceptance.)`
  await c.env.DB.prepare("INSERT INTO request_events (id,request_id,actor,staff_id,kind,text_ar,text_en,visible,created_at) VALUES (?,?,'staff',?,'note',?,?,0,?)").bind(newId(), f.request_id, c.get('staffId'), txt, txt, Date.now()).run()
  await audit(c, 'staff.doc_override', null, { fileId: f.id, requestId: f.request_id, rule: chk.rule_code, version: chk.rule_version, by: c.get('staffId') })
  return c.json({ ok: true })
})

// ---------- which sign-in methods are available (public; reveals configuration only) ----------
staff.get('/auth/methods', (c) => c.json({
  passkey: true, authenticator: true,
  whatsappMessage: !!c.env.WA_BUSINESS_NUMBER,
  whatsappCode: !!(c.env.WA_TOKEN && c.env.WA_PHONE_NUMBER_ID && c.env.WA_OTP_TEMPLATE),
}))

// ---------- a login code delivered to the member's WhatsApp (authentication template; paid by Meta) ----------
const OTP_TTL = 5 * 60 * 1000
staff.post('/auth/otp/request', async (c) => {
  const b = await jsonBody(c)
  const phone = normalizePhone(b?.phone)
  const lang = b?.language === 'en' ? 'en' : 'ar'
  if (!phone) return c.json({ error: 'invalid_phone' }, 400)
  if (!(c.env.WA_TOKEN && c.env.WA_PHONE_NUMBER_ID && c.env.WA_OTP_TEMPLATE)) return c.json({ error: 'not_configured' }, 503)
  const phoneHash = await hmacHex(c.env.PEPPER, `phone:${phone}`)
  if (!(await allow(c.env, `sotp:p:${phoneHash}`, 3, 600)) || !(await allow(c.env, `sotp:i:${clientIp(c)}`, 10, 600))) return c.json({ error: 'too_many_requests' }, 429)
  const id = newId()
  const m = await staffByPhone(c.env, phoneHash)
  if (m?.active) {
    const code = otpCode()
    await c.env.DB.prepare("INSERT INTO otp_challenges (id,phone_hash,code_hash,expires_at,created_at,purpose) VALUES (?,?,?,?,?,'staff')")
      .bind(id, phoneHash, await hmacHex(c.env.PEPPER, `sotp:${id}:${code}`), Date.now() + OTP_TTL, Date.now()).run()
    const sent = await sendWhatsAppCode(c.env, phone.replace('+', ''), code, lang)
    await audit(c, sent ? 'staff.otp_sent' : 'staff.otp_send_failed', null, { staffId: m.id })
  }
  // Same answer whether or not the number is on the team, and whether or not delivery worked.
  return c.json({ challengeId: id, expiresIn: OTP_TTL / 1000 })
})

staff.post('/auth/otp/verify', async (c) => {
  const b = await jsonBody(c)
  const phone = normalizePhone(b?.phone)
  const id = typeof b?.challengeId === 'string' ? b.challengeId : '', code = typeof b?.code === 'string' ? b.code.trim() : ''
  if (!phone || !isUuid(id) || !/^\d{6}$/.test(code)) return c.json({ error: 'invalid_code' }, 401)
  const phoneHash = await hmacHex(c.env.PEPPER, `phone:${phone}`)
  if (await tooMany(c, phoneHash, 'sotpv')) return c.json({ error: 'too_many_requests' }, 429)
  const ch = await c.env.DB.prepare("SELECT code_hash,attempts,expires_at,consumed_at FROM otp_challenges WHERE id=? AND phone_hash=? AND purpose='staff'").bind(id, phoneHash)
    .first<{ code_hash: string; attempts: number; expires_at: number; consumed_at: number | null }>()
  if (!ch || ch.consumed_at || ch.expires_at < Date.now() || ch.attempts >= 5) return c.json({ error: 'invalid_code' }, 401)
  const upd = await c.env.DB.prepare('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=? AND attempts<5').bind(id).run() // count first so parallel guesses cannot exceed the cap
  if (!upd.meta.changes) return c.json({ error: 'invalid_code' }, 401)
  if (!timingSafeEqual(await hmacHex(c.env.PEPPER, `sotp:${id}:${code}`), ch.code_hash)) { await audit(c, 'staff.otp_fail', null); return c.json({ error: 'invalid_code' }, 401) }
  const used = await c.env.DB.prepare('UPDATE otp_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL').bind(Date.now(), id).run()
  const m = await staffByPhone(c.env, phoneHash)
  if (!used.meta.changes || !m || !m.active) return c.json({ error: 'invalid_code' }, 401)
  return openSession(c, m.id, m.role)
})

// ---------- biometric sign-in: passkeys (WebAuthn) ----------
// The fingerprint/face never leaves the phone; the server only stores a public key. User verification is required.
const CHALLENGE_TTL = 5 * 60 * 1000
const rp = (c: C) => {
  const u = new URL(c.req.url)
  return { rpID: c.env.WEBAUTHN_RP_ID ?? u.hostname, origins: (c.env.WEBAUTHN_ORIGINS ?? u.origin).split(',').map((x) => x.trim()).filter(Boolean) }
}
async function saveChallenge(c: C, challenge: string, purpose: 'register' | 'login', staffId: string | null) {
  const id = newId()
  await c.env.DB.prepare('INSERT INTO webauthn_challenges (id,challenge,purpose,staff_id,expires_at) VALUES (?,?,?,?,?)').bind(id, challenge, purpose, staffId, Date.now() + CHALLENGE_TTL).run()
  if (Math.random() < 0.05) await c.env.DB.prepare('DELETE FROM webauthn_challenges WHERE expires_at < ?').bind(Date.now() - 3600_000).run()
  return id
}
/** A challenge can be used exactly once. */
async function takeChallenge(c: C, id: unknown, purpose: 'register' | 'login', staffId: string | null) {
  if (typeof id !== 'string' || !isUuid(id)) return null
  const row = await c.env.DB.prepare('SELECT challenge,staff_id FROM webauthn_challenges WHERE id=? AND purpose=? AND used_at IS NULL AND expires_at>?').bind(id, purpose, Date.now()).first<{ challenge: string; staff_id: string | null }>()
  if (!row || (purpose === 'register' && row.staff_id !== staffId)) return null
  const r = await c.env.DB.prepare('UPDATE webauthn_challenges SET used_at=? WHERE id=? AND used_at IS NULL').bind(Date.now(), id).run()
  return r.meta.changes ? row.challenge : null
}

guarded.post('/passkeys/register/options', async (c) => {
  const me = await c.env.DB.prepare('SELECT name FROM staff WHERE id=?').bind(c.get('staffId')).first<{ name: string }>()
  const existing = await c.env.DB.prepare('SELECT credential_id FROM staff_passkeys WHERE staff_id=?').bind(c.get('staffId')).all<{ credential_id: string }>()
  const { rpID } = rp(c)
  const options = await generateRegistrationOptions({
    rpName: 'TRUTHFUL PRO', rpID, userName: me?.name ?? 'staff', userDisplayName: me?.name ?? 'staff', userID: new Uint8Array(new TextEncoder().encode(c.get('staffId'))),
    attestationType: 'none', excludeCredentials: existing.results.map((x) => ({ id: x.credential_id })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required', authenticatorAttachment: 'platform' },
  })
  return c.json({ challengeId: await saveChallenge(c, options.challenge, 'register', c.get('staffId')), options })
})

guarded.post('/passkeys/register/verify', async (c) => {
  const b = await jsonBody(c, 16 * 1024)
  const challenge = await takeChallenge(c, b?.challengeId, 'register', c.get('staffId'))
  if (!challenge || !b?.response) return c.json({ error: 'invalid_request' }, 400)
  const { rpID, origins } = rp(c)
  let v
  try { v = await verifyRegistrationResponse({ response: b.response as never, expectedChallenge: challenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: true }) } catch { return c.json({ error: 'verification_failed' }, 400) }
  if (!v.verified || !v.registrationInfo) return c.json({ error: 'verification_failed' }, 400)
  const cred = v.registrationInfo.credential
  const name = typeof b.deviceName === 'string' && b.deviceName.trim() ? b.deviceName.trim().slice(0, 60) : 'Device'
  await c.env.DB.prepare('INSERT INTO staff_passkeys (id,staff_id,credential_id,public_key,counter,transports,device_name,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(newId(), c.get('staffId'), cred.id, b64(cred.publicKey), cred.counter, JSON.stringify(cred.transports ?? []), name, Date.now()).run()
  await audit(c, 'staff.passkey_add', null, { by: c.get('staffId') })
  return c.json({ ok: true })
})

guarded.get('/passkeys', async (c) => {
  const r = await c.env.DB.prepare('SELECT id,device_name,created_at,last_used_at FROM staff_passkeys WHERE staff_id=? ORDER BY created_at').bind(c.get('staffId')).all()
  return c.json({ passkeys: r.results })
})
guarded.delete('/passkeys/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'not_found' }, 404)
  const r = await c.env.DB.prepare('DELETE FROM staff_passkeys WHERE id=? AND staff_id=?').bind(id, c.get('staffId')).run()
  if (!r.meta.changes) return c.json({ error: 'not_found' }, 404)
  await audit(c, 'staff.passkey_remove', null, { by: c.get('staffId') })
  return c.json({ ok: true })
})

// Public: sign in with a fingerprint/face. No phone number is typed: the device offers its saved passkey.
staff.post('/auth/passkey/options', async (c) => {
  if (!(await allow(c.env, `pko:${clientIp(c)}`, 60, 600))) return c.json({ error: 'too_many_requests' }, 429)
  const { rpID } = rp(c)
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' })
  return c.json({ challengeId: await saveChallenge(c, options.challenge, 'login', null), options })
})

staff.post('/auth/passkey/verify', async (c) => {
  if (!(await allow(c.env, `pkv:${clientIp(c)}`, 30, 600))) return c.json({ error: 'too_many_requests' }, 429)
  const b = await jsonBody(c, 16 * 1024)
  const challenge = await takeChallenge(c, b?.challengeId, 'login', null)
  const resp = b?.response as { id?: string } | undefined
  if (!challenge || !resp || typeof resp.id !== 'string') return c.json({ error: 'invalid_passkey' }, 401)
  const row = await c.env.DB.prepare('SELECT k.id kid,k.public_key,k.counter,k.transports,k.credential_id,m.id staff_id,m.role,m.active FROM staff_passkeys k JOIN staff m ON m.id=k.staff_id WHERE k.credential_id=?').bind(resp.id)
    .first<{ kid: string; public_key: string; counter: number; transports: string | null; credential_id: string; staff_id: string; role: Role; active: number }>()
  if (!row || !row.active) { await audit(c, 'staff.passkey_fail', null); return c.json({ error: 'invalid_passkey' }, 401) }
  const { rpID, origins } = rp(c)
  let v
  try {
    v = await verifyAuthenticationResponse({
      response: b?.response as never, expectedChallenge: challenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: true,
      credential: { id: row.credential_id, publicKey: new Uint8Array(unb64(row.public_key)), counter: row.counter, transports: JSON.parse(row.transports ?? '[]') },
    })
  } catch { await audit(c, 'staff.passkey_fail', null); return c.json({ error: 'invalid_passkey' }, 401) }
  if (!v.verified) return c.json({ error: 'invalid_passkey' }, 401)
  await c.env.DB.prepare('UPDATE staff_passkeys SET counter=?, last_used_at=? WHERE id=?').bind(v.authenticationInfo.newCounter, Date.now(), row.kid).run()
  return openSession(c, row.staff_id, row.role)
})


// ---------- override (owner/manager): bypass the status machine, with a mandatory reason, fully audited ----------
const ALL_STATUS = ['submitted', 'review', 'needs_documents', 'ready_for_authority', 'authority', 'decision', 'completed', 'cancelled', 'rejected']
guarded.post('/requests/:id/override', roles('owner', 'manager'), async (c) => {
  const r = await loadRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const cf = conflict(c, r, b); if (cf) return cf
  const reason = typeof b?.reason === 'string' ? b.reason.trim().slice(0, 500) : ''
  if (reason.length < 3) return c.json({ error: 'reason_required' }, 400)
  const me = await c.env.DB.prepare('SELECT name FROM staff WHERE id=?').bind(c.get('staffId')).first<{ name: string }>()
  const done: string[] = []
  let sd: any = {}; try { sd = JSON.parse(r.staff_data) } catch {}
  let data: any = {}; try { data = JSON.parse(r.data) } catch {}
  let status = r.status, dataChanged = false
  if (typeof b?.status === 'string') {
    if (!ALL_STATUS.includes(b.status) || b.status === r.status) return c.json({ error: 'invalid_status' }, 400)
    status = b.status; done.push(`status ${r.status} -> ${status}`)
    if (status === 'completed') sd.completedAt = new Date().toISOString(); else delete sd.completedAt // reopening clears the completion date
  }
  if (typeof b?.expectedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.expectedAt)) { sd.expectedAt = b.expectedAt; done.push('expected date') }
  if (typeof b?.customerName === 'string' && b.customerName.trim()) { data.name = b.customerName.trim().slice(0, 80); dataChanged = true; done.push('customer name') }
  if (!done.length) return c.json({ error: 'nothing_to_change' }, 400)
  await c.env.DB.prepare('UPDATE requests SET status=?, staff_data=?, data=?, version=version+1, updated_at=? WHERE id=?')
    .bind(status, JSON.stringify(sd), dataChanged ? JSON.stringify(data) : r.data, Date.now(), r.id).run()
  if (status !== r.status) { const [ar, en] = LABEL[status] as [string, string]; await addEvent(c, r.id, 'status', ar, en, true) }
  const txt = `OVERRIDE by ${me?.name ?? c.get('staffId')}: ${done.join(', ')}. Reason: ${reason}`
  await addEvent(c, r.id, 'note', txt, txt, false)
  await audit(c, 'staff.override', null, { requestId: r.id, by: c.get('staffId'), changes: done, reason })
  return c.json({ ok: true, status })
})

// ---------- overview, activity, customers ----------
guarded.get('/overview', roles(...OPS), async (c) => {
  const open = "r.status IN ('submitted','review','needs_documents','authority','decision')"
  const dayStart = (() => { const d = new Date(Date.now() + 4 * 3600_000); d.setUTCHours(0, 0, 0, 0); return d.getTime() - 4 * 3600_000 })() // start of today in Dubai
  const scope = c.get('staffRole') === 'agent' ? ' AND (r.assignee_id IS NULL OR r.assignee_id=?)' : ''
  const args = c.get('staffRole') === 'agent' ? [c.get('staffId')] : []
  const one = (sql: string, ...a: unknown[]) => c.env.DB.prepare(sql).bind(...a).first<{ n: number }>()
  const newToday = await one(`SELECT COUNT(*) n FROM requests r WHERE r.deleted_at IS NULL AND r.status!='draft' AND r.created_at>=?${scope}`, dayStart, ...args)
  const doneToday = await one(`SELECT COUNT(*) n FROM requests r WHERE r.deleted_at IS NULL AND r.status='completed' AND r.updated_at>=?${scope}`, dayStart, ...args)
  const openN = await one(`SELECT COUNT(*) n FROM requests r WHERE r.deleted_at IS NULL AND ${open}${scope}`, ...args)
  const stale = await c.env.DB.prepare(
    `SELECT r.id,r.status,r.data,r.updated_at,u.display_name FROM requests r JOIN users u ON u.id=r.user_id
     WHERE r.deleted_at IS NULL AND ${open}${scope} AND r.updated_at<? ORDER BY r.updated_at ASC LIMIT 8`).bind(...args, Date.now() - 24 * 3600_000).all<{ id: string; status: string; data: string; updated_at: number; display_name: string | null }>()
  const attention = stale.results.map((x) => { let d: any = {}; try { d = JSON.parse(x.data) } catch {} return { id: x.id, status: x.status, title: d.title ?? null, customer: d.name || x.display_name || '', waitingHours: Math.floor((Date.now() - x.updated_at) / 3600_000) } })
  let workload: unknown[] = []
  if (c.get('staffRole') !== 'agent') {
    workload = (await c.env.DB.prepare(`SELECT m.id,m.name,COUNT(r.id) n FROM staff m LEFT JOIN requests r ON r.assignee_id=m.id AND r.deleted_at IS NULL AND ${open} WHERE m.active=1 AND m.role IN ('owner','manager','agent') GROUP BY m.id ORDER BY n DESC`).all()).results
  }
  const ev = await c.env.DB.prepare(
    `SELECT e.id,e.request_id,e.actor,e.kind,e.text_ar,e.text_en,e.visible,e.created_at,r.data FROM request_events e JOIN requests r ON r.id=e.request_id
     WHERE r.deleted_at IS NULL AND r.status!='draft'${scope} ORDER BY e.created_at DESC LIMIT 15`).bind(...args).all<{ id: string; request_id: string; actor: string; kind: string; text_ar: string; text_en: string; visible: number; created_at: number; data: string }>()
  const activity = ev.results.map((e) => { let d: any = {}; try { d = JSON.parse(e.data) } catch {} return { id: e.id, requestId: e.request_id, actor: e.actor, kind: e.kind, text_ar: e.text_ar, text_en: e.text_en, internal: !e.visible, at: e.created_at, title: d.title ?? null, customer: d.name ?? '' } })
  return c.json({ newToday: newToday?.n ?? 0, completedToday: doneToday?.n ?? 0, open: openN?.n ?? 0, attention, workload, activity })
})

guarded.get('/customers', roles('owner', 'manager'), async (c) => {
  const q = (c.req.query('q') ?? '').trim().toLowerCase()
  const rows = await c.env.DB.prepare(
    `SELECT u.id,u.display_name,u.phone_enc,u.created_at,COUNT(r.id) requests,MAX(r.updated_at) last_at,
            SUM(CASE WHEN r.status IN ('submitted','review','needs_documents','authority','decision') THEN 1 ELSE 0 END) open
     FROM users u LEFT JOIN requests r ON r.user_id=u.id AND r.deleted_at IS NULL AND r.status!='draft'
     WHERE u.deleted_at IS NULL GROUP BY u.id ORDER BY COALESCE(MAX(r.updated_at),u.created_at) DESC LIMIT 200`).all<{ id: string; display_name: string | null; phone_enc: string; created_at: number; requests: number; last_at: number | null; open: number | null }>()
  const out = []
  for (const u of rows.results) {
    const phone = await openText(c.env.DATA_KEY, 'user-phone', u.phone_enc).catch(() => '')
    const name = u.display_name ?? ''
    if (!q || (name + ' ' + phone).toLowerCase().includes(q)) out.push({ id: u.id, name, phone, joinedAt: u.created_at, requests: u.requests, open: u.open ?? 0, lastAt: u.last_at })
  }
  return c.json({ customers: out })
})

guarded.get('/customers/:id', roles('owner', 'manager'), async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'not_found' }, 404)
  const u = await c.env.DB.prepare('SELECT id,display_name,phone_enc,language,created_at FROM users WHERE id=? AND deleted_at IS NULL').bind(id).first<{ id: string; display_name: string | null; phone_enc: string; language: string; created_at: number }>()
  if (!u) return c.json({ error: 'not_found' }, 404)
  const reqs = await c.env.DB.prepare("SELECT id,service_id,status,data,created_at,updated_at FROM requests WHERE user_id=? AND deleted_at IS NULL AND status!='draft' ORDER BY updated_at DESC").bind(id).all<{ id: string; service_id: string; status: string; data: string; created_at: number; updated_at: number }>()
  const consents = await c.env.DB.prepare('SELECT type,version,accepted,created_at FROM consents WHERE user_id=? ORDER BY created_at DESC LIMIT 20').bind(id).all()
  const phone = await openText(c.env.DATA_KEY, 'user-phone', u.phone_enc).catch(() => '')
  await audit(c, 'staff.view_customer', null, { customerId: id, by: c.get('staffId') })
  return c.json({
    customer: { id: u.id, name: u.display_name ?? '', phone, language: u.language, joinedAt: u.created_at },
    requests: reqs.results.map((r) => { let d: any = {}; try { d = JSON.parse(r.data) } catch {} return { id: r.id, serviceId: r.service_id, status: r.status, title: d.title ?? null, name: d.name ?? '', createdAt: r.created_at, updatedAt: r.updated_at } }),
    consents: consents.results,
  })
})


// ---------- finance: quotes, invoices, manual payments, refunds, documents (TEST copies only; no tax; no real payment gateway) ----------
const FIN: Role[] = ['owner', 'manager', 'accountant']          // issue / verify / cancel
const FIN_VIEW: Role[] = ['owner', 'manager', 'accountant', 'agent']

async function finRequest(c: C, id: string) {
  if (!isUuid(id)) return null
  const r = await c.env.DB.prepare("SELECT r.id,r.user_id,r.status,r.data,r.assignee_id,u.display_name FROM requests r JOIN users u ON u.id=r.user_id WHERE r.id=? AND r.deleted_at IS NULL AND r.status!='draft'").bind(id)
    .first<{ id: string; user_id: string; status: string; data: string; assignee_id: string | null; display_name: string | null }>()
  return r && canSee(c, r.assignee_id) ? r : null
}
const reqMeta = (r: { id: string; data: string; display_name: string | null }) => {
  let d: any = {}; try { d = JSON.parse(r.data) } catch { /* */ }
  return { customerName: d.name || r.display_name || '', requestTitle: d.title ?? null, requestRef: r.id.slice(0, 8) }
}
const visibleEvent = (c: C, requestId: string, ar: string, en: string, visible = true) => addEvent(c, requestId, 'status', ar, en, visible)
const itemsOf = async (c: C, quoteId: string) => (await c.env.DB.prepare('SELECT kind,description_ar,description_en,amount_fils FROM quote_items WHERE quote_id=? ORDER BY position').bind(quoteId).all<{ kind: string; description_ar: string; description_en: string; amount_fils: number }>()).results
const numberOf = async (c: C, docId: string | null) => docId ? (await c.env.DB.prepare('SELECT number FROM fin_documents WHERE id=?').bind(docId).first<{ number: string }>())?.number ?? null : null

guarded.get('/requests/:id/finance', roles(...FIN_VIEW), async (c) => {
  const r = await finRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const qs = await c.env.DB.prepare('SELECT id,version,status,total_fils,gov_fils,gov_pay_url,issued_at,accepted_at,document_id FROM quotes WHERE request_id=? ORDER BY version').bind(r.id).all<{ id: string; version: number; status: string; total_fils: number; gov_fils: number; gov_pay_url: string | null; issued_at: number | null; accepted_at: number | null; document_id: string | null }>()
  const quotes = []
  for (const q of qs.results) quotes.push({ ...q, number: await numberOf(c, q.document_id), items: await itemsOf(c, q.id) })
  const payments = await c.env.DB.prepare('SELECT id,kind,amount_fils,method,reference,status,created_by_kind,created_at,decided_at,decision_note,reason,receipt_id,proof_file_id,refund_of FROM payments WHERE request_id=? ORDER BY created_at').bind(r.id).all()
  const documents = await c.env.DB.prepare('SELECT id,doc_type,number,status,void_reason,total_fils,created_at,related_id FROM fin_documents WHERE request_id=? ORDER BY created_at').bind(r.id).all()
  const authority = await c.env.DB.prepare('SELECT id,amount_fils,reference,status,reported_by_kind,created_at,verified_at,note,proof_file_id FROM authority_payments WHERE request_id=? ORDER BY created_at').bind(r.id).all()
  return c.json({ quotes, payments: payments.results, documents: documents.results, totals: await totalsFor(c.env, r.id), gov: await govFor(c.env, r.id), authorityPayments: authority.results, tax: { configured: false }, test: true })
})

// Draft a quote (manual pricing: nothing is pre-priced). Replaces the open draft or starts the next version.
guarded.post('/requests/:id/quotes', roles(...FIN_VIEW), async (c) => {
  const r = await finRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  if (['cancelled', 'rejected'].includes(r.status)) return c.json({ error: 'request_closed' }, 409)
  const b = await jsonBody(c)
  const parsed = parseItems(b?.items)
  if (!parsed) return c.json({ error: 'invalid_items' }, 400)
  const govUrl = parseGovUrl(c.env, b?.govPayUrl)
  if (govUrl === undefined) return c.json({ error: 'invalid_pay_url' }, 400) // https + an official authority host only
  const now = Date.now()
  const insertItems = (qid: string) => parsed.items.map((it, i) => c.env.DB.prepare('INSERT INTO quote_items (id,quote_id,kind,description_ar,description_en,amount_fils,position) VALUES (?,?,?,?,?,?,?)').bind(newId(), qid, it.kind, it.ar, it.en, it.amount, i))
  try {
    const draft = await c.env.DB.prepare("SELECT id,version FROM quotes WHERE request_id=? AND status='draft'").bind(r.id).first<{ id: string; version: number }>()
    if (draft) {
      await c.env.DB.batch([c.env.DB.prepare('DELETE FROM quote_items WHERE quote_id=?').bind(draft.id), ...insertItems(draft.id), c.env.DB.prepare('UPDATE quotes SET total_fils=?, gov_fils=?, gov_pay_url=? WHERE id=?').bind(parsed.total, parsed.gov, govUrl, draft.id)])
      return c.json({ id: draft.id, version: draft.version, totalFils: parsed.total, govFils: parsed.gov })
    }
    const mx = await c.env.DB.prepare('SELECT MAX(version) v FROM quotes WHERE request_id=?').bind(r.id).first<{ v: number | null }>()
    const qid = newId(), version = (mx?.v ?? 0) + 1
    await c.env.DB.batch([c.env.DB.prepare("INSERT INTO quotes (id,request_id,version,status,total_fils,gov_fils,gov_pay_url,created_by,created_at) VALUES (?,?,?,'draft',?,?,?,?,?)").bind(qid, r.id, version, parsed.total, parsed.gov, govUrl, c.get('staffId'), now), ...insertItems(qid)])
    return c.json({ id: qid, version, totalFils: parsed.total, govFils: parsed.gov }, 201)
  } catch { return c.json({ error: 'conflict' }, 409) }
})

// Issue the draft: freezes the lines, supersedes older versions (their acceptance no longer counts) and numbers the document.
guarded.post('/quotes/:qid/issue', roles(...FIN), async (c) => {
  const qid = c.req.param('qid')
  const q = isUuid(qid) ? await c.env.DB.prepare('SELECT id,request_id,version,status,total_fils,gov_fils FROM quotes WHERE id=?').bind(qid).first<{ id: string; request_id: string; version: number; status: string; total_fils: number; gov_fils: number }>() : null
  const r = q ? await finRequest(c, q.request_id) : null
  if (!q || !r) return c.json({ error: 'not_found' }, 404)
  if (q.status !== 'draft') return c.json({ error: 'not_a_draft' }, 409)
  const items = await itemsOf(c, q.id)
  if (items.length === 0 || q.total_fils <= 0) return c.json({ error: 'empty_quote' }, 400)
  const active = await c.env.DB.prepare("SELECT 1 x FROM fin_documents WHERE request_id=? AND doc_type='invoice' AND status='issued'").bind(r.id).first()
  if (active) return c.json({ error: 'invoice_active' }, 409) // cancel the invoice (with a reason) before re-pricing
  const now = Date.now(), docId = newId()
  const snapshot = { ...reqMeta(r), lines: items.map((i) => ({ kind: i.kind, ar: i.description_ar, en: i.description_en, amount: i.amount_fils })), totals: { total: q.total_fils }, govTotal: q.gov_fils, extra: { version: q.version } }
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE quotes SET status='superseded' WHERE request_id=? AND status IN ('issued','accepted')").bind(r.id),
    c.env.DB.prepare("UPDATE quotes SET status='issued', issued_at=?, issued_by=?, document_id=? WHERE id=? AND status='draft'").bind(now, c.get('staffId'), docId, q.id),
    ...(await documentStatements(c.env, { id: docId, requestId: r.id, type: 'quote', relatedId: q.id, totalFils: q.total_fils, snapshot, createdBy: c.get('staffId'), now })),
  ])
  await visibleEvent(c, r.id, 'صدر عرض سعر جديد بانتظار موافقتك (نسخة تجريبية)', 'A new quotation is waiting for your approval (test copy)')
  await audit(c, 'finance.quote_issue', null, { requestId: r.id, version: q.version, by: c.get('staffId') })
  return c.json({ ok: true, documentId: docId, number: await numberOf(c, docId), version: q.version }, 201)
})

guarded.post('/requests/:id/invoice', roles(...FIN), async (c) => {
  const r = await finRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const q = await c.env.DB.prepare("SELECT id,version,total_fils,gov_fils,document_id FROM quotes WHERE request_id=? AND status='accepted' ORDER BY version DESC LIMIT 1").bind(r.id).first<{ id: string; version: number; total_fils: number; gov_fils: number; document_id: string | null }>()
  if (!q) return c.json({ error: 'quote_not_accepted' }, 409) // an invoice exists only for a quote the customer accepted
  const exists = await c.env.DB.prepare("SELECT 1 x FROM fin_documents WHERE request_id=? AND doc_type='invoice' AND status='issued'").bind(r.id).first()
  if (exists) return c.json({ error: 'invoice_exists' }, 409)
  const items = await itemsOf(c, q.id), now = Date.now(), docId = newId()
  const snapshot = { ...reqMeta(r), lines: items.map((i) => ({ kind: i.kind, ar: i.description_ar, en: i.description_en, amount: i.amount_fils })), totals: { total: q.total_fils, paid: 0, refunded: 0, remaining: q.total_fils }, govTotal: q.gov_fils, extra: { quoteNumber: await numberOf(c, q.document_id) } }
  try { await c.env.DB.batch(await documentStatements(c.env, { id: docId, requestId: r.id, type: 'invoice', relatedId: q.id, totalFils: q.total_fils, snapshot, createdBy: c.get('staffId'), now })) } catch { return c.json({ error: 'invoice_exists' }, 409) }
  await visibleEvent(c, r.id, 'صدرت الفاتورة (نسخة تجريبية)', 'Invoice issued (test copy)')
  await audit(c, 'finance.invoice_issue', null, { requestId: r.id, by: c.get('staffId') })
  return c.json({ ok: true, documentId: docId, number: await numberOf(c, docId) }, 201)
})

// Cancelling an invoice never deletes it: it is voided with a reason and a linked credit note. Impossible while money is held.
guarded.post('/invoices/:docId/cancel', roles(...FIN), async (c) => {
  const did = c.req.param('docId')
  const d = isUuid(did) ? await c.env.DB.prepare("SELECT id,request_id,number,total_fils,status FROM fin_documents WHERE id=? AND doc_type='invoice'").bind(did).first<{ id: string; request_id: string; number: string; total_fils: number; status: string }>() : null
  const r = d ? await finRequest(c, d.request_id) : null
  if (!d || !r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const reason = typeof b?.reason === 'string' ? b.reason.trim().slice(0, 300) : ''
  if (reason.length < 10) return c.json({ error: 'reason_required' }, 400)
  if (d.status !== 'issued') return c.json({ error: 'already_void' }, 409)
  const t = await totalsFor(c.env, r.id)
  if (t.net > 0 || t.pending > 0) return c.json({ error: t.net > 0 ? 'refund_first' : 'pending_payments' }, 409)
  const now = Date.now(), cn = newId()
  const snapshot = { ...reqMeta(r), lines: [], totals: { amount: d.total_fils }, extra: { originalNumber: d.number, reason } }
  try {
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE fin_documents SET status='void', void_reason=?, voided_at=?, voided_by=? WHERE id=? AND status='issued'").bind(reason, now, c.get('staffId'), d.id),
      ...(await documentStatements(c.env, { id: cn, requestId: r.id, type: 'credit_note', relatedId: d.id, totalFils: d.total_fils, snapshot, createdBy: c.get('staffId'), now })),
    ])
  } catch { return c.json({ error: 'conflict' }, 409) }
  await visibleEvent(c, r.id, 'أُلغيت الفاتورة وصدر إشعار دائن', 'The invoice was cancelled and a credit note issued')
  await audit(c, 'finance.invoice_cancel', null, { requestId: r.id, by: c.get('staffId'), reason })
  return c.json({ ok: true, creditNoteId: cn, number: await numberOf(c, cn) })
})

// Manual payments recorded by staff (e.g. cash at the counter). Always pending until verified.
guarded.post('/requests/:id/payments', roles(...FIN), async (c) => {
  const r = await finRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const method = b?.method === 'cash' || b?.method === 'bank_transfer' || b?.method === 'other' ? b.method : null
  const reference = typeof b?.reference === 'string' && /^[A-Za-z0-9 ._/-]{4,60}$/.test(b.reference.trim()) ? b.reference.trim() : null
  if (!isFils(b?.amountFils) || !method || (method === 'bank_transfer' && !reference)) return c.json({ error: 'invalid_request' }, 400)
  const t = await totalsFor(c.env, r.id)
  if (!t.invoice) return c.json({ error: 'no_invoice' }, 409)
  const key = typeof b?.clientKey === 'string' && /^[A-Za-z0-9._:-]{8,80}$/.test(b.clientKey) ? b.clientKey : null
  const id = newId()
  const res = await insertPayment(c.env, { id, requestId: r.id, invoiceId: t.invoice.id, amount: b.amountFils, method, reference, proofFileId: null, clientKey: key, byKind: 'staff', by: c.get('staffId'), now: Date.now() })
  if (!res.ok) return c.json({ error: res.error }, 409)
  await audit(c, 'finance.payment_recorded', null, { requestId: r.id, paymentId: id, by: c.get('staffId') })
  return c.json({ id, status: 'pending_verification' }, 201)
})

guarded.get('/payments', roles(...FIN), async (c) => {
  const status = ['pending_verification', 'approved', 'rejected'].includes(c.req.query('status') ?? '') ? (c.req.query('status') as string) : 'pending_verification'
  const rows = await c.env.DB.prepare(
    `SELECT p.id,p.request_id,p.kind,p.amount_fils,p.method,p.reference,p.status,p.created_by_kind,p.created_at,p.proof_file_id,r.data,u.display_name
     FROM payments p JOIN requests r ON r.id=p.request_id JOIN users u ON u.id=r.user_id WHERE p.status=? AND p.kind='payment' ORDER BY p.created_at DESC LIMIT 100`).bind(status).all<any>()
  return c.json({ payments: rows.results.map((p) => { let d: any = {}; try { d = JSON.parse(p.data) } catch { /* */ } return { id: p.id, requestId: p.request_id, amount_fils: p.amount_fils, method: p.method, reference: p.reference, status: p.status, createdBy: p.created_by_kind, createdAt: p.created_at, hasProof: !!p.proof_file_id, title: d.title ?? null, customer: d.name || p.display_name || '' } }) })
})

async function ensureReceipt(c: C, paymentId: string, requestId: string, meta: ReturnType<typeof reqMeta>, p: { amount_fils: number; method: string; reference: string | null; invoice_id: string }) {
  const have = await c.env.DB.prepare("SELECT id,number FROM fin_documents WHERE related_id=? AND doc_type='receipt'").bind(paymentId).first<{ id: string; number: string }>()
  if (have) { await c.env.DB.prepare('UPDATE payments SET receipt_id=? WHERE id=? AND receipt_id IS NULL').bind(have.id, paymentId).run(); return have }
  const t = await totalsFor(c.env, requestId)
  const inv = await c.env.DB.prepare('SELECT number FROM fin_documents WHERE id=?').bind(p.invoice_id).first<{ number: string }>()
  const id = newId(), now = Date.now()
  const snapshot = { ...meta, lines: [], totals: { amount: p.amount_fils, total: t.total, paid: t.paid, refunded: t.refunded, remaining: t.remaining }, extra: { invoiceNumber: inv?.number, paymentMethod: p.method, paymentRef: p.reference ? `…${p.reference.slice(-4)}` : null } }
  try {
    await c.env.DB.batch([...(await documentStatements(c.env, { id, requestId, type: 'receipt', relatedId: paymentId, totalFils: p.amount_fils, snapshot, createdBy: c.get('staffId'), now })), c.env.DB.prepare('UPDATE payments SET receipt_id=? WHERE id=? AND receipt_id IS NULL').bind(id, paymentId)])
  } catch { /* a concurrent approval created it first */ }
  return await c.env.DB.prepare("SELECT id,number FROM fin_documents WHERE related_id=? AND doc_type='receipt'").bind(paymentId).first<{ id: string; number: string }>()
}

guarded.post('/payments/:pid/approve', roles(...FIN), async (c) => {
  const pid = c.req.param('pid')
  const p = isUuid(pid) ? await c.env.DB.prepare('SELECT id,request_id,invoice_id,kind,amount_fils,method,reference,proof_file_id,status,created_by_kind,created_by FROM payments WHERE id=?').bind(pid).first<{ id: string; request_id: string; invoice_id: string; kind: string; amount_fils: number; method: string; reference: string | null; proof_file_id: string | null; status: string; created_by_kind: string; created_by: string }>() : null
  const r = p ? await finRequest(c, p.request_id) : null
  if (!p || !r || p.kind !== 'payment') return c.json({ error: 'not_found' }, 404)
  if (p.created_by_kind === 'staff' && p.created_by === c.get('staffId') && c.get('staffRole') !== 'owner') return c.json({ error: 'second_approver_required' }, 403)
  if (p.status === 'pending_verification' && p.proof_file_id) {
    const f = await c.env.DB.prepare('SELECT scan_status s FROM request_files WHERE id=? AND deleted_at IS NULL').bind(p.proof_file_id).first<{ s: string }>()
    if (!f || f.s !== 'clean') return c.json({ error: 'scan_pending' }, 423) // an unscanned proof cannot be the basis of an approval
  }
  const b = await jsonBody(c)
  const done = await approvePayment(c.env, p.id, c.get('staffId'), typeof b?.note === 'string' ? b.note.slice(0, 300) : null, Date.now())
  if (!done) {
    const now = await c.env.DB.prepare('SELECT status FROM payments WHERE id=?').bind(p.id).first<{ status: string }>()
    if (now?.status === 'approved') { const rc = await ensureReceipt(c, p.id, r.id, reqMeta(r), p); return c.json({ ok: true, duplicate: true, receipt: rc?.number ?? null }) } // repeating an approval changes nothing
    return c.json({ error: now?.status === 'rejected' ? 'rejected' : 'exceeds_balance' }, 409)
  }
  const rc = await ensureReceipt(c, p.id, r.id, reqMeta(r), p)
  await visibleEvent(c, r.id, `تم اعتماد دفعتك — إيصال ${rc?.number ?? ''} (نسخة تجريبية)`, `Your payment was verified — receipt ${rc?.number ?? ''} (test copy)`)
  await audit(c, 'finance.payment_approved', null, { requestId: r.id, paymentId: p.id, by: c.get('staffId') })
  return c.json({ ok: true, duplicate: false, receipt: rc?.number ?? null })
})

guarded.post('/payments/:pid/reject', roles(...FIN), async (c) => {
  const pid = c.req.param('pid')
  const p = isUuid(pid) ? await c.env.DB.prepare("SELECT id,request_id FROM payments WHERE id=? AND kind='payment'").bind(pid).first<{ id: string; request_id: string }>() : null
  const r = p ? await finRequest(c, p.request_id) : null
  if (!p || !r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const reason = typeof b?.reason === 'string' ? b.reason.trim().slice(0, 300) : ''
  if (reason.length < 3) return c.json({ error: 'reason_required' }, 400)
  const u = await c.env.DB.prepare("UPDATE payments SET status='rejected', decided_by=?, decided_at=?, decision_note=? WHERE id=? AND status='pending_verification'").bind(c.get('staffId'), Date.now(), reason, p.id).run()
  if (!u.meta.changes) return c.json({ error: 'not_pending' }, 409)
  await visibleEvent(c, r.id, `لم يُعتمد إثبات الدفع: ${reason}`, `Payment proof was not accepted: ${reason}`)
  await audit(c, 'finance.payment_rejected', null, { requestId: r.id, paymentId: p.id, by: c.get('staffId') })
  return c.json({ ok: true })
})

// Refunds: owner/manager only; never above what is paid; linked credit note; the original receipt is untouched.
guarded.post('/requests/:id/refunds', roles('owner', 'manager'), async (c) => {
  const r = await finRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const reason = typeof b?.reason === 'string' ? b.reason.trim().slice(0, 300) : ''
  const refundOf = typeof b?.paymentId === 'string' && isUuid(b.paymentId) ? b.paymentId : null
  if (!isFils(b?.amountFils) || reason.length < 10) return c.json({ error: 'invalid_request' }, 400)
  const t = await totalsFor(c.env, r.id)
  if (!t.invoice) return c.json({ error: 'no_invoice' }, 409)
  const id = newId(), now = Date.now()
  if (!(await insertRefund(c.env, { id, requestId: r.id, invoiceId: t.invoice.id, amount: b.amountFils, reason, refundOf, by: c.get('staffId'), now }))) return c.json({ error: 'exceeds_paid' }, 409)
  const after = await totalsFor(c.env, r.id)
  const cn = newId()
  const snapshot = { ...reqMeta(r), lines: [], totals: { amount: b.amountFils, total: after.total, paid: after.paid, refunded: after.refunded, remaining: after.remaining }, extra: { invoiceNumber: t.invoice.number, reason } }
  await c.env.DB.batch([...(await documentStatements(c.env, { id: cn, requestId: r.id, type: 'credit_note', relatedId: id, totalFils: b.amountFils, snapshot, createdBy: c.get('staffId'), now })), c.env.DB.prepare('UPDATE payments SET receipt_id=? WHERE id=?').bind(cn, id)])
  await visibleEvent(c, r.id, 'تم رد مبلغ إليك (نسخة تجريبية)', 'A refund was issued to you (test copy)')
  await audit(c, 'finance.refund', null, { requestId: r.id, paymentId: id, by: c.get('staffId') })
  return c.json({ ok: true, refundId: id, creditNote: await numberOf(c, cn) }, 201)
})

// The official payment link may need refreshing (links expire); it is not a price term, so it can change without a new quote version.
guarded.patch('/quotes/:qid/pay-link', roles(...FIN), async (c) => {
  const qid = c.req.param('qid')
  const q = isUuid(qid) ? await c.env.DB.prepare("SELECT id,request_id,status FROM quotes WHERE id=? AND status IN ('draft','issued','accepted')").bind(qid).first<{ id: string; request_id: string; status: string }>() : null
  const r = q ? await finRequest(c, q.request_id) : null
  if (!q || !r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const url = parseGovUrl(c.env, b?.url)
  if (url === undefined) return c.json({ error: 'invalid_pay_url' }, 400)
  await c.env.DB.prepare('UPDATE quotes SET gov_pay_url=? WHERE id=?').bind(url, q.id).run()
  await audit(c, 'finance.pay_link', null, { requestId: r.id, by: c.get('staffId') })
  return c.json({ ok: true, url })
})

// Government fees are paid by the customer straight to the authority. Here we only REGISTER and VERIFY that the customer did so.
guarded.post('/requests/:id/authority-payments', roles(...FIN), async (c) => {
  const r = await finRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const reference = typeof b?.reference === 'string' && /^[A-Za-z0-9 ._/-]{4,60}$/.test(b.reference.trim()) ? b.reference.trim() : null
  if (!isFils(b?.amountFils) || !reference) return c.json({ error: 'invalid_request' }, 400)
  const g = await govFor(c.env, r.id)
  if (!g.quoteId || g.total <= 0) return c.json({ error: 'no_government_fees' }, 409)
  const key = typeof b?.clientKey === 'string' && /^[A-Za-z0-9._:-]{8,80}$/.test(b.clientKey) ? b.clientKey : null
  const id = newId()
  const res = await insertAuthorityPayment(c.env, { id, requestId: r.id, quoteId: g.quoteId, amount: b.amountFils, reference, proofFileId: null, clientKey: key, byKind: 'staff', by: c.get('staffId'), now: Date.now() })
  if (!res.ok) return c.json({ error: res.error }, 409)
  return c.json({ id, status: 'reported' }, 201)
})

guarded.post('/authority-payments/:pid/verify', roles(...FIN), async (c) => {
  const pid = c.req.param('pid')
  const p = isUuid(pid) ? await c.env.DB.prepare('SELECT id,request_id,status,proof_file_id,reported_by_kind,reported_by FROM authority_payments WHERE id=?').bind(pid).first<{ id: string; request_id: string; status: string; proof_file_id: string | null; reported_by_kind: string; reported_by: string }>() : null
  const r = p ? await finRequest(c, p.request_id) : null
  if (!p || !r) return c.json({ error: 'not_found' }, 404)
  if (p.reported_by_kind === 'staff' && p.reported_by === c.get('staffId') && c.get('staffRole') !== 'owner') return c.json({ error: 'second_approver_required' }, 403)
  if (p.status === 'reported' && p.proof_file_id) {
    const f = await c.env.DB.prepare('SELECT scan_status s FROM request_files WHERE id=? AND deleted_at IS NULL').bind(p.proof_file_id).first<{ s: string }>()
    if (!f || f.s !== 'clean') return c.json({ error: 'scan_pending' }, 423)
  }
  const b = await jsonBody(c)
  const u = await c.env.DB.prepare("UPDATE authority_payments SET status='verified', verified_by=?, verified_at=?, note=? WHERE id=? AND status='reported'").bind(c.get('staffId'), Date.now(), typeof b?.note === 'string' ? b.note.slice(0, 300) : null, p.id).run()
  if (!u.meta.changes) return c.json(p.status === 'verified' ? { ok: true, duplicate: true } : { error: 'not_reported' }, p.status === 'verified' ? 200 : 409)
  await visibleEvent(c, r.id, 'تم التحقق من دفعك الرسوم الحكومية للجهة', 'Your payment of the government fees to the authority was verified')
  await audit(c, 'finance.authority_verified', null, { requestId: r.id, paymentId: p.id, by: c.get('staffId') })
  return c.json({ ok: true, duplicate: false })
})

guarded.post('/authority-payments/:pid/reject', roles(...FIN), async (c) => {
  const pid = c.req.param('pid')
  const p = isUuid(pid) ? await c.env.DB.prepare('SELECT id,request_id FROM authority_payments WHERE id=?').bind(pid).first<{ id: string; request_id: string }>() : null
  const r = p ? await finRequest(c, p.request_id) : null
  if (!p || !r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const reason = typeof b?.reason === 'string' ? b.reason.trim().slice(0, 300) : ''
  if (reason.length < 3) return c.json({ error: 'reason_required' }, 400)
  const u = await c.env.DB.prepare("UPDATE authority_payments SET status='rejected', verified_by=?, verified_at=?, note=? WHERE id=? AND status='reported'").bind(c.get('staffId'), Date.now(), reason, p.id).run()
  if (!u.meta.changes) return c.json({ error: 'not_reported' }, 409)
  await visibleEvent(c, r.id, `لم يُعتمد إثبات دفع الرسوم الحكومية: ${reason}`, `The government-fee payment proof was not accepted: ${reason}`)
  return c.json({ ok: true })
})

guarded.get('/authority-payments', roles(...FIN), async (c) => {
  const status = ['reported', 'verified', 'rejected'].includes(c.req.query('status') ?? '') ? (c.req.query('status') as string) : 'reported'
  const rows = await c.env.DB.prepare(
    `SELECT a.id,a.request_id,a.amount_fils,a.reference,a.status,a.reported_by_kind,a.created_at,a.proof_file_id,r.data,u.display_name
     FROM authority_payments a JOIN requests r ON r.id=a.request_id JOIN users u ON u.id=r.user_id WHERE a.status=? ORDER BY a.created_at DESC LIMIT 100`).bind(status).all<any>()
  return c.json({ payments: rows.results.map((p) => { let d: any = {}; try { d = JSON.parse(p.data) } catch { /* */ } return { id: p.id, requestId: p.request_id, amount_fils: p.amount_fils, reference: p.reference, status: p.status, createdBy: p.reported_by_kind, createdAt: p.created_at, hasProof: !!p.proof_file_id, title: d.title ?? null, customer: d.name || p.display_name || '' } }) })
})

guarded.get('/authority-payments/:pid/proof', roles(...FIN), async (c) => {
  const pid = c.req.param('pid')
  const p = isUuid(pid) ? await c.env.DB.prepare('SELECT a.proof_file_id,a.request_id,f.r2_key,f.mime,f.name,f.user_id,f.scan_status FROM authority_payments a JOIN request_files f ON f.id=a.proof_file_id WHERE a.id=? AND f.deleted_at IS NULL').bind(pid).first<{ proof_file_id: string; request_id: string; r2_key: string; mime: string; name: string; user_id: string; scan_status: string }>() : null
  if (!p || !(await finRequest(c, p.request_id)) || p.scan_status === 'infected' || p.scan_status === 'error') return c.json({ error: 'not_found' }, 404)
  if (p.scan_status !== 'clean') return c.json({ error: 'scan_pending' }, 423)
  const obj = await c.env.DOCS.get(p.r2_key)
  if (!obj) return c.json({ error: 'not_found' }, 404)
  const plain = await open(c.env.DATA_KEY, `file:${p.user_id}:${p.proof_file_id}`, new Uint8Array(await obj.arrayBuffer()))
  await audit(c, 'staff.proof_view', null, { authorityPaymentId: pid, by: c.get('staffId') })
  return new Response(plain as BufferSource, { headers: { 'content-type': p.mime, 'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(p.name)}`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; frame-ancestors 'self'", 'x-frame-options': 'SAMEORIGIN' } })
})

guarded.get('/documents/:docId', roles(...FIN_VIEW), async (c) => {
  const did = c.req.param('docId')
  const d = isUuid(did) ? await c.env.DB.prepare('SELECT request_id,doc_type,number,status,void_reason,created_at,total_fils,snapshot FROM fin_documents WHERE id=?').bind(did).first<DocRow & { request_id: string }>() : null
  if (!d || !(await finRequest(c, d.request_id))) return c.json({ error: 'not_found' }, 404)
  return new Response(renderDocument(c.env, d), { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'self'", 'x-frame-options': 'SAMEORIGIN', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
})

guarded.get('/payments/:pid/proof', roles(...FIN), async (c) => {
  const pid = c.req.param('pid')
  const p = isUuid(pid) ? await c.env.DB.prepare("SELECT p.proof_file_id,p.request_id,f.r2_key,f.mime,f.name,f.user_id,f.scan_status FROM payments p JOIN request_files f ON f.id=p.proof_file_id WHERE p.id=? AND f.deleted_at IS NULL").bind(pid).first<{ proof_file_id: string; request_id: string; r2_key: string; mime: string; name: string; user_id: string; scan_status: string }>() : null
  if (!p || !(await finRequest(c, p.request_id)) || p.scan_status === 'infected' || p.scan_status === 'error') return c.json({ error: 'not_found' }, 404)
  if (p.scan_status !== 'clean') return c.json({ error: 'scan_pending' }, 423)
  const obj = await c.env.DOCS.get(p.r2_key)
  if (!obj) return c.json({ error: 'not_found' }, 404)
  const plain = await open(c.env.DATA_KEY, `file:${p.user_id}:${p.proof_file_id}`, new Uint8Array(await obj.arrayBuffer()))
  await audit(c, 'staff.proof_view', null, { paymentId: pid, by: c.get('staffId') })
  return new Response(plain as BufferSource, { headers: { 'content-type': p.mime, 'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(p.name)}`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; frame-ancestors 'self'", 'x-frame-options': 'SAMEORIGIN' } })
})

staff.route('/', guarded)
