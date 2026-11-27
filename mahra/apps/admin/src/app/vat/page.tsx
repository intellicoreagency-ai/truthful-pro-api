import { connection } from 'next/server';
import { PageHead, Stat } from '@/components/ui';
import { aed, date, num } from '@/lib/format';
import { listVat } from '@/lib/queries';

export default async function Vat() {
  await connection();
  const rows = await listVat();
  const total = rows.reduce((a, r) => a + Number(r.vat_fils), 0);
  const base = rows.reduce((a, r) => a + Number(r.base_fils), 0);

  return (
    <div className="stack">
      <PageHead title="مخصصات الضريبة" sub="ضريبة القيمة المضافة 5% على كل عمولة تُسجَّل مدفوعة. تُحذف عند التراجع عن «مدفوعة»." />
      <div className="alert" style={{ background: 'var(--warn-bg)', color: 'var(--warn)', borderColor: '#ecd49a' }} role="note">
        وعاء الاحتساب الحالي = قيمة العمولة. هذا افتراض بانتظار تأكيد المحاسب، ويُسجَّل الوعاء في كل سطر لتعديله لاحقاً دون فقد البيانات.
      </div>
      <section className="grid stats">
        <Stat tone="gold" n={aed(total)} label="إجمالي المخصَّص للضريبة" />
        <Stat n={aed(base)} label="وعاء الاحتساب" sub={`${num(rows.length)} سطر`} />
      </section>
      <div className="card tablewrap">
        {rows.length === 0 ? (
          <p className="empty">لا مخصصات بعد. تظهر عند تسجيل أول عمولة مدفوعة.</p>
        ) : (
          <table>
            <thead><tr><th>التاريخ</th><th>المزود</th><th>الطلب</th><th className="num">الوعاء</th><th className="num">النسبة</th><th className="num">الضريبة</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{date(r.created_at)}</td>
                  <td>{r.company_name}</td>
                  <td>{r.title}</td>
                  <td className="num">{aed(r.base_fils)}</td>
                  <td className="num">{(Number(r.rate) * 100).toFixed(0)}%</td>
                  <td className="num"><b>{aed(r.vat_fils)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
