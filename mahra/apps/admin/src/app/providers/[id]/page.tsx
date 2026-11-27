import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { reviewDocument, setProviderStatus } from '@/app/actions';
import { Badge, Check, CommissionBadge, DocBadge, ErrorAlert, PageHead, ProviderBadge, ReadyDot } from '@/components/ui';
import { aed, date } from '@/lib/format';
import { getProvider } from '@/lib/queries';
import { DOC_KIND, EMIRATE, MISSING, SUSPEND_REASON } from '@/lib/strings';

const REQUIRED = ['phone', 'whatsapp', 'maps_url', 'categories', 'coverage', 'trade_license', 'tenancy_contract'];

export default async function ProviderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await connection();
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getProvider(id);
  if (!d) notFound();
  const { p } = d;
  const canApprove = d.missing_accepted.length === 0;

  return (
    <div className="stack">
      <p className="small">
        <Link href="/providers" className="muted">← المزودون</Link>
      </p>
      <PageHead title={p.company_name} sub={`انضم ${date(p.created_at)}`}>
        <span className="inline">
          <ReadyDot dot={d.dot} />
          <ProviderBadge status={p.status} />
        </span>
      </PageHead>
      <ErrorAlert message={error} />

      {(p.status === 'suspended' || p.status === 'terminated') && (
        <div className="alert bad" role="note">
          <b>{p.status === 'suspended' ? 'الحساب موقوف' : 'الحساب ملغى'}.</b> السبب: {SUSPEND_REASON[p.status_reason ?? ''] ?? p.status_reason ?? 'غير مذكور'}
        </div>
      )}

      <div className="grid two">
        <section className="card" aria-label="الإجراءات">
          <header><h2>الإجراءات</h2></header>
          <div className="pad stack" style={{ gap: 12 }}>
            {['invited', 'incomplete', 'pending_review'].includes(p.status) && (
              <form action={setProviderStatus} className="stack" style={{ gap: 10 }}>
                <input type="hidden" name="provider" value={p.id} />
                <input type="hidden" name="status" value="approved" />
                <input type="hidden" name="reason" value="اعتماد بعد مراجعة الوثائق" />
                <button className="btn gold" disabled={!canApprove}>اعتماد المزود</button>
                {!canApprove && (
                  <p className="small muted">
                    لا يمكن الاعتماد قبل قبول: {d.missing_accepted.map((m) => MISSING[m] ?? m).join('، ')}.
                  </p>
                )}
              </form>
            )}

            {p.status === 'suspended' && (
              <details className="act">
                <summary>إعادة التفعيل (override)</summary>
                <form action={setProviderStatus}>
                  <input type="hidden" name="provider" value={p.id} />
                  <input type="hidden" name="status" value="approved" />
                  <label className="field">السبب (مطلوب)
                    <input type="text" name="reason" required placeholder="مثال: تم الاتفاق على سداد العمولة" />
                  </label>
                  <label className="field">مهلة بلا إيقاف آلي (أيام)
                    <input type="number" name="override_days" min={1} max={60} defaultValue={7} />
                  </label>
                  <button className="btn primary">إعادة التفعيل</button>
                </form>
              </details>
            )}

            {p.status === 'approved' && (
              <details className="act">
                <summary>إيقاف الحساب مؤقتاً</summary>
                <form action={setProviderStatus}>
                  <input type="hidden" name="provider" value={p.id} />
                  <input type="hidden" name="status" value="suspended" />
                  <label className="field">السبب (مطلوب)
                    <input type="text" name="reason" required placeholder="مثال: شكوى من عميل قيد التحقيق" />
                  </label>
                  <button className="btn danger">إيقاف</button>
                </form>
              </details>
            )}

            {p.status !== 'terminated' && (
              <details className="act">
                <summary>إلغاء الحساب نهائياً</summary>
                <form action={setProviderStatus}>
                  <input type="hidden" name="provider" value={p.id} />
                  <input type="hidden" name="status" value="terminated" />
                  <p className="small muted">الإلغاء نهائي ولا يمكن إرجاع الحساب. يُسجَّل في سجل التدقيق.</p>
                  <label className="field">السبب (مطلوب)
                    <input type="text" name="reason" required placeholder="غير كفء، مشكلة مع عميل، سوء أدب، اتفاق خارج التطبيق…" />
                  </label>
                  <button className="btn danger">إلغاء الحساب</button>
                </form>
              </details>
            )}
            {p.status === 'terminated' && <p className="muted">الحساب ملغى نهائياً؛ لا إجراءات متاحة.</p>}
          </div>
        </section>

        <section className="card" aria-label="اكتمال الملف">
          <header><h2>اكتمال الملف</h2></header>
          <div className="pad">
            {REQUIRED.map((k) => (
              <Check key={k} ok={!d.missing.includes(k)}>{MISSING[k]}</Check>
            ))}
          </div>
        </section>
      </div>

      <div className="grid two">
        <section className="card" aria-label="بيانات المزود">
          <header><h2>البيانات</h2></header>
          <dl className="kv pad" style={{ margin: 0 }}>
            <dt>الهاتف</dt><dd className="mono">{p.phone ?? '—'}</dd>
            <dt>الواتساب</dt><dd className="mono">{p.whatsapp ?? '—'}</dd>
            <dt>الموقع</dt><dd>{p.maps_url ? <a href={p.maps_url} className="mono" rel="noreferrer">{p.maps_url}</a> : '—'}</dd>
            <dt>الفئات</dt><dd>{d.categories.join('، ') || '—'}</dd>
            <dt>التغطية</dt><dd>{d.emirates.map((e) => EMIRATE[e] ?? e).join('، ') || '—'}</dd>
            <dt>التقييم</dt><dd>{p.rating_avg ? `${p.rating_avg} (${p.rating_count})` : 'لا تقييمات بعد'}</dd>
          </dl>
        </section>

        <section className="card" aria-label="الوثائق">
          <header><h2>الوثائق</h2></header>
          {d.docs.length === 0 ? (
            <p className="empty">لم يرفع المزود أي وثيقة.</p>
          ) : (
            <div className="pad stack" style={{ gap: 14 }}>
              {d.docs.map((doc) => (
                <div key={doc.id} className="stack" style={{ gap: 8, paddingBottom: 14, borderBottom: '1px solid var(--line-soft)' }}>
                  <div className="between">
                    <b>{DOC_KIND[doc.kind] ?? doc.kind}</b>
                    <DocBadge status={doc.status} />
                  </div>
                  <p className="small muted">
                    <span className="mono">{doc.storage_path}</span> · ينتهي {date(doc.expires_on)}
                  </p>
                  {doc.reject_reason && <p className="small" style={{ color: 'var(--bad)' }}>سبب الرفض: {doc.reject_reason}</p>}
                  {doc.status === 'uploaded' && (
                    <div className="row">
                      <form action={reviewDocument} style={{ flex: '0 0 auto' }}>
                        <input type="hidden" name="provider" value={p.id} />
                        <input type="hidden" name="id" value={doc.id} />
                        <input type="hidden" name="decision" value="accept" />
                        <button className="btn sm primary">قبول</button>
                      </form>
                      <form action={reviewDocument} className="row" style={{ flex: '1 1 260px' }}>
                        <input type="hidden" name="provider" value={p.id} />
                        <input type="hidden" name="id" value={doc.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <input type="text" name="reason" required placeholder="سبب الرفض" aria-label="سبب الرفض" />
                        <button className="btn sm">رفض</button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card tablewrap" aria-label="العمولات">
        <header><h2>العمولات</h2></header>
        {d.commissions.length === 0 ? (
          <p className="empty">لا عمولات بعد.</p>
        ) : (
          <table>
            <thead><tr><th>الطلب</th><th className="num">المبلغ</th><th>الاستحقاق</th><th>الحالة</th></tr></thead>
            <tbody>
              {d.commissions.map((c) => (
                <tr key={c.id}>
                  <td>{c.title}</td>
                  <td className="num">{aed(c.amount_fils)}</td>
                  <td>{date(c.due_on)}</td>
                  <td><CommissionBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" aria-label="سجل التدقيق">
        <header><h2>سجل التدقيق</h2></header>
        {d.audit.length === 0 ? (
          <p className="empty">لا تغييرات حالة مسجلة.</p>
        ) : (
          <div className="pad stack" style={{ gap: 8 }}>
            {d.audit.map((a, i) => (
              <p key={i} className="small">
                <span className="muted">{date(a.at)}</span> · {a.before?.status} ← <b>{a.after?.status}</b>{' '}
                <Badge tone="mute">{a.actor_kind === 'auto' ? 'آلي' : 'موظف'}</Badge>
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
