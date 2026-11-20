import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { ApiError, api, type WaStart } from './api'
import { useI18n, type Key } from './i18n'
import { Field } from './ui'

function e164(raw: string): string | null {
  const d = raw.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/\D/g, '')
  const n = d.startsWith('971') ? d : d.startsWith('0') ? '971' + d.slice(1) : d.length === 9 ? '971' + d : ''
  return /^9715\d{8}$/.test(n) ? '+' + n : null
}
const digits = (s: string) => s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/\D/g, '').slice(0, 6)
type Tab = 'code' | 'setup' | 'wa'

export function Login({ onDone }: { onDone: () => void }) {
  const { t, toggle } = useI18n()
  const [tab, setTab] = useState<Tab>('code')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState<Key | ''>('')
  const [busy, setBusy] = useState(false)
  const switchTab = (x: Tab) => { setTab(x); setErr('') }
  const fail = (e: unknown, ctx: Tab): Key => {
    const c = e instanceof ApiError ? e.code : ''
    if (c === 'too_many_requests') return 'e_many'
    if (c === 'network') return 'e_net'
    if (c === 'not_staff') return 'e_not_staff'
    if (c === 'not_configured') return 'e_not_configured'
    if (c === 'invalid_setup') return 'e_setup'
    if (c === 'invalid_code') return 'e_code'
    return ctx === 'wa' && c === 'invalid_phone' ? 'e_phone' : 'e_gen'
  }
  const common = { phone, setPhone, err, setErr, busy, setBusy, onDone, fail }
  const bio = async () => {
    setErr(''); setBusy(true)
    try { await api.passkeyLogin(); try { localStorage.setItem('tp.pk', '1') } catch { /* */ } onDone() }
    catch (e) { setErr(e instanceof ApiError && e.code === 'too_many_requests' ? 'e_many' : e instanceof ApiError && e.code === 'network' ? 'e_net' : 'bioFail') } finally { setBusy(false) }
  }
  return (
    <div className="login">
      <div className="card">
        <img className="logo" src="/logo.png" alt="" />
        <h1>{t('loginTitle')}</h1>
        {api.passkeysSupported() && (
          <>
            <button className="btn primary bio" disabled={busy} onClick={bio}><span aria-hidden="true">☝︎</span> {t('bio')}</button>
            <p className="small" style={{ margin: '6px 0 0' }}>{t('bioHint')}</p>
          </>
        )}
        <div className="tabs" role="tablist">
          {(['code', 'setup', 'wa'] as Tab[]).map((x) => (
            <button key={x} role="tab" aria-selected={tab === x} className="tab" onClick={() => switchTab(x)}>{t(x === 'code' ? 'tabCode' : x === 'setup' ? 'tabSetup' : 'tabWa')}</button>
          ))}
        </div>
        {err && <div className="msg" role="alert">{t(err)}</div>}
        {tab === 'code' && <CodeForm {...common} />}
        {tab === 'setup' && <SetupForm {...common} />}
        {tab === 'wa' && <WaForm {...common} />}
        <p style={{ marginTop: 16 }}><button className="btn sm" onClick={toggle}>{t('lang')}</button></p>
      </div>
    </div>
  )
}

type P = { phone: string; setPhone: (v: string) => void; err: Key | ''; setErr: (k: Key | '') => void; busy: boolean; setBusy: (b: boolean) => void; onDone: () => void; fail: (e: unknown, c: Tab) => Key }

function PhoneField({ phone, setPhone, disabled }: { phone: string; setPhone: (v: string) => void; disabled?: boolean }) {
  const { t } = useI18n()
  return <Field label={t('phone')}><input inputMode="tel" autoComplete="tel" dir="ltr" placeholder={t('phonePh')} value={phone} disabled={disabled} onChange={(e) => setPhone(e.target.value)} /></Field>
}

