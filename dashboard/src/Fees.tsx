import { useState } from 'react'
import { ApiError, api } from './api'
import { useI18n } from './i18n'
import { Card, useAsync } from './ui'
import { SERVICE_NAMES } from './serviceNames'
import { aedToFils, fmtFils } from './Finance'

/** The Company's own fee per service. When a customer submits that service, an invoice for this fee is issued automatically. */
export function Fees({ canEdit }: { canEdit: boolean }) {
  const { t, lang } = useI18n()
  const { data, reload } = useAsync(() => api.fees(), [])
  const [vals, setVals] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const cur = new Map((data?.fees ?? []).map((f) => [f.service_id, f.fee_fils]))
  const save = async (id: string, v: string) => {
    setMsg(null)
    try { await api.setFee(id, v.trim() === '' ? null : (aedToFils(v) ?? Number.NaN)); setVals((x) => { const { [id]: _o, ...rest } = x; return rest }); reload() } catch (e) { setMsg(e instanceof ApiError ? t('e_bad') : t('failed')) }
  }
  return (
    <>
      <h1>{t('feesTitle')}</h1>
      <p className="muted">{t('feesNote')}</p>
      {msg && <div className="msg">{msg}</div>}
      <Card>
        {SERVICE_NAMES.map((s) => (
          <div className="file" key={s.id}>
            <span>{lang === 'ar' ? s.ar : s.en}<br /><span className="muted small" dir="ltr">{s.id} · {cur.has(s.id) ? fmtFils(cur.get(s.id)!) : t('feeNone')}</span></span>
            {canEdit && <span className="row"><input dir="ltr" inputMode="decimal" aria-label={`${s.id} AED`} placeholder="250" value={vals[s.id] ?? ''} onChange={(e) => setVals({ ...vals, [s.id]: e.target.value })} /><button className="btn sm" disabled={vals[s.id] === undefined} onClick={() => save(s.id, vals[s.id] ?? '')}>{t('saveFee')}</button></span>}
          </div>
        ))}
      </Card>
    </>
  )
}
