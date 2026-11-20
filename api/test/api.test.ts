import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import { readFileSync, readdirSync } from 'node:fs'
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
  const dir = new URL('../migrations/', import.meta.url)
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(file, dir), 'utf8')
    for (const stmt of sql.split(/;\s*\n/).map((x) => x.trim()).filter(Boolean)) await env.DB.prepare(stmt).run()
  }
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

describe('consent log', () => {
  it('records a decision once, but records changes and withdrawals', async () => {
    const a = (await login('+971521130001')).json
    const post = (accepted: boolean, version = '1.0') => call('POST', '/v1/consents', { token: a.accessToken, body: { type: 'privacy', version, accepted } })
    await post(true); await post(true); await post(true)
    await post(false) // withdrawal
    await post(true, '1.1') // new version
    const n = await env.DB.prepare("SELECT COUNT(*) n FROM consents c JOIN users u ON u.id=c.user_id WHERE c.type='privacy' AND u.id=(SELECT user_id FROM sessions ORDER BY created_at DESC LIMIT 1)").first<{ n: number }>()
    expect(n?.n).toBe(3)
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
    const bare = { ...env, WA_BUSINESS_NUMBER: undefined } as Env // ignore anything in a local .dev.vars
    const r = await app.fetch(new Request('https://api.test/v1/auth/wa/start', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.2.0.1' }, body: JSON.stringify({ phone: '+971521120001' }) }), bare)
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

describe('staff operations hub', () => {
  const SECRET = 's-secret'
  const OWNER = '+971521140001'
  const senv = () => ({ ...env, WA_BUSINESS_NUMBER: '971500000000', WA_APP_SECRET: SECRET, OWNER_PHONE: OWNER } as Env)
  const hit = (method: string, path: string, o: { body?: unknown; token?: string; raw?: Uint8Array; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { 'cf-connecting-ip': `10.3.0.${++ipCounter % 250}`, ...(o.headers ?? {}) }
    let body: BodyInit | undefined
    if (o.raw) body = o.raw as BodyInit; else if (o.body !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(o.body) }
    if (o.token) headers.authorization = `Bearer ${o.token}`
    return app.fetch(new Request('https://api.test' + path, { method, headers, body }), senv())
  }
  const deliver = async (from: string, code: string) => {
    const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from, type: 'text', text: { body: code } }] } }] }] })
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = 'sha256=' + Buffer.from(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(raw))).toString('hex')
    return hit('POST', '/webhooks/whatsapp', { headers: { 'x-hub-signature-256': sig, 'content-type': 'application/json' }, raw: new TextEncoder().encode(raw) })
  }
  async function staffLogin(phone: string) {
    const s = await (await hit('POST', '/staff/v1/auth/wa/start', { body: { phone } })).json() as { challengeId: string; pollToken: string; code: string }
    await deliver(phone.replace('+', ''), s.code)
    const r = await hit('POST', '/staff/v1/auth/wa/poll', { body: { phone, challengeId: s.challengeId, pollToken: s.pollToken } })
    return { status: r.status, j: await r.json() as { status: string; accessToken: string } }
  }
  async function customerLogin(phone: string) {
    const s = await (await hit('POST', '/v1/auth/wa/start', { body: { phone } })).json() as { challengeId: string; pollToken: string; code: string }
    await deliver(phone.replace('+', ''), s.code)
    const r = await hit('POST', '/v1/auth/wa/poll', { body: { phone, challengeId: s.challengeId, pollToken: s.pollToken } })
    return (await r.json() as { accessToken: string }).accessToken
  }
  const submitted = async (token: string) => {
    const { id } = await (await hit('POST', '/v1/requests', { token, body: { serviceId: 'emirates-id', data: { name: 'Ali', title: { ar: 'تجديد', en: 'Renew' } } } })).json() as { id: string }
    await hit('PATCH', `/v1/requests/${id}`, { token, body: { status: 'submitted' } })
    return id
  }
  let owner = '', agentA = '', agentB = '', accountant = ''

  it('denies a verified number that is not on the team, and bootstraps the owner', async () => {
    const stranger = await staffLogin('+971521140099')
    expect(stranger.status).toBe(403); expect(stranger.j.status).toBe('not_staff')
    const o = await staffLogin(OWNER)
    expect(o.status).toBe(200); owner = o.j.accessToken
  })
  it('lets only the owner manage the team; roles are enforced', async () => {
    for (const [phone, role] of [['+971521140002', 'agent'], ['+971521140003', 'agent'], ['+971521140004', 'accountant']] as const)
      expect((await hit('POST', '/staff/v1/team', { token: owner, body: { phone, name: role, role } })).status).toBe(201)
    agentA = (await staffLogin('+971521140002')).j.accessToken
    agentB = (await staffLogin('+971521140003')).j.accessToken
    accountant = (await staffLogin('+971521140004')).j.accessToken
    expect((await hit('POST', '/staff/v1/team', { token: agentA, body: { phone: '+971521140005', name: 'x', role: 'agent' } })).status).toBe(403)
    expect((await hit('GET', '/staff/v1/requests', { token: accountant })).status).toBe(403)
    expect((await hit('POST', '/staff/v1/team', { token: owner, body: { phone: '+971521140005', name: 'x', role: 'owner' } })).status).toBe(400)
  })
  it('keeps customer and staff identities apart', async () => {
    const cust = await customerLogin('+971521140010')
    expect((await hit('GET', '/staff/v1/requests', { token: cust })).status).toBe(401)
    expect((await hit('GET', '/v1/requests', { token: owner })).status).toBe(401)
    expect((await hit('GET', '/staff/v1/requests')).status).toBe(401)
  })
  it('queue hides drafts, scopes agents, and supports assignment', async () => {
    const cust = await customerLogin('+971521140011')
    const draft = (await (await hit('POST', '/v1/requests', { token: cust, body: { serviceId: 'emirates-id' } })).json() as { id: string }).id
    const id = await submitted(cust)
    const q = await (await hit('GET', '/staff/v1/requests', { token: agentA })).json() as { requests: { id: string; customer: { phone: string } }[] }
    expect(q.requests.some((r) => r.id === id)).toBe(true)
    expect(q.requests.some((r) => r.id === draft)).toBe(false)
    expect(q.requests.find((r) => r.id === id)?.customer.phone).toBe('+971521140011')
    const me = await (await hit('GET', '/staff/v1/me', { token: agentA })).json() as { staff: { id: string } }
    expect((await hit('POST', `/staff/v1/requests/${id}/assign`, { token: agentA, body: { staffId: me.staff.id } })).status).toBe(200)
    expect((await hit('GET', `/staff/v1/requests/${id}`, { token: agentB })).status).toBe(404) // taken by A
    expect((await hit('GET', `/staff/v1/requests/${id}`, { token: owner })).status).toBe(200) // owner sees all
    expect((await hit('POST', `/staff/v1/requests/${id}/assign`, { token: agentB, body: { staffId: me.staff.id } })).status).toBe(404)
  })
  it('enforces the status machine and hides internal notes from the customer', async () => {
    const cust = await customerLogin('+971521140012')
    const id = await submitted(cust)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { token: owner, body: { status: 'completed' } })).status).toBe(409)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { token: owner, body: { status: 'review', expectedAt: '2026-12-01' } })).status).toBe(200)
    await hit('POST', `/staff/v1/requests/${id}/notes`, { token: owner, body: { text: 'SECRET internal note' } })
    const d = await (await hit('GET', `/v1/requests/${id}`, { token: cust })).json() as { request: { status: string; staff_data: string }; events: { text_en: string }[] }
    expect(d.request.status).toBe('review')
    expect(JSON.parse(d.request.staff_data).expectedAt).toBe('2026-12-01')
    expect(JSON.stringify(d.events)).not.toContain('SECRET')
    expect(d.events.map((e) => e.text_en)).toEqual(expect.arrayContaining(['Request submitted', 'Under review']))
    expect((await hit('PATCH', `/v1/requests/${id}`, { token: cust, body: { status: 'completed' } })).status).toBe(400) // customers cannot self-complete
  })
  it('asks for missing documents and returns to review when the customer supplies them', async () => {
    const cust = await customerLogin('+971521140013')
    const id = await submitted(cust)
    await hit('POST', `/staff/v1/requests/${id}/status`, { token: owner, body: { status: 'review' } })
    expect((await hit('POST', `/staff/v1/requests/${id}/missing`, { token: owner, body: { items: [] } })).status).toBe(400)
    expect((await hit('POST', `/staff/v1/requests/${id}/missing`, { token: owner, body: { items: [{ labelAr: 'صورة الجواز', labelEn: 'Passport copy', noteEn: 'Unclear' }] } })).status).toBe(200)
    let d = await (await hit('GET', `/v1/requests/${id}`, { token: cust })).json() as { request: { status: string }; missing: { id: string; resolved_at: number | null }[] }
    expect(d.request.status).toBe('needs_documents'); expect(d.missing).toHaveLength(1)
    const up = await hit('PUT', `/v1/requests/${id}/files?missingId=${d.missing[0]!.id}`, { token: cust, raw: pdf() })
    expect(up.status).toBe(201)
    d = await (await hit('GET', `/v1/requests/${id}`, { token: cust })).json() as typeof d
    expect(d.request.status).toBe('review'); expect(d.missing[0]!.resolved_at).not.toBeNull()
  })
  it('delivers a final file the customer can open but not delete; staff views are audited', async () => {
    const cust = await customerLogin('+971521140014')
    const id = await submitted(cust)
    const put = await hit('PUT', `/staff/v1/requests/${id}/files?kind=final`, { token: owner, raw: pdf(), headers: { 'x-file-name': 'result.pdf', 'x-file-label': encodeURIComponent('Delivery') } })
    expect(put.status).toBe(201)
    const f = await put.json() as { id: string }
    const dl = await hit('GET', `/v1/files/${f.id}`, { token: cust })
    expect(dl.status).toBe(200); expect(new Uint8Array(await dl.arrayBuffer())).toEqual(pdf())
    expect((await hit('DELETE', `/v1/files/${f.id}`, { token: cust })).status).toBe(404)
    const sv = await hit('GET', `/staff/v1/files/${f.id}`, { token: owner })
    expect(sv.status).toBe(200); expect(sv.headers.get('content-security-policy')).toContain("frame-ancestors 'self'")
    expect((await hit('GET', '/health')).headers.get('x-frame-options')).toBe('DENY') // everything else stays un-embeddable
    const logged = await env.DB.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='staff.file_view'").first<{ n: number }>()
    expect(logged!.n).toBeGreaterThan(0)
  })
  it('deactivating a staff member ends their session immediately', async () => {
    const team = await (await hit('GET', '/staff/v1/team', { token: owner })).json() as { team: { id: string; name: string; role: string }[] }
    const acc = team.team.find((t) => t.role === 'accountant')!
    expect((await hit('PATCH', `/staff/v1/team/${acc.id}`, { token: owner, body: { active: false } })).status).toBe(200)
    expect((await hit('GET', '/staff/v1/me', { token: accountant })).status).toBe(401)
  })
})

