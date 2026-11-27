import Link from 'next/link';
import { connection } from 'next/server';
import { CommissionBadge, PageHead, ProviderBadge, Stat } from '@/components/ui';
import { aed, date, num } from '@/lib/format';
import { getDashboard, listCommissions, listProviders } from '@/lib/queries';

export default async function Dashboard() {
  await connection(); // بيانات حية في كل طلب، لا تُعرض ثابتة
  const [d, overdue, review, pending] = await Promise.all([
    getDashboard(),
    listCommissions('overdue'),
    listCommissions('review'),
    listProviders('pending_review'),
  ]);

  return (
    <div className="stack">
      <PageHead title="لوحة القيادة" sub="ما يحتاج قرارك الآن، ثم الأرقام." />

      <section aria-label="يحتاج انتباهك" className="card">
        <header>
          <h2>يحتاج انتباهك</h2>
          <span className="small muted">{num(pending.length + overdue.length + review.length)} عنصر</span>
        </header>
        {pending.length + overdue.length + review.length === 0 ? (
          <p className="empty">لا شيء ينتظرك. كل شيء مُراجَع.</p>
        ) : (
          <div className="attn">
            {overdue.map((c) => (
              <Link key={c.id} href="/commissions?f=overdue">
                <span className="t">
                  <b>{c.company_name}</b> · عمولة {aed(c.amount_fils)} متأخرة {num(c.days_late)} أيام
                </span>
                <CommissionBadge status="overdue" />
              </Link>
            ))}
            {review.map((c) => (
              <Link key={c.id} href="/commissions?f=review">
                <span className="t">
                  <b>{c.company_name}</b> · إثبات تحويل {aed(c.amount_fils)} ينتظر مراجعتك
                </span>
                <CommissionBadge status={c.status} />
              </Link>
            ))}
            {pending.map((p) => (
              <Link key={p.id} href={`/providers/${p.id}`}>
                <span className="t">
                  <b>{p.company_name}</b> · وثائقه {p.dot === 'green' ? 'مكتملة وجاهزة للمراجعة' : 'ناقصة'}
                </span>
                <ProviderBadge status={p.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-label="العمولات" className="grid stats">
        <Stat tone="bad" href="/commissions?f=overdue" n={aed(d.overdue_fils)} label="عمولات متأخرة" sub={`${num(d.overdue_n)} عمولة`} />
        <Stat tone="warn" href="/commissions?f=open" n={aed(d.due_fils)} label="عمولات مستحقة" sub={`${num(d.due_n)} عمولة ضمن المهلة`} />
        <Stat tone="warn" href="/commissions?f=review" n={num(d.review_n)} label="إثباتات تحتاج مراجعة" sub="المسح الآلي لم يطابقها" />
        <Stat tone="ok" href="/revenue" n={aed(d.month_paid_fils)} label="محصَّل هذا الشهر" />
      </section>

      <section aria-label="المزودون" className="grid stats">
        <Stat href="/providers?status=pending_review" n={num(d.pending_providers)} label="مزودون بانتظار الاعتماد" />
        <Stat href="/providers?status=approved" n={num(d.approved_n)} label="مزودون معتمدون" />
        <Stat tone={d.suspended_n ? 'bad' : undefined} href="/providers?status=suspended" n={num(d.suspended_n)} label="مزودون موقوفون" />
        <Stat tone="gold" href="/vat" n={aed(d.vat_fils)} label="مخصصات الضريبة (5%)" sub={`آخر تحديث ${date(new Date())}`} />
      </section>
    </div>
  );
}
