import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { Env, Vars } from './types'
import { hmacHex, newId, open, openText, randomToken, seal, sealText, sha256Hex, timingSafeEqual } from './crypto'
import { MAX_FILE_BYTES, isUuid, normalizePhone, safeFileName, sniffFile } from './validate'
import { allow, audit, clientIp, jsonBody, type C } from './security'
import { newSecret, otpauthUri, verifyTotp } from './totp'

type Role = Vars['staffRole']
const ACCESS_TTL = 15 * 60 * 1000
const REFRESH_TTL = 12 * 3600 * 1000 // staff sessions are shorter than customers'

export const staff = new Hono<{ Bindings: Env; Variables: Vars }>()

// ---------- status machine ----------
export const TRANSITIONS: Record<string, string[]> = {
  submitted: ['review', 'rejected', 'cancelled'],
  review: ['needs_documents', 'authority', 'rejected', 'cancelled'],
  needs_documents: ['review', 'rejected', 'cancelled'],
  authority: ['decision', 'needs_documents', 'completed', 'rejected'],
  decision: ['completed', 'authority', 'rejected'],
}
const LABEL: Record<string, [string, string]> = {
  review: ['قيد المراجعة', 'Under review'], needs_documents: ['مطلوب استكمال', 'Action required'], authority: ['لدى الجهة', 'With authority'],
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
type Row = { id: string; user_id: string; service_id: string; status: string; data: string; staff_data: string; assignee_id: string | null; created_at: number; updated_at: number; display_name: string | null; phone_enc: string; assignee_name?: string | null }
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
    `SELECT r.id,r.user_id,r.service_id,r.status,r.data,r.staff_data,r.assignee_id,r.created_at,r.updated_at,u.display_name,u.phone_enc
     FROM requests r JOIN users u ON u.id=r.user_id WHERE r.id=? AND r.deleted_at IS NULL AND r.status!='draft'`).bind(id).first<Row>()
  return r && canSee(c, r.assignee_id) ? r : null
}

async function addEvent(c: C, requestId: string, kind: string, ar: string, en: string, visible: boolean) {
  await c.env.DB.prepare('INSERT INTO request_events (id,request_id,actor,staff_id,kind,text_ar,text_en,visible,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(newId(), requestId, 'staff', c.get('staffId'), kind, ar, en, visible ? 1 : 0, Date.now()).run()
}

guarded.get('/requests/:id', roles(...OPS), async (c) => {
  const r = await loadRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const files = await c.env.DB.prepare('SELECT id,name,mime,size,kind,label,created_at FROM request_files WHERE request_id=? AND deleted_at IS NULL ORDER BY created_at').bind(r.id).all()
  const events = await c.env.DB.prepare('SELECT id,actor,kind,text_ar,text_en,visible,created_at FROM request_events WHERE request_id=? ORDER BY created_at').bind(r.id).all()
  const missing = await c.env.DB.prepare('SELECT id,label_ar,label_en,note_ar,note_en,replacement_file_id,resolved_at FROM missing_documents WHERE request_id=? ORDER BY created_at').bind(r.id).all()
  let data: any = {}, sd: any = {}; try { data = JSON.parse(r.data) } catch {} try { sd = JSON.parse(r.staff_data) } catch {}
  const phone = await openText(c.env.DATA_KEY, 'user-phone', r.phone_enc).catch(() => '')
  await audit(c, 'staff.view_request', null, { requestId: r.id, by: c.get('staffId') })
  return c.json({ request: { id: r.id, serviceId: r.service_id, status: r.status, assigneeId: r.assignee_id, createdAt: r.created_at, updatedAt: r.updated_at, data, staff: sd }, customer: { id: r.user_id, name: data.name || r.display_name || '', phone }, files: files.results, events: events.results, missing: missing.results, transitions: TRANSITIONS[r.status] ?? [] })
})

guarded.post('/requests/:id/assign', roles(...OPS), async (c) => {
  const r = await loadRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  let to: string | null = typeof b?.staffId === 'string' ? b.staffId : null
  if (c.get('staffRole') === 'agent') to = to === null || to === c.get('staffId') ? to : 'forbidden' // agents may only take or release their own
  if (to === 'forbidden') return c.json({ error: 'forbidden' }, 403)
  if (to) {
    const m = await c.env.DB.prepare('SELECT name FROM staff WHERE id=? AND active=1 AND role IN (?,?,?)').bind(to, 'owner', 'manager', 'agent').first<{ name: string }>()
    if (!m) return c.json({ error: 'invalid_request' }, 400)
  }
  await c.env.DB.prepare('UPDATE requests SET assignee_id=?, updated_at=? WHERE id=?').bind(to, Date.now(), r.id).run()
  await addEvent(c, r.id, 'assign', to ? 'تم إسناد الطلب لموظف' : 'أُلغي إسناد الطلب', to ? 'Request assigned' : 'Request unassigned', false)
  return c.json({ ok: true })
})

guarded.post('/requests/:id/status', roles(...OPS), async (c) => {
  const r = await loadRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const to = typeof b?.status === 'string' ? b.status : ''
  if (!(TRANSITIONS[r.status] ?? []).includes(to)) return c.json({ error: 'invalid_transition', allowed: TRANSITIONS[r.status] ?? [] }, 409)
  let sd: any = {}; try { sd = JSON.parse(r.staff_data) } catch {}
  const now = new Date().toISOString()
  if (typeof b?.expectedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.expectedAt)) sd.expectedAt = b.expectedAt
  if (to === 'completed') sd.completedAt = now
  if (to === 'rejected' && typeof b?.reason === 'string') sd.issue = b.reason.slice(0, 300)
  await c.env.DB.prepare('UPDATE requests SET status=?, staff_data=?, assignee_id=COALESCE(assignee_id,?), updated_at=? WHERE id=?').bind(to, JSON.stringify(sd), c.get('staffId'), Date.now(), r.id).run()
  const [ar, en] = LABEL[to] as [string, string]
  await addEvent(c, r.id, 'status', ar, en, true)
  if (typeof b?.note === 'string' && b.note.trim()) await addEvent(c, r.id, 'note', b.note.trim().slice(0, 500), b.note.trim().slice(0, 500), false)
  await audit(c, 'staff.status', null, { requestId: r.id, to, by: c.get('staffId') })
  return c.json({ ok: true, status: to })
})

