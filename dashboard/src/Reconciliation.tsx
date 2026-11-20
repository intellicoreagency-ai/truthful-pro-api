import { useState } from 'react'
import { api } from './api'
import { useI18n } from './i18n'
import { Card, useAsync } from './ui'
import { fmtFils } from './Finance'

/** Daily reconciliation: approved payments with their references, proofs and allocations, plus anything that does not match. */
export function Reconciliation() {
  const { t, fmt } = useI18n()
  const [date, setDate] = useState('')
  const { data, loading } = useAsync(() => api.reconciliation(date || undefined), [date])
  return (
    <>
      <h1>{t('recTitle')}</h1>
      <div className="msg" style={{ background: '#fbe6e3', color: 'var(--bad)' }}>{t('finTest')}</div>
      <label className="field"><span>{t('recDate')}</span><input type="date" value={date || data?.date || ''} onChange={(e) => setDate(e.target.value)} /></label>
      {loading && !data ? <p className="muted">{t('loading')}</p> : data && (
        <>
          <Card>
            <dl className="kv">
              <dt>{t('recReceived')}</dt><dd dir="ltr">{fmtFils(data.totals.received)}</dd>
              <dt>{t('recAllocated')}</dt><dd dir="ltr">{fmtFils(data.totals.allocated)}</dd>
              <dt>{t('recUnallocated')}</dt><dd dir="ltr">{fmtFils(data.totals.unallocated)}</dd>
              <dt>{t('recRefunds')}</dt><dd dir="ltr">{fmtFils(data.totals.refundsPaidOut)}</dd>
              <dt>{t('recPending')}</dt><dd>{data.totals.pendingOver24h}</dd>
            </dl>
          </Card>
          <h3>{t('recFlags')}</h3>
          {data.flags.length === 0 ? <div className="empty">{t('recClean')}</div> : data.flags.map((f, i) => <div className="msg" key={i}>{t(('flag_' + f.type) as never)}{f.detail ? ` — ${f.detail}` : ''}{f.paymentId ? ` · ${f.paymentId.slice(0, 8)}` : ''}</div>)}
          <h3>{t('recPayments')}</h3>
          <Card>
            {data.payments.length === 0 ? <p className="muted">{t('queueEmpty')}</p> : data.payments.map((p) => (
              <div className="file" key={p.id}>
                <span><b dir="ltr">{fmtFils(p.amount_fils)}</b> · {p.method} · <span dir="ltr">{p.reference ?? '—'}</span><br /><span className="muted small">{t('recAllocated')}: {fmtFils(p.allocated)} · {t('recUnallocated')}: {fmtFils(p.unallocated)} · {p.hasProof ? t('recProof') : t('recNoProof')}</span></span>
                <a className="btn sm" href={`#/requests/${p.requestId}`}>{t('open')}</a>
              </div>
            ))}
          </Card>
        </>
      )}
      <p className="muted small">{fmt(Date.now())}</p>
    </>
  )
}
