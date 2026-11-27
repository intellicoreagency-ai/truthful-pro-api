import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/** أضواء محيطية نهارية ناعمة (أزرق، ذهبي، أخضر) تعطي الزجاج الفاتح عمقاً. ثابتة. */
export function Ambient() {
  const id = useId().replace(/:/g, '');
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`${id}b`} x1="0" y1="0" x2="0.3" y2="1"><Stop offset="0" stopColor="#F4F6FC" /><Stop offset="1" stopColor="#E9EEF8" /></LinearGradient>
          <RadialGradient id={`${id}1`} cx="0.85" cy="0.12" rx="0.7" ry="0.3"><Stop offset="0" stopColor="#6B8CFF" stopOpacity="0.20" /><Stop offset="1" stopColor="#6B8CFF" stopOpacity="0" /></RadialGradient>
          <RadialGradient id={`${id}2`} cx="0.1" cy="0.42" rx="0.7" ry="0.28"><Stop offset="0" stopColor="#D9BC7E" stopOpacity="0.26" /><Stop offset="1" stopColor="#D9BC7E" stopOpacity="0" /></RadialGradient>
          <RadialGradient id={`${id}3`} cx="0.5" cy="0.96" rx="0.8" ry="0.28"><Stop offset="0" stopColor="#34C759" stopOpacity="0.14" /><Stop offset="1" stopColor="#34C759" stopOpacity="0" /></RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id}b)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}1)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}2)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}3)`} />
      </Svg>
    </View>
  );
}