guarded.post('/requests/:id/missing', roles(...OPS), async (c) => {
  const r = await loadRequest(c, c.req.param('id'))
  if (!r) return c.json({ error: 'not_found' }, 404)
  if (!(TRANSITIONS[r.status] ?? []).includes('needs_documents')) return c.json({ error: 'invalid_transition' }, 409)
  const b = await jsonBody(c)
  const items = Array.isArray(b?.items) ? (b.items as any[]).slice(0, 10) : []
  const ok = items.length > 0 && items.every((i) => typeof i?.labelAr === 'string' && typeof i?.labelEn === 'string' && i.labelAr.trim() && i.labelEn.trim())
  if (!ok) return c.json({ error: 'invalid_request' }, 400)
  const stmts = items.map((i) => c.env.DB.prepare('INSERT INTO missing_documents (id,request_id,label_ar,label_en,note_ar,note_en,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(newId(), r.id, String(i.labelAr).slice(0, 120), String(i.labelEn).slice(0, 120), String(i.noteAr ?? '').slice(0, 300), String(i.noteEn ?? '').slice(0, 300), Date.now()))
  stmts.push(c.env.DB.prepare("UPDATE requests SET status='needs_documents', updated_at=? WHERE id=?").bind(Date.now(), r.id))
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
  const f = await c.env.DB.prepare('SELECT f.r2_key,f.name,f.mime,f.user_id,f.request_id,r.assignee_id FROM request_files f JOIN requests r ON r.id=f.request_id WHERE f.id=? AND f.deleted_at IS NULL').bind(fid)
    .first<{ r2_key: string; name: string; mime: string; user_id: string; request_id: string; assignee_id: string | null }>()
  if (!f || !canSee(c, f.assignee_id)) return c.json({ error: 'not_found' }, 404)
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
  const t = sniffFile(bytes)
  if (!t) return c.json({ error: 'unsupported_type' }, 415)
  const fid = newId(), key = `u/${r.user_id}/${fid}`
  await c.env.DOCS.put(key, await seal(c.env.DATA_KEY, `file:${r.user_id}:${fid}`, bytes), { httpMetadata: { contentType: 'application/octet-stream' } })
  const name = safeFileName(c.req.header('x-file-name') ? decodeURIComponent(c.req.header('x-file-name') as string) : null, t.ext)
  const label = (c.req.header('x-file-label') ? decodeURIComponent(c.req.header('x-file-label') as string) : '').slice(0, 120) || null
  await c.env.DB.prepare('INSERT INTO request_files (id,request_id,user_id,r2_key,name,mime,size,sha256,created_at,kind,label) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .bind(fid, r.id, r.user_id, key, name, t.mime, bytes.length, await sha256Hex(bytes), Date.now(), kind, label).run()
  await addEvent(c, r.id, 'file', kind === 'final' ? 'أُضيف ملف التسليم' : 'أُضيفت فاتورة', kind === 'final' ? 'Delivery file added' : 'Invoice added', true)
  await audit(c, 'staff.file_upload', null, { fileId: fid, requestId: r.id, kind, by: c.get('staffId') })
  return c.json({ id: fid, name, kind }, 201)
})

staff.route('/', guarded)
