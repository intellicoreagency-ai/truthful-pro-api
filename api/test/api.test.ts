import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import { readFileSync } from 'node:fs'
import { app } from '../src/index'
import type { Env } from '../src/types'

let env: Env
let dispose: () => Promise<void>
const b64 = (n: number) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString('base64')
let ipCounter = 0

async function call(method: string, path: string, opts: { body?: unknown; token?: string; raw?: Uint8Array; headers?: Record<string, string>; ip?: string } = {}) {
  const headers: Record<string, string> = { 'cf-connecting-ip': opts.ip ?? `10.0.0.${++ipCounter % 250}`, ...(opts.headers ?? {}) }
  let body: BodyInit | undefined
  if (opts.raw) body = opts.raw as BodyInit
  else if (opts.body !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(opts.body) }
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
  return app.fetch(new Request('https://api.test' + path, { method, headers, body }), env)
}

async function login(phone = '+971501234567') {
  const r = await call('POST', '/v1/auth/otp/request', { body: { phone, language: 'en' } })
  const j = await r.json() as { challengeId: string; devCode: string }
  const v = await call('POST', '/v1/auth/otp/verify', { body: { phone, challengeId: j.challengeId, code: j.devCode } })
  return { res: v, json: await v.json() as { accessToken: string; refreshToken: string; isNewUser: boolean } }
}

beforeAll(async () => {
  const p = await getPlatformProxy<Env>({ configPath: new URL('../wrangler.toml', import.meta.url).pathname, persist: false })
  dispose = p.dispose
  env = { ...p.env, PEPPER: b64(32), DATA_KEY: b64(32), ENVIRONMENT: 'test', DEV_OTP_ECHO: '1' } as Env
  const sql = readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8')
  for (const stmt of sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await env.DB.prepare(stmt).run()
})
afterAll(async () => { await dispose?.() })

const pdf = () => new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF')

describe('auth', () => {
  it('rejects invalid phone numbers', async () => {
    for (const phone of ['123', '+97145551234', 'abc', '', null]) {
      expect((await call('POST', '/v1/auth/otp/request', { body: { phone } })).status).toBe(400)
    }
  })
  it('logs in with OTP and creates a user once', async () => {
    const a = await login('+971521110001')
    expect(a.res.status).toBe(200)
    expect(a.json.isNewUser).toBe(true)
    expect((await login('+971521110001')).json.isNewUser).toBe(false)
  })
  it('rejects a wrong code, and blocks after 5 attempts even with the right code', async () => {
    const phone = '+971521110002'
    const r = await call('POST', '/v1/auth/otp/request', { body: { phone } })
    const { challengeId, devCode } = await r.json() as { challengeId: string; devCode: string }
    const wrong = devCode === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) expect((await call('POST', '/v1/auth/otp/verify', { body: { phone, challengeId, code: wrong } })).status).toBe(401)
    expect((await call('POST', '/v1/auth/otp/verify', { body: { phone, challengeId, code: devCode } })).status).toBe(401)
  })
  it('does not let a code be used twice', async () => {
    const phone = '+971521110003'
    const r = await call('POST', '/v1/auth/otp/request', { body: { phone } })
    const { challengeId, devCode } = await r.json() as { challengeId: string; devCode: string }
    expect((await call('POST', '/v1/auth/otp/verify', { body: { phone, challengeId, code: devCode } })).status).toBe(200)
    expect((await call('POST', '/v1/auth/otp/verify', { body: { phone, challengeId, code: devCode } })).status).toBe(401)
  })
  it('rate-limits OTP requests per phone', async () => {
    const phone = '+971521110004'
    const codes: number[] = []
    for (let i = 0; i < 4; i++) codes.push((await call('POST', '/v1/auth/otp/request', { body: { phone } })).status)
    expect(codes).toEqual([200, 200, 200, 429])
  })
  it('never echoes the code in production', async () => {
    const prod = { ...env, ENVIRONMENT: 'production' } as Env
    const r = await app.fetch(new Request('https://api.test/v1/auth/otp/request', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '9.9.9.9' }, body: JSON.stringify({ phone: '+971521110005' }) }), prod)
    expect(r.status).toBe(502) // no SMS provider configured => fail closed, no code leaked
    expect(await r.text()).not.toMatch(/devCode/)
  })
  it('requires a valid bearer token', async () => {
    expect((await call('GET', '/v1/me')).status).toBe(401)
    expect((await call('GET', '/v1/me', { token: 'x'.repeat(43) })).status).toBe(401)
  })
  it('rotates refresh tokens and kills the session on reuse', async () => {
    const { json } = await login('+971521110006')
    const r1 = await call('POST', '/v1/auth/refresh', { body: { refreshToken: json.refreshToken } })
    expect(r1.status).toBe(200)
    const n = await r1.json() as { accessToken: string; refreshToken: string }
    expect((await call('GET', '/v1/me', { token: n.accessToken })).status).toBe(200)
    expect((await call('GET', '/v1/me', { token: json.accessToken })).status).toBe(401) // old access token dead
    expect((await call('POST', '/v1/auth/refresh', { body: { refreshToken: json.refreshToken } })).status).toBe(401) // reuse
    expect((await call('GET', '/v1/me', { token: n.accessToken })).status).toBe(401) // session revoked
  })
  it('logout revokes the session', async () => {
    const { json } = await login('+971521110007')
    expect((await call('POST', '/v1/auth/logout', { token: json.accessToken })).status).toBe(200)
    expect((await call('GET', '/v1/me', { token: json.accessToken })).status).toBe(401)
  })
  it('stores no plaintext phone number', async () => {
    await login('+971521110008')
    const rows = await env.DB.prepare('SELECT phone_hash, phone_enc FROM users').all<{ phone_hash: string; phone_enc: string }>()
    for (const r of rows.results) { expect(r.phone_hash + r.phone_enc).not.toContain('971521110008') }
  })
})

