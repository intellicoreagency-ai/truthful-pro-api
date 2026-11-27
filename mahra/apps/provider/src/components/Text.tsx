import { I18nManager, Platform, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useI18n } from '@/i18n';
import { fontFor, type FontWeight } from '@/theme/fonts';
import { color } from '@/theme/tokens';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'caption';
const VARIANTS: Record<Variant, { size: number; weight: FontWeight }> = {
  display: { size: 34, weight: 'bold' },
  title: { size: 24, weight: 'semibold' },
  heading: { size: 18, weight: 'semibold' },
  body: { size: 16, weight: 'regular' },
  caption: { size: 13, weight: 'regular' },
};
const TONES = { normal: color.text, dim: color.dim, gold: color.goldInk, ok: color.ok, bad: color.bad, warn: color.warn, onInk: color.onInk, onInkDim: color.onInkDim } as const;

type Props = TextProps & { variant?: Variant; weight?: FontWeight; tone?: keyof typeof TONES; center?: boolean };

/** نص المزود: الخط حسب اللغة، المحاذاة حسب الاتجاه، يحترم تكبير النص (حتى 1.6×). */
export function Text({ variant = 'body', weight, tone = 'normal', center, style, ...rest }: Props) {
  const { lang, dir } = useI18n();
  const v = VARIANTS[variant];
  const flipped = I18nManager.isRTL;
  const align: TextStyle['textAlign'] = center ? 'center' : Platform.OS === 'web' ? undefined : (dir === 'rtl') !== flipped ? 'right' : 'left';
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[{ fontFamily: fontFor(lang, weight ?? v.weight), fontSize: v.size, lineHeight: Math.round(v.size * (lang === 'ar' ? 1.6 : 1.45)), color: TONES[tone], textAlign: align }, style]}
    />
  );
}
