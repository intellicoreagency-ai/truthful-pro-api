const LOCALE = 'ar-AE-u-nu-latn'; // أرقام لاتينية (المعتاد في الإمارات)

/** المبالغ مخزنة بالفلس */
export function aed(fils: number | string | bigint | null | undefined): string {
  const n = Number(fils ?? 0) / 100;
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

export function date(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
}

export function num(n: number | string | bigint | null | undefined): string {
  return new Intl.NumberFormat(LOCALE).format(Number(n ?? 0));
}
