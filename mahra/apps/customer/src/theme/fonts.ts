import { Platform, type TextStyle } from 'react-native';
import type { Lang } from '@/i18n';

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';
/** يُبقى الدور في الواجهة للتوافق؛ الخط الآن واحد لكل لغة (قرار المالك). */
export type FontRole = 'body' | 'display' | 'label' | 'kufi';

/**
 * خط لكل أبجدية (قرار المالك):
 *  العربية            Noto Kufi Arabic (كل الأوزان والأدوار)
 *  الإنجليزية والإسبانية والفرنسية والروسية  Manrope (هندسي أنيق، يغطي اللاتينية والسيريلية)
 *  الهندية            Noto Sans Devanagari
 *  الصينية            خط النظام (PingFang SC على آيفون، Noto Sans CJK على أندرويد): ملفات CJK ضخمة (10MB للوزن)
 */
export const fontSources = {
  NotoKufiArabic_400Regular: require('@expo-google-fonts/noto-kufi-arabic/400Regular/NotoKufiArabic_400Regular.ttf'),
  NotoKufiArabic_500Medium: require('@expo-google-fonts/noto-kufi-arabic/500Medium/NotoKufiArabic_500Medium.ttf'),
  NotoKufiArabic_600SemiBold: require('@expo-google-fonts/noto-kufi-arabic/600SemiBold/NotoKufiArabic_600SemiBold.ttf'),
  NotoKufiArabic_700Bold: require('@expo-google-fonts/noto-kufi-arabic/700Bold/NotoKufiArabic_700Bold.ttf'),
  Manrope_400Regular: require('@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf'),
  Manrope_500Medium: require('@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf'),
  Manrope_600SemiBold: require('@expo-google-fonts/manrope/600SemiBold/Manrope_600SemiBold.ttf'),
  Manrope_700Bold: require('@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf'),
  NotoSansDevanagari_400Regular: require('@expo-google-fonts/noto-sans-devanagari/400Regular/NotoSansDevanagari_400Regular.ttf'),
  NotoSansDevanagari_500Medium: require('@expo-google-fonts/noto-sans-devanagari/500Medium/NotoSansDevanagari_500Medium.ttf'),
  NotoSansDevanagari_600SemiBold: require('@expo-google-fonts/noto-sans-devanagari/600SemiBold/NotoSansDevanagari_600SemiBold.ttf'),
  NotoSansDevanagari_700Bold: require('@expo-google-fonts/noto-sans-devanagari/700Bold/NotoSansDevanagari_700Bold.ttf'),
};

const SUFFIX: Record<FontWeight, string> = { regular: '400Regular', medium: '500Medium', semibold: '600SemiBold', bold: '700Bold' };
const NUMERIC: Record<FontWeight, TextStyle['fontWeight']> = { regular: '400', medium: '500', semibold: '600', bold: '700' };
const SYSTEM = '"SF Pro Text", -apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const CJK = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif';

const FAMILY: Partial<Record<Lang, string>> = {
  ar: 'NotoKufiArabic',
  en: 'Manrope', es: 'Manrope', fr: 'Manrope', ru: 'Manrope',
  hi: 'NotoSansDevanagari',
};

/** نمط الخط حسب اللغة والوزن. letterSpacing صفر دائماً (التباعد يقطع الحروف العربية المتصلة). */
export function fontStyle(lang: Lang, weight: FontWeight, _role: FontRole = 'body'): TextStyle {
  const family = FAMILY[lang];
  if (family) {
    const face = `${family}_${SUFFIX[weight]}`;
    return { fontFamily: Platform.OS === 'web' ? `${face}, ${SYSTEM}` : face, letterSpacing: 0 };
  }
  // الصينية: خط النظام
  return Platform.OS === 'web'
    ? { fontFamily: CJK, fontWeight: NUMERIC[weight], letterSpacing: 0 }
    : { fontWeight: NUMERIC[weight], letterSpacing: 0 };
}
