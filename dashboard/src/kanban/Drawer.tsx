import { useEffect, useRef, useState } from 'react'
import { ApiError, api, type Detail, type FileRow, type Role, type Status } from '../api'
import { STATUS_LABEL, useI18n } from '../i18n'
import { NEXT, ago, shortId } from '../ui'
import { NEEDS_INPUT, errorKey, fileSize, initials, useS } from './model'
import { Icon } from './Icon'

type Form = { to: Status; reference: string; reason: string; note: string; override: string; needOverride: boolean; docs: { ar: string; en: string; note: string }[] }
const blankDocs = () => [{ ar: '', en: '', note: '' }]

/**
 * Slide-in panel for one request: client, documents, details and status actions.
 * `intent: 'missing'` opens straight on the missing-documents form (used when a card is dropped on "Pending client").
 */
export function Drawer({ id, role, intent, onClose, onChanged }: {
  id: string; role: Role; intent?: 'missing'
  onClose: () => void; onChanged: (id: string, status: Status) => void
}) {
  const { lang, fmt } = useI18n()
  const s = useS(lang)
  const [d, setD] = useState<Detail | null>(null)
  const [loadErr, setLoadErr] = useState(false)
  const [closing, setClosing] = useState(false)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState<{ url: string; mime: string; name: string } | null>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)

  const load = async () => {
    try { const x = await api.request(id); setD(x); setLoadErr(false); return x } catch { setLoadErr(true); return null }
  }
  useEffect(() => {
    setD(null); setForm(null); setMsg(null)
    void load().then((x) => { if (x && intent === 'missing' && x.transitions.includes('needs_documents')) startForm('needs_documents') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, intent])

  // Slide in on mount; focus the close button; restore focus to whatever opened the drawer on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeBtn.current?.focus()
    return () => { opener?.focus?.() }
  }, [])
  const close = () => { if (closing) return; setClosing(true); window.setTimeout(onClose, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (preview) closePreview(); else if (form) setForm(null); else close() }
      if (e.key === 'Tab' && panel.current) { // keep focus inside the dialog
        const f = panel.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0]!, last = f[f.length - 1]!
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function startForm(to: Status) { setMsg(null); setForm({ to, reference: '', reason: '', note: '', override: '', needOverride: false, docs: blankDocs() }) }

  const run = async (to: Status, f?: Form) => {
    if (!d) return
    setBusy(true); setMsg(null)
    const r = d.request
    const fromAuthority = r.status === 'authority' || r.status === 'decision'
    try {
      if (to === 'needs_documents' && f) {
        await api.missing(r.id, f.docs.map((x) => ({ labelAr: x.ar.trim(), labelEn: x.en.trim(), noteAr: x.note.trim(), noteEn: x.note.trim() })), r.version, fromAuthority ? f.reason.trim() : undefined)
      } else {
        await api.setStatus(r.id, to, {
          expectedVersion: r.version,
          reference: f?.reference.trim() || undefined,
          reason: f?.reason.trim() || undefined,
          note: f?.note.trim() || undefined,
          overrideReason: f?.override.trim() || undefined,
        })
      }
      setForm(null)
      setMsg({ ok: true, text: `${s('saved')} ${STATUS_LABEL[to][lang]}` })
      onChanged(r.id, to)
      await load()
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined
      if (code === 'payment_required' && (role === 'owner' || role === 'manager')) {
        setForm({ ...(f ?? { to, reference: '', reason: '', note: '', override: '', docs: blankDocs() }), to, needOverride: true })
        setMsg({ ok: false, text: s('payBlocked') })
      } else {
        setMsg({ ok: false, text: s(errorKey(code)) })
        if (e instanceof ApiError && e.status === 409) await load()
      }
    } finally { setBusy(false) }
  }

  const choose = (to: Status) => (NEEDS_INPUT[to] ? startForm(to) : void run(to))

  const openFile = async (f: FileRow) => {
    try { const b = await api.fileBlob(f.id); setPreview({ url: URL.createObjectURL(b), mime: f.mime, name: f.name }) } catch { setMsg({ ok: false, text: s('e_gen') }) }
  }
  const closePreview = () => { if (preview) URL.revokeObjectURL(preview.url); setPreview(null) }

  const r = d?.request
  const fromAuthority = r?.status === 'authority' || r?.status === 'decision'
  const valid = (f: Form) => {
    const need = NEEDS_INPUT[f.to]
    if (f.needOverride && f.override.trim().length < 10) return false
    if (need === 'reference') return f.reference.trim().length >= 3 && f.reference.trim().length <= 100
    if (need === 'reason') return f.reason.trim().length >= 3
    if (need === 'missing') return f.docs.every((x) => x.ar.trim() && x.en.trim()) && (!fromAuthority || f.reason.trim().length >= 3)
    return true
  }
  const primary = r ? NEXT[r.status] : undefined
  const ordered = d ? [...d.transitions].sort((a, b) => rank(a, primary) - rank(b, primary)) : []

  return (
    <div className={`kb-scrim ${closing ? 'closing' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <aside ref={panel} className={`kb-drawer ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="kb-dtitle">
        <header className="kb-dhead">
          <span className="kb-id" dir="ltr">#{shortId(id)}</span>
          {r && <span className={`kb-pill s-${r.status}`}><i />{STATUS_LABEL[r.status][lang]}</span>}
          <span className="kb-grow" />
          <a className="kb-iconbtn" href={`#/requests/${id}`} title={s('fullPage')} aria-label={s('fullPage')}><Icon name="expand" /></a>
          <button ref={closeBtn} className="kb-iconbtn" onClick={close} aria-label={s('close')} title={s('close')}><Icon name="x" /></button>
        </header>

        <div className="kb-dbody">
          {!d && !loadErr && <div className="kb-skel"><span /><span /><span /><span /></div>}
          {loadErr && <div className="kb-alert">{s('e_gen')} <button className="kb-link" onClick={() => void load()}>{s('retry')}</button></div>}
          {d && r && (
            <>
              <h2 id="kb-dtitle" className="kb-dtitle">{r.data.title?.[lang] ?? r.serviceId}</h2>
              <p className="kb-sub">{s('created')} {fmt(r.createdAt)} · {s('updated')} {ago(r.updatedAt, lang)}</p>

              {d.work && (
                <div className={`kb-next ${d.work.overdue ? 'late' : ''}`}>
                  <Icon name="arrow" />
                  <div><b>{d.work.next[lang]}</b><span>{s('waitingOn')}: {s(`w_${d.work.waitingOn}`)}{d.work.overdue ? ` · ${s('overdue')}` : ''}</span></div>
                </div>
              )}

              <section className="kb-sec" aria-labelledby="kb-st">
                <h3 id="kb-st">{s('status')}</h3>
                {msg && <div className={`kb-msg ${msg.ok ? 'ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</div>}
                {!ordered.length ? <p className="kb-muted">{s('noMoves')}</p> : (
                  <div className="kb-actions">
                    {ordered.map((to) => (
                      <button key={to} disabled={busy}
                        className={`kb-btn ${to === primary ? 'primary' : ''} ${to === 'rejected' || to === 'cancelled' ? 'danger' : ''} ${form?.to === to ? 'on' : ''}`}
                        onClick={() => choose(to)}>
                        <span className={`kb-dot s-${to}`} />{STATUS_LABEL[to][lang]}
                      </button>
                    ))}
                  </div>
                )}
                {form && (
                  <form className="kb-form" onSubmit={(e) => { e.preventDefault(); if (valid(form)) void run(form.to, form) }}>
                    <p className="kb-formtitle">{s('moveTo')} <b>{STATUS_LABEL[form.to][lang]}</b></p>
                    {NEEDS_INPUT[form.to] === 'reference' && (
                      <label className="kb-field"><span>{s('reference')}</span>
                        <input autoFocus dir="ltr" value={form.reference} maxLength={100} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                        <small>{s('referenceHint')}</small></label>
                    )}
                    {(NEEDS_INPUT[form.to] === 'reason' || (form.to === 'needs_documents' && fromAuthority)) && (
                      <label className="kb-field"><span>{form.to === 'needs_documents' ? s('authorityReason') : s('reason')}</span>
                        <textarea autoFocus rows={2} value={form.reason} maxLength={300} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                        <small>{s('reasonHint')}</small></label>
                    )}
                    {form.to === 'needs_documents' && (
                      <fieldset className="kb-docs">
                        <legend>{s('missingTitle')}</legend>
                        {form.docs.map((x, i) => (
                          <div key={i} className="kb-docrow">
                            <label className="kb-field"><span>{s('docAr')}</span><input dir="rtl" autoFocus={i === 0 && !fromAuthority} value={x.ar} maxLength={120} onChange={(e) => setForm({ ...form, docs: form.docs.map((y, j) => (j === i ? { ...y, ar: e.target.value } : y)) })} /></label>
                            <label className="kb-field"><span>{s('docEn')}</span><input dir="ltr" value={x.en} maxLength={120} onChange={(e) => setForm({ ...form, docs: form.docs.map((y, j) => (j === i ? { ...y, en: e.target.value } : y)) })} /></label>
                            <label className="kb-field wide"><span>{s('docNote')}</span><input value={x.note} maxLength={300} onChange={(e) => setForm({ ...form, docs: form.docs.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)) })} /></label>
                            {form.docs.length > 1 && <button type="button" className="kb-link danger" onClick={() => setForm({ ...form, docs: form.docs.filter((_, j) => j !== i) })}>{s('removeDoc')}</button>}
                          </div>
                        ))}
                        {form.docs.length < 10 && <button type="button" className="kb-link" onClick={() => setForm({ ...form, docs: [...form.docs, ...blankDocs()] })}><Icon name="plus" /> {s('addDoc')}</button>}
                      </fieldset>
                    )}
                    {form.to !== 'needs_documents' && (
                      <label className="kb-field"><span>{s('note')}</span>
                        <input value={form.note} maxLength={500} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
                    )}
                    {form.needOverride && (
                      <label className="kb-field"><span>{s('payGate')}</span>
                        <textarea autoFocus rows={2} value={form.override} maxLength={300} onChange={(e) => setForm({ ...form, override: e.target.value })} /></label>
                    )}
                    <div className="kb-formbar">
                      <button type="button" className="kb-btn" onClick={() => setForm(null)}>{s('cancel')}</button>
                      <button type="submit" className="kb-btn primary" disabled={busy || !valid(form)}>{busy ? '…' : form.to === 'needs_documents' ? s('sendMissing') : s('confirm')}</button>
                    </div>
                  </form>
                )}
              </section>

              <section className="kb-sec" aria-labelledby="kb-cl">
                <h3 id="kb-cl">{s('client')}</h3>
                <div className="kb-client">
                  <span className="kb-avatar lg" aria-hidden="true">{initials(d.customer.name || r.data.name || '?')}</span>
                  <div className="kb-grow">
                    <b><bdi>{d.customer.name || r.data.name || '—'}</bdi></b>
                    <span dir="ltr" className="kb-mono">{d.customer.phone}</span>
                    {d.customer.email && <span dir="ltr" className="kb-muted">{d.customer.email} <em className={`kb-tag ${d.customer.emailVerified ? 'ok' : ''}`}>{d.customer.emailVerified ? s('verified') : s('unverified')}</em></span>}
                  </div>
                </div>
                {d.customer.phone && (
                  <div className="kb-row">
                    <a className="kb-btn sm" href={`tel:${d.customer.phone}`}><Icon name="phone" />{s('call')}</a>
                    <a className="kb-btn sm" href={`https://wa.me/${d.customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><Icon name="chat" />{s('whatsapp')}</a>
                  </div>
                )}
              </section>

              {d.missing.length > 0 && (
                <section className="kb-sec" aria-labelledby="kb-ms">
                  <h3 id="kb-ms">{s('requested')}</h3>
                  <ul className="kb-list">
                    {d.missing.map((m) => (
                      <li key={m.id}>
                        <Icon name={m.resolved_at ? 'check' : 'clock'} />
                        <span className="kb-grow">{lang === 'ar' ? m.label_ar : m.label_en}{(lang === 'ar' ? m.note_ar : m.note_en) && <small>{lang === 'ar' ? m.note_ar : m.note_en}</small>}</span>
                        <em className={`kb-tag ${m.resolved_at ? 'ok' : 'warn'}`}>{m.resolved_at ? s('uploaded') : s('waiting')}</em>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="kb-sec" aria-labelledby="kb-dc">
                <h3 id="kb-dc">{s('documents')} <span className="kb-count">{d.files.length}</span></h3>
                {!d.files.length ? <p className="kb-muted">{s('noDocs')}</p> : (
                  <ul className="kb-list">
                    {d.files.map((f) => (
                      <li key={f.id}>
                        <Icon name="file" />
                        <span className="kb-grow kb-ellipsis"><span dir="ltr">{f.label || f.name}</span><small>{s(f.kind)} · {fileSize(f.size)} · {ago(f.created_at, lang)}</small></span>
                        <button className="kb-btn sm" onClick={() => void openFile(f)}>{s('view')}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="kb-sec" aria-labelledby="kb-dt">
                <h3 id="kb-dt">{s('details')}</h3>
                <dl className="kb-dl">
                  <dt>{s('service')}</dt><dd><bdi>{r.serviceId}</bdi></dd>
                  {Object.entries(r.data.fields ?? {}).filter(([, v]) => String(v ?? '').trim()).map(([k, v]) => <FragmentRow key={k} k={k} v={String(v)} />)}
                  {r.staff.authorityRef && <><dt>{s('reference')}</dt><dd><bdi>{r.staff.authorityRef}</bdi></dd></>}
                  {r.staff.expectedAt && <><dt>{s('nextStep')}</dt><dd>{r.staff.expectedAt}</dd></>}
                </dl>
              </section>

              {d.events.length > 0 && (
                <section className="kb-sec" aria-labelledby="kb-ac">
                  <h3 id="kb-ac">{s('activity')}</h3>
                  <ol className="kb-feed">
                    {d.events.slice(-6).reverse().map((ev) => (
                      <li key={ev.id}><span>{lang === 'ar' ? ev.text_ar : ev.text_en}{!ev.visible && <em className="kb-tag">{s('internal')}</em>}</span><time>{ago(ev.created_at, lang)}</time></li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          )}
        </div>

        {preview && (
          <div className="kb-preview" role="dialog" aria-modal="true" aria-label={preview.name} onMouseDown={(e) => { if (e.target === e.currentTarget) closePreview() }}>
            <div className="kb-previn">
              <header><b dir="ltr" className="kb-ellipsis">{preview.name}</b><button className="kb-iconbtn" onClick={closePreview} aria-label={s('close')}><Icon name="x" /></button></header>
              {preview.mime.startsWith('image/') ? <img src={preview.url} alt={preview.name} /> : <iframe src={preview.url} title={preview.name} />}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return <><dt><bdi>{k}</bdi></dt><dd><bdi>{v}</bdi></dd></>
}

/** Primary (next natural step) first, ordinary moves next, rejection/cancellation last. */
function rank(s: Status, primary?: Status) {
  if (s === primary) return 0
  if (s === 'cancelled') return 4
  if (s === 'rejected') return 3
  return 1
}
