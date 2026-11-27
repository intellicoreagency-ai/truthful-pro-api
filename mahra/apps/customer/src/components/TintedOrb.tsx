import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { ORB_ART } from './orbArt';
import { useReducedMotion, type VoiceState } from '@/lib/voice';

const ND = Platform.OS !== 'web';
const RATIO = 347 / 560;
const BUBBLE = 0.634;
const MAX = 22;
const BAR = 3;
const GAP = 4;

/** يفتّح لوناً سداسياً نحو الأبيض بنسبة t (للجانب الأيمن من الموجة). */
function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * الكرة الصوتية: فقاعة زجاجية بلون الوكيل (انتقال متدرج 450ms) وموجات صوتية حيّة تتموج على جانبيها بلونه،
 * وسرعتها حسب الحالة: جاهزة هادئة، تستمع/تتحدث أسرع وأعلى. بلا وكيل مختار: ذهبي يساراً وفيروزي يميناً (ألوان التصميم).
 * مع «تقليل الحركة»: موجات ثابتة.
 */
export function TintedOrb({ width, agent, accent, state }: { width: number; agent: string; accent: string | null; state: VoiceState }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState({ cur: agent, prev: agent });
  const [mix] = useState(() => new Animated.Value(1));
  const [bars] = useState(() => Array.from({ length: MAX * 2 }, () => new Animated.Value(0.4)));
  if (shown.cur !== agent) setShown({ cur: agent, prev: shown.cur });

  useEffect(() => {
    mix.setValue(0);
    Animated.timing(mix, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: ND }).start();
  }, [agent, mix]);

  useEffect(() => {
    if (reduced) { bars.forEach((b, i) => b.setValue(0.35 + 0.3 * Math.abs(Math.sin(i)))); return; }
    const base = state === 'listening' ? 380 : state === 'speaking' ? 480 : state === 'thinking' ? 700 : 1100;
    const anims = bars.map((b, i) => {
      const d = base * (0.75 + 0.5 * Math.abs(Math.sin(i * 1.7)));
      const hi = state === 'idle' ? 0.7 : 1;
      return Animated.loop(Animated.sequence([
        Animated.timing(b, { toValue: hi, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
        Animated.timing(b, { toValue: 0.12, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      ]));
    });
    const t = setTimeout(() => anims.forEach((a) => a.start()), 0);
    return () => { clearTimeout(t); anims.forEach((a) => a.stop()); };
  }, [state, reduced, bars]);

  const h = width * RATIO;
  const d = width * BUBBLE;
  const side = (width - d) / 2;
  const n = Math.max(0, Math.min(MAX, Math.floor((side - 6) / (BAR + GAP))));
  const cLeft = accent ?? '#E2C07D';
  const cRight = accent ? lighten(accent, 0.35) : '#38BDF8';
  const maxH = d * 0.30;

  const col = (arr: Animated.Value[], color: string, leftSide: boolean) => arr.slice(0, n).map((v, i) => {
    const env = Math.pow(1 - i / (n + 1), 0.9);
    const x = leftSide ? side - 4 - (i + 1) * (BAR + GAP) : width - side + 4 + i * (BAR + GAP);
    return (
      <Animated.View
        key={`${leftSide ? 'l' : 'r'}${i}`}
        pointerEvents="none"
        style={{ position: 'absolute', left: x, top: h / 2 - (maxH * env) / 2, width: BAR, height: maxH * env, borderRadius: 2, backgroundColor: color, opacity: 0.35 + 0.65 * env, transform: [{ scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] }) }] }}
      />
    );
  });

  return (
    <View style={{ width, height: h, alignItems: 'center', justifyContent: 'center' }}>
      <View pointerEvents="none" style={[styles.halo, { width: d * 1.15, height: d * 1.15, borderRadius: d, backgroundColor: accent ?? '#E2C07D' }]} />
      <View style={{ width, height: h }}>
        <Image source={ORB_ART[shown.prev] ?? ORB_ART.default} style={[StyleSheet.absoluteFill, { width, height: h }]} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <Animated.Image source={ORB_ART[shown.cur] ?? ORB_ART.default} style={[StyleSheet.absoluteFill, { width, height: h, opacity: mix }]} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        {col(bars.slice(0, MAX), cLeft, true)}
        {col(bars.slice(MAX), cRight, false)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ halo: { position: 'absolute', opacity: 0.10, ...(Platform.OS === 'web' ? ({ filter: 'blur(40px)' } as object) : {}) } });
