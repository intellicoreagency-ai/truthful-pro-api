import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { Glass } from './Glass';
import { color, gradient, motion, radius, TOUCH } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  /** cta: أزرق←ذهبي (الدخول) | gold: ذهبي (الفعل الرئيسي) | glass: زجاجي | ghost | danger | tint: بلون وكيل */
  kind?: 'cta' | 'gold' | 'glass' | 'ghost' | 'danger' | 'tint';
  tint?: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  hint?: string;
  small?: boolean;
};

/** كل ضغطة تصغّر الزر قليلاً (120ms) لتأكيد الاستجابة؛ الزر الرئيسي بتوهج ذهبي ناعم. */
export function Button({ label, onPress, kind = 'gold', tint, disabled, loading, icon, style, hint, small }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (v: number) => Animated.timing(scale, { toValue: v, duration: motion.press, useNativeDriver: true }).start();
  const off = disabled || loading;
  const h = small ? 40 : TOUCH + 6;
  const fg = kind === 'cta' || kind === 'gold' ? color.deep : kind === 'tint' ? color.deep : color.text;

  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={styles.row}>
      {icon}
      <Text variant={small ? 'body' : 'heading'} weight="bold" style={{ color: fg }}>{label}</Text>
    </View>
  );

  const glow: ViewStyle | undefined = kind === 'cta' || kind === 'gold'
    ? Platform.select<ViewStyle>({
        web: { boxShadow: `0 14px 30px ${kind === 'cta' ? 'rgba(120,150,255,0.34)' : 'rgba(217,188,126,0.34)'}, inset 0 1px 0 rgba(255,255,255,0.55)` } as ViewStyle,
        default: { shadowColor: kind === 'cta' ? '#7C9BFF' : color.gold, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
      })
    : undefined;

  return (
    <Pressable onPress={onPress} disabled={off} onPressIn={() => to(0.97)} onPressOut={() => to(1)} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ disabled: !!off, busy: !!loading }}>
      <Animated.View style={[{ opacity: off ? 0.5 : 1, transform: [{ scale }] }, style]}>
        {kind === 'cta' || kind === 'gold' ? (
          <LinearGradient colors={kind === 'cta' ? gradient.cta : gradient.gold} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.base, { minHeight: h }, glow]}>{content}</LinearGradient>
        ) : kind === 'glass' ? (
          <Glass r={radius.pill} strong style={[styles.base, { minHeight: h }]}>{content}</Glass>
        ) : kind === 'tint' ? (
          <View style={[styles.base, { minHeight: h, backgroundColor: tint ?? color.gold }]}>{content}</View>
        ) : kind === 'danger' ? (
          <View style={[styles.base, { minHeight: h, backgroundColor: color.red }]}>{content}</View>
        ) : (
          <View style={[styles.base, { minHeight: h }]}>{content}</View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
