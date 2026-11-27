import { useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { color, radius, TOUCH } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  hint?: string;
};

const BG = { primary: color.gold, dark: color.ink, secondary: color.surface, ghost: 'transparent', danger: color.bad } as const;
const FG = { primary: color.ink, dark: color.onInk, secondary: color.text, ghost: color.dim, danger: '#fff' } as const;

/** زر كبير (52pt) لليد الواحدة؛ الضغطة تصغّره قليلاً لتأكيد الاستجابة. */
export function Button({ label, onPress, kind = 'primary', disabled, loading, icon, style, hint }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (v: number) => Animated.timing(scale, { toValue: v, duration: 110, useNativeDriver: true }).start();
  const off = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={off} onPressIn={() => to(0.97)} onPressOut={() => to(1)} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ disabled: !!off, busy: !!loading }}>
      <Animated.View style={[styles.base, { backgroundColor: BG[kind], opacity: off ? 0.5 : 1, transform: [{ scale }] }, (kind === 'secondary' || kind === 'ghost') && { borderWidth: 1, borderColor: color.line }, style]}>
        {loading ? <ActivityIndicator color={FG[kind]} /> : (
          <View style={styles.row}>
            {icon}
            <Text variant="heading" style={{ color: FG[kind] }}>{label}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: { minHeight: TOUCH, borderRadius: radius.pill, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
