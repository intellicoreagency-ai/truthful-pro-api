import { vi } from 'vitest'
import type { Detail, Finance, Status } from '../src/api'

/** One recorded call to the fake server. */
export type Call = { method: string; path: string; body: any }
type Handler = (c: Call) => { status?: number; json?: unknown } | undefined

/** Installs a fake `fetch`: each request is recorded; `routes` answer by "METHOD /path" (exact) or a function. Unknown routes answer {ok:true}. */
export function fakeServer(routes: Record<string, unknown | Handler>) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase(), path = String(url)
    let body: any = undefined
    try { body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body } catch { body = init.body }
    const call = { method, path, body }; calls.push(call)
    const r = routes[`${method} ${path}`] ?? routes[`${method} ${path.split('?')[0]}`]
    const out = typeof r === 'function' ? (r as Handler)(call) : r === undefined ? undefined : { json: r }
    const status = out?.status ?? 200
    return new Response(JSON.stringify(out?.json ?? { ok: true }), { status, headers: { 'content-type': 'application/json' } })
  }))
  return { calls, posts: (suffix: string) => calls.filter((c) => c.method !== 'GET' && c.path.endsWith(suffix)) }
}

export const RID = '11111111-2222-4333-8444-555555555555'
export function detail(over: Partial<Detail['request']> = {}, extra: Partial<Detail> = {}): Detail {
  const status: Status = (over.status as Status) ?? 'submitted'
  return {
    work: { waitingOn: 'staff', next: { code: 'assign', ar: 'عيّن موظفاً', en: 'Assign an owner', role: 'manager' }, followUpAt: null, overdue: false, payment: { company: 'unpriced', government: 'none' }, delivery: { state: 'none', version: 0 } } as Detail['work'],
    log: [], submissions: [], problems: [],
    request: { id: RID, serviceId: 'emirates-id', status, assigneeId: null, createdAt: 1, updatedAt: 1, version: 3, deliveryVersion: 0, acknowledgedVersion: 0, acknowledgedAt: null, data: { title: { ar: 'تجديد الهوية', en: 'Renew Emirates ID' }, name: 'منى' }, staff: {}, ...over },
    customer: { id: 'c1', name: 'منى العلي', phone: '+971529990011' },
    files: [], deliveries: [], checks: [], blocked: [], events: [], missing: [],
    transitions: status === 'submitted' ? ['review', 'cancelled'] : status === 'review' ? ['needs_documents', 'ready_for_authority', 'rejected', 'cancelled'] : [],
    ...extra,
  }
}
export function finance(over: Partial<Finance> = {}): Finance {
  return {
    credit: { received: 0, allocated: 0, refundedOut: 0, unallocated: 0 }, refundRequests: [], gov: { total: 0, payUrl: null, verified: 0, reported: 0, remaining: 0, state: 'none' }, authorityPayments: [],
    quotes: [], payments: [], documents: [], totals: { total: 0, paid: 0, refunded: 0, net: 0, pending: 0, remaining: 0, state: 'unpriced', invoice: null }, tax: { configured: false }, test: true, ...over,
  }
}
