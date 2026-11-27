import Link from 'next/link';
import { connection } from 'next/server';
import { PageHead, ProviderBadge } from '@/components/ui';
import { num } from '@/lib/format';
import { countProvidersByStatus, listProviders } from '@/lib/queries';
import { EMIRATE, MISSING, PROVIDER_STATUS } from '@/lib/strings';

const ORDER = ['pending_review', 'incomplete', 'invited', 'approved', 'suspended', 'terminated'];

export default async function Providers({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await connection();
  const { status } = await searchParams;
  const current = status && ORDER.includes(status) ? status : undefined;
  const [list, counts] = await Promise.all([listProviders(current), countProvidersByStatus()]);
  const total = counts.reduce((a, c) => a + c.n, 0);
  const n = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;

  return (
    <div className="stack">
      <PageHead title="المزودون" sub="النقطة بجانب الاسم: أخضر = كل المطلوب مرفوع وجاهز للمراجعة، أحمر = ناقص." />

      <nav className="tabs" aria-label="تصفية حسب الحالة">
        <Link href="/providers" aria-current={!current ? 'page' : undefined}>
          الكل <b>{num(total)}</b>
        </Link>
        {ORDER.map((s) => (
          <Link key={s} href={`/providers?status=${s}`} aria-current={current === s ? 'page' : undefined}>
            {PROVIDER_STATUS[s]} <b>{num(n(s))}</b>
          </Link>
        ))}
      </nav>

      <div className="card tablewrap">
        {list.length === 0 ? (
          <p className="empty">لا مزودين في هذه الحالة.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>المزود</th>
                <th>الحالة</th>
                <th>الفئات</th>
                <th>التغطية</th>
                <th>ما ينقصه</th>
                <th className="num">عمولات مفتوحة</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/providers/${p.id}`} className="namecell">
                      <span className={`dot ${p.dot}`} aria-hidden="true" />
                      <span>
                        {p.company_name}
                        <small style={{ display: 'block' }}>{p.dot === 'green' ? 'مكتمل' : 'ناقص'}</small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <ProviderBadge status={p.status} />
                  </td>
                  <td>{p.categories ?? '—'}</td>
                  <td>{(p.emirates ?? []).map((e) => EMIRATE[e] ?? e).join('، ') || '—'}</td>
                  <td>
                    {p.missing.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <span className="chips">
                        {p.missing.map((m) => (
                          <span key={m} className="chip bad">
                            {MISSING[m] ?? m}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="num">{num(p.open_commissions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="small muted inline">
        <span className="inline" style={{ gap: 6 }}><span className="dot green" aria-hidden="true" /> مكتمل</span>
        <span className="inline" style={{ gap: 6 }}><span className="dot red" aria-hidden="true" /> ناقص</span>
      </p>
    </div>
  );
}
