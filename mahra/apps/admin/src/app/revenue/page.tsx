import { connection } from 'next/server';
import { PageHead, Stat } from '@/components/ui';
import { aed, num } from '@/lib/format';
import { getRevenue } from '@/lib/queries';

function Bars({ rows, label }: { rows: { name: string; fils: string; n: number }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.fils)));
  return (
    <section className="card" aria-label={label}>
      <header><h2>{label}</h2></header>
      {rows.length === 0 ? (
        <p className="empty">لا إيرادات محصَّلة بعد.</p>
      ) : (
        <div className="pad stack" style={{ gap: 14 }}>
          {rows.map((r) => (
            <div key={r.name} className="stack" style={{ gap: 6 }}>
              <div className="row" style={{ alignItems: 'baseline' }}>
                <span style={{ flex: '1 1 auto' }}>{r.name} <span className="small muted">· {num(r.n)} عمولة</span></span>
                <b style={{ flex: '0 0 auto' }}>{aed(r.fils)}</b>
              </div>
              <div className="bar" aria-hidden="true"><i style={{ width: `${(Number(r.fils) / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function Revenue() {
  await connection();
  const r = await getRevenue();
  return (
    <div className="stack">
      <PageHead title="إيرادات مهرة" sub="العمولات المحصَّلة فعلاً (حالة «مدفوعة») فقط." />
      <section className="grid stats">
        <Stat tone="ok" n={aed(r.total_paid)} label="إجمالي المحصَّل" />
        <Stat tone="warn" n={aed(r.pending)} label="بانتظار التحصيل" sub="مستحقة أو متأخرة أو قيد المراجعة" />
      </section>
      <div className="grid two">
        <Bars label="حسب الشهر" rows={r.byMonth.map((x) => ({ name: x.m, fils: x.fils, n: x.n }))} />
        <Bars label="حسب فئة الخدمة" rows={r.byCategory.map((x) => ({ name: x.name_ar, fils: x.fils, n: x.n }))} />
      </div>
      <Bars label="حسب المزود" rows={r.byProvider.map((x) => ({ name: x.company_name, fils: x.fils, n: x.n }))} />
    </div>
  );
}
