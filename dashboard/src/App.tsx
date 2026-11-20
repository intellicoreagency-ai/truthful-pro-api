import { useEffect, useState } from 'react'
import { api, setExpiredHandler, signedIn, type Role } from './api'
import { Login } from './Login'
import { Overview } from './Overview'
import { RequestDetail } from './RequestDetail'
import { Requests } from './Requests'
import { Team } from './Team'
import { Fees } from './Fees'
import { Security } from './Security'
import { PaymentsQueue } from './Finance'
import { CustomerDetail, Customers } from './Customers'
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
  const [offer, setOffer] = useState(() => { try { return !localStorage.getItem('tp.pk') && !sessionStorage.getItem('tp.pk.later') } catch { return false } })

  const load = async () => { try { setMe((await api.me()).staff) } catch { setMe(null) } finally { setChecking(false) } }
  useEffect(() => { setExpiredHandler(() => setMe(null)); if (signedIn()) void load() }, [])

  if (checking) return <div className="login"><p className="muted">{t('loading')}</p></div>
  if (!me) return <Login onDone={() => { setChecking(true); void load() }} />

  const [path, query] = hash.slice(1).split('?')
  const params = new URLSearchParams(query ?? '')
  const parts = (path ?? '/').split('/').filter(Boolean)
  const section = parts[0] ?? ''
  const canTeam = me.role === 'owner' || me.role === 'manager'
  const canFin = canTeam || me.role === 'accountant'
  const cur = (s: string) => (section === s ? 'page' : undefined)

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href="#/"><img src="/logo.png" alt="" /><span>{t('brand')}<small>{t('team')}</small></span></a>
          <nav className="nav" aria-label="main">
            <a href="#/" aria-current={cur('')}>{t('overview')}</a>
            <a href="#/requests" aria-current={cur('requests')}>{t('requests')}</a>
            {canTeam && <a href="#/customers" aria-current={cur('customers')}>{t('customers')}</a>}
            {canFin && <a href="#/payments" aria-current={cur('payments')}>{t('paymentsQueue')}</a>}
            {canFin && <a href="#/fees" aria-current={cur('fees')}>{t('feesTitle')}</a>}
            {canTeam && <a href="#/team" aria-current={cur('team')}>{t('members')}</a>}
            <a href="#/security" aria-current={cur('security')}>{t('security')}</a>
          </nav>
          <input className="search-top" type="search" aria-label={t('searchAll')} placeholder={t('searchAll')} onKeyDown={(e) => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); go('#/requests' + (v ? '?q=' + encodeURIComponent(v) : '')) } }} />
          <button className="btn sm" onClick={toggle}>{t('lang')}</button>
          <button className="btn sm" onClick={async () => { await api.logout(); setMe(null) }}>{t('logout')}</button>
        </div>
      </header>
      {offer && api.passkeysSupported() && section !== 'security' && (
        <div className="banner" role="note"><div className="banner-in">
          <span>{t('bioBanner')}</span>
          <button className="btn primary sm" onClick={() => go('#/security')}>{t('bioEnable')}</button>
          <button className="btn sm" onClick={() => { try { sessionStorage.setItem('tp.pk.later', '1') } catch { /* */ } setOffer(false) }}>{t('bioLater')}</button>
        </div></div>
      )}
      <main className="main">
        {section === 'customers' && canTeam ? (parts[1] ? <CustomerDetail key={parts[1]} id={parts[1]} go={go} /> : <Customers go={go} />)
          : section === 'requests' && parts[1] ? <RequestDetail key={parts[1]} id={parts[1]} me={me} back={() => go('#/requests')} />
          : section === 'requests' ? <Requests params={params} go={go} />
          : section === 'fees' && canFin ? <Fees canEdit={canTeam} />
          : section === 'team' && canTeam ? <Team meId={me.id} />
          : section === 'payments' && canFin ? <PaymentsQueue go={go} />
          : section === 'security' ? <Security />
          : <Overview go={go} name={me.name} />}
      </main>
    </div>
  )
}
