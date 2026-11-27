import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { color, radius } from '@/theme/tokens';

type Props = ViewProps & { strong?: boolean; r?: number; tint?: string };

/**
 * سطح زجاجي (Spatial Glass): مادة النظام الضبابية + طبقة لمعان + حافة علوية لامعة (Specular) أسطع من بقية الحافة + ظل ناعم بإزاحة.
 * الزجاج هنا تأثير محدد فوق ضوء اللؤلؤة والخلفية، والنص فوقه دائماً بتباين كافٍ.
 */
export function Glass({ strong, r = radius.lg, tint, style, children, ...rest }: Props) {
  const shadow: ViewStyle = Platform.select<ViewStyle>({
    web: { boxShadow: '0 18px 40px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.20)' } as ViewStyle,
    default: { shadowColor: '#000', shadowOpacity: 0.34, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  })!;
  return (
    <View {...rest} style={[{ borderRadius: r, overflow: 'hidden', borderWidth: 1, borderColor: color.hairline, borderTopWidth: 1.5, borderTopColor: 'rgba(255,255,255,0.5)', backgroundColor: tint ?? color.glass }, shadow, style]}>
      <BlurView intensity={strong ? 55 : 36} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: r }]} />
      <LinearGradient colors={['rgba(255,255,255,0.13)', 'rgba(255,255,255,0.03)']} style={[StyleSheet.absoluteFill, { borderRadius: r }]} pointerEvents="none" />
      {children}
    </View>
  );
}
