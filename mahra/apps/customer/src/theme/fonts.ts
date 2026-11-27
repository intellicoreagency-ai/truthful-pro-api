import { Platform, type TextStyle } from 'react-native';
import type { Lang } from '@/i18n';

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

/**
 * الخطوط تتبع سلسلة مرجع Spatial Glass: "SF Pro" ثم "Noto Sans Arabic".
 * العربية: Noto Sans Arabic محمّل (4 أوزان). اللاتينية والروسية: خط النظام (SF Pro على آيفون، Roboto على أندرويد)،
 * فلا يوجد ملف لاتيني قد يفشل تحميله ولا رجوع إلى Times.
 */
export const fontSources = {
  NotoSansArabic_400Regular: require('@expo-google-fonts/noto-sans-arabic/400Regular/NotoSansArabic_400Regular.ttf'),
  NotoSansArabic_500Medium: require('@expo-google-fonts/noto-sans-arabic/500Medium/NotoSansArabic_500Medium.ttf'),
  NotoSansArabic_600SemiBold: require('@expo-google-fonts/noto-sans-arabic/600SemiBold/NotoSansArabic_600SemiBold.ttf'),
  NotoSansArabic_700Bold: require('@expo-google-fonts/noto-sans-arabic/700Bold/NotoSansArabic_700Bold.ttf'),
};

const suffix: Record<FontWeight, string> = { regular: '400Regular', medium: '500Medium', semibold: '600SemiBold', bold: '700Bold' };
const numeric: Record<FontWeight, TextStyle['fontWeight']> = { regular: '400', medium: '500', semibold: '600', bold: '700' };

const WEB_SANS = '"SF Pro Text","SF Pro Display",-apple-system,system-ui,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif';

/**
 * نمط الخط حسب اللغة والوزن: يُدمج في style أي نص أو حقل إدخال.
 * على الويب نضيف سلسلة احتياط صريحة (وإلا يسقط الحرف السيريلي أو اللاتيني خارج Noto إلى Times).
 * على الجوال يتولى النظام الاحتياط بالحرف الواحد (SF Pro / Roboto).
 */
export function fontStyle(lang: Lang, weight: FontWeight): TextStyle {
  if (lang === 'ar') {
    const family = `NotoSansArabic_${suffix[weight]}`;
    return { fontFamily: Platform.OS === 'web' ? `${family}, ${WEB_SANS}` : family };
  }
  return Platform.OS === 'web' ? { fontFamily: WEB_SANS, fontWeight: numeric[weight] } : { fontWeight: numeric[weight] };
}
