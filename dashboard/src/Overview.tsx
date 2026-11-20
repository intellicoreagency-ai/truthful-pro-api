import { api, type Status } from './api'
import { STATUS_LABEL, useI18n } from './i18n'
import { Badge, Card, ago, shortId, useAsync } from './ui'

const ORDER: Status[] = ['submitted', 'review', 'needs_documents', 'authority', 'decision', 'completed']

export function Overview({ go, name }: { go: (hash: string) => void; name: string }) {
  const { t, lang } = useI18n()
  const stats = useAsync(() => api.stats(), [])
  const ov = useAsync(() => api.overview(), [])
  const d = stats.data, o = ov.data
  if ((stats.loading && !d) || (ov.loading && !o)) return <p className="muted">{t('loading')}</p>
  if (!d || !o) return <div className="msg">{t('failed')}</div>
  return (
    <>
      <h1>{t('hello')} {name} 👋</h1>
      <div className="grid stats" style={{ marginTop: 16 }}>
        <button className="stat hot" onClick={() => go('#/requests?assignee=unassigned')}><b>{d.unassigned}</b><span>{t('unassigned')}</span></button>
        <button className="stat hot" onClick={() => go('#/requests?assignee=me')}><b>{d.mine}</b><span>{t('mine2')}</span></button>
        <div className="stat plain"><b>{o.newToday}</b><span>{t('newToday')}</span></div>
        <div className="stat plain"><b>{o.open}</b><span>{t('openNow')}</span></div>
        <div className="stat plain good"><b>{o.completedToday}</b><span>{t('doneToday')}</span></div>
      </div>
      <div className="grid stats" style={{ marginTop: 14 }}>
        {ORDER.map((s) => (
          <button key={s} className="stat" onClick={() => go(`#/requests?status=${s}`)}><b>{d.byStatus[s] ?? 0}</b><span>{STATUS_LABEL[s][lang]}</span></button>
        ))}
      </div>
      <div className="two" style={{ marginTop: 18 }}>
        <Card title={`${t('attention')} · ${t('attentionHint')}`}>
          {o.attention.length === 0 ? <p className="muted">{t('noAttention')}</p> : o.attention.map((a) => (
            <button key={a.id} className="row-btn" onClick={() => go(`#/requests/${a.id}`)}>
              <span><b>{a.title?.[lang] ?? '—'}</b> <span className="muted small">{a.customer} · #{shortId(a.id)}</span></span>
              <span className="row"><Badge status={a.status} /><span className="tag">{a.waitingHours} {t('waitingH')}</span></span>
            </button>
          ))}
        </Card>
        <Card title={t('activity')}>
          {o.activity.length === 0 && <p className="muted">—</p>}
          <ul className="tl">
            {o.activity.map((e) => (
              <li key={e.id} className={e.internal ? 'int' : ''}>
                <a href={`#/requests/${e.requestId}`}>{e.title?.[lang] ?? '—'}</a> · {lang === 'ar' ? e.text_ar : e.text_en}{e.internal && <span className="tag">{t('internal')}</span>}
                <div className="when">{e.customer} · {ago(e.at, lang)}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {o.workload.length > 0 && (
        <Card title={t('workload')}>
          {o.workload.map((w) => <div className="file" key={w.id}><b>{w.name}</b><span className="tag">{w.n} {t('openReq')}</span></div>)}
        </Card>
      )}
    </>
  )
}
