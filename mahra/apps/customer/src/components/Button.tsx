import { useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { color, motion, radius, TOUCH } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  accessibilityHint?: string;
};

/** الزر الرئيسي ذهبي؛ ضغطة تصغّر قليلاً (120ms) لتأكيد الاستجابة. */
export function Button({ label, onPress, kind = 'primary', disabled, loading, icon, style, accessibilityHint }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (v: number) => Animated.timing(scale, { toValue: v, duration: motion.press, useNativeDriver: true }).start();
  const off = disabled || loading;

  const bg = kind === 'primary' ? color.gold : kind === 'secondary' ? color.glassStrong : 'transparent';
  const fg = kind === 'primary' ? color.ink : color.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
    >
      <Animated.View
        style={[
          styles.base,
          { backgroundColor: bg, opacity: off ? 0.5 : 1, transform: [{ scale }] },
          kind !== 'primary' && { borderWidth: 1, borderColor: color.hairline },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <View style={styles.row}>
            {icon}
            <Text variant="heading" style={{ color: fg }}>
              {label}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: TOUCH + 4, borderRadius: radius.pill, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
