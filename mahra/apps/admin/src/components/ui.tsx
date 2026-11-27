import Link from 'next/link';
import type { ReactNode } from 'react';
import { COMMISSION_STATUS, DOC_STATUS, PROVIDER_STATUS } from '@/lib/strings';

type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'mute';

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

const PROVIDER_TONE: Record<string, Tone> = {
  approved: 'ok', pending_review: 'info', incomplete: 'warn', invited: 'mute', suspended: 'bad', terminated: 'bad',
};
export const ProviderBadge = ({ status }: { status: string }) => <Badge tone={PROVIDER_TONE[status] ?? 'mute'}>{PROVIDER_STATUS[status] ?? status}</Badge>;

const COMM_TONE: Record<string, Tone> = {
  paid: 'ok', due: 'info', proof_uploaded: 'info', needs_review: 'warn', overdue: 'bad', waived: 'mute',
};
export const CommissionBadge = ({ status }: { status: string }) => <Badge tone={COMM_TONE[status] ?? 'mute'}>{COMMISSION_STATUS[status] ?? status}</Badge>;

const DOC_TONE: Record<string, Tone> = { accepted: 'ok', uploaded: 'info', rejected: 'bad' };
export const DocBadge = ({ status }: { status: string }) => <Badge tone={DOC_TONE[status] ?? 'mute'}>{DOC_STATUS[status] ?? status}</Badge>;

/** نقطة اكتمال الوثائق: الأخضر/الأحمر مقترنان دائماً بنص (اللون لا يحمل المعنى وحده). */
export function ReadyDot({ dot, label = true }: { dot: 'green' | 'red'; label?: boolean }) {
  return (
    <span className="namecell" style={{ gap: 8, fontWeight: 500 }}>
      <span className={`dot ${dot}`} aria-hidden="true" />
      {label && <span className="small muted">{dot === 'green' ? 'مكتمل' : 'ناقص'}</span>}
    </span>
  );
}

export function ErrorAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="alert bad" role="alert">
      {message}
    </div>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="pagehead">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Stat({ n, label, sub, tone, href }: { n: ReactNode; label: string; sub?: string; tone?: 'bad' | 'warn' | 'ok' | 'gold'; href?: string }) {
  const body = (
    <>
      <span className="n">{n}</span>
      <span className="l">{label}</span>
      {sub && <span className="s">{sub}</span>}
    </>
  );
  const cls = `card stat ${tone ?? ''}`;
  return href ? <Link className={cls} href={href}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div className="check">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        {ok ? (
          <>
            <circle cx="10" cy="10" r="9" fill="#e3f4ee" />
            <path d="M5.8 10.4l2.8 2.8 5.6-6" fill="none" stroke="#12805c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <circle cx="10" cy="10" r="9" fill="#fbe9e7" />
            <path d="M6.8 6.8l6.4 6.4M13.2 6.8l-6.4 6.4" stroke="#b8332a" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
      </svg>
      <span>{children}</span>
      <span className="small muted" style={{ marginInlineStart: 'auto' }}>{ok ? 'متوفر' : 'ناقص'}</span>
    </div>
  );
}
