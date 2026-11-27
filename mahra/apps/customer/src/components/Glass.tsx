import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { glow, radius, type Tone } from '@/theme/tokens';

type Props = ViewProps & { strong?: boolean; r?: number; tint?: string; tone?: Tone; /** شدة التمويه (0–100)؛ أقل = أكثر شفافية */ blur?: number };

/**
 * سطح زجاجي (Spatial Glass): مادة النظام الضبابية + طبقة لمعان + حافة علوية لامعة (Specular) أسطع من بقية الحافة + ظل ناعم بإزاحة.
 * الزجاج هنا تأثير محدد فوق ضوء اللؤلؤة والخلفية، والنص فوقه دائماً بتباين كافٍ.
 */
export function Glass({ strong, r = radius.lg, tint, tone, blur, style, children, ...rest }: Props) {
  const g = tone ? glow[tone] : null;
  const shadow: ViewStyle = Platform.select<ViewStyle>({
    web: { boxShadow: `0 16px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)${g ? `, 0 0 26px ${g.rim.replace('0.45', '0.16')}` : ''}` } as ViewStyle,
    default: { shadowColor: g ? g.rim : '#000', shadowOpacity: g ? 0.5 : 0.55, shadowRadius: g ? 18 : 20, shadowOffset: { width: 0, height: g ? 6 : 16 }, elevation: 8 },
  })!;
  return (
    <View {...rest} style={[{ borderRadius: r, overflow: 'hidden', borderWidth: 1, borderColor: g ? g.rim : 'rgba(255,255,255,0.22)', borderTopWidth: 1.5, borderTopColor: g ? g.rim : 'rgba(255,255,255,0.48)', backgroundColor: tint ?? g?.tint ?? 'transparent' }, shadow, style]}>
      <BlurView intensity={blur ?? (strong ? 42 : 28)} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: r }]} />
      <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: r }]} pointerEvents="none" />
      {children}
    </View>
  );
}
