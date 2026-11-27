import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '@/lib/voice';
import { easeOut } from '@/theme/tokens';

const ND = Platform.OS !== 'web';

/**
 * ظهور هادئ للعناصر التي تُضاف أثناء الاستعمال (رسائل، عروض، حقول شرطية): 220ms، حركة 8 نقاط فقط.
 * مع «تقليل الحركة» يظهر العنصر فوراً. لا تلفّ به ما يتكرر مئات المرات في اليوم.
 */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) { v.setValue(1); return; }
    const a = Animated.timing(v, { toValue: 1, duration: 220, delay, easing: easeOut, useNativeDriver: ND });
    a.start();
    return () => a.stop();
  }, [v, reduced, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
