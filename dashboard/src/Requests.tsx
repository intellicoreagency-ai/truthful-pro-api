import { useEffect, useState } from 'react'
import { api, type ListItem, type Status } from './api'
import { STATUS_LABEL, useI18n } from './i18n'
import { Badge, NEXT, ago, shortId, useAsync } from './ui'

const COLUMNS: Status[] = ['submitted', 'review', 'needs_documents', 'ready_for_authority', 'authority', 'decision', 'completed']

export function Requests({ params, go }: { params: URLSearchParams; go: (hash: string) => void }) {
  const { t, lang, fmt } = useI18n()
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [assignee, setAssignee] = useState(params.get('assignee') ?? '')
  const [q, setQ] = useState(params.get('q') ?? '')
  const [dq, setDq] = useState(params.get('q') ?? '')
  const [view, setView] = useState<'list' | 'board'>(() => { try { return (localStorage.getItem('tp.view') as 'list' | 'board') || 'list' } catch { return 'list' } })
  useEffect(() => { setStatus(params.get('status') ?? ''); setAssignee(params.get('assignee') ?? ''); setQ(params.get('q') ?? ''); setDq(params.get('q') ?? '') }, [params])
  useEffect(() => { const h = setTimeout(() => setDq(q), 300); return () => clearTimeout(h) }, [q])
  const pick = (v: 'list' | 'board') => { setView(v); try { localStorage.setItem('tp.view', v) } catch { /* */ } }
  const { data, loading, error, reload } = useAsync(() => api.requests({ status: view === 'board' ? '' : status, assignee, q: dq }), [status, assignee, dq, view])
  const [err, setErr] = useState(false)
  const statuses: Status[] = ['submitted', 'review', 'needs_documents', 'ready_for_authority', 'authority', 'decision', 'completed', 'rejected', 'cancelled']
  const move = async (r: ListItem, to: Status) => {
    setErr(false)
    const reference = to === 'authority' ? window.prompt(t('refNeeded'))?.trim() : undefined
    if (to === 'authority' && !reference) return
    try { await api.setStatus(r.id, to, { reference }); reload() } catch { setErr(true); reload() }
  }

  const card = (r: ListItem) => {
    const next = NEXT[r.status]
    return (
      <div key={r.id} className="kcard">
        <button className="kmain" onClick={() => go(`#/requests/${r.id}`)}>
          <b>{r.title?.[lang] ?? r.serviceId}</b>
          <span className="muted small">{r.customer.name || '—'} · #{shortId(r.id)}</span>
          <span className="muted small">{ago(r.updatedAt, lang)}{r.assignee ? ` · ${r.assignee.name}` : ''}</span>
          {r.work && <span className="small" style={r.work.overdue ? { color: 'var(--bad)' } : undefined}>→ {r.work.next[lang]}{r.work.overdue ? ' ⏰' : ''}</span>}
        </button>
        {next && <button className="btn sm" title={t('moveTo')} onClick={() => move(r, next)}>{lang === 'ar' ? '←' : '→'} {STATUS_LABEL[next][lang]}</button>}
      </div>
    )
  }
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{t('requests')}</h1>
        <div className="seg" role="group">
          <button aria-pressed={view === 'list'} onClick={() => pick('list')}>{t('list')}</button>
          <button aria-pressed={view === 'board'} onClick={() => pick('board')}>{t('board')}</button>
        </div>
      </div>
      <div className="filters">
        <input type="search" placeholder={t('search')} aria-label={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        {view === 'list' && (
          <select aria-label={t('statusF')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('statusF')}: {t('all')}</option>
            {statuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s][lang]}</option>)}
          </select>
        )}
        <select aria-label={t('assigneeF')} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">{t('assigneeF')}: {t('all')}</option>
          <option value="me">{t('mine')}</option>
          <option value="unassigned">{t('unassigned')}</option>
        </select>
      </div>
      {err && <div className="msg">{t('invalidTransition')}</div>}
      {error ? <div className="msg">{t('failed')}</div> : loading && !data ? <p className="muted">{t('loading')}</p> : !data?.length ? <div className="empty">{t('empty')}</div> : view === 'board' ? (
        <div className="board">
          {COLUMNS.map((col) => {
            const items = data.filter((r) => r.status === col)
            return (
              <section key={col} className="col" aria-label={STATUS_LABEL[col][lang]}>
                <header><Badge status={col} /><span className="tag">{items.length}</span></header>
                {items.map(card)}
              </section>
            )
          })}
        </div>
      ) : (
        <div className="list">
          {data.map((r) => (
            <button key={r.id} className="item" onClick={() => go(`#/requests/${r.id}`)}>
              <span className="title">{r.title?.[lang] ?? r.serviceId}</span>
              <Badge status={r.status} />
              <span className="meta">
                <span>{r.customer.name || '—'}</span><span dir="ltr">{r.customer.phone}</span>
                <span>#{shortId(r.id)}</span><span>{fmt(r.updatedAt)}</span>
                <span>{t('assignedTo')}: {r.assignee?.name ?? t('none')}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
