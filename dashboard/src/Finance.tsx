import { useState } from 'react'
import { ApiError, api, type FinDoc, type FinPayment, type QuoteLine, type Role } from './api'
import { useI18n, type Key } from './i18n'
import { Badge as _B, Card, Field, shortId, useAsync } from './ui'

void _B
/** "350.50" -> 35050 using integer arithmetic only. */
export function aedToFils(v: string): number | null {
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(v.trim())
  if (!m) return null
  const n = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return n > 0 ? n : null
}
export const fmtFils = (f: number) => `AED ${String(Math.floor(Math.abs(f) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(Math.abs(f) % 100).padStart(2, '0')}`

const errKey = (e: unknown): Key => {
  const c = e instanceof ApiError ? e.code : ''
  return c === 'scan_pending' ? 'e_scan' : c === 'second_approver_required' ? 'e_second' : c === 'exceeds_balance' || c === 'exceeds_paid' ? 'e_exceeds' : c === 'reference_used' ? 'e_refref' : c === 'invalid_request' || c === 'invalid_items' ? 'e_bad' : 'failed'
}

export function openDocument(setPreview: (p: { url: string; mime: string; name: string }) => void, doc: FinDoc) {
  return api.docBlob(doc.id).then((b) => setPreview({ url: URL.createObjectURL(new Blob([b], { type: 'text/html' })), mime: 'text/html', name: doc.number }))
}

