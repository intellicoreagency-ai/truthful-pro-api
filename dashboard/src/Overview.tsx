import { api, type Status } from './api'
import { STATUS_LABEL, useI18n } from './i18n'
import { useAsync } from './ui'

const ORDER: Status[] = ['submitted', 'review', 'needs_documents', 'authority', 'decision', 'completed']

export function Overview({ go }: { go: (hash: string) => void }) {
  const { t, lang } = useI18n()
  const { data, loading } = useAsync(() => api.stats(), [])
  if (loading && !data) return <p className="muted">{t('loading')}</p>
  if (!data) return <div className="msg">{t('failed')}</div>
  return (
    <>
      <h1>{t('overview')}</h1>
      <div className="grid stats" style={{ marginTop: 16 }}>
        <button className="stat hot" onClick={() => go('#/requests?assignee=unassigned')}><b>{data.unassigned}</b><span>{t('unassigned')}</span></button>
        <button className="stat hot" onClick={() => go('#/requests?assignee=me')}><b>{data.mine}</b><span>{t('mine')}</span></button>
        {ORDER.map((s) => (
          <button key={s} className="stat" onClick={() => go(`#/requests?status=${s}`)}><b>{data.byStatus[s] ?? 0}</b><span>{STATUS_LABEL[s][lang]}</span></button>
        ))}
      </div>
    </>
  )
}
