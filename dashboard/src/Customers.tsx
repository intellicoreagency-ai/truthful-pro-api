import { useState } from 'react'
import { api } from './api'
import { useI18n } from './i18n'
import { Badge, Card, shortId, useAsync } from './ui'

export function Customers({ go }: { go: (h: string) => void }) {
  const { t, fmt, lang } = useI18n()
  const [q, setQ] = useState('')
  const { data, loading } = useAsync(() => api.customers(q), [q])
  return (
    <>
      <h1>{t('customers')}</h1>
      <div className="filters"><input type="search" placeholder={t('search')} aria-label={t('search')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {loading && !data ? <p className="muted">{t('loading')}</p> : !data?.length ? <div className="empty">{t('noCustomers')}</div> : (
        <div className="list">
          {data.map((c) => (
            <button key={c.id} className="item" onClick={() => go(`#/customers/${c.id}`)}>
              <span className="title">{c.name || '—'}</span>
              <span className="tag">{c.requests} {t('reqCount')}{c.open ? ` · ${c.open} ${t('openReq')}` : ''}</span>
              <span className="meta"><span dir="ltr">{c.phone}</span><span>{t('joined')}: {fmt(c.joinedAt)}</span>{c.lastAt && <span>{t('lastActivity')}: {fmt(c.lastAt)}</span>}</span>
            </button>
          ))}
        </div>
      )}
      <span hidden>{lang}</span>
    </>
  )
}

export function CustomerDetail({ id, go }: { id: string; go: (h: string) => void }) {
  const { t, fmt, lang } = useI18n()
  const { data, loading, error } = useAsync(() => api.customer(id), [id])
  if (loading && !data) return <p className="muted">{t('loading')}</p>
  if (error || !data) return <><button className="btn" onClick={() => go('#/customers')}>{t('back')}</button><div className="msg">{t('failed')}</div></>
  const c = data.customer
  return (
    <>
      <button className="btn" onClick={() => go('#/customers')}>{t('back')}</button>
      <h1 style={{ marginTop: 12 }}>{c.name || '—'}</h1>
      <Card>
        <dl className="kv">
          <dt>{t('phone')}</dt><dd dir="ltr" style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>{c.phone} · <a href={`tel:${c.phone}`}>{t('call')}</a> · <a href={`https://wa.me/${c.phone.replace('+', '')}`} target="_blank" rel="noopener noreferrer">{t('whatsapp')}</a></dd>
          <dt>{t('joined')}</dt><dd>{fmt(c.joinedAt)}</dd>
        </dl>
      </Card>
      <Card title={t('requests')}>
        {data.requests.map((r) => (
          <button key={r.id} className="row-btn" onClick={() => go(`#/requests/${r.id}`)}>
            <span><b>{r.title?.[lang] ?? '—'}</b> <span className="muted small">#{shortId(r.id)} · {fmt(r.updatedAt)}</span></span><Badge status={r.status} />
          </button>
        ))}
      </Card>
      <Card title={t('consents')}>
        {data.consents.map((x, i) => <div className="file" key={i}><span>{x.type} · <span dir="ltr">{x.version}</span></span><span className="muted small">{x.accepted ? '✓' : '✗'} {fmt(x.created_at)}</span></div>)}
      </Card>
    </>
  )
}
