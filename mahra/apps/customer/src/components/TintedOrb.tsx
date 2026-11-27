import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { ORB_ART } from './orbArt';
import { useReducedMotion, type VoiceState } from '@/lib/voice';

const ND = Platform.OS !== 'web';
const RATIO = 347 / 560;
const BUBBLE = 0.634;
const ART = ORB_ART;

/** الكرة الصوتية بلون الوكيل المختار (نسخة مُلوَّنة من فقاعة التصميم) مع انتقال متدرج، وتنبض حسب حالة الصوت. */
export function TintedOrb({ width, agent, accent, state }: { width: number; agent: string; accent: string; state: VoiceState }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState({ cur: agent, prev: agent });
  const [mix] = useState(() => new Animated.Value(1));
  const [breath] = useState(() => new Animated.Value(0));
  // عند تغيّر الوكيل: الحالية تصبح «السابقة» (تُضبط أثناء العرض لا داخل effect)
  if (shown.cur !== agent) setShown({ cur: agent, prev: shown.cur });

  useEffect(() => {
    mix.setValue(0);
    Animated.timing(mix, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: ND }).start();
  }, [agent, mix]);

  useEffect(() => {
    breath.setValue(0);
    if (reduced) return;
    const dur = state === 'listening' ? 900 : state === 'speaking' ? 700 : 3200;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      Animated.timing(breath, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
    ]));
    a.start();
    return () => a.stop();
  }, [state, reduced, breath]);

  const h = width * RATIO;
  const d = width * BUBBLE;
  const amp = state === 'listening' ? 0.05 : state === 'speaking' ? 0.035 : 0.02;
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + amp] });
  return (
    <View style={{ width, height: h, alignItems: 'center', justifyContent: 'center' }}>
      <View pointerEvents="none" style={[styles.halo, { width: d * 1.15, height: d * 1.15, borderRadius: d, backgroundColor: accent }]} />
      <Animated.View style={{ width, height: h, transform: [{ scale }] }}>
        <Image source={ART[shown.prev] ?? ART.jalal} style={[StyleSheet.absoluteFill, { width, height: h }]} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <Animated.Image source={ART[shown.cur] ?? ART.jalal} style={[StyleSheet.absoluteFill, { width, height: h, opacity: mix }]} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ halo: { position: 'absolute', opacity: 0.10, ...(Platform.OS === 'web' ? ({ filter: 'blur(40px)' } as object) : {}) } });
