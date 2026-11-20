import { useState } from 'react'
import { ApiError, api, type Role } from './api'
import { useI18n } from './i18n'
import { Field, Card, useAsync } from './ui'

export function Team({ meId }: { meId: string }) {
  const { t, fmt } = useI18n()
  const { data, loading, reload } = useAsync(() => api.team(), [])
  const [phone, setPhone] = useState(''); const [name, setName] = useState(''); const [role, setRole] = useState<Role>('agent')
  const [msg, setMsg] = useState<string | null>(null)
  const [key, setKey] = useState<{ name: string; value: string } | null>(null)
  const add = async () => {
    setMsg(null)
    try { const r = await api.addMember(phone.trim().replace(/^0/, '+971'), name, role); setKey({ name, value: r.enrollKey }); setPhone(''); setName(''); reload() } catch (e) { setMsg(e instanceof ApiError && e.status === 403 ? t('failed') : t('failed')) }
  }
  return (
    <>
      <h1>{t('members')}</h1>
      {data && data.length <= 1 && <p className="muted">{t('onlyYou')}</p>}
      <Card>
        {loading && !data ? <p className="muted">{t('loading')}</p> : data?.map((m) => (
          <div className="file" key={m.id}>
            <span><b>{m.name}</b> {m.id === meId && <span className="tag">{t('you')}</span>}<br /><span className="muted small">{t(m.role)} · {fmt(m.created_at)}</span></span>
            {m.id !== meId && m.role !== 'owner' && <button className="btn sm" onClick={async () => { await api.setMember(m.id, { active: !m.active }); reload() }}>{m.active ? t('disable') : t('enable')}</button>}
          </div>
        ))}
      </Card>
      {key && (
        <Card title={`${t('enrollTitle')}: ${key.name}`}>
          <p>{t('enrollBody')}</p>
          <p><span className="code">{key.value}</span></p>
          <div className="row">
            <button className="btn sm" onClick={() => void navigator.clipboard?.writeText(key.value)}>{t('copy')}</button>
            <button className="btn primary sm" onClick={() => setKey(null)}>{t('done')}</button>
          </div>
        </Card>
      )}
      <Card title={t('addMember')}>
        {msg && <div className="msg">{msg}</div>}
        <Field label={t('name')}><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t('phone')}><input dir="ltr" placeholder="+9715XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label={t('role')}><select value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="manager">{t('manager')}</option><option value="agent">{t('agent')}</option><option value="accountant">{t('accountant')}</option></select></Field>
        <button className="btn primary" disabled={!name.trim() || !phone.trim()} onClick={add}>{t('addMember')}</button>
      </Card>
    </>
  )
}