describe('authenticator-app sign-in for staff (no WhatsApp needed)', () => {
  const OWNER = '+971521150001', KEY = 'owner-setup-key-0123456789'
  const tenv = () => ({ ...env, OWNER_PHONE: OWNER, OWNER_SETUP_KEY: KEY } as Env)
  let n = 0
  const hit = (method: string, path: string, body?: unknown, token?: string, e: Env = tenv()) => {
    const headers: Record<string, string> = { 'cf-connecting-ip': `10.4.${Math.floor(++n / 250)}.${n % 250}` }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (token) headers.authorization = `Bearer ${token}`
    return app.fetch(new Request('https://api.test' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), e)
  }
  const step = () => Math.floor(Date.now() / 1000 / 30)
  let secret = '', ownerToken = ''

  beforeAll(async () => { await env.DB.prepare('DELETE FROM staff_sessions').run(); await env.DB.prepare('DELETE FROM staff').run() })

  it('refuses setup without the right key or number', async () => {
    expect((await hit('POST', '/staff/v1/auth/setup/start', { phone: OWNER, setupKey: 'wrong-key-wrong-key' })).status).toBe(403)
    expect((await hit('POST', '/staff/v1/auth/setup/start', { phone: '+971521159999', setupKey: KEY })).status).toBe(403)
    expect((await hit('POST', '/staff/v1/auth/setup/start', { phone: OWNER, setupKey: 'short' })).status).toBe(400)
    expect((await hit('POST', '/staff/v1/auth/setup/start', { phone: OWNER, setupKey: KEY }, undefined, { ...tenv(), OWNER_SETUP_KEY: undefined } as Env)).status).toBe(403)
  })
  it('enrols the owner: secret shown, first code confirms and signs in', async () => {
    const s = await hit('POST', '/staff/v1/auth/setup/start', { phone: OWNER, setupKey: KEY })
    expect(s.status).toBe(200)
    const j = await s.json() as { secret: string; uri: string }
    secret = j.secret
    expect(j.uri).toMatch(/^otpauth:\/\/totp\/.+secret=[A-Z2-7]+/)
    const { hotp } = await import('../src/totp')
    expect((await hit('POST', '/staff/v1/auth/setup/confirm', { phone: OWNER, code: '000000' })).status).toBe(401)
    const ok = await hit('POST', '/staff/v1/auth/setup/confirm', { phone: OWNER, code: await hotp(secret, step()) })
    expect(ok.status).toBe(200)
    const sess = await ok.json() as { accessToken: string; role: string }
    expect(sess.role).toBe('owner'); ownerToken = sess.accessToken
    expect((await hit('GET', '/staff/v1/me', undefined, ownerToken)).status).toBe(200)
  })
  it('cannot be re-enrolled once enabled, even with the setup key', async () => {
    expect((await hit('POST', '/staff/v1/auth/setup/start', { phone: OWNER, setupKey: KEY })).status).toBe(403)
  })
  it('logs in with a code, rejects replays, accepts the next step', async () => {
    const { hotp } = await import('../src/totp')
    // the setup confirmation already used step(); that same code must not work again
    expect((await hit('POST', '/staff/v1/auth/totp', { phone: OWNER, code: await hotp(secret, step()) })).status).toBe(401)
    const next = await hit('POST', '/staff/v1/auth/totp', { phone: OWNER, code: await hotp(secret, step() + 1) })
    expect(next.status).toBe(200)
    expect((await hit('POST', '/staff/v1/auth/totp', { phone: OWNER, code: await hotp(secret, step() + 1) })).status).toBe(401) // replay
    expect((await hit('POST', '/staff/v1/auth/totp', { phone: OWNER, code: await hotp(secret, step() - 1) })).status).toBe(401) // older than last used
  })
  it('answers identically for unknown numbers and wrong codes, and throttles guessing', async () => {
    const a = await hit('POST', '/staff/v1/auth/totp', { phone: '+971521159998', code: '123456' })
    const b = await hit('POST', '/staff/v1/auth/totp', { phone: OWNER, code: '123456' })
    expect(a.status).toBe(401); expect(b.status).toBe(401)
    expect(await a.text()).toBe(await b.text())
    const codes: number[] = []
    for (let i = 0; i < 10; i++) codes.push((await hit('POST', '/staff/v1/auth/totp', { phone: '+971521159997', code: '654321' })).status)
    expect(codes.slice(-1)[0]).toBe(429)
  })
  it('lets the owner invite a member with a one-time key that expires and burns after use', async () => {
    const { hotp } = await import('../src/totp')
    const phone = '+971521150002'
    const add = await hit('POST', '/staff/v1/team', { phone, name: 'Sara', role: 'agent' }, ownerToken)
    expect(add.status).toBe(201)
    const { enrollKey } = await add.json() as { enrollKey: string }
    expect((await hit('POST', '/staff/v1/auth/setup/start', { phone, setupKey: 'not-the-right-key-xyz' })).status).toBe(403)
    const st = await (await hit('POST', '/staff/v1/auth/setup/start', { phone, setupKey: enrollKey })).json() as { secret: string }
    const conf = await hit('POST', '/staff/v1/auth/setup/confirm', { phone, code: await hotp(st.secret, step()) })
    expect(conf.status).toBe(200); expect((await conf.json() as { role: string }).role).toBe('agent')
    expect((await hit('POST', '/staff/v1/auth/setup/start', { phone, setupKey: enrollKey })).status).toBe(403) // key burnt
    // expiry
    const p2 = '+971521150003'
    const k2 = (await (await hit('POST', '/staff/v1/team', { phone: p2, name: 'Omar', role: 'agent' }, ownerToken)).json() as { enrollKey: string }).enrollKey
    await env.DB.prepare('UPDATE staff SET enroll_expires=? WHERE name=?').bind(Date.now() - 1, 'Omar').run()
    expect((await hit('POST', '/staff/v1/auth/setup/start', { phone: p2, setupKey: k2 })).status).toBe(403)
  })
  it('a disabled member cannot sign in with a valid code', async () => {
    const { hotp } = await import('../src/totp')
    const team = await (await hit('GET', '/staff/v1/team', undefined, ownerToken)).json() as { team: { id: string; name: string }[] }
    const sara = team.team.find((t) => t.name === 'Sara')!
    expect((await hit('PATCH', `/staff/v1/team/${sara.id}`, { active: false }, ownerToken)).status).toBe(200)
    const row = await env.DB.prepare('SELECT totp_secret_enc FROM staff WHERE id=?').bind(sara.id).first<{ totp_secret_enc: string }>()
    const { openText } = await import('../src/crypto')
    const s = await openText(env.DATA_KEY, 'staff-totp', row!.totp_secret_enc)
    expect((await hit('POST', '/staff/v1/auth/totp', { phone: '+971521150002', code: await hotp(s, step() + 1) })).status).toBe(401)
  })
  it('keeps the TOTP secret encrypted at rest', async () => {
    const r = await env.DB.prepare('SELECT totp_secret_enc FROM staff WHERE totp_secret_enc IS NOT NULL LIMIT 1').first<{ totp_secret_enc: string }>()
    expect(r!.totp_secret_enc).not.toContain(secret)
  })
})