function CodeForm({ phone, setPhone, setErr, busy, setBusy, onDone, fail }: P) {
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const go = async () => {
    setErr(''); const p = e164(phone)
    if (!p) { setErr('e_phone'); return }
    setBusy(true)
    try { await api.totpLogin(p, code); onDone() } catch (e) { setErr(fail(e, 'code')) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); void go() }}>
      <p>{t('codeHint')}</p>
      <PhoneField phone={phone} setPhone={setPhone} />
      <Field label={t('code6')}><input inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} className="otp" value={code} onChange={(e) => setCode(digits(e.target.value))} /></Field>
      <button className="btn primary" style={{ width: '100%' }} disabled={busy || code.length !== 6}>{t('signIn')}</button>
    </form>
  )
}

function SetupForm({ phone, setPhone, setErr, busy, setBusy, onDone, fail }: P) {
  const { t } = useI18n()
  const [key, setKey] = useState('')
  const [info, setInfo] = useState<{ secret: string; uri: string; qr: string } | null>(null)
  const [code, setCode] = useState('')
  const start = async () => {
    setErr(''); const p = e164(phone)
    if (!p) { setErr('e_phone'); return }
    setBusy(true)
    try { const r = await api.setupStart(p, key.trim()); setInfo({ ...r, qr: await QRCode.toDataURL(r.uri, { margin: 1, width: 220 }) }) } catch (e) { setErr(fail(e, 'setup')) } finally { setBusy(false) }
  }
  const confirm = async () => {
    setErr(''); const p = e164(phone); if (!p) return
    setBusy(true)
    try { await api.setupConfirm(p, code); onDone() } catch (e) { setErr(fail(e, 'setup')) } finally { setBusy(false) }
  }
  if (info) return (
    <form onSubmit={(e) => { e.preventDefault(); void confirm() }}>
      <p>{t('scanQr')}</p>
      <p style={{ textAlign: 'center' }}><img className="qr" src={info.qr} alt="" width={220} height={220} /></p>
      <p style={{ textAlign: 'center' }}><span className="code">{info.secret}</span></p>
      <p style={{ textAlign: 'center' }}><a className="btn sm" href={info.uri}>{t('openApp')}</a></p>
      <Field label={t('firstCode')}><input inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} className="otp" value={code} onChange={(e) => setCode(digits(e.target.value))} /></Field>
      <button className="btn primary" style={{ width: '100%' }} disabled={busy || code.length !== 6}>{t('signIn')}</button>
    </form>
  )
  return (
    <form onSubmit={(e) => { e.preventDefault(); void start() }}>
      <p>{t('setupHint')}</p>
      <PhoneField phone={phone} setPhone={setPhone} />
      <Field label={t('setupKey')}><input dir="ltr" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} /></Field>
      <button className="btn primary" style={{ width: '100%' }} disabled={busy || key.trim().length < 12}>{t('continue')}</button>
    </form>
  )
}

function WaForm({ phone, setPhone, setErr, busy, setBusy, onDone, fail }: P) {
  const { t } = useI18n()
  const [wa, setWa] = useState<WaStart | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const start = async () => {
    setErr(''); const p = e164(phone)
    if (!p) { setErr('e_phone'); return }
    setBusy(true)
    try { const c = await api.waStart(p); setWa(c); window.open(c.link, '_blank', 'noopener') } catch (e) { setErr(fail(e, 'wa')) } finally { setBusy(false) }
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
        if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 429) { stop = true; if (alive.current) { setWa(null); setErr(fail(e, 'wa')) } return }
      }
      timer = setTimeout(tick, 2000)
    }
    timer = setTimeout(tick, 2000)
    return () => { stop = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wa])
  return (
    <div>
      <p>{t('loginHint')}</p>
      <PhoneField phone={phone} setPhone={setPhone} disabled={!!wa || busy} />
      {wa ? (
        <>
          <p>{t('waSteps')}</p><p><span className="code">{wa.code}</span></p><p className="muted">{t('waiting')}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <a className="btn primary" href={wa.link} target="_blank" rel="noopener noreferrer">{t('openWa')}</a>
            <button className="btn" onClick={() => { setWa(null); setErr('') }}>{t('cancel')}</button>
          </div>
        </>
      ) : <button className="btn primary" style={{ width: '100%' }} disabled={busy} onClick={start}>{t('verifyWa')}</button>}
    </div>
  )
}