describe('requests and isolation', () => {
  it('creates, lists, updates and cannot reach another user\'s request', async () => {
    const a = (await login('+971521110011')).json, b = (await login('+971521110012')).json
    const c = await call('POST', '/v1/requests', { token: a.accessToken, body: { serviceId: 'emirates-id', data: { name: 'Test' } } })
    expect(c.status).toBe(201)
    const { id } = await c.json() as { id: string }
    expect((await call('GET', `/v1/requests/${id}`, { token: a.accessToken })).status).toBe(200)
    expect((await call('GET', `/v1/requests/${id}`, { token: b.accessToken })).status).toBe(404)
    expect((await call('PATCH', `/v1/requests/${id}`, { token: b.accessToken, body: { status: 'submitted' } })).status).toBe(404)
    expect((await call('DELETE', `/v1/requests/${id}`, { token: b.accessToken })).status).toBe(404)
    const list = await (await call('GET', '/v1/requests', { token: b.accessToken })).json() as { requests: unknown[] }
    expect(list.requests).toHaveLength(0)
  })
  it('lets clients only submit or cancel, never set staff statuses', async () => {
    const a = (await login('+971521110013')).json
    const { id } = await (await call('POST', '/v1/requests', { token: a.accessToken, body: { serviceId: 'emirates-id' } })).json() as { id: string }
    expect((await call('PATCH', `/v1/requests/${id}`, { token: a.accessToken, body: { status: 'completed' } })).status).toBe(400)
    expect((await call('PATCH', `/v1/requests/${id}`, { token: a.accessToken, body: { status: 'submitted' } })).status).toBe(200)
    expect((await call('DELETE', `/v1/requests/${id}`, { token: a.accessToken })).status).toBe(409) // only drafts deletable
  })
  it('rejects oversized JSON and bad service ids', async () => {
    const a = (await login('+971521110014')).json
    expect((await call('POST', '/v1/requests', { token: a.accessToken, body: { serviceId: '../x' } })).status).toBe(400)
    expect((await call('POST', '/v1/requests', { token: a.accessToken, body: { serviceId: 'emirates-id', data: { x: 'a'.repeat(20000) } } })).status).toBe(413)
  })
})

