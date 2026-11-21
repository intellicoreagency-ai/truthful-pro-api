import { useState, type ReactNode } from 'react'
import { ApiError, api, type CheckRow, type Detail, type FileRow, type Role, type Status } from './api'
import { STATUS_LABEL, useI18n, type Key } from './i18n'
import { Field, Badge, Card, NEXT, shortId, useAsync } from './ui'
import { FinanceCard } from './Finance'

type Preview = { url: string; mime: string; name: string }

type StatusOpts = { note?: string; expectedAt?: string; reason?: string; reference?: string; expectedVersion?: number }
/** Moving to the authority needs our fee and the government fee verified; owner/manager may override with a written reason. */
async function moveStatus(role: Role, t: (k: Key) => string, id: string, to: Status, o: StatusOpts) {
  try { return await api.setStatus(id, to, o) } catch (e) {
    if (e instanceof ApiError && e.code === 'payment_required' && (role === 'owner' || role === 'manager')) {
      const why = window.prompt(t('payGatePrompt'))?.trim()
      if (why && why.length >= 10) return api.setStatus(id, to, { ...o, overrideReason: why })
    }
    throw e
  }
}
export function RequestDetail({ id, me, back }: { id: string; me: { id: string; role: Role }; back: () => void }) {
  const { t, lang, fmt, day } = useI18n()
  const { data: d, loading, error, reload } = useAsync(() => api.request(id), [id])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)

  const move = (to: Status, o: StatusOpts) => moveStatus(me.role, t, id, to, o)
  const act = async (fn: () => Promise<unknown>) => {
    setMsg(null)
    try { await fn(); setMsg({ ok: true, text: t('saved') }); reload() }
    catch (e) { setMsg({ ok: false, text: e instanceof ApiError && e.code === 'invalid_transition' ? t('invalidTransition') : e instanceof ApiError && e.code === 'version_conflict' ? t('conflict') : e instanceof ApiError && e.code === 'documents_blocked' ? t('blockedDocs') : e instanceof ApiError && e.code === 'scan_pending' ? t('e_scan') : e instanceof ApiError && e.code === 'payment_required' ? t('payRequired') : e instanceof ApiError && e.code === 'authority_not_finished' ? t('notFinished') : t('failed') }); if (e instanceof ApiError && e.status === 409) reload() }
  }
  const openFile = async (f: FileRow) => {
    try { const b = await api.fileBlob(f.id); setPreview({ url: URL.createObjectURL(b), mime: f.mime, name: f.name }) } catch { setMsg({ ok: false, text: t('failed') }) }
  }
  const closePreview = () => { if (preview) URL.revokeObjectURL(preview.url); setPreview(null) }

  if (loading && !d) return <p className="muted">{t('loading')}</p>
  if (error || !d) return <><button className="btn" onClick={back}>{t('back')}</button><div className="msg">{t('failed')}</div></>
  const r = d.request
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <button className="btn" onClick={back}>{t('back')}</button>
        <Badge status={r.status} />
      </div>
      <h1>{r.data.title?.[lang] ?? r.serviceId} <span className="muted small" dir="ltr">#{shortId(r.id)}</span></h1>
      {msg && <div className={`msg ${msg.ok ? 'ok' : ''}`} role="status">{msg.text}</div>}
      <WorkBanner d={d} act={act} />
      {(() => {
        const next = NEXT[r.status]
        const showNext = !!next && d.transitions.includes(next)
        const mine = r.assigneeId === me.id
        if (!showNext && mine) return null
        return (
          <div className="quick" role="group" aria-label={t('actions')}>
            {showNext && <button className="btn primary" onClick={() => { const ref = next === 'authority' ? window.prompt(t('refNeeded'))?.trim() : undefined; if (next === 'authority' && !ref) return; void act(() => move(next as Status, { reference: ref, expectedVersion: r.version })) }}>{t('nextStep')}: {STATUS_LABEL[next as Status][lang]}</button>}
            {!mine && <button className="btn" onClick={() => act(() => api.assign(r.id, me.id, r.version))}>{t('assignToMe')}</button>}
          </div>
        )
      })()}
      <div className="detail" style={{ marginTop: 14 }}>
        <div>
          <Card title={t('customer')}>
            <dl className="kv">
              <dt>{t('name')}</dt><dd>{d.customer.name || '—'}</dd>
              <dt>{t('emailLbl')}</dt><dd dir="ltr" style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>{d.customer.email ? <><a href={`mailto:${d.customer.email}`}>{d.customer.email}</a> <span className="tag">{d.customer.emailVerified ? t('emailVerified') : t('emailUnverified')}</span></> : '—'}</dd>
              <dt>{t('phone')}</dt>
              <dd dir="ltr" style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>{d.customer.phone} · <a href={`tel:${d.customer.phone}`}>{t('call')}</a> · <a href={`https://wa.me/${d.customer.phone.replace('+', '')}`} target="_blank" rel="noopener noreferrer">{t('whatsapp')}</a></dd>
            </dl>
          </Card>
          <Card title={t('details')}>
            <dl className="kv">
              <dt>{t('created')}</dt><dd>{fmt(r.createdAt)}</dd>
              <dt>{t('updated')}</dt><dd>{fmt(r.updatedAt)}</dd>
              {r.staff.expectedAt && <><dt>{t('expectedAt')}</dt><dd>{day(r.staff.expectedAt)}</dd></>}
              {r.data.termsVersion && <><dt>{t('terms')}</dt><dd dir="ltr">{r.data.termsVersion}</dd></>}
              {Object.entries(r.data.fields ?? {}).filter(([, v]) => v).map(([k, v]) => <Row key={k} k={k} v={v} />)}
            </dl>
          </Card>
          <Card title={t('documents')}>
            {d.files.filter((f) => f.kind === 'source').length === 0 && <p className="muted">{t('noFiles')}</p>}
            {d.files.filter((f) => f.kind === 'source').map((f) => (
              <div key={f.id} className="subrow">
                <div className="file" style={{ borderBottom: 0 }}>
                  <span>{f.label || f.name}<br /><span className="muted small">{f.name} · {Math.max(1, Math.round(f.size / 1024))} KB</span></span>
                  <button className="btn sm" onClick={() => openFile(f)}>{t('view')}</button>
                </div>
                <FileChecks file={f} checks={d.checks.filter((c) => c.file_id === f.id)} role={me.role} act={act} />
              </div>
            ))}
          </Card>
          <DeliveryCard d={d} act={act} openFile={openFile} />
          <FinanceCard requestId={r.id} role={me.role} setPreview={setPreview} />
          {r.staff.authorityRef && <Card title={t('authorityAt')}><p dir="ltr" style={{ margin: 0, textAlign: lang === 'ar' ? 'right' : 'left' }}><b>{r.staff.authorityRef}</b></p></Card>}
          {d.missing.length > 0 && (
            <Card title={t('missingList')}>
              {d.missing.map((m) => (
                <div className="file" key={m.id}><span>{lang === 'ar' ? m.label_ar : m.label_en}<br /><span className="muted small">{lang === 'ar' ? m.note_ar : m.note_en}</span></span>
                  <span className={`badge ${m.resolved_at ? 'b-completed' : 'b-needs_documents'}`}>{m.resolved_at ? t('resolved') : t('pending')}</span></div>
              ))}
            </Card>
          )}
          <Card title={t('timeline')}>
            <ul className="tl">
              {[...d.events].reverse().map((e) => (
                <li key={e.id} className={e.visible ? '' : 'int'}>
                  {lang === 'ar' ? e.text_ar : e.text_en}{!e.visible && <span className="tag">{t('internal')}</span>}
                  <div className="when">{fmt(e.created_at)}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div>
          <Actions d={d} me={me} act={act} />
          {(me.role === 'owner' || me.role === 'manager') && <OverrideCard d={d} act={act} />}
        </div>
      </div>
      {preview && (
        <div className="preview" role="dialog" aria-modal="true" onClick={closePreview}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <header><b dir="ltr">{preview.name}</b><button className="btn sm" onClick={closePreview}>{t('back')}</button></header>
            {preview.mime.startsWith('image/') ? <img src={preview.url} alt={preview.name} /> : <iframe src={preview.url} title={preview.name} />}
          </div>
        </div>
      )}
    </>
  )
}

const WAIT_LABEL: Record<string, Key> = { customer: 'waitCustomer', staff: 'waitStaff', authority: 'waitAuthority', none: 'waitNone' }
/** "What do I do now?": the next action, who we are waiting on, and the follow-up date, from the server. */
function WorkBanner({ d, act }: { d: Detail; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const { t, lang, fmt } = useI18n()
  const w = d.work
  const r = d.request
  return (
    <section className="card" style={{ borderInlineStart: `4px solid ${w.overdue ? 'var(--bad)' : 'var(--gold, #b8893a)'}`, margin: '10px 0' }} aria-label={t('whatNow')}>
      <b>{t('whatNow')}</b>
      <p style={{ margin: '4px 0' }}>{w.next[lang]}</p>
      <p className="muted small">{t('waitingOn')}: <b>{t(WAIT_LABEL[w.waitingOn] ?? 'waitNone')}</b> · {t('followUp')}: {w.followUpAt ? <span className={w.overdue ? 'tag' : ''}>{fmt(w.followUpAt)}{w.overdue ? ` · ${t('overdue')}` : ''}</span> : '—'} · {t('payState')}: {w.payment.company} · {t('delState')}: {w.delivery.state}</p>
      <div className="row">
        <button className="btn sm" onClick={() => { const v = window.prompt(t('followUpPrompt'))?.trim(); if (v) void act(() => api.setFollowUp(r.id, v)) }}>{t('setFollowUp')}</button>
        {!['completed', 'cancelled', 'rejected'].includes(r.status) && <button className="btn sm" onClick={() => { const why = window.prompt(t('delayReasonPrompt'))?.trim(); if (!why) return; const when = window.prompt(t('followUpPrompt'))?.trim(); if (when) void act(() => api.delay(r.id, why, when)) }}>{t('reportDelay')}</button>}
      </div>
      {d.problems.filter((p) => p.status === 'open').map((p) => (
        <div className="msg" key={p.id}>{t('deliveryProblem')}: {p.text} <button className="btn sm" onClick={() => { const note = window.prompt(t('resolveNote'))?.trim(); if (note) void act(() => api.resolveProblem(p.id, 'explained', note)) }}>{t('resolveProblem')}</button></div>
      ))}
      {d.submissions.length > 0 && <p className="muted small">{t('submissionsLbl')}: {d.submissions.map((x) => `#${x.number} ${x.reference} (${x.state}${x.returned_reason ? `: ${x.returned_reason}` : ''})`).join(' · ')}</p>}
      <details><summary className="small">{t('moveLog')}</summary>
        {d.log.map((x) => <div className="small" key={x.id}>{fmt(x.at)} · {x.from_status ?? '—'} → <b>{x.to_status}</b> · {x.actor_kind === 'staff' ? x.actor_name ?? 'team' : x.actor_kind}{x.reason ? ` · ${x.reason}` : ''}{x.reference ? ` · ${x.reference}` : ''}{x.internal_note ? ` · 🔒 ${x.internal_note}` : ''}</div>)}
      </details>
    </section>
  )
}

const Row = ({ k, v }: { k: string; v: string }): ReactNode => <><dt>{k}</dt><dd>{v}</dd></>

function Actions({ d, me, act }: { d: Detail; me: { id: string; role: Role }; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const { t, lang } = useI18n()
  const move = (to: Status, o: StatusOpts) => moveStatus(me.role, t, d.request.id, to, o)
  const r = d.request
  const [to, setTo] = useState<Status | ''>('')
  const [note, setNote] = useState('')
  const [expected, setExpected] = useState('')
  const [reference, setReference] = useState('')
  const [rejReason, setRejReason] = useState('')
  const [internal, setInternal] = useState('')
  const [rows, setRows] = useState([{ ar: '', en: '', note: '' }])
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<'final' | 'invoice'>('final')
  const [file, setFile] = useState<File | null>(null)
  const mine = r.assigneeId === me.id
  const canAsk = d.transitions.includes('needs_documents')
  // The server requires a reason when the authority sent the request back (from authority/decision), for rejection and for cancellation.
  const fromAuthority = r.status === 'authority' || r.status === 'decision'
  const [askReason, setAskReason] = useState('')
  const needsReason = to === 'rejected' || to === 'cancelled' || (to === 'needs_documents' && fromAuthority)

  return (
    <>
      <Card title={t('actions')}>
        <p className="small">{t('assignedTo')}: <b>{r.assigneeId ? (mine ? t('you') : '…') : t('none')}</b></p>
        <div className="row">
          {!mine && <button className="btn primary sm" onClick={() => act(() => api.assign(r.id, me.id))}>{t('assignToMe')}</button>}
          {r.assigneeId && <button className="btn sm" onClick={() => act(() => api.assign(r.id, null))}>{t('release')}</button>}
        </div>
      </Card>
      <Card title={t('changeStatus')}>
        {d.transitions.length === 0 ? <p className="muted">{t('noTransitions')}</p> : (
          <>
            <Field label={t('newStatus')}><select value={to} onChange={(e) => setTo(e.target.value as Status)}>
                <option value="">—</option>{d.transitions.map((s) => <option key={s} value={s}>{STATUS_LABEL[s][lang]}</option>)}
              </select></Field>
            {to === 'authority' && <Field label={t('authorityRef')}><input dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>}
            {needsReason && <Field label={to === 'rejected' ? t('rejectReason') : to === 'needs_documents' ? t('authorityAsked') : t('reason')}><input value={rejReason} onChange={(e) => setRejReason(e.target.value)} /></Field>}
            <Field label={t('expected')}><input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
            <Field label={t('note')}><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <button className="btn primary" disabled={!to || (to === 'authority' && reference.trim().length < 3) || (needsReason && rejReason.trim().length < 3)} onClick={() => act(async () => { await move(to as Status, { note: note || undefined, expectedAt: expected || undefined, reference: reference.trim() || undefined, reason: rejReason.trim() || undefined, expectedVersion: r.version }); setTo(''); setNote(''); setReference(''); setRejReason('') })}>{t('apply')}</button>
          </>
        )}
      </Card>
      {canAsk && (
        <Card title={t('askMissing')}>
          {rows.map((row, i) => (
            <div key={i} className="subrow">
              <Field label={t('docNameAr')}><input value={row.ar} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, ar: e.target.value } : x)))} /></Field>
              <Field label={t('docNameEn')}><input dir="ltr" value={row.en} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))} /></Field>
              <Field label={t('noteToCustomer')}><input value={row.note} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} /></Field>
            </div>
          ))}
          {fromAuthority && <Field label={t('authorityAsked')}><textarea rows={2} value={askReason} onChange={(e) => setAskReason(e.target.value)} /></Field>}
          <div className="row">
            <button className="btn sm" onClick={() => setRows([...rows, { ar: '', en: '', note: '' }])}>{t('addRow')}</button>
            <button className="btn primary sm" disabled={!rows.every((x) => x.ar.trim() && x.en.trim()) || (fromAuthority && askReason.trim().length < 3)}
              onClick={() => act(async () => { await api.missing(r.id, rows.map((x) => ({ labelAr: x.ar.trim(), labelEn: x.en.trim(), noteAr: x.note.trim(), noteEn: x.note.trim() })), r.version, fromAuthority ? askReason.trim() : undefined); setRows([{ ar: '', en: '', note: '' }]); setAskReason('') })}>{t('send')}</button>
          </div>
        </Card>
      )}
      <Card title={t('uploadFile')}>
        <p className="muted small">{t('pkgHint')}</p>
        <Field label={t('kind')}><select value={kind} onChange={(e) => setKind(e.target.value as 'final' | 'invoice')}><option value="final">{t('delivery')}</option><option value="invoice">{t('invoice')}</option></select></Field>
        <Field label={t('fileLabel')}><input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <Field label={t('choose')}><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        <button className="btn primary" disabled={!file} onClick={() => act(async () => { await api.upload(r.id, file as File, kind, label); setFile(null); setLabel('') })}>{t('save')}</button>
      </Card>
      <Card title={t('addNote')}>
        <p className="muted small">{t('noteHint')}</p>
        <div className="field"><textarea rows={3} aria-label={t('addNote')} value={internal} onChange={(e) => setInternal(e.target.value)} /></div>
        <button className="btn" disabled={!internal.trim()} onClick={() => act(async () => { await api.note(r.id, internal.trim()); setInternal('') })}>{t('save')}</button>
      </Card>
    </>
  )
}

