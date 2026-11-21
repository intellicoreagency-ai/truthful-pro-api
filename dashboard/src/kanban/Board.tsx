import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { ApiError, api, type ListItem, type Role, type Status } from '../api'
import { STATUS_LABEL, useI18n } from '../i18n'
import { ago, shortId } from '../ui'
import { ACTIVE, CLOSED, COLS, colOf, dropFor, errorKey, initials, useS, type ColId } from './model'
import { Drawer } from './Drawer'
import { Icon } from './Icon'
import './kanban.css'

type Grab = { item: ListItem; pid: number; x0: number; y0: number; dx: number; dy: number; w: number; started: boolean }
type Toast = { ok: boolean; text: string; n: number }

/** Linear-style board: four columns, pointer drag-and-drop between them, and a side drawer per request. */
export function Board({ role, initialQ, initialAssignee, onList }: { role: Role; initialQ: string; initialAssignee: string; onList: () => void }) {
  const { lang } = useI18n()
  const s = useS(lang)
  const [items, setItems] = useState<ListItem[] | null>(null)
  const [loadErr, setLoadErr] = useState(false)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState(initialQ)
  const [dq, setDq] = useState(initialQ)
  const [assignee, setAssignee] = useState(initialAssignee)
  const [showClosed, setShowClosed] = useState(false)
  const [drawer, setDrawer] = useState<{ id: string; intent?: 'missing' } | null>(null)
  const [dragging, setDragging] = useState<{ item: ListItem; w: number } | null>(null)
  const [over, setOver] = useState<ColId | null>(null)
  const [landed, setLanded] = useState<string | null>(null)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<Toast | null>(null)

  const grab = useRef<Grab | null>(null)
  const pos = useRef({ x: 0, y: 0 })
  const ghost = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const overRef = useRef<ColId | null>(null)
  const suppressClick = useRef(false)
  const seq = useRef(0)

  useEffect(() => { const h = setTimeout(() => setDq(q), 250); return () => clearTimeout(h) }, [q])

  /** One request per status keeps every active column complete even when Completed grows large. */
  const refresh = useCallback(async () => {
    const n = ++seq.current
    setLoading(true)
    try {
      const sts: Status[] = [...ACTIVE, 'completed', ...(showClosed ? CLOSED : [])]
      const lists = await Promise.all(sts.map((st) => api.requests({ status: st, assignee, q: dq, limit: ACTIVE.includes(st) ? 100 : 40 })))
      if (n === seq.current) { setItems(lists.flat()); setLoadErr(false) }
    } catch { if (n === seq.current) setLoadErr(true) } finally { if (n === seq.current) setLoading(false) }
  }, [assignee, dq, showClosed])
  useEffect(() => { void refresh() }, [refresh])

  // Keep the board live: refresh every 30 s and when the tab regains focus, but never mid-drag or mid-save.
  const idle = useRef(true)
  idle.current = !dragging && saving.size === 0
  useEffect(() => {
    const tick = () => { if (idle.current && document.visibilityState === 'visible') void refresh() }
    const h = window.setInterval(tick, 30000)
    window.addEventListener('focus', tick)
    return () => { window.clearInterval(h); window.removeEventListener('focus', tick) }
  }, [refresh])

  useEffect(() => { if (!toast) return; const h = setTimeout(() => setToast(null), 4200); return () => clearTimeout(h) }, [toast])
  useEffect(() => { if (!landed) return; const h = setTimeout(() => setLanded(null), 700); return () => clearTimeout(h) }, [landed])
  const say = (ok: boolean, text: string) => setToast({ ok, text, n: Date.now() })

  const columns = useMemo(() => {
    const by: Record<ColId, ListItem[]> = { new: [], progress: [], pending: [], done: [] }
    for (const r of items ?? []) { const c = colOf(r.status); if (c) by[c].push(r) }
    for (const k of Object.keys(by) as ColId[]) by[k].sort((a, b) => b.updatedAt - a.updatedAt)
    return by
  }, [items])

  // ---------- moves ----------
  const commit = async (item: ListItem, to: Status) => {
    setItems((xs) => xs?.map((x) => (x.id === item.id ? { ...x, status: to, updatedAt: Date.now() } : x)) ?? xs)
    setLanded(item.id)
    setSaving((v) => new Set(v).add(item.id))
    try {
      await api.setStatus(item.id, to, {})
      say(true, `${s('moved')} ${STATUS_LABEL[to][lang]}`)
      void refresh()
    } catch (e) {
      setItems((xs) => xs?.map((x) => (x.id === item.id ? item : x)) ?? xs) // roll back
      const code = e instanceof ApiError ? e.code : undefined
      say(false, code ? s(errorKey(code)) : s('failed'))
      if (code === 'payment_required') setDrawer({ id: item.id })
    } finally { setSaving((v) => { const n = new Set(v); n.delete(item.id); return n }) }
  }

  const drop = (item: ListItem, col: ColId) => {
    const d = dropFor(item.status, col)
    if (!d) { if (colOf(item.status) !== col) say(false, s('cantMove')); return }
    if (d.kind === 'missing') { setDrawer({ id: item.id, intent: 'missing' }); return }
    void commit(item, d.to)
  }

  // ---------- pointer drag-and-drop (mouse and pen; touch opens the drawer instead) ----------
  const colAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-col]') as HTMLElement | null)?.dataset.col as ColId | undefined
  const placeGhost = () => {
    const g = grab.current, el = ghost.current
    if (g && el) el.style.transform = `translate3d(${pos.current.x - g.dx}px, ${pos.current.y - g.dy}px, 0) rotate(2deg)`
  }
  useLayoutEffect(placeGhost, [dragging])

  const onMove = (e: PointerEvent) => {
    const g = grab.current
    if (!g || e.pointerId !== g.pid) return
    pos.current = { x: e.clientX, y: e.clientY }
    if (!g.started) {
      if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 5) return
      g.started = true
      document.body.classList.add('kb-grabbing')
      setDragging({ item: g.item, w: g.w })
    }
    placeGhost()
    const c = colAt(e.clientX, e.clientY) ?? null
    if (c !== overRef.current) { overRef.current = c; setOver(c) }
    const b = boardRef.current // nudge horizontal scroll near the edges on narrow screens
    if (b) { const r = b.getBoundingClientRect(); if (e.clientX < r.left + 48) b.scrollLeft -= 14; else if (e.clientX > r.right - 48) b.scrollLeft += 14 }
  }
  const end = (e: PointerEvent | KeyboardEvent, cancelled: boolean) => {
    const g = grab.current
    if (!g || ('pointerId' in e && e.pointerId !== g.pid)) return
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey)
    grab.current = null
    document.body.classList.remove('kb-grabbing')
    if (!g.started) return
    suppressClick.current = true
    window.setTimeout(() => { suppressClick.current = false }, 0)
    const col = overRef.current
    overRef.current = null
    setOver(null); setDragging(null)
    if (!cancelled && col) drop(g.item, col)
  }
  const onUp = (e: PointerEvent) => end(e, false)
  const onCancel = (e: PointerEvent) => end(e, true)
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') end(e, true) }

  const onDown = (e: RPointerEvent<HTMLElement>, item: ListItem) => {
    if (e.button !== 0 || e.pointerType === 'touch' || saving.has(item.id)) return
    const r = e.currentTarget.getBoundingClientRect()
    grab.current = { item, pid: e.pointerId, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, started: false }
    pos.current = { x: e.clientX, y: e.clientY }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
  }

  const zone = (col: ColId): 'ok' | 'no' | 'self' | undefined => {
    if (!dragging) return undefined
    if (colOf(dragging.item.status) === col) return 'self'
    return dropFor(dragging.item.status, col) ? 'ok' : 'no'
  }

  const total = items?.length ?? 0
  return (
    <div className="kb" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="kb-toolbar">
        <div className="kb-titlebox">
          <h1>{s('board')}</h1>
          <span className="kb-count">{total}</span>
        </div>
        <label className="kb-search">
          <Icon name="search" />
          <input type="search" placeholder={s('search')} aria-label={s('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="kb-seg" role="group" aria-label={s('assignee')}>
          {([['', s('everyone')], ['me', s('mine')], ['unassigned', s('unassigned')]] as const).map(([v, label]) => (
            <button key={v} aria-pressed={assignee === v} onClick={() => setAssignee(v)}>{label}</button>
          ))}
        </div>
        <label className="kb-check"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> {s('closed')}</label>
        <span className="kb-grow" />
        <button className={`kb-iconbtn ${loading ? 'spin' : ''}`} onClick={() => void refresh()} aria-label={s('refresh')} title={s('refresh')}><Icon name="refresh" /></button>
        <div className="kb-seg" role="group">
          <button aria-pressed={false} onClick={onList}>{s('list')}</button>
          <button aria-pressed={true}>{s('kanban')}</button>
        </div>
      </div>
      <p className="kb-hint">{s('shortcuts')}</p>

      {loadErr && !items ? (
        <div className="kb-alert"><Icon name="alert" /> {s('loadFail')} <button className="kb-link" onClick={() => void refresh()}>{s('retry')}</button></div>
      ) : (
        <div className="kb-board" ref={boardRef}>
          {COLS.map(({ id }) => {
            const list = columns[id]
            const z = zone(id)
            return (
              <section key={id} data-col={id} className={`kb-col c-${id} ${z ? `z-${z}` : ''} ${over === id ? 'over' : ''}`} aria-labelledby={`kb-h-${id}`}>
                <header className="kb-colhead">
                  <span className={`kb-coldot c-${id}`} aria-hidden="true" />
                  <h2 id={`kb-h-${id}`}>{s(id)}</h2>
                  <span className="kb-count">{items ? list.length : '–'}</span>
                  <span className="kb-colhint">{s(`${id}Hint`)}</span>
                </header>
                <div className="kb-cards">
                  {!items && [0, 1, 2].map((i) => <div key={i} className="kb-card skel" aria-hidden="true"><span /><span /><span /></div>)}
                  {items && !list.length && !dragging && <div className="kb-empty">{s('empty')}</div>}
                  {list.map((r) => (
                    <Card key={r.id} r={r} col={id} lang={lang} s={s}
                      ghosted={dragging?.item.id === r.id} landed={landed === r.id} saving={saving.has(r.id)}
                      onDown={onDown} onOpen={() => { if (!suppressClick.current) setDrawer({ id: r.id }) }} />
                  ))}
                  {dragging && z === 'ok' && <div className="kb-dropslot">{s('dropHere')}</div>}
                  {dragging && z === 'no' && <div className="kb-dropslot no">{s('notAllowed')}</div>}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {dragging && (
        <div ref={ghost} className="kb-ghost" style={{ width: dragging.w }} aria-hidden="true">
          <CardBody r={dragging.item} col={colOf(dragging.item.status) ?? 'new'} lang={lang} s={s} />
        </div>
      )}

      {drawer && (
        <Drawer key={drawer.id + (drawer.intent ?? '')} id={drawer.id} role={role} intent={drawer.intent}
          onClose={() => setDrawer(null)}
          onChanged={(id, st) => { setItems((xs) => xs?.map((x) => (x.id === id ? { ...x, status: st, updatedAt: Date.now() } : x)) ?? xs); setLanded(id); void refresh() }} />
      )}

      <div className="kb-toastwrap" aria-live="polite">
        {toast && <div key={toast.n} className={`kb-toast ${toast.ok ? 'ok' : 'bad'}`} role={toast.ok ? 'status' : 'alert'}><Icon name={toast.ok ? 'check' : 'alert'} />{toast.text}</div>}
      </div>
    </div>
  )
}

type S = ReturnType<typeof useS>
function Card({ r, col, lang, s, ghosted, landed, saving, onDown, onOpen }: {
  r: ListItem; col: ColId; lang: 'ar' | 'en'; s: S; ghosted: boolean; landed: boolean; saving: boolean
  onDown: (e: RPointerEvent<HTMLElement>, r: ListItem) => void; onOpen: () => void
}) {
  return (
    <button type="button" className={`kb-card ${ghosted ? 'ghosted' : ''} ${landed ? 'landed' : ''} ${saving ? 'saving' : ''}`}
      onPointerDown={(e) => onDown(e, r)} onClick={onOpen}
      aria-label={`${r.title?.[lang] ?? r.serviceId}, ${r.customer.name || '—'}, ${STATUS_LABEL[r.status][lang]}`}>
      <CardBody r={r} col={col} lang={lang} s={s} />
    </button>
  )
}

function CardBody({ r, col, lang, s }: { r: ListItem; col: ColId; lang: 'ar' | 'en'; s: S }) {
  const stage = col === 'progress' || (col === 'done' && r.status !== 'completed')
  return (
    <>
      <span className="kb-cardtop">
        <span className="kb-id" dir="ltr">#{shortId(r.id)}</span>
        {stage && <span className={`kb-pill sm s-${r.status}`}><i />{STATUS_LABEL[r.status][lang]}</span>}
        {r.work?.overdue && <span className="kb-late"><Icon name="clock" size={12} />{s('overdue')}</span>}
      </span>
      <span className="kb-cardtitle">{r.title?.[lang] ?? r.serviceId}</span>
      <span className="kb-cardclient"><bdi>{r.customer.name || '—'}</bdi><span dir="ltr" className="kb-mono">{r.customer.phone}</span></span>
      {r.work?.next && col !== 'done' && <span className="kb-cardnext"><Icon name="arrow" size={12} />{r.work.next[lang]}</span>}
      <span className="kb-cardfoot">
        <span className={`kb-avatar ${r.assignee ? '' : 'none'}`} title={r.assignee?.name ?? s('unassignedShort')}>{r.assignee ? initials(r.assignee.name) : ''}</span>
        <span className="kb-muted">{r.assignee?.name ?? s('unassignedShort')}</span>
        <span className="kb-grow" />
        <time className="kb-muted">{ago(r.updatedAt, lang)}</time>
      </span>
    </>
  )
}
