import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { radius } from '@/theme/tokens';

type Props = ViewProps & { strong?: boolean; r?: number; tint?: string };

/**
 * سطح زجاجي (Spatial Glass): مادة النظام الضبابية + طبقة لمعان + حافة علوية لامعة (Specular) أسطع من بقية الحافة + ظل ناعم بإزاحة.
 * الزجاج هنا تأثير محدد فوق ضوء اللؤلؤة والخلفية، والنص فوقه دائماً بتباين كافٍ.
 */
export function Glass({ strong, r = radius.lg, tint, style, children, ...rest }: Props) {
  const shadow: ViewStyle = Platform.select<ViewStyle>({
    web: { boxShadow: '0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)' } as ViewStyle,
    default: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  })!;
  return (
    <View {...rest} style={[{ borderRadius: r, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderTopWidth: 1.5, borderTopColor: 'rgba(255,255,255,0.55)', backgroundColor: tint ?? 'transparent' }, shadow, style]}>
      <BlurView intensity={strong ? 30 : 18} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: r }]} />
      <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: r }]} pointerEvents="none" />
      {children}
    </View>
  );
}
