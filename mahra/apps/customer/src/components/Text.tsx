import { I18nManager, Platform, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useI18n } from '@/i18n';
import { fontStyle, type FontRole, type FontWeight } from '@/theme/fonts';
import { color } from '@/theme/tokens';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'caption';

const VARIANTS: Record<Variant, { size: number; weight: FontWeight }> = {
  display: { size: 30, weight: 'bold' },
  title: { size: 22, weight: 'semibold' },
  heading: { size: 18, weight: 'semibold' },
  body: { size: 16, weight: 'regular' },
  caption: { size: 13, weight: 'regular' },
};

type Props = TextProps & {
  variant?: Variant;
  weight?: FontWeight;
  /** دور الخط: يُستنتج من النمط (عناوين=Cairo، نص=IBM Plex)؛ label للتسميات القصيرة (Tajawal) */
  font?: FontRole;
  tone?: 'normal' | 'dim' | 'gold' | 'danger' | 'success';
  center?: boolean;
};

const TONES = {
  normal: color.text,
  dim: color.textDim,
  gold: color.gold,
  danger: color.danger,
  success: color.success,
} as const;

/**
 * نص مهرة: يختار الخط حسب اللغة، ويحاذي حسب الاتجاه، ويحترم تكبير النص (حتى 1.6×).
 * على الويب يكفي attribute الاتجاه من الجذر؛ على الجوال نحدد المحاذاة صراحةً.
 */
export function Text({ variant = 'body', weight, font, tone = 'normal', center, style, ...rest }: Props) {
  const { lang, dir } = useI18n();
  const v = VARIANTS[variant];

  // على الجوال: 'left' تعمل كـ«بداية» عندما يكون النظام نفسه RTL (قلب تلقائي).
  const nativeFlipped = I18nManager.isRTL;
  const align: TextStyle['textAlign'] = center
    ? 'center'
    : Platform.OS === 'web'
      ? undefined
      : (dir === 'rtl') !== nativeFlipped
        ? 'right'
        : 'left';

  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        {
          ...fontStyle(lang, weight ?? v.weight, font ?? (variant === 'body' || variant === 'caption' ? 'body' : 'display')),
          fontSize: v.size,
          lineHeight: Math.round(v.size * (lang === 'ar' ? 1.65 : lang === 'hi' ? 1.7 : 1.5)),
          color: TONES[tone],
          textAlign: align,
        },
        style,
      ]}
    />
  );
}
