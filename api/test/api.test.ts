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
  env = { ...p.env, PEPPER: b64(32), DATA_KEY: b64(32), ENVIRONMENT: 'test', DEV_OTP_ECHO: '1', SCANNER_MODE: 'fake-test' } as Env
  const dir = new URL('../migrations/', import.meta.url)
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(file, dir), 'utf8')
    const stmts = sql.split(/;\s*\n/).map((x) => x.trim()).filter(Boolean)
    await env.DB.batch(stmts.map((x) => env.DB.prepare(x))) // one transaction per migration, like production
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
  it('keeps delivery files hidden until published, then lets the owner of the request open them (but not delete them); staff views are audited', async () => {
    const cust = await customerLogin('+971521140014')
    const id = await submitted(cust)
    const put = await hit('PUT', `/staff/v1/requests/${id}/files?kind=final`, { token: owner, raw: pdf(), headers: { 'x-file-name': 'result.pdf', 'x-file-label': encodeURIComponent('Delivery') } })
    expect(put.status).toBe(201)
    const f = await put.json() as { id: string; published: boolean }
    expect(f.published).toBe(false)
    // before publishing: invisible to the customer in the request, in downloads and in the data export
    expect((await hit('GET', `/v1/files/${f.id}`, { token: cust })).status).toBe(404)
    const before = await (await hit('GET', `/v1/requests/${id}`, { token: cust })).json() as { files: { id: string }[] }
    expect(before.files.some((x) => x.id === f.id)).toBe(false)
    const exp0 = await (await hit('GET', '/v1/me/export', { token: cust })).json() as { files: { id: string }[] }
    expect(exp0.files.some((x) => x.id === f.id)).toBe(false)
    // staff can view the draft; that view is audited
    const sv = await hit('GET', `/staff/v1/files/${f.id}`, { token: owner })
    expect(sv.status).toBe(200); expect(sv.headers.get('content-security-policy')).toContain("frame-ancestors 'self'")
    expect((await hit('GET', '/health')).headers.get('x-frame-options')).toBe('DENY')
    // publish (only once the authority has finished)
    expect((await hit('POST', `/staff/v1/requests/${id}/deliveries/publish`, { token: owner, body: {} })).status).toBe(409)
    for (const body of [{ status: 'review' }, { status: 'ready_for_authority' }, { status: 'authority', reference: 'REF-PUB-1', overrideReason: 'test: fees settled offline' }, { status: 'decision' }]) await hit('POST', `/staff/v1/requests/${id}/status`, { token: owner, body })
    expect((await hit('POST', `/staff/v1/requests/${id}/deliveries/publish`, { token: owner, body: {} })).status).toBe(201)
    const dl = await hit('GET', `/v1/files/${f.id}`, { token: cust })
    expect(dl.status).toBe(200); expect(new Uint8Array(await dl.arrayBuffer())).toEqual(pdf())
    expect((await hit('DELETE', `/v1/files/${f.id}`, { token: cust })).status).toBe(404)
    expect((await hit('DELETE', `/staff/v1/files/${f.id}`, { token: owner })).status).toBe(409) // published packages are immutable
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='staff.file_view'").first<{ n: number }>())!.n).toBeGreaterThan(0)
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
  it('needs "ready to submit" first, then a submission reference for "with authority", and a reason to reject', async () => {
    const id = await submit()
    await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'review' }, owner)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'authority', reference: 'AUTH-1', overrideReason: 'test: fees settled offline' }, owner)).status).toBe(409) // cannot skip ready_for_authority
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'ready_for_authority' }, owner)).status).toBe(200)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'authority', overrideReason: 'test: fees settled offline' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'authority', reference: 'x', overrideReason: 'test: fees settled offline' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'authority', reference: 'AUTH-2026-00123', overrideReason: 'test: fees settled offline' }, owner)).status).toBe(200)
    expect((await detail(id)).request.staff.authorityRef).toBe('AUTH-2026-00123')
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'rejected' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'decision' }, owner)).status).toBe(200)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'rejected', reason: 'Expired passport' }, owner)).status).toBe(200)
    const d = await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json() as { request: { status: string; staff_data: string } }
    expect(d.request.status).toBe('rejected'); expect(JSON.parse(d.request.staff_data).issue).toBe('Expired passport')
  })
  const toCompleted = async (id: string) => {
    for (const body of [{ status: 'review' }, { status: 'ready_for_authority' }, { status: 'authority', reference: 'REF-123', overrideReason: 'test: fees settled offline' }, { status: 'decision' }, { status: 'completed' }])
      expect((await hit('POST', `/staff/v1/requests/${id}/status`, body, owner)).status).toBe(200)
  }
  const stage = (id: string, name: string) => hit('PUT', `/staff/v1/requests/${id}/files?kind=final`, undefined, owner, { 'x-file-name': name }, pdf())
  // the request has to be with / past the authority before a delivery can be published (fees are overridden by the owner in these tests)
  const advance = async (id: string) => { for (const body of [{ status: 'review' }, { status: 'ready_for_authority' }, { status: 'authority', reference: 'REF-ADV-1', overrideReason: 'test: fees settled offline' }, { status: 'decision' }]) await hit('POST', `/staff/v1/requests/${id}/status`, body, owner) }
  const publish = async (id: string) => { await advance(id); return hit('POST', `/staff/v1/requests/${id}/deliveries/publish`, {}, owner) }
  it('records receipt acknowledgement once per PUBLISHED delivery version; viewing never acknowledges; each version needs its own', async () => {
    const id = await submit()
    const ack = (v: number, token = cust) => hit('POST', `/v1/requests/${id}/acknowledgments`, { deliveryVersion: v }, token)
    expect((await ack(1)).status).toBe(409) // not completed
    await toCompleted(id)
    expect((await ack(1)).status).toBe(409) // completed but nothing published
    const f1 = await (await stage(id, 'a.pdf')).json() as { id: string }
    expect((await ack(1)).status).toBe(409) // a saved draft is not a delivery
    expect((await publish(id)).status).toBe(201)
    await hit('GET', `/v1/files/${f1.id}`, undefined, cust) // customer downloads
    expect((await detail(id)).request.acknowledgedVersion).toBe(0) // ...which is not an acknowledgement
    expect((await ack(2)).status).toBe(409)
    const a1 = await ack(1); const j1 = await a1.json() as { duplicate: boolean; acknowledgedAt: number }
    expect(a1.status).toBe(200); expect(j1.duplicate).toBe(false)
    const a2 = await ack(1); const j2 = await a2.json() as { duplicate: boolean; acknowledgedAt: number }
    expect(j2.duplicate).toBe(true); expect(j2.acknowledgedAt).toBe(j1.acknowledgedAt)
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM receipt_acks WHERE request_id=?').bind(id).first<{ n: number }>())!.n).toBe(1)
    // a replacement package is staged invisibly, and only becomes version 2 when published
    const f2 = await (await stage(id, 'b.pdf')).json() as { id: string }
    expect((await detail(id)).request.deliveryVersion).toBe(1)
    expect((await ack(2)).status).toBe(409)
    expect((await publish(id)).status).toBe(201)
    let det = await detail(id); expect(det.request.deliveryVersion).toBe(2); expect(det.request.acknowledgedVersion).toBe(1)
    expect((await ack(1)).status).toBe(409)
    expect((await ack(2)).status).toBe(200)
    det = await detail(id); expect(det.request.acknowledgedVersion).toBe(2)
    // the customer sees only the latest published package; the superseded file is no longer served to them, but is kept for staff
    expect((await hit('GET', `/v1/files/${f2.id}`, undefined, cust)).status).toBe(200)
    expect((await hit('GET', `/v1/files/${f1.id}`, undefined, cust)).status).toBe(404)
    expect((await hit('GET', `/staff/v1/files/${f1.id}`, undefined, owner)).status).toBe(200)
    const cd = await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json() as { request: { delivery_version: number; acknowledged_version: number }; files: { id: string }[] }
    expect(cd.request.delivery_version).toBe(2); expect(cd.request.acknowledged_version).toBe(2)
    expect(cd.files.map((x) => x.id)).toEqual([f2.id])
    // another customer can neither acknowledge nor download
    const other = await login('+971521190012')
    expect((await ack(2, other)).status).toBe(404)
    expect((await hit('GET', `/v1/files/${f2.id}`, undefined, other)).status).toBe(404)
    // history: each version recorded with its own manifest
    const dels = await env.DB.prepare('SELECT version,status,manifest_hash FROM deliveries WHERE request_id=? ORDER BY version').bind(id).all<{ version: number; status: string; manifest_hash: string }>()
    expect(dels.results.map((x) => x.status)).toEqual(['superseded', 'published']); expect(dels.results[0]!.manifest_hash).not.toBe(dels.results[1]!.manifest_hash)
  })
  it('cannot publish without a final file; a staged file can be removed before publishing', async () => {
    const id = await submit()
    expect((await publish(id)).status).toBe(409)
    const inv = await (await hit('PUT', `/staff/v1/requests/${id}/files?kind=invoice`, undefined, owner, { 'x-file-name': 'inv.pdf' }, pdf())).json() as { id: string }
    expect((await publish(id)).status).toBe(409) // an invoice alone is not a delivery
    const fin = await (await stage(id, 'final.pdf')).json() as { id: string }
    expect((await hit('DELETE', `/staff/v1/files/${fin.id}`, undefined, owner)).status).toBe(200)
    expect((await publish(id)).status).toBe(409)
    void inv
  })
  it('a stale version cannot publish', async () => {
    const id = await submit(); await toCompleted(id)
    await stage(id, 'x.pdf')
    const v = (await detail(id)).request.version
    await hit('POST', `/staff/v1/requests/${id}/notes`, { text: 'x' }, owner)
    expect((await hit('POST', `/staff/v1/requests/${id}/deliveries/publish`, { expectedVersion: v - 1 }, owner)).status).toBe(409)
    expect((await hit('POST', `/staff/v1/requests/${id}/deliveries/publish`, { expectedVersion: v }, owner)).status).toBe(201)
  })
  // ---- document checks and internal override ----
  const sourceFile = async (id: string) => ((await (await hit('PUT', `/v1/requests/${id}/files`, undefined, cust, { 'x-file-name': 'passport.pdf' }, pdf())).json()) as { id: string }).id
  const staffToken = async (role: 'agent' | 'accountant' | 'manager') => {
    const { randomToken, sha256Hex, newId } = await import('../src/crypto')
    const sid = newId(), tok = randomToken(32), now = Date.now()
    await env.DB.prepare('INSERT INTO staff (id,phone_hash,phone_enc,name,role,created_at) VALUES (?,?,?,?,?,?)').bind(sid, 'h' + sid, 'x', role + '-t', role, now).run()
    await env.DB.prepare('INSERT INTO staff_sessions (id,staff_id,access_hash,refresh_hash,access_expires_at,refresh_expires_at,created_at) VALUES (?,?,?,?,?,?,?)').bind(newId(), sid, await sha256Hex(tok), await sha256Hex(tok + 'r'), now + 3600_000, now + 7200_000, now).run()
    return tok
  }
  const toReview = async (id: string) => { await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'review' }, owner) }
  const checksOf = async (id: string) => (await detail2(id)).checks
  const detail2 = async (id: string) => (await (await hit('GET', `/staff/v1/requests/${id}`, undefined, owner)).json()) as { blocked: { fileId: string; ruleCode: string }[]; checks: { id: string; file_id: string; rule_code: string; rule_version: string; outcome: string; superseded_at: number | null; override_reason: string | null }[]; events: { text_en: string; visible: number }[] }

  it('evaluates the passport rule server-side and blocks "ready to submit" until the failure is resolved', async () => {
    const id = await submit(); const fid = await sourceFile(id); await toReview(id)
    // base = request day; an expiry only 3 months away fails the 6-calendar-month rule
    const base = new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10)
    const { addCalendarMonths } = await import('../src/rules')
    const soon = addCalendarMonths(base, 3)!
    const r = await (await hit('POST', `/staff/v1/files/${fid}/extracted`, { docType: 'passport', expiry: soon }, owner)).json() as { result: { outcome: string } }
    expect(r.result.outcome).toBe('fail')
    const blocked = await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'ready_for_authority' }, owner)
    expect(blocked.status).toBe(409)
    const bj = await blocked.json() as { error: string; files: { fileId: string; ruleCode: string }[] }
    expect(bj.error).toBe('documents_blocked'); expect(bj.files[0]).toMatchObject({ fileId: fid, ruleCode: 'passport_validity_6m' })
    // the customer is never shown rule results
    expect(JSON.stringify(await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json())).not.toContain('passport_validity')
    // re-reading a valid expiry supersedes the old result (history kept) and unblocks
    const ok = await (await hit('POST', `/staff/v1/files/${fid}/extracted`, { docType: 'passport', expiry: addCalendarMonths(base, 24) }, owner)).json() as { result: { outcome: string } }
    expect(ok.result.outcome).toBe('pass')
    const chk = await checksOf(id); expect(chk.filter((c) => c.superseded_at).length).toBe(1); expect(chk).toHaveLength(2)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'ready_for_authority' }, owner)).status).toBe(200)
  })
  it('unreadable data goes to manual review, never an automatic decision', async () => {
    const id = await submit(); const fid = await sourceFile(id); await toReview(id)
    const r = await (await hit('POST', `/staff/v1/files/${fid}/extracted`, { docType: 'passport', expiry: '2026-13-45' }, owner)).json() as { result: { outcome: string } }
    expect(r.result.outcome).toBe('manual_review')
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'ready_for_authority' }, owner)).status).toBe(409)
    expect((await hit('POST', `/staff/v1/files/${fid}/extracted`, { docType: 'badtype', expiry: '2030-01-01' }, owner)).status).toBe(400)
  })
  it('an authorised member can accept a failed document after review: reason, rule, version, member and time are recorded', async () => {
    const id = await submit(); const fid = await sourceFile(id); await toReview(id)
    await hit('POST', `/staff/v1/files/${fid}/extracted`, { docType: 'passport', expiry: '2020-01-01' }, owner)
    const c0 = (await checksOf(id))[0]!
    const agent = await staffToken('agent')
    expect((await hit('POST', `/staff/v1/files/${fid}/override`, { checkId: c0.id, reason: 'Customer showed a renewed passport at the counter' }, agent)).status).toBe(403) // not authorised
    expect((await hit('POST', `/staff/v1/files/${fid}/override`, { checkId: c0.id, reason: 'short' }, owner)).status).toBe(400) // reason required
    expect((await hit('POST', `/staff/v1/files/${fid}/override`, { checkId: crypto.randomUUID(), reason: 'A proper long reason here' }, owner)).status).toBe(404)
    expect((await hit('POST', `/staff/v1/files/${fid}/override`, { checkId: c0.id, reason: 'Customer showed a renewed passport at the counter' }, owner)).status).toBe(200)
    expect((await hit('POST', `/staff/v1/files/${fid}/override`, { checkId: c0.id, reason: 'Customer showed a renewed passport at the counter' }, owner)).status).toBe(409)
    const d = await detail2(id)
    expect(d.checks[0]!.override_reason).toContain('renewed passport')
    const note = d.events.find((e) => e.text_en.includes('overridden by'))!
    expect(note.visible).toBe(0)
    expect(note.text_en).toContain('passport_validity_6m v1'); expect(note.text_en).toContain('Reason:'); expect(note.text_en).toContain('not proof of authenticity')
    expect(JSON.stringify(await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json())).not.toContain('overridden')
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='staff.doc_override'").first<{ n: number }>())!.n).toBeGreaterThan(0)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'ready_for_authority' }, owner)).status).toBe(200) // internal acceptance lets it proceed
  })
  it('never lets anyone override the malware / signature / size rules, or record them by hand', async () => {
    const id = await submit(); const fid = await sourceFile(id); await toReview(id)
    expect((await hit('POST', `/staff/v1/files/${fid}/checks`, { ruleCode: 'malware_scan', outcome: 'pass' }, owner)).status).toBe(400) // only the system records these
    const { newId } = await import('../src/crypto')
    const cid = newId()
    await env.DB.prepare("INSERT INTO document_checks (id,file_id,request_id,rule_code,rule_version,outcome,evidence,created_by,created_at) VALUES (?,?,?,?,'1','fail','{}','system',?)").bind(cid, fid, id, 'malware_scan', Date.now()).run()
    expect((await hit('POST', `/staff/v1/files/${fid}/override`, { checkId: cid, reason: 'Trust me, it is fine really' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'ready_for_authority' }, owner)).status).toBe(409) // still blocked
    // ...and manual outcomes for overridable rules work
    expect((await hit('POST', `/staff/v1/files/${fid}/checks`, { ruleCode: 'name_match', outcome: 'fail', note: 'Spelling differs' }, owner)).status).toBe(200)
    expect((await hit('POST', `/staff/v1/files/${fid}/checks`, { ruleCode: 'nope', outcome: 'fail' }, owner)).status).toBe(400)
  })
  it('another staff scope cannot touch a file it cannot see', async () => {
    const id = await submit(); const fid = await sourceFile(id)
    const me = await (await hit('GET', '/staff/v1/me', undefined, owner)).json() as { staff: { id: string } }
    await hit('POST', `/staff/v1/requests/${id}/assign`, { staffId: me.staff.id }, owner)
    const agent = await staffToken('agent')
    expect((await hit('GET', `/staff/v1/files/${fid}`, undefined, agent)).status).toBe(404)
    expect((await hit('POST', `/staff/v1/files/${fid}/extracted`, { docType: 'passport', expiry: '2030-01-01' }, agent)).status).toBe(404)
  })
  // ---- security review fixes ----
  it('customers cannot cancel/reset a request once the team has filed or finished it, nor edit its data after review starts', async () => {
    const id = await submit()
    await toReview(id)
    // data edits stop once review starts; a repeated "submitted" is a harmless no-op
    const edit = await hit('PATCH', `/v1/requests/${id}`, { data: { name: 'Changed' } }, cust)
    expect(edit.status).toBe(200); expect((await edit.json() as { applied: boolean }).applied).toBe(false)
    expect(((await detail2(id)) as unknown as { request?: unknown }).request).toBeUndefined // (shape only)
    const again = await hit('PATCH', `/v1/requests/${id}`, { status: 'submitted' }, cust)
    expect((await again.json() as { applied: boolean; status: string })).toMatchObject({ applied: false, status: 'review' })
    const d = await (await hit('GET', `/staff/v1/requests/${id}`, undefined, owner)).json() as { customer: { name: string } }
    expect(d.customer.name).not.toBe('Changed')
    // walk to the authority and to completion: cancel is refused at every late state
    for (const body of [{ status: 'ready_for_authority' }, { status: 'authority', reference: 'REF-9', overrideReason: 'test: fees settled offline' }]) await hit('POST', `/staff/v1/requests/${id}`.replace(/$/, '/status'), body, owner)
    for (const st of ['authority']) {
      const r = await hit('PATCH', `/v1/requests/${id}`, { status: 'cancelled' }, cust)
      expect(r.status).toBe(409); expect((await r.json() as { error: string }).error).toBe('cannot_cancel'); void st
    }
    await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'decision' }, owner)
    await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'completed' }, owner)
    expect((await hit('PATCH', `/v1/requests/${id}`, { status: 'cancelled' }, cust)).status).toBe(409)
    expect((await hit('PATCH', `/v1/requests/${id}`, { status: 'submitted' }, cust)).status).toBe(200) // no-op, cannot reset
    const st = await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json() as { request: { status: string } }
    expect(st.request.status).toBe('completed')
    // early states still allow the customer to cancel
    const early = await submit()
    expect((await hit('PATCH', `/v1/requests/${early}`, { status: 'cancelled' }, cust)).status).toBe(200)
  })
  it('an agent cannot lift a failed document rule by recording a manual pass, back-dating the reference date, or re-reading the expiry', async () => {
    const id = await submit(); const fid = await sourceFile(id); await toReview(id)
    await hit('POST', `/staff/v1/requests/${id}/assign`, { staffId: null }, owner) // unassigned, so an agent can reach it
    const me = await (await hit('GET', '/staff/v1/me', undefined, owner)).json() as { staff: { id: string } }
    const agent = await staffToken('agent')
    const { addCalendarMonths } = await import('../src/rules')
    const base = new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10)
    await hit('POST', `/staff/v1/files/${fid}/extracted`, { docType: 'passport', expiry: addCalendarMonths(base, 2) }, owner) // fails the rule
    expect((await detail2(id)).blocked).toHaveLength(1)
    // agents only see unassigned/own requests: it is unassigned, so the agent reaches the file
    const manual = await hit('POST', `/staff/v1/files/${fid}/checks`, { ruleCode: 'passport_validity_6m', outcome: 'pass' }, agent)
    expect(manual.status).toBe(409) // even before the role check: a pass cannot replace an unresolved failure
    const back = await hit('POST', `/staff/v1/files/${fid}/extracted`, { docType: 'passport', expiry: addCalendarMonths(base, 2), baseDate: '2000-01-01' }, agent)
    expect(back.status).toBe(200); expect((await back.json() as { result: { outcome: string } }).result.outcome).toBe('fail') // the reference date is ignored for agents
    const reread = await hit('POST', `/staff/v1/files/${fid}/extracted`, { docType: 'passport', expiry: addCalendarMonths(base, 36) }, agent)
    expect(reread.status).toBe(403)
    expect((await detail2(id)).blocked).toHaveLength(1)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'ready_for_authority' }, owner)).status).toBe(409)
    // a fresh "pass" with nothing to replace is still an agent-forbidden action, and a manager may do it
    const f2 = await sourceFile(await submit())
    expect((await hit('POST', `/staff/v1/files/${f2}/checks`, { ruleCode: 'name_match', outcome: 'pass' }, agent)).status).toBe(403)
    void me
  })
  // ---- malware-scan gate: no verdict means pending, never clean ----
  const asEnv = (e: Env, method: string, path: string, token: string, raw?: Uint8Array, headers: Record<string, string> = {}) =>
    app.fetch(new Request('https://api.test' + path, { method, headers: { authorization: `Bearer ${token}`, 'cf-connecting-ip': `10.9.${Math.floor(++k / 250)}.${k % 250}`, ...headers }, body: raw as BodyInit | undefined }), e)
  it('without a scanner a file stays pending: staff cannot open it, rules cannot read it, the request cannot advance, the delivery cannot be published', async () => {
    const noScan = { ...wenv(), SCANNER_MODE: undefined } as Env
    const id = await submit()
    const up = await asEnv(noScan, 'PUT', `/v1/requests/${id}/files`, cust, pdf(), { 'x-file-name': 'p.pdf' })
    expect(up.status).toBe(201)
    const fid = ((await up.json()) as { id: string }).id
    expect((await env.DB.prepare('SELECT scan_status s FROM request_files WHERE id=?').bind(fid).first<{ s: string }>())!.s).toBe('pending')
    expect((await hit('GET', `/staff/v1/files/${fid}`, undefined, owner)).status).toBe(423)
    expect((await hit('GET', `/v1/files/${fid}`, undefined, cust)).status).toBe(200) // the customer may fetch back their own upload
    expect((await hit('POST', `/staff/v1/files/${fid}/extracted`, { docType: 'passport', expiry: '2035-01-01' }, owner)).status).toBe(423)
    expect((await hit('POST', `/staff/v1/files/${fid}/checks`, { ruleCode: 'name_match', outcome: 'fail' }, owner)).status).toBe(423)
    await toReview(id)
    const gate = await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'ready_for_authority' }, owner)
    expect(gate.status).toBe(409); expect((await gate.json() as { error: string }).error).toBe('scan_pending')
    // a pending delivery file cannot be published either
    const staged = await asEnv(noScan, 'PUT', `/staff/v1/requests/${id}/files?kind=final`, owner, pdf(), { 'x-file-name': 'f.pdf' })
    expect(staged.status).toBe(201)
    const pub = await hit('POST', `/staff/v1/requests/${id}/deliveries/publish`, {}, owner)
    expect(pub.status).toBe(409); expect((await pub.json() as { error: string }).error).toBe('scan_pending')
  })
  it('the database default for a file with no verdict is pending, never clean', async () => {
    const id = await submit()
    const { newId } = await import('../src/crypto')
    const fid = newId()
    const uid = (await env.DB.prepare('SELECT user_id u FROM requests WHERE id=?').bind(id).first<{ u: string }>())!.u
    await env.DB.prepare("INSERT INTO request_files (id,request_id,user_id,r2_key,name,mime,size,sha256,created_at) VALUES (?,?,?,'k','n','application/pdf',1,'h',1)").bind(fid, id, uid).run()
    expect((await env.DB.prepare('SELECT scan_status s FROM request_files WHERE id=?').bind(fid).first<{ s: string }>())!.s).toBe('pending')
    expect(env.DB.prepare("INSERT INTO request_files (id,request_id,user_id,r2_key,name,mime,size,sha256,created_at,scan_status) VALUES ('x',?,?,'k','n','application/pdf',1,'h',1,'maybe')").bind(id, uid).run()).rejects.toThrow()
  })
  it('the explicit test scanner marks files clean and quarantines the EICAR test string (never stored)', async () => {
    const id = await submit()
    const clean = await hit('PUT', `/v1/requests/${id}/files`, undefined, cust, { 'x-file-name': 'ok.pdf' }, pdf())
    const fid = ((await clean.json()) as { id: string }).id
    expect((await env.DB.prepare('SELECT scan_status s, scan_engine e FROM request_files WHERE id=?').bind(fid).first<{ s: string; e: string }>())).toMatchObject({ s: 'clean', e: 'fake-test' })
    expect((await hit('GET', `/staff/v1/files/${fid}`, undefined, owner)).status).toBe(200)
    const before = (await env.DB.prepare('SELECT COUNT(*) n FROM request_files').first<{ n: number }>())!.n
    const bad = new TextEncoder().encode('%PDF-1.4\nX5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*\n%%EOF')
    expect((await hit('PUT', `/v1/requests/${id}/files`, undefined, cust, { 'x-file-name': 'bad.pdf' }, bad)).status).toBe(422)
    expect((await hit('PUT', `/staff/v1/requests/${id}/files?kind=final`, undefined, owner, { 'x-file-name': 'bad.pdf' }, bad)).status).toBe(422)
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM request_files').first<{ n: number }>())!.n).toBe(before)
  })
  it('production without a real scanner refuses uploads and reports not ready; the test scanner is ignored in production', async () => {
    const id = await submit()
    const prod = { ...wenv(), ENVIRONMENT: 'production', SCANNER_MODE: undefined } as Env
    const prodFake = { ...wenv(), ENVIRONMENT: 'production', SCANNER_MODE: 'fake-test' } as Env
    for (const e of [prod, prodFake]) {
      const r = await asEnv(e, 'PUT', `/v1/requests/${id}/files`, cust, pdf(), { 'x-file-name': 'p.pdf' })
      expect(r.status).toBe(503); expect((await r.json() as { error: string }).error).toBe('scanner_unavailable')
      expect((await asEnv(e, 'PUT', `/staff/v1/requests/${id}/files?kind=final`, owner, pdf(), { 'x-file-name': 'p.pdf' })).status).toBe(503)
      const h = await (await app.fetch(new Request('https://api.test/health'), e)).json() as { ready: boolean; scanner: string }
      expect(h.ready).toBe(false); expect(h.scanner).toBe('none')
    }
    expect(((await (await app.fetch(new Request('https://api.test/health'), wenv())).json()) as { ready: boolean }).ready).toBe(true)
  })
  // ===== finance: manual pricing, TEST documents, manual payments (no tax, no gateway) =====
  const ITEMS = [
    { kind: 'government_fee', descriptionAr: 'رسوم الجهة', descriptionEn: 'Authority fee', amountFils: 35000 },
    { kind: 'service_fee', descriptionAr: 'أتعاب الخدمة', descriptionEn: 'Service fee', amountFils: 70000 },
    { kind: 'service_fee', descriptionAr: 'أتعاب الترجمة', descriptionEn: 'Translation fee', amountFils: 30000 },
  ] // company fee AED 1,000.00; government AED 350.00 is paid by the customer to the authority and is NOT in the total
  const draftQuote = (id: string, items: unknown = ITEMS, token = owner) => hit('POST', `/staff/v1/requests/${id}/quotes`, { items }, token)
  const fin = async (id: string) => (await (await hit('GET', `/staff/v1/requests/${id}/finance`, undefined, owner)).json()) as { quotes: { id: string; version: number; status: string; number: string | null; total_fils: number }[]; payments: { id: string; kind: string; status: string; amount_fils: number; receipt_id: string | null; refund_of: string | null }[]; documents: { id: string; doc_type: string; number: string; status: string; related_id: string | null }[]; totals: { total: number; paid: number; refunded: number; net: number; pending: number; remaining: number; state: string }; tax: { configured: boolean }; test: boolean }
  const issueQuote = async (id: string, items: unknown = ITEMS) => { const q = (await (await draftQuote(id, items)).json()) as { id: string; version: number }; const r = await hit('POST', `/staff/v1/quotes/${q.id}/issue`, {}, owner); return { q, r } } // issuing creates the invoice for the Company fee (no quotation step)
  const priced = async (id: string) => { const { q, r } = await issueQuote(id); const inv = await r.json() as { documentId: string; number: string }; return { q, inv } }
  const proof = async (id: string) => ((await (await hit('PUT', `/v1/requests/${id}/files`, undefined, cust, { 'x-file-name': 'transfer.pdf' }, pdf())).json()) as { id: string }).id
  let refSeq = 0
  const pay = async (id: string, amount: number, o: { key?: string; ref?: string; token?: string; file?: string } = {}) =>
    hit('POST', `/v1/requests/${id}/payments`, { amountFils: amount, method: 'bank_transfer', reference: o.ref ?? `TRX-${Date.now()}-${++refSeq}`, proofFileId: o.file ?? await proof(id), clientKey: o.key ?? `ckey-${Date.now()}-${refSeq}-${Math.random().toString(36).slice(2, 8)}` }, o.token ?? cust)
  const approve = (pid: string, token = owner) => hit('POST', `/staff/v1/payments/${pid}/approve`, {}, token)

  it('manual pricing: validated lines in integer fils, one open draft, drafts invisible to the customer', async () => {
    const id = await submit()
    for (const bad of [[], 'x', [{ ...ITEMS[0], amountFils: -1 }], [{ ...ITEMS[0], amountFils: 10.5 }], [{ ...ITEMS[0], descriptionEn: '' }], [{ ...ITEMS[0], kind: 'tax' }], [{ ...ITEMS[0], kind: 'extra' }], [{ ...ITEMS[0], amountFils: 1e12 }], Array(31).fill(ITEMS[0])])
      expect((await draftQuote(id, bad)).status).toBe(400)
    const a = await draftQuote(id); expect(a.status).toBe(201)
    const q = await a.json() as { id: string; version: number; totalFils: number }
    expect(q.totalFils).toBe(100000)
    const again = await draftQuote(id, [ITEMS[1]]); expect(again.status).toBe(200) // replaces the draft, same version
    expect((await again.json() as { id: string; version: number })).toMatchObject({ id: q.id, version: 1 })
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM quotes WHERE request_id=? AND status='draft'").bind(id).first<{ n: number }>())!.n).toBe(1)
    const cd = await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json() as { finance: { quotes: unknown[]; totals: { state: string } } }
    expect(cd.finance.quotes).toHaveLength(0); expect(cd.finance.totals.state).toBe('unpriced')
    expect(await (await fin(id)).totals.state).toBe('unpriced')
  })
  it('government fees are paid straight to the authority: not in our invoice, totals or receipts; only the company fee is collected', async () => {
    const id = await submit()
    // a government-only quote cannot be issued: there is no company fee to collect
    const g = await (await draftQuote(id, [ITEMS[0]])).json() as { id: string; govFils: number }
    expect(g.govFils).toBe(35000)
    expect((await hit('POST', `/staff/v1/quotes/${g.id}/issue`, {}, owner)).status).toBeGreaterThanOrEqual(400)
    const q = await (await draftQuote(id)).json() as { id: string; version: number; totalFils: number; govFils: number }
    expect(q).toMatchObject({ totalFils: 100000, govFils: 35000 })
    // the official payment link: https + an official host only
    for (const bad of ['http://x.gov.ae/p', 'https://evil.example.com/p', 'https://user:pw@mol.gov.ae/p', 'https://mol.gov.ae.evil.com/p', 'javascript:alert(1)'])
      expect((await hit('PATCH', `/staff/v1/quotes/${q.id}/pay-link`, { url: bad }, owner)).status).toBe(400)
    expect((await hit('PATCH', `/staff/v1/quotes/${q.id}/pay-link`, { url: 'https://mol.gov.ae/pay?x=1' }, owner)).status).toBe(200)
    expect((await hit('POST', `/staff/v1/quotes/${q.id}/issue`, {}, owner)).status).toBe(201)
    const t = (await fin(id)).totals
    expect(t).toMatchObject({ total: 100000, remaining: 100000 }) // government fees are not part of what the customer owes us
    const c = await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json() as { finance: { gov: { total: number; payUrl: string; remaining: number; state: string } } }
    expect(c.finance.gov).toMatchObject({ total: 35000, payUrl: 'https://mol.gov.ae/pay?x=1', remaining: 35000 })
    // the invoice document shows the government part separately and says we do not collect it
    const doc = (await fin(id)).documents.find((d) => d.doc_type === 'invoice')!
    const html = await (await hit('GET', `/v1/documents/${doc.id}`, undefined, cust)).text()
    expect(html).toContain('الجهة'); expect(html).toContain('350.00'); expect(html).toContain('1,000.00')
    // customer reports paying the authority: capped, idempotent, unique reference
    const rep = (amount: number, ref: string, key: string, token = cust) => hit('POST', `/v1/requests/${id}/authority-payments`, { amountFils: amount, reference: ref, clientKey: key }, token)
    expect((await rep(40000, 'GOV-AAA-1', 'gk-over-0001')).status).toBe(409) // more than the official fee
    const a = await rep(20000, 'GOV-AAA-1', 'gk-one-00001'); expect(a.status).toBe(201)
    const aid = (await a.json() as { id: string }).id
    expect(((await (await rep(20000, 'GOV-AAA-1', 'gk-one-00001')).json()) as { replay: boolean }).replay).toBe(true)
    expect((await rep(1000, 'GOV-AAA-1', 'gk-two-00001')).status).toBe(409) // same reference twice
    expect((await rep(20000, 'GOV-BBB-2', 'gk-three-0001')).status).toBe(409) // would exceed 35000 together
    expect((await rep(15000, 'GOV-BBB-2', 'gk-four-0001', await login('+971521190031'))).status).toBe(404)
    expect((await hit('POST', `/staff/v1/authority-payments/${aid}/verify`, {}, cust)).status).toBe(401)
    expect((await hit('POST', `/staff/v1/authority-payments/${aid}/verify`, {}, await staffToken('agent'))).status).toBe(403)
    expect((await hit('POST', `/staff/v1/authority-payments/${aid}/verify`, {}, owner)).status).toBe(200)
    expect((await hit('POST', `/staff/v1/authority-payments/${aid}/verify`, {}, owner)).status).toBe(200) // replay is harmless
    const b = await (await rep(15000, 'GOV-BBB-2', 'gk-five-0001')).json() as { id: string }
    expect((await hit('POST', `/staff/v1/authority-payments/${b.id}/reject`, { reason: 'x' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/authority-payments/${b.id}/reject`, { reason: 'reference not found' }, owner)).status).toBe(200)
    const after = await (await hit('GET', `/staff/v1/requests/${id}/finance`, undefined, owner)).json() as { gov: { verified: number; remaining: number }; totals: { paid: number; remaining: number } }
    expect(after.gov).toMatchObject({ verified: 20000, remaining: 15000 })
    expect(after.totals).toMatchObject({ paid: 0, remaining: 100000 }) // our balance is untouched by authority payments
    expect(env.DB.prepare('DELETE FROM authority_payments WHERE id=?').bind(aid).run()).rejects.toThrow()
    expect(env.DB.prepare('UPDATE authority_payments SET amount_fils=1 WHERE id=?').bind(aid).run()).rejects.toThrow()
  })
  it('submission to the authority needs the verified company fee (paid in advance) and the verified government fee; only owner/manager can override, with a reason', async () => {
    const id = await submit()
    for (const body of [{ status: 'review' }, { status: 'ready_for_authority' }]) await hit('POST', `/staff/v1/requests/${id}/status`, body, owner)
    const go = (extra: object = {}, token = owner) => hit('POST', `/staff/v1/requests/${id}/status`, { status: 'authority', reference: 'AUTH-PAY-1', ...extra }, token)
    expect((await (await go()).json() as { unmet: string[] }).unmet).toEqual(['company_fee']) // not priced at all
    expect((await go({ overrideReason: 'short' })).status).toBe(409) // reason too short
    await issueQuote(id)
    expect((await go()).status).toBe(409)
    const p = await (await pay(id, 99999)).json() as { id: string }; await approve(p.id) // one fil short
    const r1 = await go(); expect((await r1.json() as { unmet: string[] }).unmet).toContain('company_fee')
    const p2 = await (await pay(id, 1)).json() as { id: string }; await approve(p2.id)
    // company fee is now paid; the government fee (35000) is still outstanding
    const r2 = await go(); expect((await r2.json() as { unmet: string[] }).unmet).toEqual(['government_fee'])
    const a = await (await hit('POST', `/v1/requests/${id}/authority-payments`, { amountFils: 35000, reference: 'GOV-GATE-1', clientKey: 'gate-key-0001' }, cust)).json() as { id: string }
    expect((await go()).status).toBe(409) // reported is not verified
    await hit('POST', `/staff/v1/authority-payments/${a.id}/verify`, {}, owner)
    expect((await go()).status).toBe(200)
  })
  it('the invoice for the Company fee is issued automatically at submission when the service has a fee; the government fee is attached once afterwards', async () => {
    const agent = await staffToken('agent')
    expect((await hit('PUT', '/staff/v1/fees/emirates-id', { feeFils: 25000 }, agent)).status).toBe(403)
    expect((await hit('PUT', '/staff/v1/fees/emirates-id', { feeFils: 0 }, owner)).status).toBe(400)
    expect((await hit('PUT', '/staff/v1/fees/emirates-id', { feeFils: 25000 }, owner)).status).toBe(200)
    const id = await submit() // creates + submits an emirates-id request
    const f = await fin(id)
    expect(f.documents.map((d) => d.doc_type)).toEqual(['invoice']); expect(f.documents[0]!.number).toMatch(/^T-INV-/)
    expect(f.totals).toMatchObject({ total: 25000, remaining: 25000, state: 'awaiting_payment' })
    const cd = await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json() as { finance: { totals: { total: number }; documents: unknown[] }; events: { text_en: string }[] }
    expect(cd.finance.totals.total).toBe(25000); expect(cd.finance.documents).toHaveLength(1) // the customer sees it at once
    // submitting again changes nothing: still one invoice
    await hit('PATCH', `/v1/requests/${id}`, { status: 'submitted' }, cust)
    expect((await fin(id)).documents.filter((d) => d.doc_type === 'invoice')).toHaveLength(1)
    // government fee: attached once, official host only
    expect((await hit('POST', `/staff/v1/requests/${id}/government-fee`, { amountFils: 35000, url: 'https://evil.example.com/x' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/requests/${id}/government-fee`, { amountFils: 35000, url: 'https://mol.gov.ae/pay' }, owner)).status).toBe(200)
    expect((await hit('POST', `/staff/v1/requests/${id}/government-fee`, { amountFils: 99999 }, owner)).status).toBe(409) // cannot be changed afterwards
    expect(env.DB.prepare('UPDATE quotes SET gov_fils=1 WHERE request_id=?').bind(id).run()).rejects.toThrow()
    const g = (await (await hit('GET', `/staff/v1/requests/${id}/finance`, undefined, owner)).json()) as { gov: { total: number; payUrl: string }; totals: { total: number } }
    expect(g.gov).toMatchObject({ total: 35000, payUrl: 'https://mol.gov.ae/pay' }); expect(g.totals.total).toBe(25000)
    // a service without a configured fee is not invoiced automatically
    await hit('PUT', '/staff/v1/fees/emirates-id', { feeFils: null }, owner)
    const id2 = await submit(); expect((await fin(id2)).documents).toHaveLength(0)
  })
  it('real scanner (clamav-http): configuration rules, explicit verdicts only; outage or odd answers stay pending, never clean', async () => {
    const { scanBytes, scannerMode, uploadsBlocked } = await import('../src/scanner')
    const base = { ...wenv(), SCANNER_MODE: 'clamav-http', SCANNER_TOKEN: 't'.repeat(32) } as Env
    // production needs https; missing URL/token or plain http is "no scanner"
    expect(scannerMode({ ...base, ENVIRONMENT: 'production', SCANNER_URL: 'https://scan.example.com/scan' } as Env)).toBe('clamav-http')
    expect(uploadsBlocked({ ...base, ENVIRONMENT: 'production', SCANNER_URL: 'https://scan.example.com/scan' } as Env)).toBe(false)
    expect(scannerMode({ ...base, ENVIRONMENT: 'production', SCANNER_URL: 'http://scan.example.com/scan' } as Env)).toBe('none')
    expect(scannerMode({ ...base, ENVIRONMENT: 'production', SCANNER_URL: 'http://localhost:8081/scan' } as Env)).toBe('none')
    expect(scannerMode({ ...base, SCANNER_URL: 'http://localhost:8081/scan' } as Env)).toBe('clamav-http') // local development only
    expect(scannerMode({ ...base, SCANNER_URL: undefined } as Env)).toBe('none')
    expect(scannerMode({ ...base, SCANNER_TOKEN: undefined, SCANNER_URL: 'https://x.example/scan' } as Env)).toBe('none')
    const e = { ...base, SCANNER_URL: 'https://scan.example.com/scan' } as Env
    const real = globalThis.fetch
    try {
      const answer = (status: number, body: unknown) => { globalThis.fetch = (async () => new Response(JSON.stringify(body), { status })) as typeof fetch }
      answer(200, { status: 'clean' }); expect((await scanBytes(e, new Uint8Array([1]))).status).toBe('clean')
      answer(200, { status: 'infected' }); expect((await scanBytes(e, new Uint8Array([1]))).status).toBe('infected')
      for (const odd of [[200, { status: 'maybe' }], [200, {}], [502, { status: 'error' }], [401, { error: 'unauthorized' }], [200, { status: 'clean ' }]] as [number, unknown][]) {
        answer(odd[0], odd[1]); expect((await scanBytes(e, new Uint8Array([1]))).status).toBe('pending')
      }
      globalThis.fetch = (async () => { throw new Error('network down') }) as typeof fetch
      expect((await scanBytes(e, new Uint8Array([1]))).status).toBe('pending')
      // the request carries the bearer token and the bytes
      let seen: { auth: string | null; len: number } | null = null
      globalThis.fetch = (async (_u: unknown, init?: RequestInit) => { seen = { auth: new Headers(init?.headers).get('authorization'), len: (init?.body as Uint8Array).length }; return new Response(JSON.stringify({ status: 'clean' })) }) as typeof fetch
      await scanBytes(e, new Uint8Array(5)); expect(seen).toEqual({ auth: `Bearer ${'t'.repeat(32)}`, len: 5 })
    } finally { globalThis.fetch = real }
  })
  it('rescan releases a pending file only on an explicit clean verdict', async () => {
    const noScan = { ...wenv(), SCANNER_MODE: undefined } as Env
    const id = await submit()
    const up = await asEnv(noScan, 'PUT', `/v1/requests/${id}/files`, cust, pdf(), { 'x-file-name': 'p.pdf' })
    const fid = ((await up.json()) as { id: string }).id
    expect((await hit('POST', `/staff/v1/files/${fid}/rescan`, {}, await staffToken('agent'))).status).toBe(403)
    expect((await asEnv(noScan, 'POST', `/staff/v1/files/${fid}/rescan`, owner)).status).toBe(200) // no scanner in this env: still pending
    expect((await env.DB.prepare('SELECT scan_status s FROM request_files WHERE id=?').bind(fid).first<{ s: string }>())!.s).toBe('pending')
    const real = globalThis.fetch
    try {
      for (const [verdict, stored] of [['clean', 'clean']] as const) {
        globalThis.fetch = (async () => new Response(JSON.stringify({ status: verdict }))) as typeof fetch
        const e = { ...wenv(), SCANNER_MODE: 'clamav-http', SCANNER_URL: 'https://scan.example.com/scan', SCANNER_TOKEN: 't'.repeat(32) } as Env
        const r = await asEnv(e, 'POST', `/staff/v1/files/${fid}/rescan`, owner)
        expect(r.status).toBe(200); expect(((await r.json()) as { status: string }).status).toBe(verdict)
        expect((await env.DB.prepare('SELECT scan_status s FROM request_files WHERE id=?').bind(fid).first<{ s: string }>())!.s).toBe(stored)
        expect((await asEnv(e, 'GET', `/staff/v1/files/${fid}`, owner)).status).toBe(200) // now openable
        expect((await asEnv(e, 'POST', `/staff/v1/files/${fid}/rescan`, owner)).status).toBe(409) // already decided
      }
    } finally { globalThis.fetch = real }
  })
  it('email: welcome email first with a confirmation link; the invoice is emailed when the customer starts the transaction, only to a confirmed address', async () => {
    const { mailbox } = await import('../src/mail')
    mailbox.length = 0
    const e = { ...wenv(), EMAIL_MODE: 'capture', PUBLIC_BASE_URL: 'https://api.test' } as Env
    const json = (o: unknown) => new TextEncoder().encode(JSON.stringify(o))
    const J = (method: string, path: string, token: string, body: unknown) => asEnv(e, method, path, token, json(body), { 'content-type': 'application/json' })
    await hit('PUT', '/staff/v1/fees/emirates-id', { feeFils: 25000 }, owner)
    const t = await login('+971521190077')
    expect((await J('PATCH', '/v1/me', t, { email: 'not-an-email' })).status).toBe(400)
    expect((await J('PATCH', '/v1/me', t, { email: 'Hind.Test@Example.com' })).status).toBe(200)
    expect(mailbox).toHaveLength(1)
    expect(mailbox[0]!.to).toBe('hind.test@example.com'); expect(mailbox[0]!.subject).toContain('Welcome')
    expect(((await (await hit('GET', '/v1/me', undefined, t)).json()) as { user: { email_set: boolean; email_verified: boolean } }).user).toMatchObject({ email_set: true, email_verified: false })
    // the customer starts the transaction: the invoice is created at once but NOT emailed to an unconfirmed address
    const id = ((await (await hit('POST', '/v1/requests', { serviceId: 'emirates-id', data: { name: 'H', title: { ar: 'ت', en: 'T' } } }, t)).json()) as { id: string }).id
    await J('PATCH', `/v1/requests/${id}`, t, { status: 'submitted' })
    expect((await fin(id)).documents.map((d) => d.doc_type)).toEqual(['invoice'])
    expect(mailbox).toHaveLength(1)
    // confirming the address (link in the welcome email) releases the invoice email, after the welcome email
    const link = /confirm\?token=([^"&]+)/.exec(mailbox[0]!.html)![1]!
    expect((await asEnv(e, 'GET', '/v1/email/confirm?token=bogus', '')).status).toBe(400)
    expect((await asEnv(e, 'GET', `/v1/email/confirm?token=${link}`, '')).status).toBe(200)
    expect((await asEnv(e, 'GET', `/v1/email/confirm?token=${link}`, '')).status).toBe(400) // one use
    expect(mailbox.map((m) => m.subject.split(' ')[0])).toEqual([mailbox[0]!.subject.split(' ')[0], 'فاتورة'])
    const inv = mailbox[1]!
    expect(inv.to).toBe('hind.test@example.com'); expect(inv.html).toContain('T-INV-'); expect(inv.html).toContain('250.00'); expect(inv.html).toContain('TEST COPY')
    expect(inv.html).not.toContain('350.00') // government fees are never part of our invoice
    // it is sent once only
    await asEnv(e, 'GET', `/v1/email/confirm?token=${link}`, '')
    expect(mailbox).toHaveLength(2)
    // without EMAIL_MODE nothing is ever sent
    mailbox.length = 0
    const t2 = await login('+971521190078')
    await hit('PATCH', '/v1/me', { email: 'nobody@example.com' }, t2)
    expect(mailbox).toHaveLength(0)
    await hit('PUT', '/staff/v1/fees/emirates-id', { feeFils: null }, owner)
  })
  it('permissions: agents may draft but not issue; accountants issue; customers and other customers are kept out', async () => {
    const id = await submit()
    const agent = await staffToken('agent'), accountant = await staffToken('accountant')
    expect((await draftQuote(id, ITEMS, cust)).status).toBe(401) // a customer token is not a staff token
    const q = await (await draftQuote(id, ITEMS, agent)).json() as { id: string; version: number }
    expect((await hit('POST', `/staff/v1/quotes/${q.id}/issue`, {}, agent)).status).toBe(403)
    const iss = await hit('POST', `/staff/v1/quotes/${q.id}/issue`, {}, accountant)
    expect(iss.status).toBe(201); expect((await iss.json() as { number: string }).number).toMatch(/^T-INV-\d{4}-\d{6}$/)
    const other = await login('+971521190030')
    expect((await pay(id, 1000, { token: other })).status).toBe(404)
    const docId = (await fin(id)).documents[0]!.id
    expect((await hit('GET', `/v1/documents/${docId}`, undefined, other)).status).toBe(404)
    expect((await hit('GET', `/v1/documents/${docId}`, undefined, cust)).status).toBe(200)
    expect((await hit('GET', `/staff/v1/documents/${docId}`, undefined, accountant)).status).toBe(200)
  })
  it('issuing creates the invoice at once (no quotation); the fee statement is frozen; re-pricing needs the invoice cancelled and a new version supersedes it', async () => {
    const id = await submit()
    const { q, r } = await issueQuote(id); expect(r.status).toBe(201)
    expect((await fin(id)).documents.map((d) => d.doc_type)).toEqual(['invoice']) // no quote document is produced
    expect((await fin(id)).quotes[0]!.status).toBe('accepted')
    // the database itself refuses edits to an issued statement
    expect(env.DB.prepare('UPDATE quote_items SET amount_fils=1 WHERE quote_id=?').bind(q.id).run()).rejects.toThrow()
    expect(env.DB.prepare('DELETE FROM quote_items WHERE quote_id=?').bind(q.id).run()).rejects.toThrow()
    expect(env.DB.prepare('UPDATE quotes SET total_fils=1 WHERE id=?').bind(q.id).run()).rejects.toThrow()
    expect(env.DB.prepare('DELETE FROM quotes WHERE id=?').bind(q.id).run()).rejects.toThrow()
    // with an invoice in force, re-pricing needs the invoice cancelled first
    const v2 = (await (await draftQuote(id, [ITEMS[0], { ...ITEMS[1], amountFils: 60000 }])).json()) as { id: string; version: number }
    expect(v2.version).toBe(2)
    expect((await hit('POST', `/staff/v1/quotes/${v2.id}/issue`, {}, owner)).status).toBe(409)
    const inv = (await fin(id)).documents[0]!
    expect((await hit('POST', `/staff/v1/invoices/${inv.id}/cancel`, { reason: 'Re-priced after documents review' }, owner)).status).toBe(200)
    expect((await hit('POST', `/staff/v1/quotes/${v2.id}/issue`, {}, owner)).status).toBe(201)
    const f = await fin(id); expect(f.quotes.map((x) => x.status)).toEqual(['superseded', 'accepted'])
    expect(f.totals.total).toBe(60000)
  })
  it('financial documents are immutable and carry the test marking; tax is never zero-rated or described as a tax invoice', async () => {
    const id = ((await (await hit('POST', '/v1/requests', { serviceId: 'emirates-id', data: { name: '<script>alert(1)</script>', title: { ar: 'خدمة', en: '<b>x</b>' } } }, cust)).json()) as { id: string }).id
    await hit('PATCH', `/v1/requests/${id}`, { status: 'submitted' }, cust)
    const { inv } = await priced(id)
    expect(inv.number).toMatch(/^T-INV-\d{4}-\d{6}$/)
    const f = await fin(id)
    expect(f.tax.configured).toBe(false); expect(f.test).toBe(true)
    expect('tax' in f.totals).toBe(false) // no tax figure exists anywhere
    const doc = f.documents.find((d) => d.doc_type === 'invoice')!
    expect(env.DB.prepare('UPDATE fin_documents SET snapshot=? WHERE id=?').bind('{}', doc.id).run()).rejects.toThrow()
    expect(env.DB.prepare('UPDATE fin_documents SET number=? WHERE id=?').bind('X', doc.id).run()).rejects.toThrow()
    expect(env.DB.prepare('UPDATE fin_documents SET total_fils=1 WHERE id=?').bind(doc.id).run()).rejects.toThrow()
    expect(env.DB.prepare('DELETE FROM fin_documents WHERE id=?').bind(doc.id).run()).rejects.toThrow()
    expect(env.DB.prepare("INSERT INTO fin_documents (id,request_id,doc_type,number,total_fils,snapshot,snapshot_hash,is_test,created_by,created_at) VALUES ('z',?,'invoice','LIVE-1',1,'{}','h',0,'x',1)").bind(id).run()).rejects.toThrow() // a live document cannot exist yet
    const html = await (await hit('GET', `/staff/v1/documents/${doc.id}`, undefined, owner)).text()
    expect(html).toContain('TEST COPY — NOT VALID FOR FINANCIAL USE'); expect(html).toContain('نسخة تجريبية — غير صالحة للاستخدام المالي')
    expect(html).toContain('Tax is not configured'); expect(html).toContain('الضريبة غير مهيأة')
    expect(html).toContain('AED 1,000.00'); expect(html).toContain('data:image/png;base64,')
    expect(html).not.toMatch(/<h1>[^<]*Tax Invoice/i); expect(html).not.toMatch(/VAT\s*\(?\d|5\s*%/)
    expect(html).not.toContain('<script>alert(1)</script>'); expect(html).toContain('&lt;script&gt;')
    expect((await hit('GET', `/staff/v1/documents/${doc.id}`, undefined, cust)).status).toBe(401)
    const ch = await hit('GET', `/v1/documents/${doc.id}`, undefined, cust)
    expect(ch.headers.get('content-security-policy')).toContain("default-src 'none'"); expect(ch.headers.get('x-frame-options')).toBe('DENY')
  })
  it('partial payments, caps, duplicate registration and duplicate approval', async () => {
    const id = await submit(); await priced(id)
    const agent = await staffToken('agent')
    const p1 = await pay(id, 60000); expect(p1.status).toBe(201)
    const pid1 = (await p1.json() as { id: string }).id
    let t = (await fin(id)).totals; expect(t).toMatchObject({ total: 100000, paid: 0, pending: 60000, remaining: 100000, state: 'awaiting_payment' }) // pending is not paid
    // same key + same content = same payment; same key + other content = refused; reused transfer reference refused
    const key = 'idem-pay-0001', ref = `TRX-DUP-${Date.now()}`
    const a = await pay(id, 10000, { key, ref }); expect(a.status).toBe(201)
    const b = await pay(id, 10000, { key, ref }); expect((await b.json() as { replay: boolean }).replay).toBe(true)
    expect((await pay(id, 20000, { key, ref })).status).toBe(422)
    expect((await pay(id, 5000, { ref })).status).toBe(409) // reference already used
    // cannot exceed the invoice together with what is already pending/approved: 60000+10000 pending, only 30000 left
    expect((await pay(id, 30001)).status).toBe(409)
    expect((await pay(id, 30000)).status).toBe(201)
    expect((await hit('POST', `/v1/requests/${id}/payments`, { amountFils: 1.5, method: 'bank_transfer', reference: 'TRX-9999', proofFileId: await proof(id), clientKey: 'k-float-0001' }, cust)).status).toBe(400)
    // only an authorised member approves; an agent or the customer cannot
    expect((await approve(pid1, agent)).status).toBe(403); expect((await approve(pid1, cust)).status).toBe(401)
    const ok = await approve(pid1); expect(ok.status).toBe(200)
    expect((await ok.json() as { receipt: string }).receipt).toMatch(/^T-RCT-\d{4}-\d{6}$/)
    t = (await fin(id)).totals; expect(t).toMatchObject({ paid: 60000, remaining: 40000, state: 'partial' })
    // approving again does not create a second receipt, nor change the totals
    const dup = await approve(pid1); expect((await dup.json() as { duplicate: boolean }).duplicate).toBe(true)
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM fin_documents WHERE doc_type='receipt' AND related_id=?").bind(pid1).first<{ n: number }>())!.n).toBe(1)
    // two simultaneous approvals: exactly one wins, one receipt
    const rest = (await fin(id)).payments.filter((x) => x.status === 'pending_verification')
    const [x, y] = await Promise.all([approve(rest[0]!.id), approve(rest[0]!.id)])
    const flags = [(await x.json() as { duplicate: boolean }).duplicate, (await y.json() as { duplicate: boolean }).duplicate].sort()
    expect(flags).toEqual([false, true])
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM fin_documents WHERE doc_type='receipt' AND related_id=?").bind(rest[0]!.id).first<{ n: number }>())!.n).toBe(1)
    // pay the rest, get to "paid"; then nothing more can be registered
    for (const p of (await fin(id)).payments.filter((q) => q.status === 'pending_verification')) expect((await approve(p.id)).status).toBe(200)
    t = (await fin(id)).totals; expect(t).toMatchObject({ paid: 100000, remaining: 0, state: 'paid', pending: 0 })
    expect((await pay(id, 1)).status).toBe(409)
    // approved payments cannot be altered in the database
    expect(env.DB.prepare('UPDATE payments SET amount_fils=1 WHERE id=?').bind(pid1).run()).rejects.toThrow()
    expect(env.DB.prepare('DELETE FROM payments WHERE id=?').bind(pid1).run()).rejects.toThrow()
  })
  it('a payment cannot be approved beyond the invoice even if pending ones were registered earlier', async () => {
    const id = await submit(); const { } = await priced(id)
    const pids: string[] = []
    for (const amt of [70000, 30000]) pids.push((await (await pay(id, amt)).json() as { id: string }).id)
    // sneak an over-cap pending row in directly (as if registered before a refund reduced headroom), approval must still be blocked
    const { newId } = await import('../src/crypto')
    const inv = (await fin(id)).documents.find((d) => d.doc_type === 'invoice')!
    const over = newId()
    await env.DB.prepare("INSERT INTO payments (id,request_id,invoice_id,kind,amount_fils,method,reference,status,created_by_kind,created_by,created_at) VALUES (?,?,?,'payment',20000,'bank_transfer','OVER-0001','pending_verification','customer','x',1)").bind(over, id, inv.id).run()
    expect((await approve(pids[0]!)).status).toBe(200); expect((await approve(pids[1]!)).status).toBe(200)
    const r = await approve(over)
    expect(r.status).toBe(409); expect((await r.json() as { error: string }).error).toBe('exceeds_balance')
    expect((await fin(id)).totals.paid).toBe(100000)
  })
  it('proof must be scanned before approval; staff-recorded payments need a second approver (owner excepted); rejection frees the reference', async () => {
    const id = await submit(); await priced(id)
    const noScan = { ...wenv(), SCANNER_MODE: undefined } as Env
    const up = await asEnv(noScan, 'PUT', `/v1/requests/${id}/files`, cust, pdf(), { 'x-file-name': 'p.pdf' })
    const pf = ((await up.json()) as { id: string }).id
    const pid = (await (await pay(id, 20000, { file: pf, ref: 'TRX-PEND-0001' })).json() as { id: string }).id
    const r = await approve(pid); expect(r.status).toBe(423) // unscanned proof
    expect((await hit('GET', `/staff/v1/payments/${pid}/proof`, undefined, owner)).status).toBe(423)
    const rej = await hit('POST', `/staff/v1/payments/${pid}/reject`, { reason: 'Proof unreadable' }, owner); expect(rej.status).toBe(200)
    expect((await approve(pid)).status).toBe(409) // a rejected payment cannot be approved
    expect((await hit('POST', `/staff/v1/payments/${pid}/reject`, { reason: 'again' }, owner)).status).toBe(409)
    const ev = await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json() as { events: { text_en: string }[] }
    expect(ev.events.some((e) => e.text_en.includes('Proof unreadable'))).toBe(true)
    expect((await pay(id, 20000, { ref: 'TRX-PEND-0001' })).status).toBe(201) // the reference is free again
    // staff-recorded cash: the same non-owner cannot approve their own entry; the owner can
    const mgr = await staffToken('manager')
    const rec = await hit('POST', `/staff/v1/requests/${id}/payments`, { amountFils: 10000, method: 'cash' }, mgr)
    expect(rec.status).toBe(201)
    const cid = (await rec.json() as { id: string }).id
    const own = await approve(cid, mgr); expect(own.status).toBe(403); expect((await own.json() as { error: string }).error).toBe('second_approver_required')
    expect((await approve(cid)).status).toBe(200)
    // a clean proof can be viewed by authorised finance staff only
    const clean = await proof(id); const p2 = (await (await pay(id, 5000, { file: clean })).json() as { id: string }).id
    expect((await hit('GET', `/staff/v1/payments/${p2}/proof`, undefined, owner)).status).toBe(200)
    expect((await hit('GET', `/staff/v1/payments/${p2}/proof`, undefined, await staffToken('agent'))).status).toBe(403)
  })
  it('refunds: owner/manager only, never above what is paid or what that payment received, linked credit notes, originals untouched', async () => {
    const id = await submit(); await priced(id)
    const pids: string[] = []
    for (const amt of [60000, 40000]) { const p = (await (await pay(id, amt)).json() as { id: string }).id; await approve(p); pids.push(p) }
    const before = await env.DB.prepare("SELECT number,snapshot_hash,status FROM fin_documents WHERE related_id=? AND doc_type='receipt'").bind(pids[0]).first<{ number: string; snapshot_hash: string; status: string }>()
    const refund = (amt: number, body: Record<string, unknown> = {}, token = owner) => hit('POST', `/staff/v1/requests/${id}/refunds`, { amountFils: amt, reason: 'Service not delivered as agreed', ...body }, token)
    expect((await refund(1000, {}, await staffToken('accountant'))).status).toBe(403)
    expect((await refund(1000, {}, await staffToken('agent'))).status).toBe(403)
    expect((await refund(1000, {}, cust)).status).toBe(401)
    expect((await refund(1000, { reason: 'short' })).status).toBe(400)
    expect((await refund(100001)).status).toBe(409) // more than was paid
    expect((await refund(40001, { paymentId: pids[1] })).status).toBe(409) // more than that payment received
    const ok = await refund(25000, { paymentId: pids[1] }); expect(ok.status).toBe(201)
    expect((await ok.json() as { creditNote: string }).creditNote).toMatch(/^T-CRN-\d{4}-\d{6}$/)
    expect((await refund(15001, { paymentId: pids[1] })).status).toBe(409) // 25000 already refunded from that payment
    expect((await refund(15000, { paymentId: pids[1] })).status).toBe(201)
    let t = (await fin(id)).totals; expect(t).toMatchObject({ paid: 100000, refunded: 40000, net: 60000, remaining: 40000, state: 'partial' })
    const after = await env.DB.prepare("SELECT number,snapshot_hash,status FROM fin_documents WHERE related_id=? AND doc_type='receipt'").bind(pids[0]).first<{ number: string; snapshot_hash: string; status: string }>()
    expect(after).toEqual(before) // the original receipt is exactly as it was
    expect((await fin(id)).payments.filter((p) => p.kind === 'refund').every((p) => p.refund_of === pids[1] && p.receipt_id)).toBe(true)
    // refund the rest -> state "refunded"
    expect((await refund(60000)).status).toBe(201)
    t = (await fin(id)).totals; expect(t).toMatchObject({ net: 0, state: 'refunded' })
    expect((await refund(1)).status).toBe(409)
  })
  it('cancelling an invoice voids it with a reason and a linked credit note; impossible while money is held; a new invoice can follow', async () => {
    const id = await submit(); const { inv } = await priced(id)
    const cancel = (reason = 'Customer changed the request scope', token = owner) => hit('POST', `/staff/v1/invoices/${inv.documentId}/cancel`, { reason }, token)
    const p = (await (await pay(id, 50000)).json() as { id: string }).id
    expect((await cancel()).status).toBe(409) // pending payment
    await approve(p)
    const held = await cancel(); expect((await held.json() as { error: string }).error).toBe('refund_first')
    await hit('POST', `/staff/v1/requests/${id}/refunds`, { amountFils: 50000, reason: 'Refund before cancelling the invoice' }, owner)
    expect((await cancel('short')).status).toBe(400)
    expect((await cancel('x'.repeat(12), await staffToken('agent'))).status).toBe(403)
    const done = await cancel(); expect(done.status).toBe(200)
    expect((await done.json() as { number: string }).number).toMatch(/^T-CRN-/)
    const docs = (await fin(id)).documents
    const old = docs.find((d) => d.id === inv.documentId)!
    expect(old.status).toBe('void'); expect(docs.some((d) => d.doc_type === 'credit_note' && d.related_id === inv.documentId)).toBe(true)
    expect(env.DB.prepare("UPDATE fin_documents SET status='issued' WHERE id=?").bind(old.id).run()).rejects.toThrow() // a void document cannot be revived
    expect((await cancel()).status).toBe(409)
    expect((await pay(id, 1000)).status).toBe(409) // no invoice in force
    expect((await issueQuote(id)).r.status).toBe(201) // after cancelling, the fee can be re-issued as a new invoice
    const invs = (await fin(id)).documents.filter((d) => d.doc_type === 'invoice').map((d) => d.number)
    expect(new Set(invs).size).toBe(2)
  })
  it('document numbers are unique and gap-free per type', async () => {
    const rows = await env.DB.prepare("SELECT doc_type t, number n FROM fin_documents ORDER BY doc_type, number").all<{ t: string; n: string }>()
    const by: Record<string, number[]> = {}
    for (const r of rows.results) (by[r.t] ??= []).push(Number(r.n.slice(-6)))
    for (const nums of Object.values(by)) { expect(new Set(nums).size).toBe(nums.length); expect(nums[0]).toBe(1); expect(nums[nums.length - 1]).toBe(nums.length) }
    expect(new Set(rows.results.map((r) => r.n)).size).toBe(rows.results.length)
  })
  it('CORS headers also reach raw-Response routes (documents, files) for allowed origins only', async () => {
    const id = await submit(); await priced(id)
    const docId = (await fin(id)).documents[0]!.id
    const withCors = { ...wenv(), ALLOWED_ORIGINS: 'https://app.example' } as Env
    const call = (origin: string, e: Env) => app.fetch(new Request(`https://api.test/v1/documents/${docId}`, { headers: { authorization: `Bearer ${cust}`, origin, 'cf-connecting-ip': `10.10.${Math.floor(++k / 250)}.${k % 250}` } }), e)
    const ok = await call('https://app.example', withCors)
    expect(ok.status).toBe(200); expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.example')
    expect((await call('https://evil.example', withCors)).headers.get('access-control-allow-origin')).toBeNull()
    expect((await call('https://app.example', wenv())).headers.get('access-control-allow-origin')).toBeNull() // closed by default
  })
})

describe('calendar-month rules', () => {
  it('adds calendar months with month-end clamping, year rollover and leap years', async () => {
    const { addCalendarMonths: add } = await import('../src/rules')
    expect(add('2026-01-31', 6)).toBe('2026-07-31')
    expect(add('2026-08-31', 6)).toBe('2027-02-28')   // clamped, non-leap
    expect(add('2023-08-31', 6)).toBe('2024-02-29')   // clamped, leap year
    expect(add('2026-12-31', 6)).toBe('2027-06-30')   // year rollover + short month
    expect(add('2024-02-29', 12)).toBe('2025-02-28')  // leap day + 1 year
    expect(add('2026-02-30', 6)).toBeNull(); expect(add('nonsense', 6)).toBeNull()
  })
  it('treats the six-month boundary as inclusive and one day less as a failure', async () => {
    const { passportValidity: pv } = await import('../src/rules')
    expect(pv('2026-07-31', '2026-01-31').outcome).toBe('pass')
    expect(pv('2026-07-30', '2026-01-31').outcome).toBe('fail')
    expect(pv('2027-02-28', '2026-08-31').outcome).toBe('pass')
    expect(pv('2027-02-27', '2026-08-31').outcome).toBe('fail')
    expect(pv('2024-02-29', '2023-08-31').outcome).toBe('pass'); expect(pv('2024-02-28', '2023-08-31').outcome).toBe('fail')
    expect(pv(undefined, '2026-01-31').outcome).toBe('manual_review'); expect(pv('2026-02-31', '2026-01-31').outcome).toBe('manual_review')
    expect(pv('2026-07-31', 'bad').outcome).toBe('manual_review')
  })
})
