import { useEffect, useId, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAccent } from '@/lib/accent';
import { color } from '@/theme/tokens';

type Props = { tone?: 'gold' | 'blue' };
const ND = Platform.OS !== 'web';

function Layer({ accent, tone }: { accent: string | null; tone: 'gold' | 'blue' }) {
  const id = useId().replace(/:/g, '');
  const warm = accent ?? (tone === 'gold' ? color.gold : color.periwinkle);
  const cool = accent ?? color.periwinkle;
  const low = accent ?? '#1E4FD0';
  const k = accent ? 0.85 : 1;
  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={`${id}b`} x1="0" y1="0" x2="0.35" y2="1"><Stop offset="0" stopColor="#00081B" /><Stop offset="0.55" stopColor="#030F2B" /><Stop offset="1" stopColor="#020A1F" /></LinearGradient>
        <LinearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.07" /><Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></LinearGradient>
        <RadialGradient id={`${id}1`} cx="0.82" cy="0.1" rx="0.7" ry="0.32"><Stop offset="0" stopColor={cool} stopOpacity={0.30 * k} /><Stop offset="1" stopColor={cool} stopOpacity="0" /></RadialGradient>
        <RadialGradient id={`${id}2`} cx="0.16" cy="0.36" rx="0.7" ry="0.3"><Stop offset="0" stopColor={warm} stopOpacity={0.16 * k} /><Stop offset="1" stopColor={warm} stopOpacity="0" /></RadialGradient>
        <RadialGradient id={`${id}3`} cx="0.5" cy="0.95" rx="0.8" ry="0.3"><Stop offset="0" stopColor={low} stopOpacity={0.17 * k} /><Stop offset="1" stopColor={low} stopOpacity="0" /></RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id}b)`} />
      <Rect width="100%" height="100%" fill={`url(#${id}1)`} />
      <Rect width="100%" height="100%" fill={`url(#${id}2)`} />
      <Rect width="100%" height="100%" fill={`url(#${id}3)`} />
    </Svg>
  );
}

/**
 * أرضية ليلية بأضواء محيطية (Spatial Glass). مع لون وكيل مختار (AccentProvider) تتلوّن الأضواء الثلاثة بلونه،
 * بانتقال متدرج 450ms بين اللونين.
 */
export function Backdrop({ tone = 'gold' }: Props) {
  const { accent } = useAccent();
  const [layers, setLayers] = useState<{ cur: string | null; prev: string | null }>({ cur: accent, prev: accent });
  const [fade] = useState(() => new Animated.Value(1));

  if (layers.cur !== accent) setLayers({ cur: accent, prev: layers.cur });

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: ND }).start();
  }, [accent, fade]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={StyleSheet.absoluteFill}><Layer accent={layers.prev} tone={tone} /></View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}><Layer accent={layers.cur} tone={tone} /></Animated.View>
    </View>
  );
}
