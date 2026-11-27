// نسخة مطابقة لما في تطبيق العميل ومخطط قاعدة البيانات (offers_before_insert).
// TODO: تُستخرج إلى حزمة مشتركة (mahra/packages/shared) حين يُعدّ الـmonorepo، كي لا تنحرف النسخ.
/**
 * التسعير: العميل يرى «السعر النهائي» فقط = سعر المزود + عمولة مهرة (20%).
 * كل المبالغ بالفلس (1 درهم = 100 فلس) لتفادي أخطاء الفاصلة العائمة.
 * النسبة هنا افتراضية؛ النسبة الفعلية تُضبط لكل فئة من تطبيق المدير.
 */
export const DEFAULT_COMMISSION_RATE = 0.2;

export const toFils = (aed: number): number => Math.round(aed * 100);

export type Quote = {
  /** سعر المزود (لا يراه العميل) */
  providerPrice: number;
  /** عمولة مهرة المستحقة على المزود */
  commission: number;
  /** السعر الذي يراه العميل */
  customerPrice: number;
};

export function quote(providerPriceFils: number, rate = DEFAULT_COMMISSION_RATE): Quote {
  const commission = Math.round(providerPriceFils * rate);
  return {
    providerPrice: providerPriceFils,
    commission,
    customerPrice: providerPriceFils + commission,
  };
}

export function formatAed(fils: number, locale: string): string {
  // أرقام لاتينية في كل اللغات (المعتاد في الإمارات)
  const tag = locale === 'ar' ? 'ar-AE-u-nu-latn' : locale;
  return new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: fils % 100 === 0 ? 0 : 2,
  }).format(fils / 100);
}
