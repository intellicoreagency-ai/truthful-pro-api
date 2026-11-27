import { Platform, type TextStyle } from 'react-native';
import type { Lang } from '@/i18n';

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';
/** أدوار الخطوط (مجموعة الخطوط المعتمدة من المالك، لا تُستبدل): */
export type FontRole = 'body' | 'display' | 'label';

/**
 * body    IBM Plex Sans Arabic 400/500/600/700: النصوص الأساسية والبطاقات وحقول الإدخال وتفاصيل الوكلاء.
 * display Cairo 400/600/700/800: العناوين الكبيرة، الأزرار الرئيسية، أرقام الأسعار والدفعات.
 * label   Tajawal 500/700/800: شريط التنقل السفلي، التسميات القصيرة، شارات الحالة، البطاقات المدمجة.
 * الاحتياط: Noto Sans Arabic ثم خط النظام (SF Pro على آيفون).
 */
export const fontSources = {
  IBMPlexSansArabic_400Regular: require('@expo-google-fonts/ibm-plex-sans-arabic/400Regular/IBMPlexSansArabic_400Regular.ttf'),
  IBMPlexSansArabic_500Medium: require('@expo-google-fonts/ibm-plex-sans-arabic/500Medium/IBMPlexSansArabic_500Medium.ttf'),
  IBMPlexSansArabic_600SemiBold: require('@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold/IBMPlexSansArabic_600SemiBold.ttf'),
  IBMPlexSansArabic_700Bold: require('@expo-google-fonts/ibm-plex-sans-arabic/700Bold/IBMPlexSansArabic_700Bold.ttf'),
  Cairo_400Regular: require('@expo-google-fonts/cairo/400Regular/Cairo_400Regular.ttf'),
  Cairo_600SemiBold: require('@expo-google-fonts/cairo/600SemiBold/Cairo_600SemiBold.ttf'),
  Cairo_700Bold: require('@expo-google-fonts/cairo/700Bold/Cairo_700Bold.ttf'),
  Cairo_800ExtraBold: require('@expo-google-fonts/cairo/800ExtraBold/Cairo_800ExtraBold.ttf'),
  Tajawal_500Medium: require('@expo-google-fonts/tajawal/500Medium/Tajawal_500Medium.ttf'),
  Tajawal_700Bold: require('@expo-google-fonts/tajawal/700Bold/Tajawal_700Bold.ttf'),
  Tajawal_800ExtraBold: require('@expo-google-fonts/tajawal/800ExtraBold/Tajawal_800ExtraBold.ttf'),
  NotoSansArabic_400Regular: require('@expo-google-fonts/noto-sans-arabic/400Regular/NotoSansArabic_400Regular.ttf'),
  NotoSansArabic_600SemiBold: require('@expo-google-fonts/noto-sans-arabic/600SemiBold/NotoSansArabic_600SemiBold.ttf'),
  NotoSansArabic_700Bold: require('@expo-google-fonts/noto-sans-arabic/700Bold/NotoSansArabic_700Bold.ttf'),
};

const FACE: Record<FontRole, Record<FontWeight, string>> = {
  body: { regular: 'IBMPlexSansArabic_400Regular', medium: 'IBMPlexSansArabic_500Medium', semibold: 'IBMPlexSansArabic_600SemiBold', bold: 'IBMPlexSansArabic_700Bold' },
  display: { regular: 'Cairo_400Regular', medium: 'Cairo_600SemiBold', semibold: 'Cairo_700Bold', bold: 'Cairo_800ExtraBold' },
  label: { regular: 'Tajawal_500Medium', medium: 'Tajawal_500Medium', semibold: 'Tajawal_700Bold', bold: 'Tajawal_800ExtraBold' },
};
const NOTO = 'NotoSansArabic_400Regular, NotoSansArabic_600SemiBold, NotoSansArabic_700Bold';
const WEB_FALLBACK = `${NOTO}, "SF Pro Text", -apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const numeric: Record<FontWeight, TextStyle['fontWeight']> = { regular: '400', medium: '500', semibold: '600', bold: '700' };
/** اللغات التي تغطيها المجموعة (عربية + لاتينية). الروسية والهندية والصينية يتولاها خط النظام. */
const SUITE_LANGS: Lang[] = ['ar', 'en', 'es', 'fr'];

/** نمط الخط حسب اللغة والوزن والدور. letterSpacing صفر دائماً: التباعد يقطع الحروف العربية المتصلة. */
export function fontStyle(lang: Lang, weight: FontWeight, role: FontRole = 'body'): TextStyle {
  if (SUITE_LANGS.includes(lang)) {
    const family = FACE[role][weight];
    return { fontFamily: Platform.OS === 'web' ? `${family}, ${WEB_FALLBACK}` : family, letterSpacing: 0 };
  }
  return Platform.OS === 'web'
    ? { fontFamily: WEB_FALLBACK, fontWeight: numeric[weight], letterSpacing: 0 }
    : { fontWeight: numeric[weight], letterSpacing: 0 };
}
