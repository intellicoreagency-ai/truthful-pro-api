import { useState, type ReactNode } from 'react'
import { ApiError, api, type Detail, type FileRow, type Role, type Status } from './api'
import { STATUS_LABEL, useI18n } from './i18n'
import { Field, Badge, Card, NEXT, shortId, useAsync } from './ui'

type Preview = { url: string; mime: string; name: string }

export function RequestDetail({ id, me, back }: { id: string; me: { id: string; role: Role }; back: () => void }) {
  const { t, lang, fmt, day } = useI18n()
  const { data: d, loading, error, reload } = useAsync(() => api.request(id), [id])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)

  const act = async (fn: () => Promise<unknown>) => {
    setMsg(null)
    try { await fn(); setMsg({ ok: true, text: t('saved') }); reload() }
    catch (e) { setMsg({ ok: false, text: e instanceof ApiError && e.code === 'invalid_transition' ? t('invalidTransition') : e instanceof ApiError && e.code === 'version_conflict' ? t('conflict') : t('failed') }); if (e instanceof ApiError && e.status === 409) reload() }
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
      {(() => {
        const next = NEXT[r.status]
        const showNext = !!next && d.transitions.includes(next)
        const mine = r.assigneeId === me.id
        if (!showNext && mine) return null
        return (
          <div className="quick" role="group" aria-label={t('actions')}>
            {showNext && <button className="btn primary" onClick={() => { const ref = next === 'authority' ? window.prompt(t('refNeeded'))?.trim() : undefined; if (next === 'authority' && !ref) return; void act(() => api.setStatus(r.id, next as Status, { reference: ref, expectedVersion: r.version })) }}>{t('nextStep')}: {STATUS_LABEL[next as Status][lang]}</button>}
            {!mine && <button className="btn" onClick={() => act(() => api.assign(r.id, me.id, r.version))}>{t('assignToMe')}</button>}
          </div>
        )
      })()}
      <div className="detail" style={{ marginTop: 14 }}>
        <div>
          <Card title={t('customer')}>
            <dl className="kv">
              <dt>{t('name')}</dt><dd>{d.customer.name || '—'}</dd>
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
            {d.files.length === 0 && <p className="muted">{t('noFiles')}</p>}
            {d.files.map((f) => (
              <div className="file" key={f.id}>
                <span>{f.kind === 'final' ? <span className="tag">{t('delivery')}</span> : f.kind === 'invoice' ? <span className="tag">{t('invoice')}</span> : null} {f.label || f.name}<br /><span className="muted small">{f.name} · {Math.max(1, Math.round(f.size / 1024))} KB</span></span>
                <button className="btn sm" onClick={() => openFile(f)}>{t('view')}</button>
              </div>
            ))}
          </Card>
          {r.deliveryVersion > 0 && (
            <Card title={t('delivery2')}>
              <dl className="kv">
                <dt>{t('deliveryVer')}</dt><dd>{r.deliveryVersion}</dd>
                <dt>{t('ackDone')}</dt><dd>{r.acknowledgedVersion >= r.deliveryVersion && r.acknowledgedAt ? <span className="badge b-completed">✓ {fmt(r.acknowledgedAt)}</span> : <span className="badge b-needs_documents">{t('ackWait')}</span>}</dd>
              </dl>
            </Card>
          )}
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

const Row = ({ k, v }: { k: string; v: string }): ReactNode => <><dt>{k}</dt><dd>{v}</dd></>

function Actions({ d, me, act }: { d: Detail; me: { id: string }; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const { t, lang } = useI18n()
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
            {to === 'rejected' && <Field label={t('rejectReason')}><input value={rejReason} onChange={(e) => setRejReason(e.target.value)} /></Field>}
            <Field label={t('expected')}><input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
            <Field label={t('note')}><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <button className="btn primary" disabled={!to || (to === 'authority' && reference.trim().length < 3) || (to === 'rejected' && rejReason.trim().length < 3)} onClick={() => act(async () => { await api.setStatus(r.id, to as Status, { note: note || undefined, expectedAt: expected || undefined, reference: reference.trim() || undefined, reason: rejReason.trim() || undefined, expectedVersion: r.version }); setTo(''); setNote(''); setReference(''); setRejReason('') })}>{t('apply')}</button>
          </>
        )}
      </Card>
      {canAsk && (
        <Card title={t('askMissing')}>
          {rows.map((row, i) => (
            <div key={i} style={{ borderBottom: '1px dashed var(--line)', marginBottom: 10 }}>
              <Field label={t('docNameAr')}><input value={row.ar} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, ar: e.target.value } : x)))} /></Field>
              <Field label={t('docNameEn')}><input dir="ltr" value={row.en} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))} /></Field>
              <Field label={t('noteToCustomer')}><input value={row.note} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} /></Field>
            </div>
          ))}
          <div className="row">
            <button className="btn sm" onClick={() => setRows([...rows, { ar: '', en: '', note: '' }])}>{t('addRow')}</button>
            <button className="btn primary sm" disabled={!rows.every((x) => x.ar.trim() && x.en.trim())}
              onClick={() => act(async () => { await api.missing(r.id, rows.map((x) => ({ labelAr: x.ar.trim(), labelEn: x.en.trim(), noteAr: x.note.trim(), noteEn: x.note.trim() })), r.version); setRows([{ ar: '', en: '', note: '' }]) })}>{t('send')}</button>
          </div>
        </Card>
      )}
      <Card title={t('uploadFile')}>
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
  const all: Status[] = ['submitted', 'review', 'needs_documents', 'authority', 'decision', 'completed', 'rejected', 'cancelled']
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
