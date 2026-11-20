import { useEffect, useRef, useState } from 'react'
import { ApiError, api, type WaStart } from './api'
import { useI18n, type Key } from './i18n'
import { Field } from './ui'

function e164(raw: string): string | null {
  const d = raw.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/\D/g, '')
  const n = d.startsWith('971') ? d : d.startsWith('0') ? '971' + d.slice(1) : d.length === 9 ? '971' + d : ''
  return /^9715\d{8}$/.test(n) ? '+' + n : null
}

export function Login({ onDone }: { onDone: () => void }) {
  const { t, toggle } = useI18n()
  const [phone, setPhone] = useState('')
  const [wa, setWa] = useState<WaStart | null>(null)
  const [err, setErr] = useState<Key | ''>('')
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const fail = (e: unknown): Key => {
    const c = e instanceof ApiError ? e.code : ''
    return c === 'not_staff' ? 'e_not_staff' : c === 'too_many_requests' ? 'e_many' : c === 'network' ? 'e_net' : c === 'invalid_phone' ? 'e_phone' : c === 'not_configured' ? 'e_not_configured' : 'e_gen'
  }
  const start = async () => {
    setErr(''); const p = e164(phone)
    if (!p) { setErr('e_phone'); return }
    setBusy(true)
    try { const c = await api.waStart(p); setWa(c); window.open(c.link, '_blank', 'noopener') } catch (e) { setErr(fail(e)) } finally { setBusy(false) }
  }
  useEffect(() => {
    if (!wa) return
    const p = e164(phone); if (!p) return
    let stop = false; let timer: ReturnType<typeof setTimeout>
    const until = Date.now() + wa.expiresIn * 1000
    const tick = async () => {
      if (stop) return
      try {
        const s = await api.waPoll(p, wa)
        if (s === 'verified') { stop = true; if (alive.current) onDone(); return }
        if (s === 'expired' || Date.now() > until) { stop = true; if (alive.current) { setWa(null); setErr('e_expired') } return }
      } catch (e) {
        if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 429) { stop = true; if (alive.current) { setWa(null); setErr(fail(e)) } return }
      }
      timer = setTimeout(tick, 2000)
    }
    timer = setTimeout(tick, 2000)
    return () => { stop = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wa])

  return (
    <div className="login">
      <div className="card">
        <img src="/logo.png" alt="" />
        <h1>{t('loginTitle')}</h1>
        <p>{t('loginHint')}</p>
        <Field label={t('phone')}><input inputMode="tel" autoComplete="tel" dir="ltr" placeholder={t('phonePh')} value={phone} disabled={!!wa || busy} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !wa && start()} /></Field>
        {err && <div className="msg" role="alert">{t(err)}</div>}
        {wa ? (
          <>
            <p>{t('waSteps')}</p>
            <p><span className="code">{wa.code}</span></p>
            <p className="muted">{t('waiting')}</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <a className="btn primary" href={wa.link} target="_blank" rel="noopener noreferrer">{t('openWa')}</a>
              <button className="btn" onClick={() => { setWa(null); setErr('') }}>{t('cancel')}</button>
            </div>
          </>
        ) : (
          <button className="btn primary" style={{ width: '100%' }} disabled={busy} onClick={start}>{t('verifyWa')}</button>
        )}
        <p style={{ marginTop: 16 }}><button className="btn sm" onClick={toggle}>{t('lang')}</button></p>
      </div>
    </div>
  )
}