describe('files', () => {
  it('encrypts at rest, round-trips, and is private to the owner', async () => {
    const a = (await login('+971521110021')).json, b = (await login('+971521110022')).json
    const { id } = await (await call('POST', '/v1/requests', { token: a.accessToken, body: { serviceId: 'emirates-id' } })).json() as { id: string }
    const up = await call('PUT', `/v1/requests/${id}/files`, { token: a.accessToken, raw: pdf(), headers: { 'x-file-name': encodeURIComponent('جواز السفر.pdf'), 'content-type': 'application/pdf' } })
    expect(up.status).toBe(201)
    const f = await up.json() as { id: string; mime: string; name: string }
    expect(f.mime).toBe('application/pdf')
    const row = await env.DB.prepare('SELECT r2_key FROM request_files WHERE id=?').bind(f.id).first<{ r2_key: string }>()
    const stored = new Uint8Array(await (await env.DOCS.get(row!.r2_key))!.arrayBuffer())
    expect(new TextDecoder().decode(stored)).not.toContain('%PDF') // ciphertext, not the file
    const dl = await call('GET', `/v1/files/${f.id}`, { token: a.accessToken })
    expect(dl.status).toBe(200)
    expect(new Uint8Array(await dl.arrayBuffer())).toEqual(pdf())
    expect((await call('GET', `/v1/files/${f.id}`, { token: b.accessToken })).status).toBe(404)
    expect((await call('DELETE', `/v1/files/${f.id}`, { token: b.accessToken })).status).toBe(404)
    expect((await call('DELETE', `/v1/files/${f.id}`, { token: a.accessToken })).status).toBe(200)
    expect(await env.DOCS.get(row!.r2_key)).toBeNull()
  })
  it('judges by content, not the declared type, and enforces the size cap', async () => {
    const a = (await login('+971521110023')).json
    const { id } = await (await call('POST', '/v1/requests', { token: a.accessToken, body: { serviceId: 'emirates-id' } })).json() as { id: string }
    const exe = new TextEncoder().encode('MZ\x90\x00 pretend exe')
    expect((await call('PUT', `/v1/requests/${id}/files`, { token: a.accessToken, raw: exe, headers: { 'content-type': 'application/pdf' } })).status).toBe(415)
    const big = new Uint8Array(5 * 1024 * 1024 + 1); big.set([0x25, 0x50, 0x44, 0x46, 0x2d])
    expect((await call('PUT', `/v1/requests/${id}/files`, { token: a.accessToken, raw: big })).status).toBe(413)
  })
  it('sanitises file names', async () => {
    const a = (await login('+971521110024')).json
    const { id } = await (await call('POST', '/v1/requests', { token: a.accessToken, body: { serviceId: 'emirates-id' } })).json() as { id: string }
    const up = await call('PUT', `/v1/requests/${id}/files`, { token: a.accessToken, raw: pdf(), headers: { 'x-file-name': encodeURIComponent('../../etc/pass‮wd.pdf') } })
    expect((await up.json() as { name: string }).name).toBe('passwd.pdf')
  })
})

