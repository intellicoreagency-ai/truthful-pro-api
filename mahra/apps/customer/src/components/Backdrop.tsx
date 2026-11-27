import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { color } from '@/theme/tokens';

/** خلفية كحلية عميقة مع توهج ذهبي خافت من الزاوية وياقوتي من الأسفل. ثابتة، بلا حركة. */
export function Backdrop() {
  const id = useId().replace(/:/g, '');
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`${id}base`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.deep} />
            <Stop offset="1" stopColor={color.ink} />
          </LinearGradient>
          <RadialGradient id={`${id}gold`} cx="0.1" cy="0.05" rx="0.7" ry="0.45">
            <Stop offset="0" stopColor={color.gold} stopOpacity="0.28" />
            <Stop offset="1" stopColor={color.gold} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${id}blue`} cx="0.95" cy="0.95" rx="0.8" ry="0.5">
            <Stop offset="0" stopColor={color.sapphire} stopOpacity="0.30" />
            <Stop offset="1" stopColor={color.sapphire} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id}base)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}gold)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}blue)`} />
      </Svg>
    </View>
  );
}
