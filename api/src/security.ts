import type { Context, MiddlewareHandler } from 'hono'
import type { Env, Vars } from './types'
import { hmacHex, newId, sha256Hex } from './crypto'

export type C = Context<{ Bindings: Env; Variables: Vars }>

export const clientIp = (c: C) => c.req.header('cf-connecting-ip') ?? 'unknown'

export const ipHash = (c: C) => hmacHex(c.env.PEPPER, `ip:${clientIp(c)}`)

export async function audit(c: C, action: string, userId: string | null, detail?: Record<string, unknown>) {
  try {
    await c.env.DB.prepare('INSERT INTO audit_events (id,user_id,action,detail,ip_hash,created_at) VALUES (?,?,?,?,?,?)')
      .bind(newId(), userId, action, detail ? JSON.stringify(detail).slice(0, 500) : null, await ipHash(c), Date.now()).run()
  } catch { /* audit must never break the request */ }
}

/** Fixed-window limiter in D1. Returns true when the call is allowed. */
export async function allow(env: Env, key: string, limit: number, windowSec: number): Promise<boolean> {
  const window = Math.floor(Date.now() / 1000 / windowSec)
  const k = await sha256Hex(key)
  const row = await env.DB.prepare(
    'INSERT INTO rate_limits (key,window,count) VALUES (?,?,1) ON CONFLICT(key,window) DO UPDATE SET count=count+1 RETURNING count'
  ).bind(k, window).first<{ count: number }>()
  if (Math.random() < 0.01) await env.DB.prepare('DELETE FROM rate_limits WHERE window < ?').bind(window - 2).run()
  return (row?.count ?? 1) <= limit
}

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  c.header('X-Content-Type-Options', 'nosniff')
  if (!c.res.headers.has('x-frame-options')) c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'no-referrer')
  c.header('Cache-Control', 'no-store')
  if (!c.res.headers.has('content-security-policy')) c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
}

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Vars }> = async (c, next) => {
  const h = c.req.header('authorization') ?? ''
  const m = /^Bearer ([A-Za-z0-9_-]{40,64})$/.exec(h)
  if (!m) return c.json({ error: 'unauthorized' }, 401)
  const hash = await sha256Hex(m[1] as string)
  const s = await c.env.DB.prepare(
    'SELECT s.id, s.user_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.access_hash=? AND s.revoked_at IS NULL AND s.access_expires_at>? AND u.deleted_at IS NULL'
  ).bind(hash, Date.now()).first<{ id: string; user_id: string }>()
  if (!s) return c.json({ error: 'unauthorized' }, 401)
  c.set('userId', s.user_id)
  c.set('sessionId', s.id)
  await next()
}

export async function jsonBody(c: C, max = 32 * 1024): Promise<Record<string, unknown> | null> {
  const len = Number(c.req.header('content-length') ?? '0')
  if (len > max) return null
  if (!(c.req.header('content-type') ?? '').toLowerCase().startsWith('application/json')) return null
  const text = await c.req.text()
  if (text.length > max) return null
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch { return null }
}
