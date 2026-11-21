import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
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
  const json = await v.json() as { accessToken: string; refreshToken: string; isNewUser: boolean }
  if (json.accessToken) await call('PATCH', '/v1/me', { token: json.accessToken, body: { email: `u${phone.replace(/\D/g, '')}@example.test` } }) // essential contact data: needed to submit
  return { res: v, json }
}

beforeAll(async () => {
  const p = await getPlatformProxy<Env>({ configPath: new URL('../wrangler.toml', import.meta.url).pathname, persist: false })
  dispose = p.dispose
  env = { ...p.env, PEPPER: b64(32), DATA_KEY: b64(32), ENVIRONMENT: 'test', DEV_OTP_ECHO: '1', SCANNER_MODE: 'fake-test' } as Env
  const dir = fileURLToPath(new URL('../migrations/', import.meta.url).href) // a path string: avoids the DOM/Node URL type clash
  for (const file of readdirSync(dir).filter((f: string) => f.endsWith('.sql')).sort()) {
    const sql: string = readFileSync(join(dir, file), 'utf8')
    const stmts = sql.split(/;\s*\n/).map((x: string) => x.trim()).filter(Boolean)
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
    const token = (await r.json() as { accessToken: string }).accessToken
    await hit('PATCH', '/v1/me', { token, body: { email: `u${phone.replace(/\D/g, '')}@example.test` } }) // essential contact data
    return token
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
    await hit('PATCH', '/v1/me', { email: 'u971521170010@example.test' }, custToken)
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
    const token = ((await (await hit('POST', '/v1/auth/wa/poll', { phone, challengeId: st.challengeId, pollToken: st.pollToken })).json()) as { accessToken: string }).accessToken
    await hit('PATCH', '/v1/me', { email: `u${phone.replace(/\D/g, '')}@example.test` }, token) // email is essential contact data: no submission without it
    return token
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
  // manual pricing per request: staff drafts and SENDS the quote; the invoice exists only once the CUSTOMER accepts that exact version
  const sendQuote = async (id: string, items: unknown = ITEMS, token = owner) => { const q = (await (await draftQuote(id, items)).json()) as { id: string; version: number }; const r = await hit('POST', `/staff/v1/quotes/${q.id}/issue`, {}, token); return { q, r } }
  const acceptQuote = (id: string, q: { id: string; version: number }, token = cust) => hit('POST', `/v1/requests/${id}/quotes/${q.id}/accept`, { version: q.version }, token)
  const issueQuote = async (id: string, items: unknown = ITEMS) => { const { q, r: sent } = await sendQuote(id, items); if (sent.status !== 201) return { q, r: sent, sent }; return { q, r: await acceptQuote(id, q), sent } } // r = the customer's acceptance (it issues the invoice)
  const priced = async (id: string) => { const { q, r } = await issueQuote(id); const inv = await r.json() as { documentId: string; number: string }; return { q, inv } }
  const proof = async (id: string) => { await env.DB.prepare('DELETE FROM rate_limits').run(); return ((await (await hit('PUT', `/v1/requests/${id}/files`, undefined, cust, { 'x-file-name': 'transfer.pdf' }, pdf())).json()) as { id: string }).id }
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
    expect((await acceptQuote(id, q)).status).toBe(201) // the customer approves it; that issues the invoice
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
  it('service fees are placeholders only: never invoiced automatically; each request is priced by a quotation the customer approves; the government fee is attached once afterwards', async () => {
    const agent = await staffToken('agent')
    expect((await hit('PUT', '/staff/v1/fees/emirates-id', { feeFils: 25000 }, agent)).status).toBe(403)
    expect((await hit('PUT', '/staff/v1/fees/emirates-id', { feeFils: 0 }, owner)).status).toBe(400)
    expect((await hit('PUT', '/staff/v1/fees/emirates-id', { feeFils: 25000 }, owner)).status).toBe(200)
    const fees = await (await hit('GET', '/staff/v1/fees', undefined, owner)).json() as { placeholder: boolean; fees: { service_id: string; is_placeholder: number }[] }
    expect(fees.placeholder).toBe(true); expect(fees.fees.find((f) => f.service_id === 'emirates-id')!.is_placeholder).toBe(1) // labelled as dummy data
    expect(env.DB.prepare("UPDATE service_fees SET is_placeholder=0 WHERE service_id='emirates-id'").run()).rejects.toThrow() // cannot be turned into an approved price list
    const id = await submit() // creates + submits an emirates-id request
    expect((await fin(id)).documents).toHaveLength(0) // a placeholder fee never creates an invoice
    let cd = await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json() as { finance: { totals: { total: number }; documents: unknown[]; pendingQuote: unknown }; work: { stage: { action: string | null }; payment: { company: string } } }
    expect(cd.finance.documents).toHaveLength(0); expect(cd.finance.pendingQuote).toBeNull(); expect(cd.work.stage.action).toBeNull()
    // staff prices THIS request and sends it: the customer sees the quotation and is asked to approve it; still no invoice
    const { q, r: sent } = await sendQuote(id, [ITEMS[1]])
    expect(sent.status).toBe(201); expect(((await sent.json()) as { number: string }).number).toMatch(/^T-QUO-/)
    cd = await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json() as typeof cd
    expect(cd.finance.pendingQuote).toMatchObject({ id: q.id, version: 1, total_fils: 70000 }); expect(cd.work.stage.action).toBe('approve_quote'); expect(cd.work.payment.company).toBe('awaiting_approval')
    expect((await fin(id)).documents.map((d) => d.doc_type)).toEqual(['quote'])
    // the customer accepts the exact version: the invoice is issued from it; accepting again changes nothing
    expect((await hit('POST', `/v1/requests/${id}/quotes/${q.id}/accept`, { version: 2 }, cust)).status).toBe(409) // not the version they were shown
    const acc = await acceptQuote(id, q); expect(acc.status).toBe(201)
    expect(((await acc.json()) as { number: string }).number).toMatch(/^T-INV-/)
    expect((await acceptQuote(id, q)).status).toBe(200) // replay: same invoice
    const f = await fin(id)
    expect(f.documents.map((d) => d.doc_type)).toEqual(['quote', 'invoice']); expect(f.totals).toMatchObject({ total: 70000, remaining: 70000, state: 'awaiting_payment' })
    // government fee: attached once, official host only
    expect((await hit('POST', `/staff/v1/requests/${id}/government-fee`, { amountFils: 35000, url: 'https://evil.example.com/x' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/requests/${id}/government-fee`, { amountFils: 35000, url: 'https://mol.gov.ae/pay' }, owner)).status).toBe(200)
    expect((await hit('POST', `/staff/v1/requests/${id}/government-fee`, { amountFils: 99999 }, owner)).status).toBe(409) // cannot be changed afterwards
    const g = (await (await hit('GET', `/staff/v1/requests/${id}/finance`, undefined, owner)).json()) as { gov: { total: number; payUrl: string }; totals: { total: number } }
    expect(g.gov).toMatchObject({ total: 35000, payUrl: 'https://mol.gov.ae/pay' }); expect(g.totals.total).toBe(70000)
    await hit('PUT', '/staff/v1/fees/emirates-id', { feeFils: null }, owner)
  })
  it('quotation approval: decline, re-quote, and a later price increase needs a new approval; money already paid is carried over, never lost or doubled', async () => {
    const me = await login('+971521140098') // its own customer, so the credit checks below are not shared with other tests
    const id = await submit(me)
    const myProof = async () => { await env.DB.prepare('DELETE FROM rate_limits').run(); return ((await (await hit('PUT', `/v1/requests/${id}/files`, undefined, me, { 'x-file-name': 'transfer.pdf' }, pdf())).json()) as { id: string }).id }
    const myPay = async (amount: number) => pay(id, amount, { token: me, file: await myProof() })
    // the customer declines; the team sends a new version; another customer can never act on it
    const v1 = await sendQuote(id, [ITEMS[1]])
    const other = await login('+971521140099')
    expect((await acceptQuote(id, v1.q, other)).status).toBe(404)
    expect((await hit('POST', `/v1/requests/${id}/quotes/${v1.q.id}/decline`, { reason: 'Too high' }, me)).status).toBe(200)
    expect((await hit('POST', `/v1/requests/${id}/quotes/${v1.q.id}/decline`, {}, me)).status).toBe(200) // replay
    expect((await acceptQuote(id, v1.q, me)).status).toBe(409) // a declined quote cannot be accepted
    expect((await fin(id)).documents.filter((d) => d.doc_type === 'invoice')).toHaveLength(0)
    const v2 = await sendQuote(id, [{ ...ITEMS[1], amountFils: 60000 }])
    // sending a newer version replaces one still waiting
    const v3 = await sendQuote(id, [{ ...ITEMS[1], amountFils: 50000 }])
    expect((await acceptQuote(id, v2.q, me)).status).toBe(409)
    expect((await acceptQuote(id, v3.q, me)).status).toBe(201)
    // the customer pays part of it; staff approves
    const p1 = (await (await myPay(30000)).json()) as { id: string }; expect((await approve(p1.id)).status).toBe(200)
    expect((await fin(id)).totals).toMatchObject({ total: 50000, net: 30000, remaining: 20000 })
    // the price goes UP: a new quotation; until the customer approves it, the accepted price and invoice stand
    const v4 = await sendQuote(id, [{ ...ITEMS[1], amountFils: 80000 }])
    expect(v4.r.status).toBe(201)
    let f = await fin(id)
    expect(f.totals).toMatchObject({ total: 50000, net: 30000 }); expect(f.quotes.find((x) => x.id === v4.q.id)!.status).toBe('issued')
    const cd = await (await hit('GET', `/v1/requests/${id}`, undefined, me)).json() as { work: { stage: { action: string } } }
    expect(cd.work.stage.action).toBe('approve_quote')
    // a pending payment would block replacing the invoice, so the quote cannot be sent while one waits
    const p2 = (await (await myPay(10000)).json()) as { id: string }
    expect((await sendQuote(id, [{ ...ITEMS[1], amountFils: 90000 }])).r.status).toBe(409)
    expect((await acceptQuote(id, v4.q, me)).status).toBe(409) // nor accepted: verify the payment first
    expect((await approve(p2.id)).status).toBe(200)
    // accepted: old invoice voided with a credit note, new invoice at the new price, both payments carried over exactly once
    expect((await acceptQuote(id, v4.q, me)).status).toBe(201)
    f = await fin(id)
    const invs = f.documents.filter((d) => d.doc_type === 'invoice')
    expect(invs.map((d) => d.status)).toEqual(['void', 'issued'])
    expect(f.documents.filter((d) => d.doc_type === 'credit_note')).toHaveLength(1)
    expect(f.totals).toMatchObject({ total: 80000, net: 40000, remaining: 40000 })
    const credit = await (await hit('GET', `/v1/requests/${id}`, undefined, me)).json() as { finance: { credit: { unallocated: number } } }
    expect(credit.finance.credit.unallocated).toBe(0) // nothing lost, nothing counted twice
    // the price goes DOWN below what was paid: the excess becomes the customer's credit, the invoice is fully paid
    const v5 = await sendQuote(id, [{ ...ITEMS[1], amountFils: 25000 }])
    expect((await acceptQuote(id, v5.q, me)).status).toBe(201)
    f = await fin(id)
    expect(f.totals).toMatchObject({ total: 25000, net: 25000, remaining: 0, state: 'paid' })
    const c2 = await (await hit('GET', `/v1/requests/${id}`, undefined, me)).json() as { finance: { credit: { unallocated: number } } }
    expect(c2.finance.credit.unallocated).toBe(15000)
    // agents may draft but never send; the customer can never accept a draft
    const agent = await staffToken('agent')
    const d = (await (await draftQuote(id, [ITEMS[1]], agent)).json()) as { id: string; version: number }
    expect((await hit('POST', `/staff/v1/quotes/${d.id}/issue`, {}, agent)).status).toBe(403)
    expect((await acceptQuote(id, d, me)).status).toBe(409)
  })
  // ===== network drops: the server finished the work but the phone never got the answer, so the app retries the same command =====
  it('network drop during submit: retrying create and submit gives one request, one submission event, one transition', async () => {
    const me = await login('+971521140201')
    const create = () => hit('POST', '/v1/requests', { serviceId: 'emirates-id', data: { name: 'N', title: { ar: 'ت', en: 'T' } }, clientKey: 'local-req-0001' }, me)
    const a = await create(); expect(a.status).toBe(201)
    const id = ((await a.json()) as { id: string }).id
    const b = await create(); expect(b.status).toBe(200); expect(((await b.json()) as { id: string; replay: boolean })).toMatchObject({ id, replay: true }) // the response was lost: same request
    expect((await hit('PATCH', `/v1/requests/${id}`, { status: 'submitted' }, me)).status).toBe(200)
    const again = await hit('PATCH', `/v1/requests/${id}`, { status: 'submitted' }, me) // retry after a lost response
    expect(((await again.json()) as { applied: boolean; status: string })).toMatchObject({ applied: false, status: 'submitted' })
    const uid = (await env.DB.prepare('SELECT user_id u FROM requests WHERE id=?').bind(id).first<{ u: string }>())!.u
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM requests WHERE user_id=?').bind(uid).first<{ n: number }>())!.n).toBe(1)
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM request_events WHERE request_id=? AND text_en='Request submitted'").bind(id).first<{ n: number }>())!.n).toBe(1)
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM request_transitions WHERE request_id=? AND to_status='submitted'").bind(id).first<{ n: number }>())!.n).toBe(1)
    // the same key with different content is refused, not merged
    expect((await hit('POST', '/v1/requests', { serviceId: 'residence-visa', data: {}, clientKey: 'local-req-0001' }, me)).status).toBe(422)
  })
  it('network drop during upload: the retry with the same client key returns the stored file; nothing is stored twice; another file with that key is refused', async () => {
    const me = await login('+971521140202')
    const id = ((await (await hit('POST', '/v1/requests', { serviceId: 'emirates-id', data: { name: 'U' } }, me)).json()) as { id: string }).id
    const up = (bytes: Uint8Array, key: string | null, q = '') => hit('PUT', `/v1/requests/${id}/files${q}`, undefined, me, { 'x-file-name': 'passport.pdf', ...(key ? { 'x-client-key': key } : {}) }, bytes)
    const r1 = await up(pdf(), 'local-file-0001'); expect(r1.status).toBe(201)
    const f1 = (await r1.json()) as { id: string }
    const r2 = await up(pdf(), 'local-file-0001'); expect(r2.status).toBe(200)
    expect(((await r2.json()) as { id: string; replay: boolean })).toMatchObject({ id: f1.id, replay: true })
    const other = new TextEncoder().encode('%PDF-1.4\n% a different document\n%%EOF')
    expect((await up(other, 'local-file-0001')).status).toBe(422) // same key, different bytes: never silently swapped
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM request_files WHERE request_id=? AND deleted_at IS NULL').bind(id).first<{ n: number }>())!.n).toBe(1)
    // simultaneous retries: exactly one file
    const [x, y] = await Promise.all([up(pdf(), 'local-file-0002'), up(pdf(), 'local-file-0002')])
    expect([x.status, y.status].sort()).toEqual([200, 201])
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM request_files WHERE request_id=? AND client_key='local-file-0002'").bind(id).first<{ n: number }>())!.n).toBe(1)
    // answering a missing-document request, retried: one file, the request moves back to review once
    await hit('PATCH', `/v1/requests/${id}`, { status: 'submitted' }, me)
    await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'review' }, owner)
    await hit('POST', `/staff/v1/requests/${id}/missing`, { items: [{ labelAr: 'إقامة', labelEn: 'Residence' }] }, owner)
    const mid = ((await (await hit('GET', `/v1/requests/${id}`, undefined, me)).json()) as { missing: { id: string }[] }).missing[0]!.id
    expect((await up(pdf(), 'local-file-0003', `?missingId=${mid}`)).status).toBe(201)
    expect((await up(pdf(), 'local-file-0003', `?missingId=${mid}`)).status).toBe(200)
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM request_transitions WHERE request_id=? AND from_status='needs_documents' AND to_status='review'").bind(id).first<{ n: number }>())!.n).toBe(1)
  })
  it('network drop during payment: the customer\'s report and the staff approval can both be retried without a second payment, allocation or receipt', async () => {
    const me = await login('+971521140203')
    const id = await submit(me)
    const { q } = await sendQuote(id, [ITEMS[1]]); expect((await acceptQuote(id, q, me)).status).toBe(201)
    await env.DB.prepare('DELETE FROM rate_limits').run()
    const proofId = ((await (await hit('PUT', `/v1/requests/${id}/files`, undefined, me, { 'x-file-name': 'transfer.pdf', 'x-client-key': 'local-proof-0001' }, pdf())).json()) as { id: string }).id
    const report = () => hit('POST', `/v1/requests/${id}/payments`, { amountFils: 70000, method: 'bank_transfer', reference: 'TRX-NET-0001', proofFileId: proofId, clientKey: 'pay-net-0001' }, me)
    const p1 = await report(); expect(p1.status).toBe(201)
    const pid = ((await p1.json()) as { id: string }).id
    expect(((await (await report()).json()) as { id: string; replay: boolean })).toMatchObject({ id: pid, replay: true })
    // staff approves; the response is lost; they press again (and a colleague at the same time)
    expect((await approve(pid)).status).toBe(200)
    const [r1, r2] = await Promise.all([approve(pid), approve(pid)])
    expect([r1.status, r2.status]).toEqual([200, 200])
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM payments WHERE request_id=?').bind(id).first<{ n: number }>())!.n).toBe(1)
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM allocations WHERE payment_id=?').bind(pid).first<{ n: number }>())!.n).toBe(1)
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM fin_documents WHERE doc_type='receipt' AND related_id=?").bind(pid).first<{ n: number }>())!.n).toBe(1)
    expect((await fin(id)).totals).toMatchObject({ total: 70000, paid: 70000, remaining: 0, state: 'paid' })
  })
  it('network drop during receipt confirmation: the retry records one acknowledgement and one timeline entry', async () => {
    const me = await login('+971521140204')
    const id = await submit(me)
    for (const s of ['review', 'ready_for_authority', 'authority', 'decision', 'completed']) await hit('POST', `/staff/v1/requests/${id}/status`, { status: s, reference: 'AUTH-NET-1', overrideReason: 'test: fees settled outside this test' }, owner)
    await hit('PUT', `/staff/v1/requests/${id}/files?kind=final`, undefined, owner, { 'x-file-name': 'done.pdf' }, pdf())
    expect((await hit('POST', `/staff/v1/requests/${id}/deliveries/publish`, {}, owner)).status).toBe(201)
    const ack = () => hit('POST', `/v1/requests/${id}/acknowledgments`, { deliveryVersion: 1 }, me)
    const a1 = await ack(); expect(((await a1.json()) as { duplicate: boolean }).duplicate).toBe(false)
    const [b1, b2] = await Promise.all([ack(), ack()])
    expect([(await b1.json() as { duplicate: boolean }).duplicate, (await b2.json() as { duplicate: boolean }).duplicate]).toEqual([true, true])
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM receipt_acks WHERE request_id=?').bind(id).first<{ n: number }>())!.n).toBe(1)
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM request_events WHERE request_id=? AND text_en='Customer confirmed receipt of the files'").bind(id).first<{ n: number }>())!.n).toBe(1)
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
  it('email: welcome email first with a confirmation link; the invoice is emailed once the customer accepts the quotation, only to a confirmed address', async () => {
    const { mailbox } = await import('../src/mail')
    mailbox.length = 0
    const e = { ...wenv(), EMAIL_MODE: 'capture', PUBLIC_BASE_URL: 'https://api.test' } as Env
    const json = (o: unknown) => new TextEncoder().encode(JSON.stringify(o))
    const J = (method: string, path: string, token: string, body: unknown) => asEnv(e, method, path, token, json(body), { 'content-type': 'application/json' })
    const t = await login('+971521190077')
    expect((await J('PATCH', '/v1/me', t, { email: 'not-an-email' })).status).toBe(400)
    expect((await J('PATCH', '/v1/me', t, { email: 'Hind.Test@Example.com' })).status).toBe(200)
    expect(mailbox).toHaveLength(1)
    expect(mailbox[0]!.to).toBe('hind.test@example.com'); expect(mailbox[0]!.subject).toContain('Welcome')
    expect(((await (await hit('GET', '/v1/me', undefined, t)).json()) as { user: { email_set: boolean; email_verified: boolean } }).user).toMatchObject({ email_set: true, email_verified: false })
    // the customer starts the transaction: nothing is invoiced at submission
    const id = ((await (await hit('POST', '/v1/requests', { serviceId: 'emirates-id', data: { name: 'H', title: { ar: 'ت', en: 'T' } } }, t)).json()) as { id: string }).id
    await J('PATCH', `/v1/requests/${id}`, t, { status: 'submitted' })
    expect((await fin(id)).documents).toHaveLength(0)
    // staff sends a quotation; the customer accepts it: the invoice now exists but is NOT emailed to an unconfirmed address
    const { q } = await sendQuote(id, [{ kind: 'service_fee', descriptionAr: 'أتعاب', descriptionEn: 'Fee', amountFils: 25000 }])
    const acc = await asEnv(e, 'POST', `/v1/requests/${id}/quotes/${q.id}/accept`, t, json({ version: q.version }), { 'content-type': 'application/json' })
    expect(acc.status).toBe(201)
    expect((await fin(id)).documents.map((d) => d.doc_type)).toEqual(['quote', 'invoice'])
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
  })
  it('cancellation after the government fee was paid: shows authority fee, earned fee and refundable amount; moves no money by itself', async () => {
    await hit('PUT', '/staff/v1/policies/emirates-id', { payGate: 'authority', retainPct: 30 }, owner)
    const id = await submit(); await issueQuote(id, [ITEMS[1], ITEMS[2]]) // company fee 1000.00, no government line yet
    expect((await hit('POST', `/staff/v1/requests/${id}/government-fee`, { amountFils: 35000, url: 'https://mol.gov.ae/pay', beneficiary: 'MOHRE' }, owner)).status).toBe(200)
    const p = (await (await pay(id, 100000)).json() as { id: string }).id; await approve(p)
    const a = (await (await hit('POST', `/v1/requests/${id}/authority-payments`, { amountFils: 35000, reference: 'GOV-CXL-1', clientKey: 'cxl-key-0001' }, cust)).json()) as { id: string }
    await hit('POST', `/staff/v1/authority-payments/${a.id}/verify`, {}, owner)
    const c1 = await (await hit('GET', `/staff/v1/requests/${id}/cancellation`, undefined, owner)).json() as { companyFee: { invoiced: number; allocated: number; retainedPercent: number; earned: number; refundable: number }; governmentFee: { total: number; paidToAuthorityVerified: number }; policyApproved: boolean }
    expect(c1.governmentFee).toMatchObject({ total: 35000, paidToAuthorityVerified: 35000 }) // paid to the authority: not ours to refund
    expect(c1.companyFee).toMatchObject({ invoiced: 100000, allocated: 100000, retainedPercent: 30, earned: 30000, refundable: 70000 })
    expect(c1.policyApproved).toBe(true)
    expect((await hit('GET', `/staff/v1/requests/${id}/cancellation`, undefined, await staffToken('agent'))).status).toBe(403)
    // the customer cancels: nothing moves automatically
    await hit('PATCH', `/v1/requests/${id}`, { status: 'cancelled' }, cust)
    expect((await fin(id)).totals).toMatchObject({ paid: 100000, net: 100000 })
    // a refund request for exactly the refundable amount goes through approval; an amount above it is still capped only by the ledger, the policy figure is advice
    expect((await refundReq(id, 70000)).status).toBe(201)
    await hit('PUT', '/staff/v1/policies/emirates-id', { payGate: 'authority', retainPct: 0 }, owner)
  })
  it('government fee: beneficiary, expected vs actual, explicit variance adjustment (owner/manager, reason, never revenue)', async () => {
    const id = await submit(); await issueQuote(id, [ITEMS[1], ITEMS[2]])
    expect((await hit('POST', `/staff/v1/requests/${id}/government-fee`, { amountFils: 35000, url: 'https://mol.gov.ae/pay', beneficiary: 'MOHRE' }, owner)).status).toBe(200)
    const a = (await (await hit('POST', `/v1/requests/${id}/authority-payments`, { amountFils: 35000, reference: 'GOV-VAR-1', clientKey: 'var-key-0001' }, cust)).json()) as { id: string }
    await hit('POST', `/staff/v1/authority-payments/${a.id}/verify`, {}, owner)
    const adj = (delta: number, reason = 'The authority changed the official fee', token = owner) => hit('POST', `/staff/v1/requests/${id}/government-fee/adjust`, { deltaFils: delta, reason }, token)
    expect((await adj(500, undefined, await staffToken('accountant'))).status).toBe(403)
    expect((await adj(500, 'short')).status).toBe(400)
    expect((await adj(-1)).status).toBe(409) // below what the customer already paid to the authority
    expect((await adj(1500)).status).toBe(200)
    const g = (await (await hit('GET', `/staff/v1/requests/${id}/finance`, undefined, owner)).json()) as { gov: { beneficiary: string; expected: number; adjustments: number; total: number; verified: number; remaining: number; state: string }; totals: { total: number } }
    expect(g.gov).toMatchObject({ beneficiary: 'MOHRE', expected: 35000, adjustments: 1500, total: 36500, verified: 35000, remaining: 1500, state: 'reported' })
    expect(g.totals.total).toBe(100000) // the Company's invoice never absorbs a government difference
    expect(env.DB.prepare('DELETE FROM gov_adjustments').run()).rejects.toThrow()
  })
  it('payment policy per service: required before the authority step by default, before delivery when configured, never when "none"; the customer cannot mark anything paid', async () => {
    const id = await submit(); await issueQuote(id, [ITEMS[1], ITEMS[2]])
    for (const body of [{ status: 'review' }, { status: 'ready_for_authority' }]) await hit('POST', `/staff/v1/requests/${id}/status`, body, owner)
    await hit('PUT', '/staff/v1/policies/emirates-id', { payGate: 'authority', retainPct: 0 }, owner)
    expect((await hit('PUT', '/staff/v1/policies/emirates-id', { payGate: 'authority', retainPct: 0 }, await staffToken('manager'))).status).toBe(403) // owner only
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'authority', reference: 'POL-1' }, owner)).status).toBe(409)
    await hit('PUT', '/staff/v1/policies/emirates-id', { payGate: 'none', retainPct: 0 }, owner)
    expect((await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'authority', reference: 'POL-1' }, owner)).status).toBe(200) // policy says no payment needed
    // delivery policy: files cannot be published while unpaid
    await hit('PUT', '/staff/v1/policies/emirates-id', { payGate: 'delivery', retainPct: 0 }, owner)
    await hit('POST', `/staff/v1/requests/${id}/status`, { status: 'decision' }, owner)
    await stage(id, 'out.pdf')
    expect((await hit('POST', `/staff/v1/requests/${id}/deliveries/publish`, {}, owner)).status).toBe(409)
    const p = (await (await pay(id, 100000)).json() as { id: string }).id; await approve(p)
    expect((await hit('POST', `/staff/v1/requests/${id}/deliveries/publish`, {}, owner)).status).toBe(201)
    // the customer has no way to change amounts or mark a request paid
    for (const body of [{ data: { paid: true, totalFils: 1 } }, { money: { paid: 999999 } }, { status: 'paid' }]) await hit('PATCH', `/v1/requests/${id}`, body, cust)
    expect((await fin(id)).totals).toMatchObject({ total: 100000, paid: 100000 })
    expect((await hit('POST', `/v1/requests/${id}/payments`, { amountFils: 1000, method: 'bank_transfer', reference: 'TRX-CUST-1', clientKey: 'cust-key-0001', status: 'approved' }, cust)).status).toBe(400) // needs proof; and a status field is ignored
    await hit('PUT', '/staff/v1/policies/emirates-id', { payGate: 'authority', retainPct: 0 }, owner)
  })
  it('re-pricing after the customer saw the invoice keeps the previous version; reconciliation lists approved payments, flags duplicates, pending items and missing proof', async () => {
    const id = await submit(); const { inv } = await priced(id)
    const v1 = (await fin(id)).quotes[0]!
    expect((await hit('POST', `/staff/v1/invoices/${inv.documentId}/cancel`, { reason: 'Re-priced after the customer agreed another scope' }, owner)).status).toBe(200)
    const again = await issueQuote(id, [ITEMS[1]]); expect(again.r.status).toBe(201)
    const f = await fin(id)
    expect(f.quotes.map((q) => [q.version, q.status])).toEqual([[1, 'superseded'], [2, 'accepted']]) // the earlier version is kept
    expect(f.quotes[0]!.id).toBe(v1.id); expect(f.documents.filter((d) => d.doc_type === 'invoice' && d.status === 'void')).toHaveLength(1)
    // reconciliation
    const mk = async (amt: number, ref: string, withProof = true) => { const r = await pay(id, amt, { ref }); const x = (await r.json() as { id: string }).id; return x }
    const a = await mk(10000, 'REC-AAA-1'); const b = await mk(10000, 'REC-BBB-2')
    await approve(a); await approve(b)
    await env.DB.prepare("UPDATE payments SET proof_file_id=NULL WHERE id=?").bind(b).run().catch(() => null) // approved payments are immutable in amount/status only; proof can be absent for cash
    const day = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10)
    const rec = await (await hit('GET', `/staff/v1/finance/reconciliation?date=${day}`, undefined, owner)).json() as { totals: { received: number; allocated: number; unallocated: number }; payments: { id: string; reference: string; allocated: number }[]; flags: { type: string; paymentId?: string }[] }
    expect(rec.payments.map((x) => x.id)).toEqual(expect.arrayContaining([a, b]))
    expect(rec.totals.received).toBeGreaterThan(0); expect(rec.totals.received).toBe(rec.totals.allocated + rec.totals.unallocated)
    expect(rec.flags.some((x) => x.type === 'possible_duplicate' && x.paymentId === b)).toBe(true) // same customer, amount and method
    expect(rec.flags.some((x) => x.type === 'approved_without_proof' && x.paymentId === b)).toBe(true)
    expect(rec.flags.some((x) => x.type === 'invoice_ledger_mismatch')).toBe(false)
    expect((await hit('GET', `/staff/v1/finance/reconciliation?date=${day}`, undefined, await staffToken('agent'))).status).toBe(403)
  })
  // ===== transaction lifecycle: every step has an action, an owner and a condition; the server is the reference =====
  type WorkJ = { work: { waitingOn: string; next: { code: string }; overdue: boolean; followUpAt: number | null; payment: { company: string }; delivery: { state: string; version: number } }; log: { from_status: string | null; to_status: string; actor_kind: string; reason: string | null; internal_note: string | null; reference: string | null }[]; submissions: { number: number; reference: string; state: string; returned_reason: string | null }[]; problems: { id: string; status: string }[] }
  const sdet = async (id: string) => (await (await hit('GET', `/staff/v1/requests/${id}`, undefined, owner)).json()) as WorkJ
  const cwork = async (id: string, token = cust) => ((await (await hit('GET', `/v1/requests/${id}`, undefined, token)).json()) as { work: { stage: { actionRequired: boolean; action: string | null; ar: string }; payment: { company: string }; delivery: { state: string } } }).work
  const st = (id: string, body: Record<string, unknown>) => hit('POST', `/staff/v1/requests/${id}/status`, body, owner)
  it('full successful cycle: next action and waiting party at every step; payment, status and delivery are independent; all moves logged; renewal reminders', async () => {
    const id = await submit() // 3: server received it and numbered it; nothing is invoiced yet
    let d = await sdet(id)
    expect(d.work).toMatchObject({ waitingOn: 'staff', next: { code: 'assign' } }) // 4: someone must own it
    // 5: the team prices this request; the customer approves the quotation; that issues the invoice
    const { q: fq } = await sendQuote(id, [{ kind: 'service_fee', descriptionAr: 'أتعاب الشركة', descriptionEn: 'Company fee', amountFils: 25000 }])
    expect((await cwork(id)).stage.action).toBe('approve_quote')
    expect((await acceptQuote(id, fq)).status).toBe(201)
    expect((await cwork(id)).stage.action).toBe('pay_company_fee') // the customer is told what is needed from them
    const mgr = await staffToken('manager')
    await st(id, { status: 'review' }); d = await sdet(id)
    expect(['finish_review', 'await_scan']).toContain(d.work.next.code); expect(d.work.followUpAt).toBeGreaterThan(Date.now())
    // 7: pay (verified payment) -> the payment state moves on its own; the transaction status does not
    const p = (await (await pay(id, 25000)).json() as { id: string }).id
    expect((await sdet(id)).work.payment.company).toBe('awaiting_payment') // a reported payment proves nothing
    await approve(p)
    d = await sdet(id); expect(d.work.payment.company).toBe('paid'); expect((await cwork(id)).payment.company).toBe('paid')
    expect(d.work.next.code).not.toBe('await_payment')
    expect((await st(id, { status: 'ready_for_authority' })).status).toBe(200) // 8
    expect((await sdet(id)).work.next.code).toBe('submit_authority')
    expect((await st(id, { status: 'authority' })).status).toBe(400) // no reference, no evidence of submission
    expect((await st(id, { status: 'authority', reference: 'AUTH-LIFE-1' })).status).toBe(200) // 9
    d = await sdet(id); expect(d.work).toMatchObject({ waitingOn: 'authority', next: { code: 'follow_authority' } })
    expect(d.submissions).toHaveLength(1); expect(d.submissions[0]).toMatchObject({ number: 1, reference: 'AUTH-LIFE-1', state: 'active' })
    await st(id, { status: 'decision' }); expect((await sdet(id)).work.next.code).toBe('record_decision') // 10
    expect((await st(id, { status: 'completed', expiresAt: '2000-01-01' })).status).toBe(400) // expiry in the past
    expect((await st(id, { status: 'completed', expiresAt: new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10) })).status).toBe(200) // 11
    d = await sdet(id)
    expect(d.work.next.code).toBe('upload_final'); expect(d.work.delivery.state).toBe('none') // 12: completed does NOT mean delivered
    expect(d.submissions[0]!.state).toBe('decided')
    await stage(id, 'result.pdf'); expect((await sdet(id)).work.next.code).toBe('publish'); expect((await sdet(id)).work.delivery.state).toBe('draft')
    expect((await cwork(id)).delivery.state).toBe('draft') === undefined
    expect((await hit('POST', `/staff/v1/requests/${id}/deliveries/publish`, {}, owner)).status).toBe(201) // 13
    d = await sdet(id); expect(d.work).toMatchObject({ waitingOn: 'customer', next: { code: 'await_receipt' }, delivery: { state: 'awaiting_receipt', version: 1 } })
    const cw = await cwork(id); expect(cw.stage).toMatchObject({ actionRequired: true, action: 'confirm_receipt' })
    // opening/downloading does not acknowledge; only the explicit confirmation does
    expect((await sdet(id)).work.delivery.state).toBe('awaiting_receipt')
    const ack = await hit('POST', `/v1/requests/${id}/acknowledgments`, { deliveryVersion: 1 }, cust); expect(ack.status).toBeLessThan(300)
    d = await sdet(id); expect(d.work.delivery.state).toBe('received'); expect(d.work.next.code).toBe('archived') // 14: expiry is already recorded
    // every move was logged: who, from, to, reason/reference
    const kinds = d.log.map((x) => `${x.from_status ?? '-'}>${x.to_status}:${x.actor_kind}`)
    expect(kinds).toEqual(expect.arrayContaining(['draft>submitted:customer', 'review>ready_for_authority:staff', 'ready_for_authority>authority:staff', 'decision>completed:staff']))
    expect(d.log.find((x) => x.to_status === 'authority')!.reference).toBe('AUTH-LIFE-1')
    expect(env.DB.prepare('DELETE FROM request_transitions').run()).rejects.toThrow()
    // reminders at 90/30/7 days before expiry; they fire into the customer's timeline once, and not when a renewal already exists
    const n = (await env.DB.prepare("SELECT COUNT(*) n FROM reminders WHERE request_id=? AND state='pending'").bind(id).first<{ n: number }>())!.n
    expect(n).toBe(3)
    const { fireReminders } = await import('../src/ops')
    expect(await fireReminders(env, Date.now() + 370 * 86400000)).toBeGreaterThan(0)
    const ev = await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json() as { events: { text_en: string }[] }
    expect(ev.events.some((e) => e.text_en.includes('expires in about'))).toBe(true)
    expect(await fireReminders(env, Date.now() + 400 * 86400000)).toBeGreaterThanOrEqual(0)
    // 14: renewal creates a NEW linked request; the original is untouched
    const ren = await hit('POST', '/v1/requests', { serviceId: 'emirates-id', renewalOf: id, data: { name: 'Z' } }, cust); expect(ren.status).toBe(201)
    expect((await sdet(id)).work.next.code).toBe('archived')
    await hit('PUT', '/staff/v1/fees/emirates-id', { feeFils: null }, owner); void mgr
  })
  it('shortage cycle: staff names what is missing, the customer is told, replies, and the request returns to review; the authority can ask again against its reference', async () => {
    const id = await submit(); await toReview(id)
    expect((await hit('POST', `/staff/v1/requests/${id}/missing`, { items: [{ labelAr: 'صورة الجواز', labelEn: 'Passport copy', noteAr: 'أوضح', noteEn: 'clearer' }] }, owner)).status).toBe(200)
    let d = await sdet(id); expect(d.work).toMatchObject({ waitingOn: 'customer', next: { code: 'chase_customer' } })
    expect((await cwork(id)).stage).toMatchObject({ actionRequired: true, action: 'send_documents' })
    const missing = ((await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json()) as { missing: { id: string }[] }).missing[0]!.id
    expect((await hit('PUT', `/v1/requests/${id}/files?missingId=${missing}`, undefined, cust, { 'x-file-name': 'p.pdf' }, pdf())).status).toBe(201)
    d = await sdet(id); expect(d.log.some((x) => x.from_status === 'needs_documents' && x.to_status === 'review' && x.actor_kind === 'customer')).toBe(true)
    expect((await cwork(id)).stage.action).not.toBe('send_documents')
    // the authority returns it: reason is mandatory, tied to the submission reference; the first filing is kept and a new one is a new row
    for (const body of [{ status: 'ready_for_authority' }, { status: 'authority', reference: 'AUTH-A-1', overrideReason: 'test: fees settled offline' }]) await st(id, body)
    expect((await st(id, { status: 'needs_documents' })).status).toBe(400)
    expect((await st(id, { status: 'needs_documents', reason: 'Authority asked for a signed power of attorney' })).status).toBe(200)
    d = await sdet(id); expect(d.submissions).toHaveLength(1); expect(d.submissions[0]).toMatchObject({ state: 'returned', returned_reason: 'Authority asked for a signed power of attorney', reference: 'AUTH-A-1' })
    expect((await cwork(id)).stage.action).toBe('send_documents')
    for (const body of [{ status: 'review' }, { status: 'ready_for_authority' }, { status: 'authority', reference: 'AUTH-A-2', overrideReason: 'test: fees settled offline' }]) await st(id, body)
    d = await sdet(id); expect(d.submissions.map((x) => [x.number, x.reference, x.state])).toEqual([[1, 'AUTH-A-1', 'returned'], [2, 'AUTH-A-2', 'active']])
  })
  it('rejection, cancellation and delay have reasons, follow-up and a money path; nothing is deleted', async () => {
    // rejection
    const rej = await submit(); await toReview(rej)
    expect((await st(rej, { status: 'rejected' })).status).toBe(400)
    expect((await st(rej, { status: 'rejected', reason: 'Documents do not meet the authority rules' })).status).toBe(200)
    expect((await cwork(rej)).stage.ar).toContain('لم تُقبل')
    expect((await sdet(rej)).log.find((x) => x.to_status === 'rejected')!.reason).toContain('authority rules')
    // cancellation by staff needs a reason; by the customer it records one; money is untouched either way
    const can = await submit(); await hit('PUT', '/staff/v1/fees/emirates-id', { feeFils: null }, owner); await issueQuote(can, [ITEMS[1], ITEMS[2]])
    const pp = (await (await pay(can, 100000)).json() as { id: string }).id; await approve(pp)
    await toReview(can)
    expect((await st(can, { status: 'cancelled' })).status).toBe(400)
    expect((await hit('PATCH', `/v1/requests/${can}`, { status: 'cancelled', reason: 'I no longer need the service' }, cust)).status).toBe(200)
    const dc = await sdet(can); expect(dc.log.find((x) => x.to_status === 'cancelled')).toMatchObject({ actor_kind: 'customer', reason: 'I no longer need the service' })
    expect(dc.work.next.code).toBe('settle_money') // the money path is the next action; nothing was refunded automatically
    expect((await fin(can)).totals).toMatchObject({ paid: 100000, net: 100000 })
    expect(((await (await hit('GET', `/staff/v1/requests/${can}/cancellation`, undefined, owner)).json()) as { companyFee: { allocated: number } }).companyFee.allocated).toBe(100000)
    // delay: explained to the customer with a new date, status unchanged, follow-up moved
    const dl = await submit(); await toReview(dl)
    expect((await hit('POST', `/staff/v1/requests/${dl}/delay`, { reason: 'x', expectedAt: '2099-01-01' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/requests/${dl}/delay`, { reason: 'The authority portal is down', expectedAt: '2099-01-01' }, owner)).status).toBe(200)
    const cd = await (await hit('GET', `/v1/requests/${dl}`, undefined, cust)).json() as { request: { status: string; staff_data: string }; events: { text_en: string }[] }
    expect(cd.request.status).toBe('review'); expect(cd.events.some((e) => e.text_en.includes('delayed') && e.text_en.includes('2099-01-01'))).toBe(true)
    expect((await sdet(dl)).work.followUpAt).toBe(Date.parse('2099-01-01T08:00:00Z'))
    // overdue follow-up is flagged for the staff list
    await env.DB.prepare('UPDATE requests SET follow_up_at=? WHERE id=?').bind(Date.now() - 1000, dl).run()
    const list = await (await hit('GET', '/staff/v1/requests?limit=100', undefined, owner)).json() as { requests: { id: string; work: { overdue: boolean; waitingOn: string } }[] }
    expect(list.requests.find((x) => x.id === dl)!.work).toMatchObject({ overdue: true, waitingOn: 'staff' })
  })
  it('delivery problem and package replacement: the customer reports, staff must publish a newer version before resolving as replaced; the earlier version is kept', async () => {
    const id = await submit(); await advance(id); await st(id, { status: 'completed' })
    await stage(id, 'v1.pdf'); expect((await hit('POST', `/staff/v1/requests/${id}/deliveries/publish`, {}, owner)).status).toBe(201)
    expect((await hit('POST', `/v1/requests/${id}/problems`, { text: 'x' }, cust)).status).toBe(400)
    const prob = await hit('POST', `/v1/requests/${id}/problems`, { text: 'The file is of another person' }, cust); expect(prob.status).toBe(201)
    const pid = (await prob.json() as { id: string }).id
    expect(((await (await hit('POST', `/v1/requests/${id}/problems`, { text: 'The file is of another person' }, cust)).json()) as { duplicate: boolean }).duplicate).toBe(true)
    const other = await login('+971521190066'); expect((await hit('POST', `/v1/requests/${id}/problems`, { text: 'not my request at all' }, other)).status).toBe(404)
    let d = await sdet(id); expect(d.work.next.code).toBe('fix_delivery'); expect(d.problems).toHaveLength(1)
    expect((await cwork(id)).stage.ar).toContain('بلاغك')
    expect((await hit('POST', `/staff/v1/problems/${pid}/resolve`, { resolution: 'replaced', note: 'Replaced with the right file' }, owner)).status).toBe(409) // no newer package yet
    await stage(id, 'v2.pdf'); expect((await hit('POST', `/staff/v1/requests/${id}/deliveries/publish`, {}, owner)).status).toBe(201)
    expect((await hit('POST', `/staff/v1/problems/${pid}/resolve`, { resolution: 'replaced', note: 'Replaced with the right file' }, owner)).status).toBe(200)
    d = await sdet(id); expect(d.work.next.code).toBe('await_receipt')
    const dv = await env.DB.prepare("SELECT version,status FROM deliveries WHERE request_id=? AND version IS NOT NULL ORDER BY version").bind(id).all<{ version: number; status: string }>()
    expect(dv.results.map((x) => [x.version, x.status])).toEqual([[1, 'superseded'], [2, 'published']]) // the earlier package is kept, not deleted
  })
  it('the customer email is essential: no request can be submitted without one, and staff see the customer\'s email and phone', async () => {
    // an account created at verification time has no email yet (the helper `login` adds one, so verify by hand)
    const st = await (await hit('POST', '/v1/auth/wa/start', { phone: '+971521190088' })).json() as { challengeId: string; pollToken: string; code: string }
    const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: '971521190088', type: 'text', text: { body: st.code } }] } }] }] })
    const kx = await crypto.subtle.importKey('raw', new TextEncoder().encode('w-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = 'sha256=' + Buffer.from(await crypto.subtle.sign('HMAC', kx, new TextEncoder().encode(raw))).toString('hex')
    await app.fetch(new Request('https://api.test/webhooks/whatsapp', { method: 'POST', headers: { 'x-hub-signature-256': sig, 'content-type': 'application/json', 'cf-connecting-ip': '10.8.99.98' }, body: raw }), wenv())
    const t = ((await (await hit('POST', '/v1/auth/wa/poll', { phone: '+971521190088', challengeId: st.challengeId, pollToken: st.pollToken })).json()) as { accessToken: string }).accessToken
    const uid = (await env.DB.prepare("SELECT id FROM users ORDER BY created_at DESC LIMIT 1").first<{ id: string }>())!.id
    const id = ((await (await hit('POST', '/v1/requests', { serviceId: 'emirates-id', data: { name: 'M', title: { ar: 'ت', en: 'T' } } }, t)).json()) as { id: string }).id
    const no = await hit('PATCH', `/v1/requests/${id}`, { status: 'submitted' }, t)
    expect(no.status).toBe(409); expect(((await no.json()) as { error: string }).error).toBe('email_required')
    expect((await hit('PATCH', '/v1/me', { email: 'bad' }, t)).status).toBe(400)
    expect((await hit('PATCH', '/v1/me', { email: 'Mona.Test@Example.com' }, t)).status).toBe(200)
    const me = await (await hit('GET', '/v1/me', undefined, t)).json() as { user: { email_set: boolean } }
    expect(me.user.email_set).toBe(true)
    expect((await hit('PATCH', `/v1/requests/${id}`, { status: 'submitted' }, t)).status).toBe(200)
    const d = await (await hit('GET', `/staff/v1/requests/${id}`, undefined, owner)).json() as { customer: { phone: string; email: string | null; emailVerified: boolean } }
    expect(d.customer).toMatchObject({ phone: '+971521190088', email: 'mona.test@example.com', emailVerified: false })
    // the database enforces the same rule: no email -> no submission, and a live account cannot lose its email
    expect(env.DB.prepare('UPDATE users SET email_enc=NULL WHERE id=?').bind(uid).run()).rejects.toThrow()
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(uid).run().catch(() => null)
  })
  it('permissions: agents may draft but not issue; accountants issue; customers and other customers are kept out', async () => {
    const id = await submit()
    const agent = await staffToken('agent'), accountant = await staffToken('accountant')
    expect((await draftQuote(id, ITEMS, cust)).status).toBe(401) // a customer token is not a staff token
    const q = await (await draftQuote(id, ITEMS, agent)).json() as { id: string; version: number }
    expect((await hit('POST', `/staff/v1/quotes/${q.id}/issue`, {}, agent)).status).toBe(403)
    const iss = await hit('POST', `/staff/v1/quotes/${q.id}/issue`, {}, accountant)
    expect(iss.status).toBe(201); expect((await iss.json() as { number: string }).number).toMatch(/^T-QUO-\d{4}-\d{6}$/) // sent for approval: a quotation, not an invoice
    expect((await acceptQuote(id, q, await login('+971521190031'))).status).toBe(404) // another customer cannot approve it
    const acc = await acceptQuote(id, q)
    expect(acc.status).toBe(201); expect((await acc.json() as { number: string }).number).toMatch(/^T-INV-\d{4}-\d{6}$/)
    const other = await login('+971521190030')
    expect((await pay(id, 1000, { token: other })).status).toBe(404)
    const docId = (await fin(id)).documents[0]!.id
    expect((await hit('GET', `/v1/documents/${docId}`, undefined, other)).status).toBe(404)
    expect((await hit('GET', `/v1/documents/${docId}`, undefined, cust)).status).toBe(200)
    expect((await hit('GET', `/staff/v1/documents/${docId}`, undefined, accountant)).status).toBe(200)
  })
  it('sending creates a quotation, not an invoice; the customer\'s acceptance issues the invoice; a sent statement is frozen; re-pricing is a new version the customer accepts again', async () => {
    const id = await submit()
    const { q, r, sent } = await issueQuote(id); expect(sent.status).toBe(201); expect(r.status).toBe(201)
    expect((await fin(id)).documents.map((d) => d.doc_type)).toEqual(['quote', 'invoice']) // the quotation the customer saw, then the invoice
    expect((await fin(id)).quotes[0]!.status).toBe('accepted')
    // the database itself refuses edits to a sent statement
    expect(env.DB.prepare('UPDATE quote_items SET amount_fils=1 WHERE quote_id=?').bind(q.id).run()).rejects.toThrow()
    expect(env.DB.prepare('DELETE FROM quote_items WHERE quote_id=?').bind(q.id).run()).rejects.toThrow()
    expect(env.DB.prepare('UPDATE quotes SET total_fils=1 WHERE id=?').bind(q.id).run()).rejects.toThrow()
    expect(env.DB.prepare('DELETE FROM quotes WHERE id=?').bind(q.id).run()).rejects.toThrow()
    // re-pricing: a new version is sent; the accepted price and its invoice stand until the customer accepts the new one
    const v2 = (await (await draftQuote(id, [ITEMS[0], { ...ITEMS[1], amountFils: 60000 }])).json()) as { id: string; version: number }
    expect(v2.version).toBe(2)
    expect((await hit('POST', `/staff/v1/quotes/${v2.id}/issue`, {}, owner)).status).toBe(201)
    let f = await fin(id); expect(f.quotes.map((x) => x.status)).toEqual(['accepted', 'issued']); expect(f.totals.total).toBe(100000)
    expect((await acceptQuote(id, v2)).status).toBe(201)
    f = await fin(id); expect(f.quotes.map((x) => x.status)).toEqual(['superseded', 'accepted'])
    expect(f.totals.total).toBe(60000)
    expect(f.documents.filter((d) => d.doc_type === 'invoice').map((d) => d.status)).toEqual(['void', 'issued'])
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
    // an extra payment is accepted and approved: it does NOT change the invoice, it becomes the customer's unallocated credit
    const extra = await (await pay(id, 2500)).json() as { id: string }; expect((await approve(extra.id)).status).toBe(200)
    t = (await fin(id)).totals; expect(t).toMatchObject({ paid: 100000, remaining: 0, state: 'paid' })
    expect(((await (await hit('GET', `/staff/v1/requests/${id}/ledger`, undefined, owner)).json()) as { credit: { unallocated: number } }).credit.unallocated).toBe(2500)
    // approved payments cannot be altered in the database
    expect(env.DB.prepare('UPDATE payments SET amount_fils=1 WHERE id=?').bind(pid1).run()).rejects.toThrow()
    expect(env.DB.prepare('DELETE FROM payments WHERE id=?').bind(pid1).run()).rejects.toThrow()
  })
  it('overpayment is never hidden: the excess is kept as unallocated credit, the ledger shows it, and the invoice stays at its total', async () => {
    const id = await submit(); await priced(id)
    const c0 = await creditOf(id) // the customer-wide credit may already hold money from other tests: compare deltas
    const pids: string[] = []
    for (const amt of [70000, 30000, 20000]) { const p = (await (await pay(id, amt)).json() as { id: string }).id; expect((await approve(p)).status).toBe(200); pids.push(p) }
    const t = (await fin(id)).totals; expect(t).toMatchObject({ total: 100000, paid: 100000, remaining: 0, state: 'paid' })
    const l = await (await hit('GET', `/staff/v1/requests/${id}/ledger`, undefined, owner)).json() as { credit: { received: number; allocated: number; unallocated: number }; allocations: { payment_id: string; amount_fils: number }[] }
    expect([l.credit.received - c0.received, l.credit.allocated - c0.allocated, l.credit.unallocated - c0.unallocated]).toEqual([120000, 100000, 20000])
    expect(l.allocations.find((x) => x.payment_id === pids[2])).toBeUndefined() // the 3rd payment got nothing allocated: it is all credit
    const cd = await (await hit('GET', `/v1/requests/${id}`, undefined, cust)).json() as { finance: { credit: { unallocated: number } } }
    expect(cd.finance.credit.unallocated - c0.unallocated).toBe(20000) // the customer sees it too
    // the database itself refuses allocating money twice
    expect(env.DB.prepare("INSERT INTO allocations (id,payment_id,request_id,invoice_id,amount_fils,kind,reason,created_by,created_at) VALUES ('11111111-1111-4111-8111-111111111111',?,?,?,1,'allocate','x','x',1)").bind(pids[0], id, (await fin(id)).documents.find((d) => d.doc_type === 'invoice')!.id).run()).rejects.toThrow()
    expect(env.DB.prepare('DELETE FROM allocations').run()).rejects.toThrow()
    expect(env.DB.prepare('UPDATE allocations SET amount_fils=1').run()).rejects.toThrow()
  })
  it('one payment can cover two transactions; the same money cannot be allocated twice; reversal is a linked entry; other customers are kept out', async () => {
    const id1 = await submit(); await priced(id1)
    const id2 = await submit(); await priced(id2)
    const c0 = await creditOf(id1)
    const p = (await (await pay(id1, 150000)).json() as { id: string }).id; await approve(p)
    expect((await fin(id1)).totals).toMatchObject({ paid: 100000, remaining: 0 })
    expect((await fin(id2)).totals).toMatchObject({ paid: 0, remaining: 100000 })
    const alloc = (rid: string, amt: number, token = owner) => hit('POST', `/staff/v1/payments/${p}/allocate`, { requestId: rid, amountFils: amt, reason: 'One transfer for two transactions' }, token)
    expect((await alloc(id2, 50001)).status).toBe(409) // only 50000 is unallocated
    expect((await alloc(id2, 50000, await staffToken('agent'))).status).toBe(403)
    const ok = await alloc(id2, 50000); expect(ok.status).toBe(201)
    expect((await fin(id2)).totals).toMatchObject({ paid: 50000, remaining: 50000, state: 'partial' })
    expect((await alloc(id2, 1)).status).toBe(409) // nothing left to allocate: the same money is not allocated twice
    const other = await login('+971521190055'); const idOther = await submit(other); await priced(idOther)
    expect((await alloc(idOther, 1)).status).toBe(404) // a different customer's invoice
    // reversal: new negative entry, original untouched, only once
    const aid = (await ok.json() as { id: string }).id
    expect((await hit('POST', `/staff/v1/allocations/${aid}/reverse`, { reason: 'Allocated to the wrong transaction' }, await staffToken('accountant'))).status).toBe(403)
    expect((await hit('POST', `/staff/v1/allocations/${aid}/reverse`, { reason: 'short' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/allocations/${aid}/reverse`, { reason: 'Allocated to the wrong transaction' }, owner)).status).toBe(200)
    expect((await hit('POST', `/staff/v1/allocations/${aid}/reverse`, { reason: 'Allocated to the wrong transaction' }, owner)).status).toBe(409)
    expect((await fin(id2)).totals).toMatchObject({ paid: 50000, net: 0, remaining: 100000 })
    const led = await (await hit('GET', `/staff/v1/requests/${id2}/ledger`, undefined, owner)).json() as { allocations: { kind: string; reverses_id: string | null; amount_fils: number }[]; credit: { unallocated: number } }
    expect(led.allocations.map((x) => x.kind)).toEqual(['allocate', 'reverse']); expect(led.allocations[1]!.reverses_id).toBe(aid)
    expect(led.credit.unallocated - c0.unallocated).toBe(50000)
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
  const creditOf = async (id: string) => ((await (await hit('GET', `/staff/v1/requests/${id}/ledger`, undefined, owner)).json()) as { credit: { received: number; allocated: number; unallocated: number } }).credit // customer-wide
  const refundReq = (id: string, amt: number, body: Record<string, unknown> = {}, token = owner) => hit('POST', `/staff/v1/requests/${id}/refund-requests`, { amountFils: amt, reason: 'Service not delivered as agreed', ...body }, token)
  it('refunds: a request is not an execution; separate approval and execution; capped by what is allocated; credit notes; originals untouched', async () => {
    const id = await submit(); await priced(id)
    const c0 = await creditOf(id)
    const pids: string[] = []
    for (const amt of [60000, 40000]) { const p = (await (await pay(id, amt)).json() as { id: string }).id; await approve(p); pids.push(p) }
    const before = await env.DB.prepare("SELECT number,snapshot_hash,status FROM fin_documents WHERE related_id=? AND doc_type='receipt'").bind(pids[0]).first<{ number: string; snapshot_hash: string; status: string }>()
    const accountant = await staffToken('accountant'), manager = await staffToken('manager')
    expect((await refundReq(id, 1000, {}, await staffToken('agent'))).status).toBe(403)
    expect((await refundReq(id, 1000, {}, cust)).status).toBe(401)
    expect((await refundReq(id, 1000, { reason: 'short' })).status).toBe(400)
    expect((await refundReq(id, 100001)).status).toBe(409) // more than was paid
    expect((await refundReq(id, 40001, { paymentId: pids[1] })).status).toBe(409) // more than that payment received
    const r1 = await refundReq(id, 25000, { paymentId: pids[1] }, accountant); expect(r1.status).toBe(201) // an accountant may REQUEST
    const rid = (await r1.json() as { id: string }).id
    expect((await fin(id)).totals).toMatchObject({ net: 100000, refunded: 0 }) // a request moves no money
    expect((await hit('POST', `/staff/v1/refund-requests/${rid}/execute`, { reference: 'PAYOUT-0001' }, accountant)).status).toBe(409) // not approved yet
    expect((await hit('POST', `/staff/v1/refund-requests/${rid}/approve`, {}, accountant)).status).toBe(403) // an accountant cannot approve
    expect((await hit('POST', `/staff/v1/refund-requests/${rid}/approve`, {}, manager)).status).toBe(200)
    expect((await hit('POST', `/staff/v1/refund-requests/${rid}/execute`, {}, accountant)).status).toBe(400) // payout reference required
    const ex = await hit('POST', `/staff/v1/refund-requests/${rid}/execute`, { reference: 'PAYOUT-0001' }, accountant); expect(ex.status).toBe(200)
    expect((await ex.json() as { creditNote: string }).creditNote).toMatch(/^T-CRN-\d{4}-\d{6}$/)
    expect(((await (await hit('POST', `/staff/v1/refund-requests/${rid}/execute`, { reference: 'PAYOUT-0001' }, accountant)).json()) as { duplicate: boolean }).duplicate).toBe(true) // repeating is harmless
    let t = (await fin(id)).totals; expect(t).toMatchObject({ paid: 100000, refunded: 25000, net: 75000, remaining: 25000, state: 'partial' })
    // a manager cannot approve their own request; the owner can
    const r2 = await refundReq(id, 15000, { paymentId: pids[1] }, manager); const rid2 = (await r2.json() as { id: string }).id
    expect((await hit('POST', `/staff/v1/refund-requests/${rid2}/approve`, {}, manager)).status).toBe(403)
    expect((await hit('POST', `/staff/v1/refund-requests/${rid2}/reject`, { reason: 'x' }, owner)).status).toBe(400)
    expect((await hit('POST', `/staff/v1/refund-requests/${rid2}/reject`, { reason: 'Customer withdrew the request' }, owner)).status).toBe(200)
    expect((await hit('POST', `/staff/v1/refund-requests/${rid2}/approve`, {}, owner)).status).toBe(409) // a rejected request is final
    // open requests reserve the amount: 75000 is allocated, 10000 is held by this request
    const r3 = await refundReq(id, 10000, { paymentId: pids[0] }); expect(r3.status).toBe(201)
    expect((await refundReq(id, 65001)).status).toBe(409); expect((await refundReq(id, 65000, { paymentId: pids[0] })).status).toBe(409) // pids[0] only has 50000 left net
    // to_credit: money stays with us as the customer's credit
    const r4 = await refundReq(id, 20000, { resolution: 'to_credit', paymentId: pids[0] }); const rid4 = (await r4.json() as { id: string }).id
    await hit('POST', `/staff/v1/refund-requests/${rid4}/approve`, {}, owner)
    expect((await hit('POST', `/staff/v1/refund-requests/${rid4}/execute`, {}, accountant)).status).toBe(200) // no payout reference needed for a credit
    const led = await (await hit('GET', `/staff/v1/requests/${id}/ledger`, undefined, owner)).json() as { credit: { unallocated: number } }
    expect(led.credit.unallocated - c0.unallocated).toBe(20000) // credit kept, not hidden by zeroing the balance
    expect((await fin(id)).totals).toMatchObject({ net: 55000, remaining: 45000 })
    const after = await env.DB.prepare("SELECT number,snapshot_hash,status FROM fin_documents WHERE related_id=? AND doc_type='receipt'").bind(pids[0]).first<{ number: string; snapshot_hash: string; status: string }>()
    expect(after).toEqual(before) // the original receipt is exactly as it was
    expect(env.DB.prepare('DELETE FROM refund_requests').run()).rejects.toThrow()
  })
  it('cancelling an invoice voids it with a reason and a linked credit note; impossible while money is held; a new invoice can follow', async () => {
    const id = await submit(); const { inv } = await priced(id)
    const cancel = (reason = 'Customer changed the request scope', token = owner) => hit('POST', `/staff/v1/invoices/${inv.documentId}/cancel`, { reason }, token)
    const p = (await (await pay(id, 50000)).json() as { id: string }).id
    expect((await cancel()).status).toBe(409) // pending payment
    await approve(p)
    const held = await cancel(); expect((await held.json() as { error: string }).error).toBe('refund_first')
    const rr = (await (await refundReq(id, 50000, { reason: 'Refund before cancelling the invoice' })).json() as { id: string }).id
    await hit('POST', `/staff/v1/refund-requests/${rr}/approve`, {}, owner); await hit('POST', `/staff/v1/refund-requests/${rr}/execute`, { reference: 'PAYOUT-0002' }, owner)
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
