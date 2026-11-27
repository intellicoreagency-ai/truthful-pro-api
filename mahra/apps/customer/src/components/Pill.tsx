import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { Press } from './Press';
import { Text } from './Text';
import { glow, type Tone } from '@/theme/tokens';

/** زر كبسولة زجاجي شفاف بلون الفئة (Apple clear glass): حدّ ملوّن ونص أبيض. */
export function Pill({ label, tone, accent, onPress, hint }: { label: string; tone?: Tone; /** لون hex يغلب على tone (لون الوكيل) */ accent?: string; onPress: () => void; hint?: string }) {
  const ink = accent ?? glow[tone ?? 'sapphire'].ink;
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} style={styles.wrap}>
      <LinearGradient colors={[ink + '55', ink + '22']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.pill, { borderColor: ink + '99' }]}>
        <Text font="display" weight="semibold" style={{ color: '#FFFFFF' }}>{label}</Text>
      </LinearGradient>
    </Press>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  pill: { minHeight: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
});
