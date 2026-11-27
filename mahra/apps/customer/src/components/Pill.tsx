import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { Press } from './Press';
import { Text } from './Text';
import { glow, type Tone } from '@/theme/tokens';

/** زر كبسولة بتدرج لون الوكيل (مواصفات Spatial Glass): نص أبيض عريض على تدرج الزر. */
export function Pill({ label, tone, onPress, hint }: { label: string; tone: Tone; onPress: () => void; hint?: string }) {
  const g = glow[tone];
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} style={styles.wrap}>
      <LinearGradient colors={g.btn} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.pill}>
        <Text font="display" weight="semibold" style={{ color: '#FFFFFF' }}>{label}</Text>
      </LinearGradient>
    </Press>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  pill: { minHeight: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
});
