import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { useReducedMotion, type VoiceState } from '@/lib/voice';

const ART = require('../../assets/ui/studio-orb.png');
const ND = Platform.OS !== 'web';
const RATIO = 812 / 1312; // نسبة صورة الكرة
const BUBBLE = 416 / 656; // قطر الفقاعة من عرض الصورة

/**
 * الكرة الصوتية من تصميم الاستوديو: فقاعة زجاجية بميكروفون شفاف وموجات ذهبية/فيروزية.
 * جاهزة: تنفّس هادئ | تستمع: نبض أسرع + حلقة تنتشر | تعالج: وميض | تتحدث: نبض متوسط. مع «تقليل الحركة»: ثابتة.
 */
export function StudioOrb({ width, state }: { width: number; state: VoiceState }) {
  const reduced = useReducedMotion();
  const [breath] = useState(() => new Animated.Value(0));
  const [ring] = useState(() => new Animated.Value(0));

  useEffect(() => {
    breath.setValue(0);
    ring.setValue(0);
    if (reduced) return;
    const dur = state === 'listening' ? 900 : state === 'speaking' ? 700 : state === 'thinking' ? 1400 : 3200;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      Animated.timing(breath, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
    ]));
    a.start();
    let b: Animated.CompositeAnimation | null = null;
    if (state === 'listening') {
      b = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1900, easing: Easing.out(Easing.quad), useNativeDriver: ND }));
      b.start();
    }
    return () => { a.stop(); b?.stop(); };
  }, [state, reduced, breath, ring]);

  const amp = state === 'listening' ? 0.05 : state === 'speaking' ? 0.035 : state === 'thinking' ? 0.012 : 0.02;
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + amp] });
  const opacity = state === 'thinking' ? breath.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) : 1;
  const h = width * RATIO;
  const d = width * BUBBLE;
  const ringStyle = { opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }] };

  return (
    <View style={{ width, height: h, alignItems: 'center', justifyContent: 'center' }}>
      {state === 'listening' && !reduced && <Animated.View pointerEvents="none" style={[styles.ring, { width: d, height: d, borderRadius: d / 2 }, ringStyle]} />}
      <Animated.View style={{ width, height: h, opacity, transform: [{ scale }] }}>
        <Image source={ART} style={{ width, height: h }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ ring: { position: 'absolute', borderWidth: 1.5, borderColor: '#38BDF8' } });