describe('totp implementation', () => {
  it('matches the RFC 4226 / 6238 reference vectors', async () => {
    const { hotp, base32, unbase32 } = await import('../src/totp')
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' // ASCII "12345678901234567890"
    expect(await hotp(secret, 0)).toBe('755224')
    expect(await hotp(secret, 1)).toBe('287082')
    expect(await hotp(secret, 9)).toBe('520489')
    // RFC 6238, SHA-1, T=59s -> counter 1 -> 94287082 -> last 6 digits
    expect(await hotp(secret, Math.floor(59 / 30))).toBe('287082')
    expect(await hotp(secret, Math.floor(1111111109 / 30))).toBe('081804')
    expect(base32(unbase32(secret))).toBe(secret)
  })
})

describe('passkeys (guards; the full ceremony is exercised in the browser smoke test)', () => {
  const pe = () => ({ ...env, OWNER_PHONE: '+971521160001', OWNER_SETUP_KEY: 'owner-setup-key-0123456789' } as Env)
  let k = 0
  const hit = (method: string, path: string, body?: unknown, token?: string) => {
    const headers: Record<string, string> = { 'cf-connecting-ip': `10.5.${Math.floor(++k / 250)}.${k % 250}` }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (token) headers.authorization = `Bearer ${token}`
    return app.fetch(new Request('https://api.test' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), pe())
  }
  it('requires a staff session to register or list passkeys', async () => {
    expect((await hit('POST', '/staff/v1/passkeys/register/options', {})).status).toBe(401)
    expect((await hit('GET', '/staff/v1/passkeys')).status).toBe(401)
    const cust = await (async () => { const s = await (await hit('POST', '/v1/auth/wa/start', { phone: '+971521160009' })).json().catch(() => ({})) as { error?: string }; return s })()
    void cust
  })
  it('issues a login challenge that cannot be replayed and rejects unknown credentials', async () => {
    const o = await (await hit('POST', '/staff/v1/auth/passkey/options', {})).json() as { challengeId: string; options: { challenge: string; rpId: string; userVerification: string } }
    expect(o.options.userVerification).toBe('required')
    expect(o.options.rpId).toBe('api.test')
    const fake = { id: 'AAAA', rawId: 'AAAA', type: 'public-key', response: { clientDataJSON: 'e30', authenticatorData: 'AA', signature: 'AA' }, clientExtensionResults: {} }
    expect((await hit('POST', '/staff/v1/auth/passkey/verify', { challengeId: o.challengeId, response: fake })).status).toBe(401) // unknown credential
    expect((await hit('POST', '/staff/v1/auth/passkey/verify', { challengeId: o.challengeId, response: fake })).status).toBe(401) // challenge already consumed
    expect((await hit('POST', '/staff/v1/auth/passkey/verify', { challengeId: 'not-a-uuid', response: fake })).status).toBe(401)
  })
  it('refuses a registration response without a valid challenge', async () => {
    const owner = await (async () => {
      const { hotp } = await import('../src/totp')
      await env.DB.prepare('DELETE FROM staff_sessions').run(); await env.DB.prepare('DELETE FROM staff_passkeys').run(); await env.DB.prepare('DELETE FROM staff').run()
      const s = await (await hit('POST', '/staff/v1/auth/setup/start', { phone: '+971521160001', setupKey: 'owner-setup-key-0123456789' })).json() as { secret: string }
      const r = await (await hit('POST', '/staff/v1/auth/setup/confirm', { phone: '+971521160001', code: await hotp(s.secret, Math.floor(Date.now() / 30000)) })).json() as { accessToken: string }
      return r.accessToken
    })()
    const ro = await (await hit('POST', '/staff/v1/passkeys/register/options', {}, owner)).json() as { challengeId: string; options: { authenticatorSelection: { userVerification: string; residentKey: string } } }
    expect(ro.options.authenticatorSelection.userVerification).toBe('required')
    expect(ro.options.authenticatorSelection.residentKey).toBe('required')
    const junk = { id: 'AAAA', rawId: 'AAAA', type: 'public-key', response: { clientDataJSON: 'e30', attestationObject: 'AA' }, clientExtensionResults: {} }
    expect((await hit('POST', '/staff/v1/passkeys/register/verify', { challengeId: ro.challengeId, response: junk }, owner)).status).toBe(400)
    expect((await hit('POST', '/staff/v1/passkeys/register/verify', { challengeId: ro.challengeId, response: junk }, owner)).status).toBe(400) // burnt
    expect((await hit('GET', '/staff/v1/passkeys', undefined, owner)).status).toBe(200)
  })
})

