import { Platform, type TextStyle } from 'react-native';
import type { Lang } from '@/i18n';

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

/**
 * خط التصميم المعتمد (صور Gemini): Readex Pro، عريض هندسي متساوي السماكة. يغطي العربية واللاتينية (en/es/fr).
 * الروسية والهندية والصينية خارج تغطيته: يتولاها خط النظام (SF Pro / Roboto) بحرف احتياطي سليم.
 */
export const fontSources = {
  ReadexPro_400Regular: require('@expo-google-fonts/readex-pro/400Regular/ReadexPro_400Regular.ttf'),
  ReadexPro_500Medium: require('@expo-google-fonts/readex-pro/500Medium/ReadexPro_500Medium.ttf'),
  ReadexPro_600SemiBold: require('@expo-google-fonts/readex-pro/600SemiBold/ReadexPro_600SemiBold.ttf'),
  ReadexPro_700Bold: require('@expo-google-fonts/readex-pro/700Bold/ReadexPro_700Bold.ttf'),
};

const suffix: Record<FontWeight, string> = { regular: '400Regular', medium: '500Medium', semibold: '600SemiBold', bold: '700Bold' };
const numeric: Record<FontWeight, TextStyle['fontWeight']> = { regular: '400', medium: '500', semibold: '600', bold: '700' };
const WEB_SANS = '"SF Pro Text","SF Pro Display",-apple-system,system-ui,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif';
const READEX_LANGS: Lang[] = ['ar', 'en', 'es', 'fr'];

/** نمط الخط حسب اللغة والوزن: يُدمج في style أي نص أو حقل إدخال. */
export function fontStyle(lang: Lang, weight: FontWeight): TextStyle {
  if (READEX_LANGS.includes(lang)) {
    const family = `ReadexPro_${suffix[weight]}`;
    return { fontFamily: Platform.OS === 'web' ? `${family}, ${WEB_SANS}` : family };
  }
  return Platform.OS === 'web' ? { fontFamily: WEB_SANS, fontWeight: numeric[weight] } : { fontWeight: numeric[weight] };
}