export function FinanceCard({ requestId, role, setPreview }: { requestId: string; role: Role; setPreview: (p: { url: string; mime: string; name: string }) => void }) {
  const { t, lang, fmt } = useI18n()
  const { data: f, reload } = useAsync(() => api.finance(requestId), [requestId])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [lines, setLines] = useState<{ kind: QuoteLine['kind']; ar: string; en: string; amount: string }[]>([{ kind: 'service_fee', ar: '', en: '', amount: '' }])
  const [payAmt, setPayAmt] = useState(''); const [payMethod, setPayMethod] = useState('cash'); const [payRef, setPayRef] = useState('')
  const [refAmt, setRefAmt] = useState(''); const [payUrl, setPayUrl] = useState(''); const [govAmt, setGovAmt] = useState(''); const [govUrl, setGovUrl] = useState('')
  const canFin = role === 'owner' || role === 'manager' || role === 'accountant'
  const canRefund = role === 'owner' || role === 'manager'
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setMsg(null)
    try { await fn(); setMsg({ ok: true, text: ok ?? t('saved') }); reload() } catch (e) { setMsg({ ok: false, text: t(errKey(e)) }); reload() }
  }
  if (!f) return null
  const draft = f.quotes.find((q) => q.status === 'draft')
  const live = [...f.quotes].filter((q) => q.status !== 'draft').pop()
  const stateLabel: Record<string, Key> = { unpriced: 'stUnpriced', awaiting_payment: 'stAwaiting', partial: 'stPartial', paid: 'stPaid', refunded: 'stRefunded' }
  const qLabel: Record<string, Key> = { draft: 'quoteDraft', issued: 'quoteIssued', accepted: 'quoteAccepted', superseded: 'quoteSuperseded' }
  const dLabel: Record<string, Key> = { quote: 'dQuote', invoice: 'dInvoice', receipt: 'dReceipt', credit_note: 'dCredit' }
  const kLabel: Record<string, Key> = { government_fee: 'kGov', service_fee: 'kSvc' }
  const pLabel: Record<string, Key> = { pending_verification: 'pPending', approved: 'pApproved', rejected: 'pRejected' }
  const parsed = lines.map((l) => ({ ...l, fils: aedToFils(l.amount) }))
  const valid = parsed.length > 0 && parsed.every((l) => l.fils && l.ar.trim() && l.en.trim())
  const inv = f.documents.find((d) => d.doc_type === 'invoice' && d.status === 'issued')
  const paymentsOnly = f.payments.filter((p) => p.kind === 'payment')

  return (
    <Card title={t('finance')}>
      <div className="msg" style={{ background: '#fbe6e3', color: 'var(--bad)' }}>{t('finTest')}</div>
      <p className="muted small">{t('finTax')}</p>
      {msg && <div className={`msg ${msg.ok ? 'ok' : ''}`} role="status">{msg.text}</div>}
      <dl className="kv">
        <dt>{t('total')}</dt><dd dir="ltr" style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}><b>{fmtFils(f.totals.total)}</b> <span className="tag">{t(stateLabel[f.totals.state] ?? 'stUnpriced')}</span></dd>
        <dt>{t('paid')}</dt><dd dir="ltr" style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>{fmtFils(f.totals.paid)}</dd>
        <dt>{t('refunded')}</dt><dd dir="ltr" style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>{fmtFils(f.totals.refunded)}</dd>
        <dt>{t('pendingAmt')}</dt><dd dir="ltr" style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>{fmtFils(f.totals.pending)}</dd>
        <dt>{t('remaining')}</dt><dd dir="ltr" style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}><b>{fmtFils(f.totals.remaining)}</b></dd>
      </dl>

      <h3 style={{ marginTop: 14 }}>{t('feeStatement')}</h3>
      {f.quotes.filter((q) => q.status !== 'draft').map((q) => (
        <div className="file" key={q.id}><span>v{q.version} · <span dir="ltr">{q.number}</span> · <span dir="ltr">{fmtFils(q.total_fils)}</span></span><span className={`badge ${q.status === 'accepted' ? 'b-completed' : q.status === 'issued' ? 'b-review' : 'b-draft'}`}>{t(qLabel[q.status] ?? 'quoteDraft')}</span></div>
      ))}
      {!inv && (
        <div style={{ marginTop: 8 }}>
          <b className="small">{t('quoteDraft')}{draft ? ` v${draft.version}` : ''}</b>
          {lines.map((l, i) => (
            <div key={i} className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8, margin: '6px 0' }}>
              <Field label={t('lineKind')}><select value={l.kind} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, kind: e.target.value as QuoteLine['kind'] } : x)))}><option value="government_fee">{t('kGov')}</option><option value="service_fee">{t('kSvc')}</option></select></Field>
              <Field label={t('amountAed')}><input dir="ltr" inputMode="decimal" placeholder="350.50" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} /></Field>
              <Field label={t('descAr')}><input value={l.ar} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, ar: e.target.value } : x)))} /></Field>
              <Field label={t('descEn')}><input dir="ltr" value={l.en} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))} /></Field>
            </div>
          ))}
          <Field label={t('payLink')}><input dir="ltr" placeholder="https://…gov.ae/…" value={payUrl} onChange={(e) => setPayUrl(e.target.value)} /></Field>
          <div className="row">
            <button className="btn sm" onClick={() => setLines([...lines, { kind: 'service_fee', ar: '', en: '', amount: '' }])}>{t('addLine')}</button>
            <button className="btn sm" disabled={!valid} onClick={() => run(() => api.draftQuote(requestId, parsed.map((l) => ({ kind: l.kind, descriptionAr: l.ar.trim(), descriptionEn: l.en.trim(), amountFils: l.fils as number })), payUrl.trim()))}>{t('saveDraft')}</button>
            {canFin && draft && <button className="btn primary sm" onClick={() => run(() => api.issueQuote(draft.id))}>{t('issueInvoice')}</button>}
          </div>
          {draft && <p className="muted small">{draft.items.map((i) => `${t(kLabel[i.kind] ?? 'kSvc')}: ${fmtFils(i.amount_fils)}`).join(' · ')}</p>}
        </div>
      )}
      {canFin && inv && f.gov.total === 0 && (
        <div style={{ marginTop: 8 }}>
          <b className="small">{t('govFeeTitle')}</b> <span className="muted small">{t('govFeeNote')}</span>
          <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <Field label={t('amountAed')}><input dir="ltr" inputMode="decimal" placeholder="350" value={govAmt} onChange={(e) => setGovAmt(e.target.value)} /></Field>
            <Field label={t('payLink')}><input dir="ltr" placeholder="https://…gov.ae/…" value={govUrl} onChange={(e) => setGovUrl(e.target.value)} /></Field>
          </div>
          <button className="btn sm" disabled={!aedToFils(govAmt)} onClick={() => run(() => api.setGovFee(requestId, aedToFils(govAmt) as number, govUrl.trim()))}>{t('addGovFee')}</button>
        </div>
      )}
      {f.gov.total > 0 && (
        <>
          <h3 style={{ marginTop: 14 }}>{t('govTitle')}</h3>
          <p className="muted small">{t('govNote')}</p>
          <dl className="kv"><dt>{t('fullCost')}</dt><dd dir="ltr"><b>{fmtFils(f.totals.total + f.gov.total)}</b> <span className="muted small">({fmtFils(f.totals.total)} + {fmtFils(f.gov.total)})</span></dd><dt>{t('kGov')}</dt><dd dir="ltr">{fmtFils(f.gov.total)}</dd><dt>{t('govVerified')}</dt><dd dir="ltr">{fmtFils(f.gov.verified)}</dd><dt>{t('govRemaining')}</dt><dd dir="ltr">{fmtFils(f.gov.remaining)}</dd></dl>
          {f.gov.payUrl && <p className="small" dir="ltr">{f.gov.payUrl}</p>}
          {f.authorityPayments.map((a) => (
            <div className="file" key={a.id}>
              <span><b dir="ltr">{fmtFils(a.amount_fils)}</b> · <span dir="ltr">{a.reference}</span> · {fmt(a.created_at)} · <span className="badge">{t(a.status === 'verified' ? 'aVerified' : a.status === 'rejected' ? 'aRejected' : 'aReported')}</span>{a.note ? ` · ${a.note}` : ''}</span>
              {canFin && a.status === 'reported' && (
                <span className="row">
                  <button className="btn primary sm" onClick={() => run(() => api.verifyAuthority(a.id))}>{t('verifyGov')}</button>
                  <button className="btn sm danger" onClick={() => { const r = window.prompt(t('govRejectPrompt'))?.trim(); if (r) void run(() => api.rejectAuthority(a.id, r)) }}>{t('rejectGov')}</button>
                </span>
              )}
            </div>
          ))}
        </>
      )}
      {canFin && inv && <button className="btn sm danger" style={{ marginTop: 8 }} onClick={() => { const r = window.prompt(t('cancelReason'))?.trim(); if (r && r.length >= 10) void run(() => api.cancelInvoice(inv.id, r)) }}>{t('cancelInvoice')}</button>}

      {inv && (
        <>
          <h3 style={{ marginTop: 14 }}>{t('payments')}</h3>
          {f.payments.length === 0 && <p className="muted small">—</p>}
          {f.payments.map((p: FinPayment) => (
            <div className="file" key={p.id}>
              <span><b dir="ltr">{p.kind === 'refund' ? '−' : ''}{fmtFils(p.amount_fils)}</b> <span className={`badge ${p.status === 'approved' ? 'b-completed' : p.status === 'rejected' ? 'b-rejected' : 'b-needs_documents'}`}>{p.kind === 'refund' ? t('refundTitle') : t(pLabel[p.status] ?? 'pPending')}</span><br />
                <span className="muted small">{p.method} · <span dir="ltr">{p.reference ?? '—'}</span> · {fmt(p.created_at)} · {p.created_by_kind === 'customer' ? t('byCustomer') : t('byStaff')}{p.decision_note ? ` · ${p.decision_note}` : ''}{p.reason ? ` · ${p.reason}` : ''}</span></span>
              {canFin && p.kind === 'payment' && p.status === 'pending_verification' && (
                <span className="row">
                  {p.proof_file_id && <button className="btn sm" onClick={async () => { try { const b = await api.proofBlob(p.id); setPreview({ url: URL.createObjectURL(b), mime: b.type, name: 'proof' }) } catch (e) { setMsg({ ok: false, text: t(errKey(e)) }) } }}>{t('viewProof')}</button>}
                  <button className="btn primary sm" onClick={() => run(() => api.approvePayment(p.id))}>{t('approveP')}</button>
                  <button className="btn sm danger" onClick={() => { const r = window.prompt(t('rejectPrompt'))?.trim(); if (r) void run(() => api.rejectPayment(p.id, r)) }}>{t('rejectP')}</button>
                </span>
              )}
            </div>
          ))}
          {canFin && (
            <div style={{ marginTop: 8 }}>
              <b className="small">{t('recordPay')}</b>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <Field label={t('amountAed')}><input dir="ltr" inputMode="decimal" placeholder="500" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} /></Field>
                <Field label={t('method')}><select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}><option value="cash">{t('mCash')}</option><option value="bank_transfer">{t('mBank')}</option><option value="other">{t('mOther')}</option></select></Field>
                <Field label={t('refLabel')}><input dir="ltr" value={payRef} onChange={(e) => setPayRef(e.target.value)} /></Field>
              </div>
              <button className="btn sm" disabled={!aedToFils(payAmt)} onClick={() => run(async () => { await api.recordPayment(requestId, { amountFils: aedToFils(payAmt) as number, method: payMethod, reference: payRef.trim() || undefined }); setPayAmt(''); setPayRef('') })}>{t('recordPay')}</button>
            </div>
          )}
          {canRefund && paymentsOnly.some((p) => p.status === 'approved') && (
            <div style={{ marginTop: 10 }}>
              <b className="small">{t('refundTitle')}</b>
              <div className="row"><input dir="ltr" inputMode="decimal" placeholder="100" aria-label={t('amountAed')} value={refAmt} onChange={(e) => setRefAmt(e.target.value)} />
                <button className="btn sm danger" disabled={!aedToFils(refAmt)} onClick={() => { const r = window.prompt(t('refundReason'))?.trim(); if (r && r.length >= 10) void run(async () => { await api.refund(requestId, { amountFils: aedToFils(refAmt) as number, reason: r }); setRefAmt('') }) }}>{t('refundBtn')}</button></div>
            </div>
          )}
        </>
      )}

      {f.documents.length > 0 && (
        <>
          <h3 style={{ marginTop: 14 }}>{t('documentsFin')}</h3>
          {f.documents.map((d) => (
            <div className="file" key={d.id}>
              <span>{t(dLabel[d.doc_type] ?? 'dQuote')} · <span dir="ltr">{d.number}</span> · <span dir="ltr">{fmtFils(d.total_fils)}</span> {d.status === 'void' && <span className="badge b-rejected">{t('voidDoc')}</span>}</span>
              <button className="btn sm" onClick={() => void openDocument(setPreview, d)}>{t('view')}</button>
            </div>
          ))}
        </>
      )}
      <span hidden>{shortId(requestId)}</span>
    </Card>
  )
}

