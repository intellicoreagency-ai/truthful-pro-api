import { useEffect, useId, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { color } from '@/theme/tokens';

const ND = Platform.OS !== 'web';

/** لؤلؤة الإتاحة: ذهبية نابضة إن كان متاحاً، رمادية ساكنة إن لم يكن. بلا نبض مع «تقليل الحركة». */
export function Orb({ on, size = 56 }: { on: boolean; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    pulse.setValue(0);
    if (!on || reduced) return;
    const a = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: ND }));
    a.start();
    return () => a.stop();
  }, [on, reduced, pulse]);

  const ring = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
  };
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {on && !reduced && <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth: 2, borderColor: color.gold }, ring]} />}
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id={`${uid}b`} cx="34%" cy="28%" r="78%">
            <Stop offset="0" stopColor={color.onInk} stopOpacity={on ? 0.7 : 0.35} />
            <Stop offset="0.35" stopColor={on ? '#3D63DD' : '#6B7390'} stopOpacity="0.55" />
            <Stop offset="0.78" stopColor={color.deep} />
            <Stop offset="1" stopColor="#060A18" />
          </RadialGradient>
          <LinearGradient id={`${uid}r`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={on ? color.gold : '#8B93AD'} />
            <Stop offset="1" stopColor={on ? color.aqua : '#5B637F'} />
          </LinearGradient>
        </Defs>
        <Circle cx="100" cy="100" r="97" fill="none" stroke={on ? '#6B8CFF' : '#8B93AD'} strokeOpacity="0.5" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round" />
        <Circle cx="100" cy="100" r="90" fill={`url(#${uid}b)`} />
        <Circle cx="100" cy="100" r="90" fill="none" stroke={`url(#${uid}r)`} strokeWidth="6" />
        <Ellipse cx="72" cy="58" rx="34" ry="17" fill={color.onInk} opacity="0.2" transform="rotate(-28 72 58)" />
      </Svg>
    </View>
  );
}
