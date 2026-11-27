'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const I = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const ITEMS = [
  { href: '/', label: 'لوحة القيادة', icon: I('M4 13h6V4H4v9zm10 7h6V4h-6v16zM4 20h6v-3H4v3z') },
  { href: '/providers', label: 'المزودون', icon: I('M16 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 11a4 4 0 100-8 4 4 0 000 8zM21 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8') },
  { href: '/commissions', label: 'العمولات', icon: I('M3 7h18v12H3zM3 10h18M7 15h3') },
  { href: '/revenue', label: 'الإيرادات', icon: I('M4 20V10M10 20V4M16 20v-7M22 20H2') },
  { href: '/vat', label: 'مخصصات الضريبة', icon: I('M19 5L5 19M7.5 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z') },
];

const SOON = ['الطلبات', 'المحادثات والتصعيد', 'الوكلاء', 'روبوت الاستقطاب', 'سجل التدقيق'];

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  return (
    <nav className="nav" aria-label="القائمة الرئيسية">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(i.href) ? 'page' : undefined}>
          {i.icon}
          {i.label}
        </Link>
      ))}
      <div className="nav-label">قريباً</div>
      {SOON.map((s) => (
        <span key={s} className="soon" aria-disabled="true">
          {s}
        </span>
      ))}
    </nav>
  );
}
