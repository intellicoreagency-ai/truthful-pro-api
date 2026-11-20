import { Hono } from 'hono'
import type { Env, Vars } from './types'
import { b64, hmacHex, hmacHexText, waCode, newId, open, openText, otpCode, randomToken, seal, sealText, sha256Hex, timingSafeEqual } from './crypto'
import { MAX_FILES_PER_REQUEST, MAX_FILE_BYTES, REQUEST_STATUSES, isServiceId, isUuid, normalizePhone, safeFileName, sniffFile } from './validate'
import { allow, audit, clientIp, jsonBody, requireAuth, securityHeaders, type C } from './security'
import { sendOtp } from './sms'
import { staff } from './staff'

const ACCESS_TTL = 15 * 60 * 1000
const REFRESH_TTL = 30 * 24 * 3600 * 1000
const MAX_OTP_ATTEMPTS = 5

export const app = new Hono<{ Bindings: Env; Variables: Vars }>()
app.use('*', securityHeaders)
// Optional CORS for the web build only. Empty by default: native apps do not need it.
app.use('*', async (c, next) => {
  const origin = c.req.header('origin')
  const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  const ok = !!origin && allowed.includes(origin)
  if (ok) { c.header('Access-Control-Allow-Origin', origin as string); c.header('Vary', 'Origin') }
  if (c.req.method === 'OPTIONS') {
    if (!ok) return c.body(null, 403)
    c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE'); c.header('Access-Control-Allow-Headers', 'authorization,content-type,x-file-name'); c.header('Access-Control-Max-Age', '600')
    return c.body(null, 204)
  }
  await next()
})
app.onError((e, c) => { console.error('unhandled', e instanceof Error ? e.message : 'unknown'); return c.json({ error: 'server_error' }, 500) })
app.notFound((c) => c.json({ error: 'not_found' }, 404))

app.get('/health', (c) => c.json({ ok: true }))

// ---------- Auth ----------
app.post('/v1/auth/otp/request', async (c) => {
  const body = await jsonBody(c)
  const phone = normalizePhone(body?.phone)
  const lang = body?.language === 'en' ? 'en' : 'ar'
  if (!phone) return c.json({ error: 'invalid_phone' }, 400)
  const phoneHash = await hmacHex(c.env.PEPPER, `phone:${phone}`)
  if (!(await allow(c.env, `otp:p:${phoneHash}`, 3, 600)) || !(await allow(c.env, `otp:i:${clientIp(c)}`, 10, 600))) {
    return c.json({ error: 'too_many_requests' }, 429)
  }
  const code = otpCode()
  const id = newId()
  const ttl = Number(c.env.OTP_TTL_SECONDS ?? '300') * 1000
  await c.env.DB.prepare('INSERT INTO otp_challenges (id,phone_hash,code_hash,expires_at,created_at) VALUES (?,?,?,?,?)')
    .bind(id, phoneHash, await hmacHex(c.env.PEPPER, `otp:${id}:${code}`), Date.now() + ttl, Date.now()).run()
  const sent = await sendOtp(c.env, phone, code, lang)
  if (!sent) return c.json({ error: 'delivery_failed' }, 502)
  await audit(c, 'otp.request', null)
  const out: Record<string, unknown> = { challengeId: id, expiresIn: ttl / 1000 }
  if (c.env.ENVIRONMENT !== 'production' && c.env.DEV_OTP_ECHO === '1') out.devCode = code
  return c.json(out)
})

