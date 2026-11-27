import Link from 'next/link';
import { connection } from 'next/server';
import { reviewProof } from '@/app/actions';
import { Badge, CommissionBadge, ErrorAlert, PageHead } from '@/components/ui';
import { PaidToggle } from '@/components/PaidToggle';
import { aed, date, num } from '@/lib/format';
import { listCommissions, listProofsToReview, type ProofRow } from '@/lib/queries';

const FILTERS = [
  { key: 'open', label: 'مفتوحة' },
  { key: 'overdue', label: 'متأخرة' },
  { key: 'review', label: 'بحاجة مراجعة' },
  { key: 'paid', label: 'مدفوعة' },
  { key: 'all', label: 'الكل' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

function Compare({ ok, label, declared, read }: { ok: boolean | null; label: string; declared: string; read: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td className={label === 'مرجع التحويل' ? 'mono' : undefined}>{declared}</td>
      <td className={label === 'مرجع التحويل' ? 'mono' : undefined}>{read}</td>
      <td>{ok === null ? <Badge tone="mute">لم يُقرأ</Badge> : ok ? <Badge tone="ok">مطابق</Badge> : <Badge tone="bad">غير مطابق</Badge>}</td>
    </tr>
  );
}

function ProofCard({ pr, back }: { pr: ProofRow; back: string }) {
  const o = pr.ocr;
  const scanned = o !== null;
  return (
    <article className="card" id={`proof-${pr.id}`} aria-label={`إثبات تحويل ${pr.company_name}`}>
      <header>
        <h3>{pr.company_name}</h3>
        {scanned ? <Badge tone="warn">لم يطابق المسح الآلي</Badge> : <Badge tone="info">بانتظار المسح</Badge>}
      </header>
      <div className="pad stack" style={{ gap: 12 }}>
        <p className="small muted">
          الملف: <span className="mono">{pr.storage_path}</span> · عمولات: {num(pr.n)} · رُفع {date(pr.created_at)}
        </p>
        <div className="tablewrap">
          <table>
            <thead><tr><th>البند</th><th>ما صرّح به المزود</th><th>ما قرأه المسح</th><th>النتيجة</th></tr></thead>
            <tbody>
              <Compare label="المبلغ" ok={scanned ? Number(o?.amount_fils) === Number(pr.declared_amount_fils) : null} declared={aed(pr.declared_amount_fils)} read={scanned ? aed(o?.amount_fils) : '—'} />
              <Compare label="الحساب المستفيد (حساب مهرة)" ok={scanned ? !!o?.iban_match : null} declared="حساب مهرة" read={scanned ? (o?.iban_match ? 'حساب مهرة' : 'حساب آخر') : '—'} />
              <Compare label="مرجع التحويل" ok={scanned ? !!o?.reference && o.reference === pr.reference : null} declared={pr.reference ?? '—'} read={o?.reference ?? '—'} />
            </tbody>
          </table>
        </div>
        <div className="row" style={{ alignItems: 'center' }}>
          <form action={reviewProof} style={{ flex: '0 0 auto' }}>
            <input type="hidden" name="id" value={pr.id} />
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="decision" value="approve" />
            <button className="btn primary">اعتماد التحويل (مدفوعة)</button>
          </form>
          <form action={reviewProof} style={{ flex: '0 0 auto' }}>
            <input type="hidden" name="id" value={pr.id} />
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="decision" value="reject" />
            <button className="btn">رفض (تعود مستحقة)</button>
          </form>
        </div>
      </div>
    </article>
  );
}

export default async function Commissions({ searchParams }: { searchParams: Promise<{ f?: string; error?: string }> }) {
  await connection();
  const sp = await searchParams;
  const f: FilterKey = FILTERS.some((x) => x.key === sp.f) ? (sp.f as FilterKey) : 'open';
  const back = `/commissions?f=${f}`;
  const [list, proofs] = await Promise.all([listCommissions(f), listProofsToReview()]);
  const sum = list.reduce((a, c) => a + Number(c.amount_fils), 0);

  return (
    <div className="stack">
      <PageHead title="العمولات" sub="هل سُدّدت عمولة مهرة؟ نعم أو لا. الاختيار يُحفظ فوراً ويُسجَّل في التدقيق." />
      <ErrorAlert message={sp.error} />

      {proofs.length > 0 && (
        <section className="stack" aria-label="إثباتات تنتظر قرارك">
          <h2>إثباتات تنتظر قرارك ({num(proofs.length)})</h2>
          {proofs.map((pr) => <ProofCard key={pr.id} pr={pr} back={back} />)}
        </section>
      )}

      <section className="stack" aria-label="لوحة العمولات">
        <nav className="tabs" aria-label="تصفية العمولات">
          {FILTERS.map((x) => (
            <Link key={x.key} href={`/commissions?f=${x.key}`} aria-current={f === x.key ? 'page' : undefined}>
              {x.label}
            </Link>
          ))}
        </nav>

        <div className="card tablewrap">
          {list.length === 0 ? (
            <p className="empty">لا عمولات في هذا العرض.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>المزود</th>
                  <th>الطلب</th>
                  <th className="num">المبلغ</th>
                  <th>الاستحقاق</th>
                  <th>الحالة</th>
                  <th>هل سُدّدت؟</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/providers/${c.provider_id}`} style={{ fontWeight: 600 }}>{c.company_name}</Link></td>
                    <td>{c.title}</td>
                    <td className="num"><b>{aed(c.amount_fils)}</b></td>
                    <td>
                      {date(c.due_on)}
                      {c.status === 'overdue' && <span className="small" style={{ display: 'block', color: 'var(--bad)' }}>متأخرة {num(c.days_late)} أيام</span>}
                      {c.status === 'paid' && c.marked_by && <span className="small muted" style={{ display: 'block' }}>{c.marked_by === 'auto' ? 'سُجّلت آلياً' : 'سجّلها موظف'}</span>}
                    </td>
                    <td>
                      <CommissionBadge status={c.status} />
                      {c.proof_id && c.status !== 'paid' && <a className="small" href={`#proof-${c.proof_id}`} style={{ display: 'block', marginTop: 4 }}>عرض الإثبات</a>}
                    </td>
                    <td><PaidToggle id={c.id} paid={c.status === 'paid'} back={back} name={c.company_name} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={2} className="muted small" style={{ padding: '12px 16px' }}>{num(list.length)} عمولة في هذا العرض</td><td className="num"><b>{aed(sum)}</b></td><td colSpan={3} /></tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
