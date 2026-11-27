/** المبالغ مخزنة بالفلس (1 درهم = 100 فلس). أرقام لاتينية (المعتاد في الإمارات). */
export function aedFmt(fils: number, lang: 'ar' | 'en'): string {
  const n = fils / 100;
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-AE', {
    style: 'currency', currency: 'AED', maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

export function dateFmt(ms: number, lang: 'ar' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-AE', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(ms));
}