async function issueSession(c: C, userId: string) {
  const access = randomToken(32), refresh = randomToken(32), now = Date.now()
  await c.env.DB.prepare('INSERT INTO sessions (id,user_id,access_hash,refresh_hash,access_expires_at,refresh_expires_at,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(newId(), userId, await sha256Hex(access), await sha256Hex(refresh), now + ACCESS_TTL, now + REFRESH_TTL, now).run()
  return { accessToken: access, refreshToken: refresh, expiresIn: ACCESS_TTL / 1000 }
}

app.post('/v1/auth/otp/verify', async (c) => {
  const body = await jsonBody(c)
  const phone = normalizePhone(body?.phone)
  const challengeId = typeof body?.challengeId === 'string' ? body.challengeId : ''
  const code = typeof body?.code === 'string' ? body.code : ''
  if (!phone || !isUuid(challengeId) || !/^\d{6}$/.test(code)) return c.json({ error: 'invalid_request' }, 400)
  const phoneHash = await hmacHex(c.env.PEPPER, `phone:${phone}`)
  if (!(await allow(c.env, `verify:i:${clientIp(c)}`, 30, 600))) return c.json({ error: 'too_many_requests' }, 429)
  const ch = await c.env.DB.prepare('SELECT * FROM otp_challenges WHERE id=? AND phone_hash=? AND purpose=\'customer\'').bind(challengeId, phoneHash)
    .first<{ code_hash: string; attempts: number; expires_at: number; consumed_at: number | null }>()
  if (!ch || ch.consumed_at || ch.expires_at < Date.now() || ch.attempts >= MAX_OTP_ATTEMPTS) return c.json({ error: 'invalid_code' }, 401)
  // Count the attempt first so parallel guesses cannot exceed the cap.
  const upd = await c.env.DB.prepare('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=? AND attempts<?').bind(challengeId, MAX_OTP_ATTEMPTS).run()
  if (!upd.meta.changes) return c.json({ error: 'invalid_code' }, 401)
  const expected = await hmacHex(c.env.PEPPER, `otp:${challengeId}:${code}`)
  if (!timingSafeEqual(expected, ch.code_hash)) { await audit(c, 'otp.fail', null); return c.json({ error: 'invalid_code' }, 401) }
  const used = await c.env.DB.prepare('UPDATE otp_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL').bind(Date.now(), challengeId).run()
  if (!used.meta.changes) return c.json({ error: 'invalid_code' }, 401)

  const out = await loginPhone(c, phone, phoneHash)
  return c.json(out)
})

/** Finds or creates the user for a verified phone and opens a session. */
async function loginPhone(c: C, phone: string, phoneHash: string) {
  let user = await c.env.DB.prepare('SELECT id FROM users WHERE phone_hash=? AND deleted_at IS NULL').bind(phoneHash).first<{ id: string }>()
  const isNew = !user
  if (!user) {
    const id = newId()
    await c.env.DB.prepare('INSERT INTO users (id,phone_hash,phone_enc,created_at) VALUES (?,?,?,?)')
      .bind(id, phoneHash, await sealText(c.env.DATA_KEY, 'user-phone', phone), Date.now()).run()
    user = { id }
  }
  await audit(c, isNew ? 'user.create' : 'auth.login', user.id)
  return { ...(await issueSession(c, user.id)), isNewUser: isNew }
}

// ---------- WhatsApp verification: the user sends us a message (inbound messages are free) ----------
const WA_TTL = 10 * 60 * 1000
app.post('/v1/auth/wa/start', async (c) => {
  const body = await jsonBody(c)
  const phone = normalizePhone(body?.phone)
  if (!phone) return c.json({ error: 'invalid_phone' }, 400)
  if (!c.env.WA_BUSINESS_NUMBER) return c.json({ error: 'not_configured' }, 503)
  const phoneHash = await hmacHex(c.env.PEPPER, `phone:${phone}`)
  if (!(await allow(c.env, `wa:p:${phoneHash}`, 5, 600)) || !(await allow(c.env, `wa:i:${clientIp(c)}`, 20, 600))) return c.json({ error: 'too_many_requests' }, 429)
  const code = waCode(), poll = randomToken(24), id = newId(), now = Date.now()
  await c.env.DB.prepare('INSERT INTO wa_challenges (id,phone_hash,code_hash,poll_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)')
    .bind(id, phoneHash, await hmacHex(c.env.PEPPER, `wa:${code}`), await sha256Hex(poll), now + WA_TTL, now).run()
  const text = body?.language === 'en' ? `Verify my TRUTHFUL PRO account: ${code}` : `تأكيد حسابي في تروثفل برو: ${code}`
  await audit(c, 'wa.start', null)
  return c.json({ challengeId: id, pollToken: poll, code, expiresIn: WA_TTL / 1000, link: `https://wa.me/${c.env.WA_BUSINESS_NUMBER}?text=${encodeURIComponent(text)}` })
})

app.get('/webhooks/whatsapp', (c) => {
  const ok = c.req.query('hub.mode') === 'subscribe' && !!c.env.WA_VERIFY_TOKEN && timingSafeEqual(c.req.query('hub.verify_token') ?? '', c.env.WA_VERIFY_TOKEN)
  return ok ? c.text(c.req.query('hub.challenge') ?? '') : c.body(null, 403)
})

app.post('/webhooks/whatsapp', async (c) => {
  if (!c.env.WA_APP_SECRET) return c.body(null, 503)
  const raw = await c.req.text()
  if (raw.length > 256 * 1024) return c.body(null, 413)
  const sig = (c.req.header('x-hub-signature-256') ?? '').replace(/^sha256=/, '')
  if (!timingSafeEqual(sig, await hmacHexText(c.env.WA_APP_SECRET, raw))) return c.body(null, 401)
  let payload: any
  try { payload = JSON.parse(raw) } catch { return c.body(null, 400) }
  for (const entry of payload?.entry ?? []) for (const ch of entry?.changes ?? []) for (const m of ch?.value?.messages ?? []) {
    if (m?.type !== 'text' || typeof m?.from !== 'string' || typeof m?.text?.body !== 'string') continue
    const found = /TP-[A-HJ-NP-Z2-9]{8}/.exec(m.text.body.toUpperCase())
    if (!found || !/^\d{8,15}$/.test(m.from)) continue
    const upd = await c.env.DB.prepare(
      'UPDATE wa_challenges SET verified_at=? WHERE code_hash=? AND phone_hash=? AND expires_at>? AND verified_at IS NULL'
    ).bind(Date.now(), await hmacHex(c.env.PEPPER, `wa:${found[0]}`), await hmacHex(c.env.PEPPER, `phone:+${m.from}`), Date.now()).run()
    if (upd.meta.changes) {
      await audit(c, 'wa.verified', null)
      if (c.env.WA_TOKEN && c.env.WA_PHONE_NUMBER_ID) { // free reply inside the 24h service window; failure is harmless
        c.executionCtx?.waitUntil?.(fetch(`https://graph.facebook.com/v21.0/${c.env.WA_PHONE_NUMBER_ID}/messages`, {
          method: 'POST', headers: { authorization: `Bearer ${c.env.WA_TOKEN}`, 'content-type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: m.from, type: 'text', text: { body: 'تم التحقق ✅ ارجع إلى التطبيق. / Verified ✅ Return to the app.' } }),
        }).catch(() => {}))
      }
    }
  }
  return c.body(null, 200)
})

app.post('/v1/auth/wa/poll', async (c) => {
  const body = await jsonBody(c)
  const id = typeof body?.challengeId === 'string' ? body.challengeId : ''
  const poll = typeof body?.pollToken === 'string' ? body.pollToken : ''
  const phone = normalizePhone(body?.phone)
  if (!isUuid(id) || !/^[A-Za-z0-9_-]{20,64}$/.test(poll) || !phone) return c.json({ error: 'invalid_request' }, 400)
  if (!(await allow(c.env, `wapoll:${clientIp(c)}`, 300, 600))) return c.json({ error: 'too_many_requests' }, 429)
  const phoneHash = await hmacHex(c.env.PEPPER, `phone:${phone}`)
  const ch = await c.env.DB.prepare('SELECT poll_hash,phone_hash,expires_at,verified_at,consumed_at FROM wa_challenges WHERE id=? AND purpose=\'customer\'').bind(id)
    .first<{ poll_hash: string; phone_hash: string; expires_at: number; verified_at: number | null; consumed_at: number | null }>()
  if (!ch || !timingSafeEqual(ch.poll_hash, await sha256Hex(poll)) || ch.phone_hash !== phoneHash) return c.json({ error: 'invalid_request' }, 400)
  if (ch.consumed_at || ch.expires_at < Date.now()) return c.json({ status: 'expired' })
  if (!ch.verified_at) return c.json({ status: 'pending' })
  const used = await c.env.DB.prepare('UPDATE wa_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL').bind(Date.now(), id).run()
  if (!used.meta.changes) return c.json({ status: 'expired' })
  return c.json({ status: 'verified', ...(await loginPhone(c, phone, phoneHash)) })
})

app.post('/v1/auth/refresh', async (c) => {
  const body = await jsonBody(c)
  const token = typeof body?.refreshToken === 'string' ? body.refreshToken : ''
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return c.json({ error: 'invalid_request' }, 400)
  const hash = await sha256Hex(token), now = Date.now()
  const reuse = await c.env.DB.prepare('SELECT id,user_id FROM sessions WHERE prev_refresh_hash=? AND revoked_at IS NULL').bind(hash).first<{ id: string; user_id: string }>()
  if (reuse) { // an already-rotated refresh token came back: assume theft, kill the session
    await c.env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE id=?').bind(now, reuse.id).run()
    await audit(c, 'auth.refresh_reuse', reuse.user_id)
    return c.json({ error: 'unauthorized' }, 401)
  }
  const s = await c.env.DB.prepare('SELECT id,user_id FROM sessions WHERE refresh_hash=? AND revoked_at IS NULL AND refresh_expires_at>?').bind(hash, now).first<{ id: string; user_id: string }>()
  if (!s) return c.json({ error: 'unauthorized' }, 401)
  const access = randomToken(32), refresh = randomToken(32)
  const r = await c.env.DB.prepare('UPDATE sessions SET access_hash=?, refresh_hash=?, prev_refresh_hash=?, access_expires_at=?, refresh_expires_at=? WHERE id=? AND refresh_hash=?')
    .bind(await sha256Hex(access), await sha256Hex(refresh), hash, now + ACCESS_TTL, now + REFRESH_TTL, s.id, hash).run()
  if (!r.meta.changes) return c.json({ error: 'unauthorized' }, 401)
  return c.json({ accessToken: access, refreshToken: refresh, expiresIn: ACCESS_TTL / 1000 })
})

const authed = new Hono<{ Bindings: Env; Variables: Vars }>()
authed.use('*', requireAuth)

authed.post('/auth/logout', async (c) => {
  await c.env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE id=?').bind(Date.now(), c.get('sessionId')).run()
  return c.json({ ok: true })
})

// ---------- Profile, consent, privacy rights ----------
authed.get('/me', async (c) => {
  const u = await c.env.DB.prepare('SELECT id,display_name,language,created_at FROM users WHERE id=?').bind(c.get('userId')).first()
  return c.json({ user: u })
})
authed.patch('/me', async (c) => {
  const b = await jsonBody(c)
  const name = typeof b?.displayName === 'string' ? b.displayName.trim().slice(0, 80) : null
  const lang = b?.language === 'en' || b?.language === 'ar' ? b.language : null
  await c.env.DB.prepare('UPDATE users SET display_name=COALESCE(?,display_name), language=COALESCE(?,language) WHERE id=?').bind(name, lang, c.get('userId')).run()
  return c.json({ ok: true })
})
authed.post('/consents', async (c) => {
  const b = await jsonBody(c)
  const type = b?.type, version = b?.version
  if (!['terms', 'privacy', 'document_processing'].includes(type as string) || typeof version !== 'string' || !/^[\w.-]{1,20}$/.test(version) || typeof b?.accepted !== 'boolean') {
    return c.json({ error: 'invalid_request' }, 400)
  }
  // Idempotent: re-sending the same decision for the same version adds nothing.
  const last = await c.env.DB.prepare('SELECT version,accepted FROM consents WHERE user_id=? AND type=? ORDER BY created_at DESC, rowid DESC LIMIT 1')
    .bind(c.get('userId'), type).first<{ version: string; accepted: number }>()
  if (last && last.version === version && !!last.accepted === b.accepted) return c.json({ ok: true, unchanged: true })
  await c.env.DB.prepare('INSERT INTO consents (id,user_id,type,version,accepted,created_at) VALUES (?,?,?,?,?,?)')
    .bind(newId(), c.get('userId'), type, version, b.accepted ? 1 : 0, Date.now()).run()
  await audit(c, 'consent.record', c.get('userId'), { type, version, accepted: b.accepted })
  return c.json({ ok: true })
})

authed.get('/me/export', async (c) => {
  const uid = c.get('userId')
  if (!(await allow(c.env, `export:${uid}`, 3, 3600))) return c.json({ error: 'too_many_requests' }, 429)
  const q = (sql: string) => c.env.DB.prepare(sql).bind(uid).all().then((r) => r.results)
  const u = await c.env.DB.prepare('SELECT id,phone_enc,display_name,language,created_at FROM users WHERE id=?').bind(uid).first<{ phone_enc: string }>()
  const phone = u ? await openText(c.env.DATA_KEY, 'user-phone', u.phone_enc) : null
  await audit(c, 'privacy.export', uid)
  return c.json({
    exportedAt: Date.now(),
    user: u ? { ...u, phone_enc: undefined, phone } : null,
    requests: await q('SELECT id,service_id,status,data,renewal_of,created_at,updated_at FROM requests WHERE user_id=? AND deleted_at IS NULL'),
    files: await q('SELECT id,request_id,name,mime,size,sha256,created_at FROM request_files WHERE user_id=? AND deleted_at IS NULL'),
    consents: await q('SELECT type,version,accepted,created_at FROM consents WHERE user_id=?'),
  })
})

authed.delete('/me', async (c) => {
  const uid = c.get('userId')
  const b = await jsonBody(c)
  if (b?.confirm !== 'DELETE') return c.json({ error: 'confirmation_required' }, 400)
  const files = await c.env.DB.prepare('SELECT r2_key FROM request_files WHERE user_id=? AND deleted_at IS NULL').bind(uid).all<{ r2_key: string }>()
  for (const f of files.results) await c.env.DOCS.delete(f.r2_key)
  const now = Date.now()
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE request_files SET deleted_at=?, name=?, r2_key=? WHERE user_id=?').bind(now, 'deleted', 'deleted', uid),
    c.env.DB.prepare("UPDATE requests SET deleted_at=?, data='{}' WHERE user_id=?").bind(now, uid),
    c.env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=?').bind(now, uid),
    c.env.DB.prepare("UPDATE users SET deleted_at=?, display_name=NULL, phone_enc='deleted', phone_hash='deleted:'||id WHERE id=?").bind(now, uid),
  ])
  await audit(c, 'privacy.delete', uid)
  return c.json({ ok: true })
})

