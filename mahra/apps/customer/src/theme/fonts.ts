import { Platform, type TextStyle } from 'react-native';
import type { Lang } from '@/i18n';

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';
/** يُبقى الدور في الواجهة للتوافق؛ الخط الآن واحد لكل لغة (قرار المالك). */
export type FontRole = 'body' | 'display' | 'label' | 'kufi' | 'tab';

/**
 * خط لكل أبجدية (قرار المالك):
 *  العربية   Noto Naskh Arabic لنصوص القراءة، وNoto Kufi Arabic للعناوين والأزرار والتسميات (قرار المالك).
 *  غير العربية بنمط Apple: على iOS خط النظام الحقيقي (SF Pro، وDevanagari Sangam MN للهندية، وPingFang للصينية)؛
 *  على أندرويد والويب: Inter (الأقرب إلى SF Pro، يغطي اللاتينية والسيريلية) وNoto Sans Devanagari للهندية،
 *  وعلى الويب يُقدَّم خط Apple (-apple-system) أولاً متى وُجد على الجهاز.
 *  الصينية  خط النظام دائماً (ملفات CJK ضخمة).
 */
export const fontSources = {
  NotoKufiArabic_400Regular: require('@expo-google-fonts/noto-kufi-arabic/400Regular/NotoKufiArabic_400Regular.ttf'),
  NotoKufiArabic_500Medium: require('@expo-google-fonts/noto-kufi-arabic/500Medium/NotoKufiArabic_500Medium.ttf'),
  NotoKufiArabic_600SemiBold: require('@expo-google-fonts/noto-kufi-arabic/600SemiBold/NotoKufiArabic_600SemiBold.ttf'),
  NotoKufiArabic_700Bold: require('@expo-google-fonts/noto-kufi-arabic/700Bold/NotoKufiArabic_700Bold.ttf'),
  NotoNaskhArabic_400Regular: require('@expo-google-fonts/noto-naskh-arabic/400Regular/NotoNaskhArabic_400Regular.ttf'),
  NotoNaskhArabic_500Medium: require('@expo-google-fonts/noto-naskh-arabic/500Medium/NotoNaskhArabic_500Medium.ttf'),
  NotoNaskhArabic_600SemiBold: require('@expo-google-fonts/noto-naskh-arabic/600SemiBold/NotoNaskhArabic_600SemiBold.ttf'),
  NotoNaskhArabic_700Bold: require('@expo-google-fonts/noto-naskh-arabic/700Bold/NotoNaskhArabic_700Bold.ttf'),
  Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
  NotoSansDevanagari_400Regular: require('@expo-google-fonts/noto-sans-devanagari/400Regular/NotoSansDevanagari_400Regular.ttf'),
  NotoSansDevanagari_500Medium: require('@expo-google-fonts/noto-sans-devanagari/500Medium/NotoSansDevanagari_500Medium.ttf'),
  NotoSansDevanagari_600SemiBold: require('@expo-google-fonts/noto-sans-devanagari/600SemiBold/NotoSansDevanagari_600SemiBold.ttf'),
  NotoSansDevanagari_700Bold: require('@expo-google-fonts/noto-sans-devanagari/700Bold/NotoSansDevanagari_700Bold.ttf'),
};

const SUFFIX: Record<FontWeight, string> = { regular: '400Regular', medium: '500Medium', semibold: '600SemiBold', bold: '700Bold' };
const NUMERIC: Record<FontWeight, TextStyle['fontWeight']> = { regular: '400', medium: '500', semibold: '600', bold: '700' };
const APPLE = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display"';
const SYSTEM_FALLBACK = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const CJK = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif';

const FAMILY: Partial<Record<Lang, string>> = { en: 'Inter', es: 'Inter', fr: 'Inter', ru: 'Inter', hi: 'NotoSansDevanagari' };

/** نمط الخط حسب اللغة والوزن. letterSpacing صفر دائماً (التباعد يقطع الحروف العربية المتصلة). */
export function fontStyle(lang: Lang, weight: FontWeight, role: FontRole = 'body'): TextStyle {
  if (lang === 'ar') {
    // قرار المالك: Noto Naskh Arabic لنصوص القراءة (الوصف والفقرات)، وNoto Kufi Arabic للعناوين والأزرار والتسميات.
    if (role === 'body') {
      const face = `NotoNaskhArabic_${SUFFIX[weight]}`;
      return { fontFamily: Platform.OS === 'web' ? `${face}, ${SYSTEM_FALLBACK}` : face, letterSpacing: 0 };
    }
    // الكوفي عريض بطبعه: نخفّض الوزن درجة (bold→semibold، semibold→medium، medium→regular)
    const w2: FontWeight = weight === 'bold' ? 'semibold' : weight === 'semibold' ? 'medium' : 'regular';
    const face = `NotoKufiArabic_${SUFFIX[w2]}`;
    return { fontFamily: Platform.OS === 'web' ? `${face}, ${SYSTEM_FALLBACK}` : face, letterSpacing: 0 };
  }
  if (lang === 'zh') {
    return Platform.OS === 'web' ? { fontFamily: CJK, fontWeight: NUMERIC[weight], letterSpacing: 0 } : { fontWeight: NUMERIC[weight], letterSpacing: 0 };
  }
  // نمط Apple: iOS = خط النظام نفسه
  if (Platform.OS === 'ios') return { fontWeight: NUMERIC[weight], letterSpacing: 0 };
  const face = `${FAMILY[lang]}_${SUFFIX[weight]}`;
  return Platform.OS === 'web'
    ? { fontFamily: `${APPLE}, ${face}, ${SYSTEM_FALLBACK}`, fontWeight: NUMERIC[weight], letterSpacing: 0 }
    : { fontFamily: face, letterSpacing: 0 };
}
