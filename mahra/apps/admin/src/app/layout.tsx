import type { Metadata, Viewport } from 'next';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import './globals.css';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: 'لوحة مدير مهرة',
  description: 'اعتماد المزودين وتحصيل العمولات والإيرادات',
};

export const viewport: Viewport = { themeColor: '#0b1530' };

function Pearl() {
  return (
    <svg width="40" height="40" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <radialGradient id="pg" cx="34%" cy="28%" r="78%">
          <stop offset="0" stopColor="#ede7da" stopOpacity=".7" />
          <stop offset=".3" stopColor="#3d63dd" stopOpacity=".6" />
          <stop offset=".75" stopColor="#0b1530" />
          <stop offset="1" stopColor="#060a18" />
        </radialGradient>
        <linearGradient id="pr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9b66b" />
          <stop offset="1" stopColor="#6fc7d1" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="90" fill="url(#pg)" />
      <circle cx="100" cy="100" r="90" fill="none" stroke="url(#pr)" strokeWidth="5" />
      <ellipse cx="72" cy="58" rx="34" ry="17" fill="#ede7da" opacity=".2" transform="rotate(-28 72 58)" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <a className="skip" href="#main">تخطَّ إلى المحتوى</a>
        <div className="shell">
          <aside className="side">
            <div className="brand">
              <Pearl />
              <div>
                <b translate="no">مهرة</b>
                <small>لوحة المدير</small>
              </div>
            </div>
            <Nav />
          </aside>
          <main className="main" id="main" tabIndex={-1}>
            <div className="devbar" role="note">
              وضع التطوير: بيانات تجريبية في الذاكرة، ودخول تجريبي بدور «مالك». لا يُستعمل مع بيانات حقيقية.
            </div>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