// ---------- Requests ----------
authed.get('/requests', async (c) => {
  const r = await c.env.DB.prepare('SELECT id,service_id,status,data,staff_data,renewal_of,created_at,updated_at,version,delivery_version,(SELECT MAX(delivery_version) FROM receipt_acks a WHERE a.request_id=requests.id) acknowledged_version,(SELECT MAX(acknowledged_at) FROM receipt_acks a WHERE a.request_id=requests.id) acknowledged_at FROM requests WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200').bind(c.get('userId')).all()
  return c.json({ requests: r.results })
})
authed.post('/requests', async (c) => {
  const b = await jsonBody(c)
  if (!isServiceId(b?.serviceId)) return c.json({ error: 'invalid_request' }, 400)
  const data = b?.data && typeof b.data === 'object' ? JSON.stringify(b.data) : '{}'
  if (data.length > 16 * 1024) return c.json({ error: 'too_large' }, 413)
  const renewalOf = typeof b?.renewalOf === 'string' && isUuid(b.renewalOf) ? b.renewalOf : null
  const uid = c.get('userId')
  if (renewalOf) {
    const own = await c.env.DB.prepare('SELECT 1 x FROM requests WHERE id=? AND user_id=?').bind(renewalOf, uid).first()
    if (!own) return c.json({ error: 'invalid_request' }, 400)
    // One active renewal per source request: asking again returns the existing one.
    const active = await c.env.DB.prepare("SELECT id FROM requests WHERE user_id=? AND renewal_of=? AND deleted_at IS NULL AND status NOT IN ('completed','cancelled','rejected') LIMIT 1").bind(uid, renewalOf).first<{ id: string }>()
    if (active) return c.json({ id: active.id, existing: true }, 200)
  }
  // Idempotent create: the same key replays the same request; the same key with different content is refused.
  const keyRaw = c.req.header('idempotency-key') ?? (typeof b?.clientKey === 'string' ? b.clientKey : '')
  const key = /^[A-Za-z0-9._:-]{8,80}$/.test(keyRaw) ? keyRaw : null
  const hash = await sha256Hex(`${b.serviceId}|${renewalOf ?? ''}`)
  if (key) {
    const prev = await c.env.DB.prepare('SELECT id,client_hash FROM requests WHERE user_id=? AND client_key=?').bind(uid, key).first<{ id: string; client_hash: string | null }>()
    if (prev) return prev.client_hash === hash ? c.json({ id: prev.id, replay: true }, 200) : c.json({ error: 'idempotency_conflict' }, 422)
  }
  const id = newId(), now = Date.now()
  try {
    await c.env.DB.prepare('INSERT INTO requests (id,user_id,service_id,status,data,renewal_of,created_at,updated_at,client_key,client_hash) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(id, uid, b.serviceId, 'draft', data, renewalOf, now, now, key, hash).run()
  } catch (e) { // lost a race with the same key: return the winner
    const prev = key ? await c.env.DB.prepare('SELECT id FROM requests WHERE user_id=? AND client_key=?').bind(uid, key).first<{ id: string }>() : null
    if (prev) return c.json({ id: prev.id, replay: true }, 200)
    throw e
  }
  return c.json({ id }, 201)
})

const ownRequest = (c: C, id: string) =>
  c.env.DB.prepare('SELECT id,status FROM requests WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(id, c.get('userId')).first<{ id: string; status: string }>()

authed.get('/requests/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'not_found' }, 404)
  const r = await c.env.DB.prepare('SELECT id,service_id,status,data,staff_data,renewal_of,created_at,updated_at,version,delivery_version,(SELECT MAX(delivery_version) FROM receipt_acks a WHERE a.request_id=requests.id) acknowledged_version,(SELECT MAX(acknowledged_at) FROM receipt_acks a WHERE a.request_id=requests.id) acknowledged_at FROM requests WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(id, c.get('userId')).first()
  if (!r) return c.json({ error: 'not_found' }, 404)
  const files = await c.env.DB.prepare('SELECT id,name,mime,size,kind,label,created_at FROM request_files WHERE request_id=? AND deleted_at IS NULL').bind(id).all()
  // Customers only ever see events marked visible; internal notes never leave the staff API.
  const events = await c.env.DB.prepare('SELECT id,text_ar,text_en,created_at FROM request_events WHERE request_id=? AND visible=1 ORDER BY created_at').bind(id).all()
  const missing = await c.env.DB.prepare('SELECT id,label_ar,label_en,note_ar,note_en,replacement_file_id,resolved_at FROM missing_documents WHERE request_id=? ORDER BY created_at').bind(id).all()
  return c.json({ request: r, files: files.results, events: events.results, missing: missing.results })
})
authed.patch('/requests/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id) || !(await ownRequest(c, id))) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const data = b?.data && typeof b.data === 'object' ? JSON.stringify(b.data) : null
  if (data && data.length > 16 * 1024) return c.json({ error: 'too_large' }, 413)
  // Clients may only submit or cancel; every other status belongs to staff.
  const status = b?.status === 'submitted' || b?.status === 'cancelled' ? b.status : null
  if (b?.status !== undefined && !status) return c.json({ error: 'invalid_status' }, 400)
  const before = await ownRequest(c, id)
  await c.env.DB.prepare('UPDATE requests SET data=COALESCE(?,data), status=COALESCE(?,status), version=version+1, updated_at=? WHERE id=? AND user_id=?').bind(data, status, Date.now(), id, c.get('userId')).run()
  if (status && before?.status !== status) {
    const [ar, en] = status === 'submitted' ? ['تم إرسال الطلب', 'Request submitted'] : ['أُلغي الطلب', 'Request cancelled']
    await c.env.DB.prepare("INSERT INTO request_events (id,request_id,actor,kind,text_ar,text_en,visible,created_at) VALUES (?,?,'customer','status',?,?,1,?)").bind(newId(), id, ar, en, Date.now()).run()
  }
  return c.json({ ok: true })
})
authed.delete('/requests/:id', async (c) => {
  const id = c.req.param('id')
  const r = isUuid(id) ? await ownRequest(c, id) : null
  if (!r) return c.json({ error: 'not_found' }, 404)
  if (r.status !== 'draft') return c.json({ error: 'only_drafts_deletable' }, 409)
  const files = await c.env.DB.prepare('SELECT r2_key FROM request_files WHERE request_id=? AND deleted_at IS NULL').bind(id).all<{ r2_key: string }>()
  for (const f of files.results) await c.env.DOCS.delete(f.r2_key)
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE request_files SET deleted_at=?, r2_key=? WHERE request_id=?').bind(Date.now(), 'deleted', id),
    c.env.DB.prepare("UPDATE requests SET deleted_at=?, data='{}' WHERE id=?").bind(Date.now(), id),
  ])
  return c.json({ ok: true })
})

