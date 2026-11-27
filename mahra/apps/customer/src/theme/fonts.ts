import type { Lang } from '@/i18n';

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

/**
 * ملفات الخطوط المحمّلة عند الإقلاع.
 * IBM Plex Sans Arabic: العربية + اللاتينية. IBM Plex Sans: اللاتينية + السيريلية (روسي).
 * لغات أخرى (هندية، أردية، صينية…) تُضاف لاحقاً بعد اختبارها؛ حتى ذلك الحين يستعمل النظام خطه.
 */
export const fontSources = {
  IBMPlexSansArabic_400Regular: require('@expo-google-fonts/ibm-plex-sans-arabic/400Regular/IBMPlexSansArabic_400Regular.ttf'),
  IBMPlexSansArabic_500Medium: require('@expo-google-fonts/ibm-plex-sans-arabic/500Medium/IBMPlexSansArabic_500Medium.ttf'),
  IBMPlexSansArabic_600SemiBold: require('@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold/IBMPlexSansArabic_600SemiBold.ttf'),
  IBMPlexSansArabic_700Bold: require('@expo-google-fonts/ibm-plex-sans-arabic/700Bold/IBMPlexSansArabic_700Bold.ttf'),
  IBMPlexSans_400Regular: require('@expo-google-fonts/ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf'),
  IBMPlexSans_500Medium: require('@expo-google-fonts/ibm-plex-sans/500Medium/IBMPlexSans_500Medium.ttf'),
  IBMPlexSans_600SemiBold: require('@expo-google-fonts/ibm-plex-sans/600SemiBold/IBMPlexSans_600SemiBold.ttf'),
  IBMPlexSans_700Bold: require('@expo-google-fonts/ibm-plex-sans/700Bold/IBMPlexSans_700Bold.ttf'),
};

const suffix: Record<FontWeight, string> = {
  regular: '400Regular',
  medium: '500Medium',
  semibold: '600SemiBold',
  bold: '700Bold',
};

export function fontFor(lang: Lang, weight: FontWeight): string {
  const family = lang === 'ar' ? 'IBMPlexSansArabic' : 'IBMPlexSans';
  return `${family}_${suffix[weight]}`;
}