describe('override, overview and customers', () => {
  const OWNER = '+971521170001'
  const oenv = () => ({ ...env, OWNER_PHONE: OWNER, OWNER_SETUP_KEY: 'owner-setup-key-0123456789', WA_BUSINESS_NUMBER: '971500000000', WA_APP_SECRET: 'o-secret' } as Env)
  let k = 0
  const hit = (method: string, path: string, body?: unknown, token?: string, raw?: Uint8Array) => {
    const headers: Record<string, string> = { 'cf-connecting-ip': `10.6.${Math.floor(++k / 250)}.${k % 250}` }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (token) headers.authorization = `Bearer ${token}`
    return app.fetch(new Request('https://api.test' + path, { method, headers, body: raw ? (raw as BodyInit) : body === undefined ? undefined : JSON.stringify(body) }), oenv())
  }
  const deliver = async (from: string, code: string) => {
    const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from, type: 'text', text: { body: code } }] } }] }] })
    const kx = await crypto.subtle.importKey('raw', new TextEncoder().encode('o-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = 'sha256=' + Buffer.from(await crypto.subtle.sign('HMAC', kx, new TextEncoder().encode(raw))).toString('hex')
    const r = await app.fetch(new Request('https://api.test/webhooks/whatsapp', { method: 'POST', headers: { 'x-hub-signature-256': sig, 'content-type': 'application/json', 'cf-connecting-ip': '10.6.9.9' }, body: raw }), oenv())
    return r.status
  }
  let owner = '', agent = '', custToken = '', rid = ''
  it('sets up the team and a submitted request', async () => {
    const { hotp } = await import('../src/totp')
    await env.DB.prepare('DELETE FROM staff_sessions').run(); await env.DB.prepare('DELETE FROM staff_passkeys').run(); await env.DB.prepare('DELETE FROM staff').run()
    const s = await (await hit('POST', '/staff/v1/auth/setup/start', { phone: OWNER, setupKey: 'owner-setup-key-0123456789' })).json() as { secret: string }
    owner = ((await (await hit('POST', '/staff/v1/auth/setup/confirm', { phone: OWNER, code: await hotp(s.secret, Math.floor(Date.now() / 30000)) })).json()) as { accessToken: string }).accessToken
    const add = await (await hit('POST', '/staff/v1/team', { phone: '+971521170002', name: 'Agent', role: 'agent' }, owner)).json() as { enrollKey: string }
    const as = await (await hit('POST', '/staff/v1/auth/setup/start', { phone: '+971521170002', setupKey: add.enrollKey })).json() as { secret: string }
    agent = ((await (await hit('POST', '/staff/v1/auth/setup/confirm', { phone: '+971521170002', code: await hotp(as.secret, Math.floor(Date.now() / 30000)) })).json()) as { accessToken: string }).accessToken
    const ph = '+971521170010'
    const st = await (await hit('POST', '/v1/auth/wa/start', { phone: ph })).json() as { challengeId: string; pollToken: string; code: string }
    expect(await deliver('971521170010', st.code)).toBe(200)
    custToken = ((await (await hit('POST', '/v1/auth/wa/poll', { phone: ph, challengeId: st.challengeId, pollToken: st.pollToken })).json()) as { accessToken: string }).accessToken
    rid = ((await (await hit('POST', '/v1/requests', { serviceId: 'emirates-id', data: { name: 'Layla', title: { ar: 'تجديد', en: 'Renew' } } }, custToken)).json()) as { id: string }).id
    await hit('PATCH', `/v1/requests/${rid}`, { status: 'submitted' }, custToken)
  })
  it('lets only owner/manager override the status machine, with a mandatory reason', async () => {
    expect((await hit('POST', `/staff/v1/requests/${rid}/status`, { status: 'completed' }, owner)).status).toBe(409) // normal path blocks it
    expect((await hit('POST', `/staff/v1/requests/${rid}/override`, { status: 'completed', reason: 'x' }, agent)).status).toBe(403)
    expect((await hit('POST', `/staff/v1/requests/${rid}/override`, { status: 'completed' }, owner)).status).toBe(400) // no reason
    expect((await hit('POST', `/staff/v1/requests/${rid}/override`, { status: 'bogus', reason: 'testing' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/requests/${rid}/override`, { status: 'completed', reason: 'Finished offline at the counter' }, owner)).status).toBe(200)
    const d = await (await hit('GET', `/v1/requests/${rid}`, undefined, custToken)).json() as { request: { status: string; staff_data: string }; events: { text_en: string }[] }
    expect(d.request.status).toBe('completed'); expect(JSON.parse(d.request.staff_data).completedAt).toBeTruthy()
    expect(JSON.stringify(d.events)).not.toContain('OVERRIDE') // the customer never sees the override note
    const det = await (await hit('GET', `/staff/v1/requests/${rid}`, undefined, owner)).json() as { events: { text_en: string; visible: number }[] }
    expect(det.events.some((e) => e.text_en.startsWith('OVERRIDE') && e.visible === 0 && e.text_en.includes('Finished offline'))).toBe(true)
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='staff.override'").first<{ n: number }>())!.n).toBe(1)
  })
  it('can reopen a completed request, clearing its completion date', async () => {
    expect((await hit('POST', `/staff/v1/requests/${rid}/override`, { status: 'review', reason: 'Customer reported a mistake' }, owner)).status).toBe(200)
    const det = await (await hit('GET', `/staff/v1/requests/${rid}`, undefined, owner)).json() as { request: { status: string; staff: { completedAt?: string } } }
    expect(det.request.status).toBe('review'); expect(det.request.staff.completedAt).toBeUndefined()
    expect((await hit('POST', `/staff/v1/requests/${rid}/override`, { customerName: 'Layla Ahmed', expectedAt: '2026-12-15', reason: 'Name spelling' }, owner)).status).toBe(200)
    const det2 = await (await hit('GET', `/staff/v1/requests/${rid}`, undefined, owner)).json() as { customer: { name: string }; request: { staff: { expectedAt?: string } } }
    expect(det2.customer.name).toBe('Layla Ahmed'); expect(det2.request.staff.expectedAt).toBe('2026-12-15')
    expect((await hit('POST', `/staff/v1/requests/${rid}/override`, { reason: 'nothing' }, owner)).status).toBe(400)
  })
  it('gives a useful overview and scopes it for agents', async () => {
    const o = await (await hit('GET', '/staff/v1/overview', undefined, owner)).json() as { newToday: number; open: number; activity: { text_en: string; internal: boolean }[]; workload: unknown[]; attention: unknown[] }
    expect(o.newToday).toBeGreaterThanOrEqual(1); expect(o.open).toBeGreaterThanOrEqual(1)
    expect(o.activity.length).toBeGreaterThan(0); expect(o.activity.some((a) => a.internal)).toBe(true)
    expect(Array.isArray(o.workload)).toBe(true)
    await env.DB.prepare('UPDATE requests SET updated_at=? WHERE id=?').bind(Date.now() - 50 * 3600_000, rid).run()
    const o2 = await (await hit('GET', '/staff/v1/overview', undefined, owner)).json() as { attention: { id: string; waitingHours: number }[] }
    expect(o2.attention.find((a) => a.id === rid)!.waitingHours).toBeGreaterThanOrEqual(49)
    const ag = await (await hit('GET', '/staff/v1/overview', undefined, agent)).json() as { workload: unknown[] }
    expect(ag.workload).toEqual([]) // agents do not see team workload
  })
  it('lists customers for owner/manager only, with their requests', async () => {
    expect((await hit('GET', '/staff/v1/customers', undefined, agent)).status).toBe(403)
    const l = await (await hit('GET', '/staff/v1/customers?q=170010', undefined, owner)).json() as { customers: { id: string; phone: string; requests: number }[] }
    expect(l.customers).toHaveLength(1); expect(l.customers[0]!.phone).toBe('+971521170010'); expect(l.customers[0]!.requests).toBe(1)
    const d = await (await hit('GET', `/staff/v1/customers/${l.customers[0]!.id}`, undefined, owner)).json() as { requests: { id: string }[]; consents: unknown[] }
    expect(d.requests[0]!.id).toBe(rid)
    expect((await hit('GET', `/staff/v1/customers/${crypto.randomUUID()}`, undefined, owner)).status).toBe(404)
  })
})

describe('staff WhatsApp login code (authentication template)', () => {
  const OWNER = '+971521180001'
  const base = () => ({ ...env, OWNER_PHONE: OWNER, OWNER_SETUP_KEY: 'owner-setup-key-0123456789', WA_TOKEN: 't', WA_PHONE_NUMBER_ID: '123', WA_OTP_TEMPLATE: 'login_code' } as Env)
  let k = 0
  const hit = (method: string, path: string, body?: unknown, token?: string, e: Env = base()) => {
    const headers: Record<string, string> = { 'cf-connecting-ip': `10.7.${Math.floor(++k / 250)}.${k % 250}` }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (token) headers.authorization = `Bearer ${token}`
    return app.fetch(new Request('https://api.test' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), e)
  }
  const sent: { to: string; code: string; template: string; lang: string }[] = []
  let owner = ''
  beforeAll(async () => {
    const orig = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url.startsWith('https://graph.facebook.com/')) {
        const b = JSON.parse(String(init?.body))
        sent.push({ to: b.to, code: b.template.components[0].parameters[0].text, template: b.template.name, lang: b.template.language.code })
        return new Response('{}', { status: 200 })
      }
      return orig(input as RequestInfo, init)
    }) as typeof fetch
    const { hotp } = await import('../src/totp')
    await env.DB.prepare('DELETE FROM staff_sessions').run(); await env.DB.prepare('DELETE FROM staff_passkeys').run(); await env.DB.prepare('DELETE FROM staff').run()
    const s = await (await hit('POST', '/staff/v1/auth/setup/start', { phone: OWNER, setupKey: 'owner-setup-key-0123456789' })).json() as { secret: string }
    owner = ((await (await hit('POST', '/staff/v1/auth/setup/confirm', { phone: OWNER, code: await hotp(s.secret, Math.floor(Date.now() / 30000)) })).json()) as { accessToken: string }).accessToken
    await hit('POST', '/staff/v1/team', { phone: '+971521180002', name: 'Noura', role: 'agent' }, owner)
  })
  it('reports which methods are configured', async () => {
    const m = await (await hit('GET', '/staff/v1/auth/methods')).json() as { whatsappCode: boolean; passkey: boolean }
    expect(m.whatsappCode).toBe(true); expect(m.passkey).toBe(true)
    const none = await (await hit('GET', '/staff/v1/auth/methods', undefined, undefined, { ...env } as Env)).json() as { whatsappCode: boolean }
    expect(none.whatsappCode).toBe(false)
    expect((await hit('POST', '/staff/v1/auth/otp/request', { phone: '+971521180002' }, undefined, { ...env } as Env)).status).toBe(503)
  })
  it('sends the code to a member and signs them in once', async () => {
    const r = await (await hit('POST', '/staff/v1/auth/otp/request', { phone: '+971521180002', language: 'en' })).json() as { challengeId: string }
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ to: '971521180002', template: 'login_code', lang: 'en' }); expect(sent[0]!.code).toMatch(/^\d{6}$/)
    const wrong = sent[0]!.code === '000000' ? '111111' : '000000'
    expect((await hit('POST', '/staff/v1/auth/otp/verify', { phone: '+971521180002', challengeId: r.challengeId, code: wrong })).status).toBe(401)
    const ok = await hit('POST', '/staff/v1/auth/otp/verify', { phone: '+971521180002', challengeId: r.challengeId, code: sent[0]!.code })
    expect(ok.status).toBe(200); expect((await ok.json() as { role: string }).role).toBe('agent')
    expect((await hit('POST', '/staff/v1/auth/otp/verify', { phone: '+971521180002', challengeId: r.challengeId, code: sent[0]!.code })).status).toBe(401) // single use
  })
  it('does not reveal whether a number is on the team, and sends nothing to strangers', async () => {
    const before = sent.length
    const a = await hit('POST', '/staff/v1/auth/otp/request', { phone: '+971521189999' })
    const b = await hit('POST', '/staff/v1/auth/otp/request', { phone: '+971521180002' })
    expect(a.status).toBe(200); expect(b.status).toBe(200)
    expect(Object.keys(await a.json() as object).sort()).toEqual(Object.keys(await b.json() as object).sort())
    expect(sent.length).toBe(before + 1) // only the real member got a message
  })
  it('locks a challenge after 5 wrong guesses, even for the right code', async () => {
    await hit('POST', '/staff/v1/team', { phone: '+971521180003', name: 'Layla', role: 'agent' }, owner)
    const phone = '+971521180003'
    const r = await (await hit('POST', '/staff/v1/auth/otp/request', { phone })).json() as { challengeId: string }
    const code = sent[sent.length - 1]!.code
    const wrong = code === '123456' ? '654321' : '123456'
    for (let i = 0; i < 5; i++) expect((await hit('POST', '/staff/v1/auth/otp/verify', { phone, challengeId: r.challengeId, code: wrong })).status).toBe(401)
    expect((await hit('POST', '/staff/v1/auth/otp/verify', { phone, challengeId: r.challengeId, code })).status).toBe(401)
  })
  it('caps code requests per number', async () => {
    await hit('POST', '/staff/v1/team', { phone: '+971521180004', name: 'Huda', role: 'agent' }, owner)
    const codes: number[] = []
    for (let i = 0; i < 4; i++) codes.push((await hit('POST', '/staff/v1/auth/otp/request', { phone: '+971521180004' })).status)
    expect(codes).toEqual([200, 200, 200, 429])
  })
  it('a staff code cannot be replayed through the customer login', async () => {
    const row = await env.DB.prepare("SELECT id FROM otp_challenges WHERE purpose='staff' LIMIT 1").first<{ id: string }>()
    const r = await hit('POST', '/v1/auth/otp/verify', { phone: '+971521180002', challengeId: row!.id, code: '123456' })
    expect(r.status).toBe(401)
  })
})

describe('workflow spec: idempotency, versions, authority evidence, acknowledgements', () => {
  const OWNER = '+971521190001'
  const wenv = () => ({ ...env, OWNER_PHONE: OWNER, OWNER_SETUP_KEY: 'owner-setup-key-0123456789', WA_BUSINESS_NUMBER: '971500000000', WA_APP_SECRET: 'w-secret' } as Env)
  let k = 0
  const hit = (method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}, raw?: Uint8Array) => {
    const h: Record<string, string> = { 'cf-connecting-ip': `10.8.${Math.floor(++k / 250)}.${k % 250}`, ...headers }
    if (body !== undefined) h['content-type'] = 'application/json'
    if (token) h.authorization = `Bearer ${token}`
    return app.fetch(new Request('https://api.test' + path, { method, headers: h, body: raw ? (raw as BodyInit) : body === undefined ? undefined : JSON.stringify(body) }), wenv())
  }
  const login = async (phone: string) => {
    const st = await (await hit('POST', '/v1/auth/wa/start', { phone })).json() as { challengeId: string; pollToken: string; code: string }
    const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: phone.replace('+', ''), type: 'text', text: { body: st.code } }] } }] }] })
    const kx = await crypto.subtle.importKey('raw', new TextEncoder().encode('w-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = 'sha256=' + Buffer.from(await crypto.subtle.sign('HMAC', kx, new TextEncoder().encode(raw))).toString('hex')
    await app.fetch(new Request('https://api.test/webhooks/whatsapp', { method: 'POST', headers: { 'x-hub-signature-256': sig, 'content-type': 'application/json', 'cf-connecting-ip': '10.8.99.99' }, body: raw }), wenv())
    return ((await (await hit('POST', '/v1/auth/wa/poll', { phone, challengeId: st.challengeId, pollToken: st.pollToken })).json()) as { accessToken: string }).accessToken
  }
  let owner = '', cust = ''
  const submit = async (token = cust) => {
    const id = ((await (await hit('POST', '/v1/requests', { serviceId: 'emirates-id', data: { name: 'Z', title: { ar: 'ت', en: 'T' } } }, token)).json()) as { id: string }).id
    await hit('PATCH', `/v1/requests/${id}`, { status: 'submitted' }, token)
    return id
  }
  const detail = async (id: string) => (await (await hit('GET', `/staff/v1/requests/${id}`, undefined, owner)).json()) as { request: { version: number; deliveryVersion: number; acknowledgedVersion: number; staff: { authorityRef?: string } } }

  it('sets up', async () => {
    const { hotp } = await import('../src/totp')
    await env.DB.prepare('DELETE FROM staff_sessions').run(); await env.DB.prepare('DELETE FROM staff_passkeys').run(); await env.DB.prepare('DELETE FROM staff').run()
    const s = await (await hit('POST', '/staff/v1/auth/setup/start', { phone: OWNER, setupKey: 'owner-setup-key-0123456789' })).json() as { secret: string }
    owner = ((await (await hit('POST', '/staff/v1/auth/setup/confirm', { phone: OWNER, code: await hotp(s.secret, Math.floor(Date.now() / 30000)) })).json()) as { accessToken: string }).accessToken
    cust = await login('+971521190010')
  })
  it('creating a request twice with the same key gives one request; a different body with that key is refused', async () => {
    const key = 'idem-key-0001'
    const a = await hit('POST', '/v1/requests', { serviceId: 'emirates-id' }, cust, { 'idempotency-key': key })
    const b = await hit('POST', '/v1/requests', { serviceId: 'emirates-id' }, cust, { 'idempotency-key': key })
    expect(a.status).toBe(201); expect(b.status).toBe(200)
    const ja = await a.json() as { id: string }, jb = await b.json() as { id: string; replay: boolean }
    expect(jb.id).toBe(ja.id); expect(jb.replay).toBe(true)
    expect((await hit('POST', '/v1/requests', { serviceId: 'trade-licenses' }, cust, { 'idempotency-key': key })).status).toBe(422)
    const n = await env.DB.prepare("SELECT COUNT(*) n FROM requests WHERE client_key=?").bind(key).first<{ n: number }>()
    expect(n!.n).toBe(1)
    const other = await login('+971521190011') // another customer may use the same key independently
    expect((await hit('POST', '/v1/requests', { serviceId: 'emirates-id' }, other, { 'idempotency-key': key })).status).toBe(201)
    const body = await hit('POST', '/v1/requests', { serviceId: 'emirates-id', clientKey: 'body-key-0002' }, cust)
    const body2 = await hit('POST', '/v1/requests', { serviceId: 'emirates-id', clientKey: 'body-key-0002' }, cust)
    expect((await body.json() as { id: string }).id).toBe((await body2.json() as { id: string }).id)
  })
  it('does not create a second active renewal of the same request', async () => {
    const src = await submit()
    const r1 = await (await hit('POST', '/v1/requests', { serviceId: 'emirates-id', renewalOf: src }, cust)).json() as { id: string }
    const r2 = await hit('POST', '/v1/requests', { serviceId: 'emirates-id', renewalOf: src }, cust)
    expect(r2.status).toBe(200); const j2 = await r2.json() as { id: string; existing: boolean }
    expect(j2.id).toBe(r1.id); expect(j2.existing).toBe(true)
  })
  it('rejects a stale expectedVersion instead of overwriting, and customers bump the version too', async () => {
    const id = await submit()
    const v0 = (await detail(id)).request.version
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'review', expectedVersion: v0 }, owner)).status).toBe(200)
    const stale = await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'needs_documents', expectedVersion: v0 }, owner)
    expect(stale.status).toBe(409); expect((await stale.json() as { error: string }).error).toBe('version_conflict')
    expect((await hit('POST', `/staff/v1/requests/${id}/assign`, { staffId: null, expectedVersion: v0 }, owner)).status).toBe(409)
    expect((await hit('POST', `/staff/v1/requests/${id}/override`, { status: 'completed', reason: 'because', expectedVersion: v0 }, owner)).status).toBe(409)
    const v1 = (await detail(id)).request.version
    expect(v1).toBeGreaterThan(v0)
    // a customer action (cancel) while staff holds v1 makes v1 stale
    await hit('PATCH', `/v1/requests/${id}`, { status: 'cancelled' }, cust)
    expect((await hit('POST', `/staff/v1/requests/${id}/notes`, { text: 'still allowed' }, owner)).status).toBe(200) // internal notes never conflict
  })
  it('will not move to "with authority" without a submission reference, nor reject without a reason', async () => {
    const id = await submit()
    await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'review' }, owner)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'authority' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'authority', reference: 'x' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'authority', reference: 'AUTH-2026-00123' }, owner)).status).toBe(200)
    expect((await detail(id)).request.staff.authorityRef).toBe('AUTH-2026-00123')
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'rejected' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'decision' }, owner)).status).toBe(200)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'rejected', reason: 'Expired passport' }, owner)).status).toBe(200)
    const d = await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json() as { request: { status: string; staff_data: string } }
    expect(d.request.status).toBe('rejected'); expect(JSON.parse(d.request.staff_data).issue).toBe('Expired passport')
  })
  it('records receipt acknowledgement once per delivery version; viewing never acknowledges', async () => {
    const id = await submit()
    const ack = (v: number) => hit('POST', `/v1/requests/${id}/acknowledgments`, { deliveryVersion: v }, cust)
    expect((await ack(1)).status).toBe(409) // not completed
    for (const s of ['review']) await hit('POST', `/staff/v1/requests/${id}/status`, { status: s }, owner)
    await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'authority', reference: 'REF-123' }, owner)
    await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'decision' }, owner)
    await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'completed' }, owner)
    expect((await ack(1)).status).toBe(409) // completed but nothing delivered
    const up = await hit('PUT', `/staff/v1/requests/${id}/files?kind=final`, undefined, owner, { 'x-file-name': 'a.pdf' }, pdf())
    expect(up.status).toBe(201)
    const f = await up.json() as { id: string }
    await hit('GET', `/v1/files/${f.id}`, undefined, cust) // customer downloads
    expect((await detail(id)).request.acknowledgedVersion).toBe(0) // ...which is not an acknowledgement
    expect((await ack(2)).status).toBe(409) // wrong/stale version
    const a1 = await ack(1); const j1 = await a1.json() as { duplicate: boolean; acknowledgedAt: number }
    expect(a1.status).toBe(200); expect(j1.duplicate).toBe(false)
    const a2 = await ack(1); const j2 = await a2.json() as { duplicate: boolean; acknowledgedAt: number }
    expect(j2.duplicate).toBe(true); expect(j2.acknowledgedAt).toBe(j1.acknowledgedAt)
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM receipt_acks WHERE request_id=?').bind(id).first<{ n: number }>())!.n).toBe(1)
    // a replacement delivery needs its own confirmation; the old one is not carried over
    await hit('PUT', `/staff/v1/requests/${id}/files?kind=final`, undefined, owner, { 'x-file-name': 'b.pdf' }, pdf())
    let det = await detail(id); expect(det.request.deliveryVersion).toBe(2); expect(det.request.acknowledgedVersion).toBe(1)
    expect((await ack(1)).status).toBe(409)
    expect((await ack(2)).status).toBe(200)
    det = await detail(id); expect(det.request.acknowledgedVersion).toBe(2)
    const cd = await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json() as { request: { delivery_version: number; acknowledged_version: number } }
    expect(cd.request.delivery_version).toBe(2); expect(cd.request.acknowledged_version).toBe(2)
    // another customer cannot acknowledge it
    const other = await login('+971521190012')
    expect((await hit('POST', `/v1/requests/${id}/acknowledgments`, { deliveryVersion: 2 }, other)).status).toBe(404)
  })
})
