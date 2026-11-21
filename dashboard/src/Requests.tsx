import { useEffect, useState } from 'react'
import { api, type ListItem, type Role, type Status } from './api'
import { Board } from './kanban/Board'
import { STATUS_LABEL, useI18n } from './i18n'
import { Badge, shortId, useAsync } from './ui'

export function Requests({ params, go, role }: { params: URLSearchParams; go: (hash: string) => void; role: Role }) {
  const { t, lang, fmt } = useI18n()
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [assignee, setAssignee] = useState(params.get('assignee') ?? '')
  const [q, setQ] = useState(params.get('q') ?? '')
  const [dq, setDq] = useState(params.get('q') ?? '')
  const [view, setView] = useState<'list' | 'board'>(() => { try { return (localStorage.getItem('tp.view') as 'list' | 'board') || 'list' } catch { return 'list' } })
  useEffect(() => { setStatus(params.get('status') ?? ''); setAssignee(params.get('assignee') ?? ''); setQ(params.get('q') ?? ''); setDq(params.get('q') ?? '') }, [params])
  useEffect(() => { const h = setTimeout(() => setDq(q), 300); return () => clearTimeout(h) }, [q])
  const pick = (v: 'list' | 'board') => { setView(v); try { localStorage.setItem('tp.view', v) } catch { /* */ } }
  const { data, loading, error } = useAsync(() => (view === 'board' ? Promise.resolve([] as ListItem[]) : api.requests({ status, assignee, q: dq })), [status, assignee, dq, view])
  const statuses: Status[] = ['submitted', 'review', 'needs_documents', 'ready_for_authority', 'authority', 'decision', 'completed', 'rejected', 'cancelled']
  if (view === 'board') return <Board role={role} initialQ={q} initialAssignee={assignee} onList={() => pick('list')} />
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{t('requests')}</h1>
        <div className="seg" role="group">
          <button aria-pressed onClick={() => pick('list')}>{t('list')}</button>
          <button aria-pressed={false} onClick={() => pick('board')}>{t('board')}</button>
        </div>
      </div>
      <div className="filters">
        <input type="search" placeholder={t('search')} aria-label={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label={t('statusF')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('statusF')}: {t('all')}</option>
          {statuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s][lang]}</option>)}
        </select>
        <select aria-label={t('assigneeF')} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">{t('assigneeF')}: {t('all')}</option>
          <option value="me">{t('mine')}</option>
          <option value="unassigned">{t('unassigned')}</option>
        </select>
      </div>
      {error ? <div className="msg">{t('failed')}</div> : loading && !data ? <p className="muted">{t('loading')}</p> : !data?.length ? <div className="empty">{t('empty')}</div> : (
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
