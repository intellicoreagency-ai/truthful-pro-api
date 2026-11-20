import { useEffect, useState } from 'react'
import { api, setExpiredHandler, signedIn, type Role } from './api'
import { Login } from './Login'
import { Overview } from './Overview'
import { RequestDetail } from './RequestDetail'
import { Requests } from './Requests'
import { Team } from './Team'
import { useI18n } from './i18n'

type Me = { id: string; name: string; role: Role }

function useHash() {
  const [h, setH] = useState(() => window.location.hash || '#/')
  useEffect(() => { const f = () => setH(window.location.hash || '#/'); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  return [h, (n: string) => { window.location.hash = n }] as const
}

export default function App() {
  const { t, toggle } = useI18n()
  const [me, setMe] = useState<Me | null>(null)
  const [checking, setChecking] = useState(signedIn())
  const [hash, go] = useHash()

  const load = async () => { try { setMe((await api.me()).staff) } catch { setMe(null) } finally { setChecking(false) } }
  useEffect(() => { setExpiredHandler(() => setMe(null)); if (signedIn()) void load() }, [])

  if (checking) return <div className="login"><p className="muted">{t('loading')}</p></div>
  if (!me) return <Login onDone={() => { setChecking(true); void load() }} />

  const [path, query] = hash.slice(1).split('?')
  const params = new URLSearchParams(query ?? '')
  const parts = (path ?? '/').split('/').filter(Boolean)
  const section = parts[0] ?? ''
  const canTeam = me.role === 'owner' || me.role === 'manager'
  const cur = (s: string) => (section === s ? 'page' : undefined)

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href="#/"><img src="/logo.png" alt="" /><span>{t('brand')}<small>{t('team')}</small></span></a>
          <nav className="nav" aria-label="main">
            <a href="#/" aria-current={cur('')}>{t('overview')}</a>
            <a href="#/requests" aria-current={cur('requests')}>{t('requests')}</a>
            {canTeam && <a href="#/team" aria-current={cur('team')}>{t('members')}</a>}
          </nav>
          <button className="btn sm" onClick={toggle}>{t('lang')}</button>
          <button className="btn sm" onClick={async () => { await api.logout(); setMe(null) }}>{t('logout')}</button>
        </div>
      </header>
      <main className="main">
        {section === 'requests' && parts[1] ? <RequestDetail key={parts[1]} id={parts[1]} me={me} back={() => go('#/requests')} />
          : section === 'requests' ? <Requests params={params} go={go} />
          : section === 'team' && canTeam ? <Team meId={me.id} />
          : <Overview go={go} />}
      </main>
    </div>
  )
}