// Receipt acknowledgement: a recorded command for one delivery version. Viewing or downloading never acknowledges.
authed.post('/requests/:id/acknowledgments', async (c) => {
  const id = c.req.param('id'), uid = c.get('userId')
  if (!isUuid(id)) return c.json({ error: 'not_found' }, 404)
  const b = await jsonBody(c)
  const r = await c.env.DB.prepare('SELECT status,delivery_version FROM requests WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(id, uid).first<{ status: string; delivery_version: number }>()
  if (!r) return c.json({ error: 'not_found' }, 404)
  if (r.status !== 'completed' || r.delivery_version < 1) return c.json({ error: 'nothing_to_acknowledge' }, 409)
  if (b?.deliveryVersion !== r.delivery_version) return c.json({ error: 'stale_delivery', current: r.delivery_version }, 409) // a newer delivery needs its own confirmation
  const now = Date.now()
  const ins = await c.env.DB.prepare('INSERT OR IGNORE INTO receipt_acks (id,request_id,user_id,delivery_version,acknowledged_at) VALUES (?,?,?,?,?)').bind(newId(), id, uid, r.delivery_version, now).run()
  const row = await c.env.DB.prepare('SELECT acknowledged_at FROM receipt_acks WHERE request_id=? AND delivery_version=?').bind(id, r.delivery_version).first<{ acknowledged_at: number }>()
  if (ins.meta.changes) {
    await c.env.DB.prepare("INSERT INTO request_events (id,request_id,actor,kind,text_ar,text_en,visible,created_at) VALUES (?,?,'customer','status',?,?,1,?)").bind(newId(), id, 'أكد العميل استلام الملفات', 'Customer confirmed receipt of the files', now).run()
    await audit(c, 'delivery.ack', uid, { requestId: id, version: r.delivery_version })
  }
  return c.json({ ok: true, deliveryVersion: r.delivery_version, acknowledgedAt: row?.acknowledged_at ?? now, duplicate: !ins.meta.changes })
})

// ---------- Files (encrypted before they reach storage) ----------
authed.put('/requests/:id/files', async (c) => {
  const id = c.req.param('id'), uid = c.get('userId')
  if (!isUuid(id) || !(await ownRequest(c, id))) return c.json({ error: 'not_found' }, 404)
  if (!(await allow(c.env, `upload:${uid}`, 40, 3600))) return c.json({ error: 'too_many_requests' }, 429)
  if (Number(c.req.header('content-length') ?? '0') > MAX_FILE_BYTES) return c.json({ error: 'too_large' }, 413)
  const bytes = new Uint8Array(await c.req.arrayBuffer())
  if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) return c.json({ error: 'too_large' }, 413)
  const kind = sniffFile(bytes) // trust the bytes, never the client-declared type
  if (!kind) return c.json({ error: 'unsupported_type' }, 415)
  const count = await c.env.DB.prepare('SELECT COUNT(*) n FROM request_files WHERE request_id=? AND deleted_at IS NULL').bind(id).first<{ n: number }>()
  if ((count?.n ?? 0) >= MAX_FILES_PER_REQUEST) return c.json({ error: 'too_many_files' }, 409)
  const fileId = newId(), key = `u/${uid}/${fileId}`
  await c.env.DOCS.put(key, await seal(c.env.DATA_KEY, `file:${uid}:${fileId}`, bytes), { httpMetadata: { contentType: 'application/octet-stream' } })
  const name = safeFileName(c.req.header('x-file-name') ? decodeURIComponent(c.req.header('x-file-name') as string) : null, kind.ext)
  await c.env.DB.prepare('INSERT INTO request_files (id,request_id,user_id,r2_key,name,mime,size,sha256,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(fileId, id, uid, key, name, kind.mime, bytes.length, await sha256Hex(bytes), Date.now()).run()
  const missingId = c.req.query('missingId')
  if (missingId && isUuid(missingId)) {
    const m = await c.env.DB.prepare('UPDATE missing_documents SET replacement_file_id=?, resolved_at=? WHERE id=? AND request_id=? AND resolved_at IS NULL').bind(fileId, Date.now(), missingId, id).run()
    if (m.meta.changes) {
      const left = await c.env.DB.prepare('SELECT COUNT(*) n FROM missing_documents WHERE request_id=? AND resolved_at IS NULL').bind(id).first<{ n: number }>()
      const cur = await ownRequest(c, id)
      if ((left?.n ?? 0) === 0 && cur?.status === 'needs_documents') { // all supplied: back to staff review
        await c.env.DB.batch([
          c.env.DB.prepare("UPDATE requests SET status='review', version=version+1, updated_at=? WHERE id=?").bind(Date.now(), id),
          c.env.DB.prepare("INSERT INTO request_events (id,request_id,actor,kind,text_ar,text_en,visible,created_at) VALUES (?,?,'customer','status',?,?,1,?)").bind(newId(), id, 'أرسل العميل المستندات المطلوبة', 'Customer sent the requested documents', Date.now()),
        ])
      }
    }
  }
  await audit(c, 'file.upload', uid, { fileId })
  return c.json({ id: fileId, name, mime: kind.mime, size: bytes.length }, 201)
})
authed.get('/files/:fileId', async (c) => {
  const fid = c.req.param('fileId'), uid = c.get('userId')
  if (!isUuid(fid)) return c.json({ error: 'not_found' }, 404)
  const f = await c.env.DB.prepare('SELECT r2_key,name,mime FROM request_files WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(fid, uid).first<{ r2_key: string; name: string; mime: string }>()
  const obj = f ? await c.env.DOCS.get(f.r2_key) : null
  if (!f || !obj) return c.json({ error: 'not_found' }, 404)
  const plain = await open(c.env.DATA_KEY, `file:${uid}:${fid}`, new Uint8Array(await obj.arrayBuffer()))
  await audit(c, 'file.download', uid, { fileId: fid })
  return new Response(plain as BufferSource, { headers: { 'content-type': f.mime, 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
})
authed.delete('/files/:fileId', async (c) => {
  const fid = c.req.param('fileId'), uid = c.get('userId')
  if (!isUuid(fid)) return c.json({ error: 'not_found' }, 404)
  const f = await c.env.DB.prepare("SELECT r2_key FROM request_files WHERE id=? AND user_id=? AND kind='source' AND deleted_at IS NULL").bind(fid, uid).first<{ r2_key: string }>()
  if (!f) return c.json({ error: 'not_found' }, 404)
  await c.env.DOCS.delete(f.r2_key)
  await c.env.DB.prepare('UPDATE request_files SET deleted_at=?, r2_key=? WHERE id=?').bind(Date.now(), 'deleted', fid).run()
  await audit(c, 'file.delete', uid, { fileId: fid })
  return c.json({ ok: true })
})

app.route('/v1', authed)
app.route('/staff/v1', staff)
export default app
