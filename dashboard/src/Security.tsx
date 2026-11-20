import { useState } from 'react'
import { api } from './api'
import { useI18n } from './i18n'
import { Card, useAsync } from './ui'

export function Security() {
  const { t, fmt } = useI18n()
  const { data, reload } = useAsync(() => api.passkeys(), [])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const enable = async () => {
    setMsg(null)
    try { await api.passkeyRegister(navigator.platform || 'Device'); try { localStorage.setItem('tp.pk', '1') } catch { /* */ } setMsg({ ok: true, text: t('bioEnabled') }); reload() }
    catch { setMsg({ ok: false, text: t('bioCancelled') }) }
  }
  return (
    <>
      <h1>{t('security')}</h1>
      {msg && <div className={`msg ${msg.ok ? 'ok' : ''}`} role="status">{msg.text}</div>}
      <Card title={t('bio')}>
        <p>{t('bioHint')}</p>
        {api.passkeysSupported() ? <button className="btn primary" onClick={enable}>{t('bioEnable')}</button> : <p className="muted">{t('bioCancelled')}</p>}
      </Card>
      <Card title={t('bioDevices')}>
        {(data ?? []).length === 0 && <p className="muted">—</p>}
        {(data ?? []).map((k) => (
          <div className="file" key={k.id}>
            <span><b>{k.device_name}</b><br /><span className="muted small">{fmt(k.created_at)} · {t('lastUsed')}: {k.last_used_at ? fmt(k.last_used_at) : t('never')}</span></span>
            <button className="btn sm danger" onClick={async () => { await api.removePasskey(k.id); reload() }}>{t('bioRemove')}</button>
          </div>
        ))}
      </Card>
    </>
  )
}
