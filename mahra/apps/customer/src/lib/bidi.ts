/** يعزل مقطعاً لاتينياً (+971، CV، AI) داخل جملة عربية فلا ينقلب ترتيبه (LRI … PDI، وهي محارف غير مرئية). */
export const ltr = (s: string | number): string => `⁦${s}⁩`;
