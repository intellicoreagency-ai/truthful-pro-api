import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { glow, radius, type Tone } from '@/theme/tokens';

type Props = ViewProps & { strong?: boolean; r?: number; tint?: string; tone?: Tone; /** زجاج صافٍ: لمعان وتمويه أخف، فتظهر الخلفية خلفه */ clear?: boolean; /** شدة التمويه (0–100)؛ أقل = أكثر شفافية */ blur?: number; /** بطاقة Dark Glassmorphism (مواصفات المالك): كحلي rgba(17,29,49,0.78)، تمويه 20px، حدّ أبيض 15%، زوايا 24، وانعكاس شمبانيّ على الحافة العليا */ card?: boolean };

/**
 * سطح زجاجي (Spatial Glass): مادة النظام الضبابية + طبقة لمعان + حافة علوية لامعة (Specular) أسطع من بقية الحافة + ظل ناعم بإزاحة.
 * الزجاج هنا تأثير محدد فوق ضوء اللؤلؤة والخلفية، والنص فوقه دائماً بتباين كافٍ.
 */
export function Glass({ strong, r, tint, tone, blur, clear, card, style, children, ...rest }: Props) {
  r = card ? 24 : (r ?? radius.lg);
  const g = tone ? glow[tone] : null;
  const shadow: ViewStyle = Platform.select<ViewStyle>({
    web: { boxShadow: `0 16px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)${g ? `, 0 0 26px ${g.rim.replace('0.45', '0.16')}` : ''}` } as ViewStyle,
    default: { shadowColor: g ? g.rim : '#000', shadowOpacity: g ? 0.5 : 0.55, shadowRadius: g ? 18 : 20, shadowOffset: { width: 0, height: g ? 6 : 16 }, elevation: 8 },
  })!;
  const cardStyle: ViewStyle | null = card ? { backgroundColor: 'rgba(17,29,49,0.78)', borderWidth: 1, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.15)' } : null;
  return (
    <View {...rest} style={[{ borderRadius: r, overflow: 'hidden', borderWidth: 1, borderColor: g ? g.rim : 'rgba(255,255,255,0.22)', borderTopWidth: 1.5, borderTopColor: g ? g.rim : 'rgba(255,255,255,0.48)', backgroundColor: tint ?? (g ? g.tint.replace(/0\.1[45]\)/, '0.08)') : 'rgba(255,255,255,0.025)') }, cardStyle, shadow, style]}>
      <BlurView intensity={blur ?? (card ? 100 : clear ? 8 : strong ? 22 : 12)} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: r }]} />
      {!card && <LinearGradient colors={clear ? ['rgba(255,255,255,0.025)', 'rgba(255,255,255,0.01)'] : ['rgba(255,255,255,0.045)', 'rgba(255,255,255,0.008)']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: r }]} pointerEvents="none" />}
      {card && (
        <>
          <LinearGradient colors={['rgba(243,221,160,0.16)', 'rgba(243,221,160,0)']} style={[styles.sheen, { borderTopLeftRadius: r, borderTopRightRadius: r }]} pointerEvents="none" />
          <LinearGradient colors={['rgba(243,221,160,0)', 'rgba(243,221,160,0.75)', 'rgba(243,221,160,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.edge, { left: r * 0.6, right: r * 0.6 }]} pointerEvents="none" />
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 40 },
  edge: { position: 'absolute', top: 0, height: 1.5 },
});