function OverrideCard({ d, act }: { d: Detail; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const { t, lang } = useI18n()
  const r = d.request
  const [status, setStatus] = useState<Status | ''>('')
  const [expected, setExpected] = useState('')
  const [name, setName] = useState('')
  const [reason, setReason] = useState('')
  const all: Status[] = ['submitted', 'review', 'needs_documents', 'ready_for_authority', 'authority', 'decision', 'completed', 'rejected', 'cancelled']
  const changed = !!status || !!expected || !!name.trim()
  return (
    <section className="card section override">
      <h3>{t('override')}</h3>
      <p className="muted small">{t('overrideHint')}</p>
      <Field label={t('forceStatus')}>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          <option value="">{t('same')}</option>
          {all.filter((x) => x !== r.status).map((x) => <option key={x} value={x}>{r.status === 'completed' && x === 'review' ? `${t('reopen')} · ` : ''}{STATUS_LABEL[x][lang]}</option>)}
        </select>
      </Field>
      <Field label={t('expected')}><input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
      <Field label={t('customerName')}><input value={name} placeholder={d.customer.name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label={t('reason')}><textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <button className="btn danger" disabled={!changed || reason.trim().length < 3}
        onClick={() => { if (!window.confirm(t('overrideConfirm'))) return; void act(async () => { await api.override(r.id, { reason: reason.trim(), status: status || undefined, expectedAt: expected || undefined, customerName: name.trim() || undefined, expectedVersion: r.version }); setStatus(''); setExpected(''); setName(''); setReason('') }) }}>
        {t('overrideApply')}
      </button>
    </section>
  )
}

function FileChecks({ file, checks, role, act }: { file: FileRow; checks: CheckRow[]; role: Role; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const { t, fmt } = useI18n()
  const [expiry, setExpiry] = useState('')
  const live = checks.filter((c) => !c.superseded_at)
  const label = (o: CheckRow['outcome']) => (o === 'pass' ? t('outPass') : o === 'fail' ? t('outFail') : t('outManual'))
  const canOverride = role === 'owner' || role === 'manager'
  return (
    <div className="small" style={{ marginTop: 4 }}>
      <b>{t('checks')}</b>
      {live.length === 0 && <span className="muted"> · {t('noChecks')}</span>}
      {live.map((c) => (
        <div key={c.id} className="row" style={{ marginTop: 4 }}>
          <span className={`badge ${c.outcome === 'pass' ? 'b-completed' : c.outcome === 'fail' ? 'b-rejected' : 'b-needs_documents'}`}>{label(c.outcome)}</span>
          <span dir="ltr">{c.rule_code} v{c.rule_version}</span>
          {c.override_reason ? <span className="tag" title={c.override_reason}>{t('overridden')} · {c.overridden_at ? fmt(c.overridden_at) : ''}</span>
            : c.outcome !== 'pass' && canOverride && c.rule_code !== 'malware_scan' && (
              <button className="btn sm danger" onClick={() => { const reason = window.prompt(t('docOverrideReason'))?.trim(); if (!reason || reason.length < 10) return; void act(() => api.overrideCheck(file.id, c.id, reason)) }}>{t('docOverride')}</button>
            )}
        </div>
      ))}
      {live.some((c) => c.override_reason) && <div className="muted">{t('overrideNote')}</div>}
      <div className="row" style={{ marginTop: 6 }}>
        <input type="date" aria-label={t('passportExpiry')} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        <button className="btn sm" disabled={!expiry} onClick={() => act(async () => { await api.readPassport(file.id, expiry); setExpiry('') })}>{t('readExpiry')}</button>
        <button className="btn sm" onClick={() => act(() => api.manualCheck(file.id, 'name_match', 'fail', ''))}>{t('nameMismatch')}</button>
      </div>
    </div>
  )
}

function DeliveryCard({ d, act, openFile }: { d: Detail; act: (fn: () => Promise<unknown>) => Promise<void>; openFile: (f: FileRow) => void | Promise<void> }) {
  const { t, fmt } = useI18n()
  const r = d.request
  const draft = d.deliveries.find((x) => x.status === 'draft')
  const items = draft ? d.files.filter((f) => f.delivery_id === draft.id) : []
  const published = d.deliveries.filter((x) => x.status !== 'draft')
  if (!draft && published.length === 0) return null
  const canPublish = items.some((f) => f.kind === 'final')
  return (
    <Card title={t('pkgTitle')}>
      {draft && (
        <div style={{ marginBottom: 12 }}>
          <span className="tag">{t('pkgDraft')}</span>
          {items.length === 0 && <p className="muted small">{t('pkgEmpty')}</p>}
          {items.map((f) => (
            <div className="file" key={f.id}>
              <span>{f.kind === 'invoice' ? <span className="tag">{t('invoice')}</span> : <span className="tag">{t('delivery')}</span>} {f.label || f.name}</span>
              <span className="row"><button className="btn sm" onClick={() => openFile(f)}>{t('view')}</button><button className="btn sm danger" onClick={() => act(() => api.removeDraftFile(f.id))}>{t('pkgRemove')}</button></span>
            </div>
          ))}
          {!canPublish && <p className="muted small">{t('pkgNeedFinal')}</p>}
          <button className="btn primary" disabled={!canPublish} onClick={() => { if (!window.confirm(t('pkgPublishConfirm'))) return; void act(() => api.publish(r.id, r.version)) }}>{t('pkgPublish')}</button>
        </div>
      )}
      {published.map((p) => {
        return (
          <div className="file" key={p.id}>
            <span><b>{t('pkgVersion')} {p.version}</b> <span className={`badge ${p.status === 'published' ? 'b-completed' : 'b-draft'}`}>{p.status === 'published' ? t('pkgPublished') : t('pkgSuperseded')}</span><br /><span className="muted small">{p.published_at ? fmt(p.published_at) : ''}</span></span>
            {p.acknowledged_at ? <span className="badge b-completed">✓ {t('ackAt')} · {fmt(p.acknowledged_at)}</span> : p.status === 'published' ? <span className="badge b-needs_documents">{t('ackWait')}</span> : <span />}
          </div>
        )
      })}
    </Card>
  )
}