describe('privacy rights', () => {
  it('records consent, exports data, and deletes everything on request', async () => {
    const a = (await login('+971521110031')).json
    expect((await call('POST', '/v1/consents', { token: a.accessToken, body: { type: 'privacy', version: '1.0', accepted: true } })).status).toBe(200)
    const { id } = await (await call('POST', '/v1/requests', { token: a.accessToken, body: { serviceId: 'emirates-id', data: { n: 1 } } })).json() as { id: string }
    const up = await (await call('PUT', `/v1/requests/${id}/files`, { token: a.accessToken, raw: pdf() })).json() as { id: string }
    const exp = await (await call('GET', '/v1/me/export', { token: a.accessToken })).json() as { user: { phone: string }; requests: unknown[]; consents: unknown[]; files: unknown[] }
    expect(exp.user.phone).toBe('+971521110031')
    expect(exp.requests).toHaveLength(1); expect(exp.consents).toHaveLength(1); expect(exp.files).toHaveLength(1)
    expect((await call('DELETE', '/v1/me', { token: a.accessToken, body: {} })).status).toBe(400) // needs confirmation
    expect((await call('DELETE', '/v1/me', { token: a.accessToken, body: { confirm: 'DELETE' } })).status).toBe(200)
    expect((await call('GET', '/v1/me', { token: a.accessToken })).status).toBe(401)
    const row = await env.DB.prepare('SELECT r2_key FROM request_files WHERE id=?').bind(up.id).first<{ r2_key: string }>()
    expect(row?.r2_key).toBe('deleted')
    const after = await login('+971521110031') // number can sign up fresh
    expect(after.json.isNewUser).toBe(true)
  })
  it('sets security headers and no CORS', async () => {
    const r = await call('GET', '/health')
    expect(r.headers.get('strict-transport-security')).toBeTruthy()
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(r.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('cors', () => {
  it('is closed by default and opens only for listed origins', async () => {
    const closed = await call('OPTIONS', '/v1/me', { headers: { origin: 'https://evil.example' } })
    expect(closed.status).toBe(403)
    const open = { ...env, ALLOWED_ORIGINS: 'https://app.example' } as Env
    const r = await app.fetch(new Request('https://api.test/v1/me', { method: 'OPTIONS', headers: { origin: 'https://app.example' } }), open)
    expect(r.status).toBe(204)
    expect(r.headers.get('access-control-allow-origin')).toBe('https://app.example')
    const bad = await app.fetch(new Request('https://api.test/v1/me', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), open)
    expect(bad.status).toBe(403)
  })
})

describe('whatsapp verification (free, user-initiated)', () => {
  const SECRET = 'test-app-secret'
  const waEnv = () => ({ ...env, WA_BUSINESS_NUMBER: '971500000000', WA_APP_SECRET: SECRET, WA_VERIFY_TOKEN: 'vt' } as Env)
  const sign = async (raw: string, secret = SECRET) => {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return 'sha256=' + Buffer.from(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(raw))).toString('hex')
  }
  const fetchWa = (path: string, init: RequestInit, e: Env = waEnv()) => app.fetch(new Request('https://api.test' + path, { ...init, headers: { 'cf-connecting-ip': `10.1.0.${++ipCounter % 250}`, ...(init.headers ?? {}) } }), e)
  const start = async (phone: string) => {
    const r = await fetchWa('/v1/auth/wa/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, language: 'en' }) })
    return { r, j: await r.json() as { challengeId: string; pollToken: string; code: string; link: string } }
  }
  const inbound = async (from: string, text: string, secret = SECRET) => {
    const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from, type: 'text', text: { body: text } }] } }] }] })
    return fetchWa('/webhooks/whatsapp', { method: 'POST', headers: { 'x-hub-signature-256': await sign(raw, secret), 'content-type': 'application/json' }, body: raw })
  }
  const poll = async (s: { challengeId: string; pollToken: string }, phone: string) => {
    const r = await fetchWa('/v1/auth/wa/poll', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challengeId: s.challengeId, pollToken: s.pollToken, phone }) })
    return await r.json() as { status?: string; accessToken?: string; error?: string }
  }

  it('is unavailable until the business number is configured', async () => {
    const r = await call('POST', '/v1/auth/wa/start', { body: { phone: '+971521120001' } })
    expect(r.status).toBe(503)
  })
  it('logs in when the real owner of the number sends the code', async () => {
    const phone = '+971521120002'
    const s = await start(phone)
    expect(s.r.status).toBe(200)
    expect(s.j.link).toContain('https://wa.me/971500000000?text=')
    expect((await poll(s.j, phone)).status).toBe('pending')
    expect((await inbound('971521120002', `Verify my account ${s.j.code}`)).status).toBe(200)
    const done = await poll(s.j, phone)
    expect(done.status).toBe('verified')
    expect((await call('GET', '/v1/me', { token: done.accessToken })).status).toBe(200)
    expect((await poll(s.j, phone)).status).toBe('expired') // single use
  })
  it('does not verify if someone else sends the code', async () => {
    const phone = '+971521120003'
    const s = await start(phone)
    await inbound('971529999999', s.j.code) // attacker's own number
    expect((await poll(s.j, phone)).status).toBe('pending')
  })
  it('rejects forged or unsigned webhooks', async () => {
    const phone = '+971521120004'
    const s = await start(phone)
    expect((await inbound('971521120004', s.j.code, 'wrong-secret')).status).toBe(401)
    const raw = JSON.stringify({ entry: [] })
    expect((await fetchWa('/webhooks/whatsapp', { method: 'POST', body: raw })).status).toBe(401)
    expect((await poll(s.j, phone)).status).toBe('pending')
  })
  it('will not hand a session to someone without the poll token', async () => {
    const phone = '+971521120005'
    const s = await start(phone)
    await inbound('971521120005', s.j.code)
    const r = await fetchWa('/v1/auth/wa/poll', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challengeId: s.j.challengeId, pollToken: 'x'.repeat(30), phone }) })
    expect(r.status).toBe(400)
    expect((await poll(s.j, phone)).status).toBe('verified') // the real client still can
  })
  it('expires old challenges', async () => {
    const phone = '+971521120006'
    const s = await start(phone)
    await env.DB.prepare('UPDATE wa_challenges SET expires_at=? WHERE id=?').bind(Date.now() - 1, s.j.challengeId).run()
    await inbound('971521120006', s.j.code)
    expect((await poll(s.j, phone)).status).toBe('expired')
  })
  it('answers Meta’s webhook handshake only with the right token', async () => {
    const ok = await fetchWa('/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=12345', { method: 'GET' })
    expect(await ok.text()).toBe('12345')
    expect((await fetchWa('/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1', { method: 'GET' })).status).toBe(403)
  })
})