export function PaymentsQueue({ go }: { go: (h: string) => void }) {
  const { t, lang, fmt } = useI18n()
  const { data, loading, reload } = useAsync(() => api.paymentQueue(), [])
  const [msg, setMsg] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; mime: string; name: string } | null>(null)
  const act = async (fn: () => Promise<unknown>) => { setMsg(null); try { await fn(); reload() } catch (e) { setMsg(t(errKey(e))); reload() } }
  return (
    <>
      <h1>{t('paymentsQueue')}</h1>
      <div className="msg" style={{ background: '#fbe6e3', color: 'var(--bad)' }}>{t('finTest')}</div>
      {msg && <div className="msg">{msg}</div>}
      {loading && !data ? <p className="muted">{t('loading')}</p> : !data?.length ? <div className="empty">{t('queueEmpty')}</div> : (
        <div className="list">
          {data.map((p) => (
            <div key={p.id} className="item" style={{ cursor: 'default' }}>
              <span className="title">{p.title?.[lang] ?? '—'} · <span dir="ltr">{fmtFils(p.amount_fils)}</span></span>
              <span className="tag">{p.method}</span>
              <span className="meta"><span>{p.customer}</span><span dir="ltr">{p.reference ?? '—'}</span><span>{fmt(p.createdAt)}</span><span>{p.createdBy === 'customer' ? t('byCustomer') : t('byStaff')}</span></span>
              <span className="row" style={{ gridColumn: '1 / -1' }}>
                {p.hasProof && <button className="btn sm" onClick={async () => { try { const b = await api.proofBlob(p.id); setPreview({ url: URL.createObjectURL(b), mime: b.type, name: 'proof' }) } catch (e) { setMsg(t(errKey(e))) } }}>{t('viewProof')}</button>}
                <button className="btn primary sm" onClick={() => act(() => api.approvePayment(p.id))}>{t('approveP')}</button>
                <button className="btn sm danger" onClick={() => { const r = window.prompt(t('rejectPrompt'))?.trim(); if (r) void act(() => api.rejectPayment(p.id, r)) }}>{t('rejectP')}</button>
                <button className="btn sm" onClick={() => go(`#/requests/${p.requestId}`)}>{t('openRequest')}</button>
              </span>
            </div>
          ))}
        </div>
      )}
      {preview && (
        <div className="preview" role="dialog" aria-modal="true" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null) }}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <header><b dir="ltr">{preview.name}</b><button className="btn sm" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null) }}>{t('back')}</button></header>
            {preview.mime.startsWith('image/') ? <img src={preview.url} alt={preview.name} /> : <iframe src={preview.url} title={preview.name} />}
          </div>
        </div>
      )}
    </>
  )
}
