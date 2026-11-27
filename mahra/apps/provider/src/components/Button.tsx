import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { color, gradient, radius, TOUCH } from '@/theme/tokens';

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

const FG = { primary: color.ink, dark: color.onInk, secondary: color.text, ghost: color.dim, danger: '#fff' } as const;

/** زر كبير (52pt) لليد الواحدة. الرئيسي ذهبي جوهري بحافة بيضاء وتوهج ناعم؛ الضغطة تصغّره (110ms). */
export function Button({ label, onPress, kind = 'primary', disabled, loading, icon, style, hint }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (v: number) => Animated.timing(scale, { toValue: v, duration: 110, useNativeDriver: true }).start();
  const off = disabled || loading;
  const content = loading ? <ActivityIndicator color={FG[kind]} /> : (
    <View style={styles.row}>
      {icon}
      <Text variant="heading" style={{ color: FG[kind] }}>{label}</Text>
    </View>
  );
  const glow = Platform.select<ViewStyle>({
    web: { boxShadow: '0 12px 26px rgba(217,188,126,0.42), inset 0 1px 0 rgba(255,255,255,0.6)' } as ViewStyle,
    default: { shadowColor: color.gold, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 9 } },
  });
  const dark = Platform.select<ViewStyle>({
    web: { boxShadow: '0 12px 24px rgba(11,21,48,0.28), inset 0 1px 0 rgba(255,255,255,0.18)' } as ViewStyle,
    default: { shadowColor: color.ink, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  });
  return (
    <Pressable onPress={onPress} disabled={off} onPressIn={() => to(0.97)} onPressOut={() => to(1)} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ disabled: !!off, busy: !!loading }}>
      <Animated.View style={[{ opacity: off ? 0.5 : 1, transform: [{ scale }] }, style]}>
        {kind === 'primary' ? (
          <LinearGradient colors={gradient.gold} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.base, glow, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }]}>{content}</LinearGradient>
        ) : kind === 'dark' ? (
          <View style={[styles.base, dark, { backgroundColor: color.ink, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }]}>{content}</View>
        ) : kind === 'danger' ? (
          <View style={[styles.base, { backgroundColor: color.bad }]}>{content}</View>
        ) : (
          <View style={[styles.base, kind === 'secondary' && { backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: color.line }, kind === 'ghost' && { borderWidth: 1, borderColor: color.line }]}>{content}</View>
        )}
      </Animated.View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: { minHeight: TOUCH, borderRadius: radius.pill, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
