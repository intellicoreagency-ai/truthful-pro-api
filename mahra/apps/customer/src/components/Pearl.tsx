import { useEffect, useId, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { useReducedMotion, type VoiceState } from '@/lib/voice';
import { color, motion } from '@/theme/tokens';

const ND = Platform.OS !== 'web';
const W = 340;

/** موجة صوتية منقطة: جيب مخفّف الأطراف. تُحسب مرة واحدة. */
function wave(amp: number, cycles: number, phase: number): string {
  let d = '';
  for (let x = 0; x <= W; x += 4) {
    const env = Math.pow(Math.sin((Math.PI * x) / W), 0.9);
    const y = 150 + amp * env * Math.sin((x / W) * Math.PI * 2 * cycles + phase);
    d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)} `;
  }
  return d;
}
const WAVES = { a: wave(58, 1.5, 0), b: wave(40, 2, 1.2), c: wave(26, 2.5, 2.4) };

type Props = { size: number; state: VoiceState; children?: ReactNode };

/**
 * اللؤلؤة: هوية مهرة. كرة زجاجية بإضاءة داخلية وحافة قزحية (ذهبي، وردي، فيروزي).
 *  idle      تنفّس هادئ وموجات ساكنة خافتة
 *  listening نبض أسرع + موجات ذهبية وفيروزية تتسع + حلقات تنتشر
 *  thinking  لمعة تدور ببطء
 *  speaking  موجات متوسطة
 * مع «تقليل الحركة»: لا حلقات ولا نبض؛ الحالة تظهر بنص الحالة المرافق.
 */
export function Pearl({ size, state, children }: Props) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const [breath] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [ring] = useState(() => new Animated.Value(0));
  const [amp] = useState(() => new Animated.Value(0));

  useEffect(() => {
    breath.setValue(0);
    ring.setValue(0);
    if (reduced) return;
    const anims: Animated.CompositeAnimation[] = [];
    const period = state === 'listening' ? motion.breathListening : state === 'speaking' ? motion.breathSpeaking : motion.breathIdle;
    if (state !== 'thinking') {
      anims.push(Animated.loop(Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
        Animated.timing(breath, { toValue: 0, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      ])));
      anims.push(Animated.loop(Animated.sequence([
        Animated.timing(amp, { toValue: 1, duration: state === 'idle' ? 2400 : 520, easing: Easing.inOut(Easing.quad), useNativeDriver: ND }),
        Animated.timing(amp, { toValue: 0, duration: state === 'idle' ? 2400 : 520, easing: Easing.inOut(Easing.quad), useNativeDriver: ND }),
      ])));
    }
    if (state === 'listening') anims.push(Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1900, easing: Easing.out(Easing.quad), useNativeDriver: ND })));
    if (state === 'thinking') {
      spin.setValue(0);
      anims.push(Animated.loop(Animated.timing(spin, { toValue: 1, duration: motion.spinThinking, easing: Easing.linear, useNativeDriver: ND })));
    }
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [state, reduced, breath, spin, ring, amp]);

  const bAmp = state === 'listening' ? 0.055 : state === 'speaking' ? 0.04 : 0.022;
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + bAmp] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const lo = state === 'idle' ? 0.3 : state === 'thinking' ? 0.12 : 0.55;
  const hi = state === 'idle' ? 0.5 : state === 'thinking' ? 0.12 : state === 'speaking' ? 0.95 : 1.15;
  const scaleY = reduced ? 0.45 : amp.interpolate({ inputRange: [0, 1], outputRange: [lo, hi] });

  const ringStyle = (delay: number) => {
    const p = ring.interpolate({ inputRange: [0, delay, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
    return { opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }] };
  };

  const s = size;
  const wv = (s * W) / 300; // عرض طبقة الموجات
  const hm = state === 'idle' ? 0.45 : 0.9;

  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {state === 'listening' && !reduced && (
        <>
          <Animated.View style={[styles.ring, { width: s * 0.78, height: s * 0.78, borderRadius: s, borderColor: color.cyan }, ringStyle(0)]} />
          <Animated.View style={[styles.ring, { width: s * 0.78, height: s * 0.78, borderRadius: s, borderColor: color.gold }, ringStyle(0.35)]} />
        </>
      )}

      <Animated.View style={{ width: s, height: s, transform: [{ scale }] }}>
        <Svg width={s} height={s} viewBox="0 0 300 300">
          <Defs>
            <RadialGradient id={`${uid}h`} cx="50%" cy="50%" r="50%"><Stop offset="0.56" stopColor={color.gold} stopOpacity="0.42" /><Stop offset="0.82" stopColor={color.cyan} stopOpacity="0.08" /><Stop offset="1" stopColor={color.cyan} stopOpacity="0" /></RadialGradient>
            <RadialGradient id={`${uid}b`} cx="32%" cy="28%" r="78%"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="0.32" stopColor="#E2C07D" /><Stop offset="0.7" stopColor="#6B8CFF" /><Stop offset="1" stopColor="#0C111D" /></RadialGradient>
            <LinearGradient id={`${uid}r`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#F6DDA6" /><Stop offset="0.34" stopColor="#EAB9D3" /><Stop offset="0.62" stopColor={color.cyan} /><Stop offset="1" stopColor={color.gold} /></LinearGradient>
          </Defs>
          <Circle cx="150" cy="150" r="146" fill={`url(#${uid}h)`} />
          <Circle cx="150" cy="150" r="139" fill="none" stroke={color.periwinkle} strokeOpacity="0.5" strokeWidth="1.3" strokeDasharray="3 7" strokeLinecap="round" />
          <Circle cx="150" cy="150" r="118" fill={`url(#${uid}b)`} />
          <Circle cx="150" cy="150" r="118" fill="none" stroke={`url(#${uid}r)`} strokeWidth="2.6" />
          <Circle cx="150" cy="150" r="111" fill="none" stroke="#fff" strokeOpacity="0.12" />
          <Ellipse cx="108" cy="84" rx="54" ry="22" fill="#fff" opacity="0.34" transform="rotate(-28 108 84)" />
          <Circle cx="84" cy="72" r="5" fill="#fff" opacity="0.85" />
        </Svg>
      </Animated.View>

      {/* الموجات الصوتية: تتجاوز الكرة أفقياً، وتتنفس رأسياً بحسب الحالة */}
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', transform: [{ scaleY }] }]} pointerEvents="none">
        <Svg width={wv} height={s} viewBox={`0 0 ${W} 300`}>
          <Defs>
            <LinearGradient id={`${uid}wg`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2="0"><Stop offset="0" stopColor={color.gold} stopOpacity="0" /><Stop offset="0.25" stopColor={color.goldBright} /><Stop offset="0.5" stopColor="#fff" /><Stop offset="0.75" stopColor={color.goldBright} /><Stop offset="1" stopColor={color.gold} stopOpacity="0" /></LinearGradient>
            <LinearGradient id={`${uid}wc`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2="0"><Stop offset="0" stopColor={color.cyan} stopOpacity="0" /><Stop offset="0.3" stopColor={color.cyan} /><Stop offset="0.7" stopColor={color.cyan} /><Stop offset="1" stopColor={color.cyan} stopOpacity="0" /></LinearGradient>
          </Defs>
          <Path d={WAVES.a} fill="none" stroke={`url(#${uid}wg)`} strokeWidth="2.8" strokeLinecap="round" strokeDasharray="0 6.4" />
          <Path d={WAVES.b} fill="none" stroke={`url(#${uid}wc)`} strokeWidth="2.2" strokeLinecap="round" strokeDasharray="0 6" opacity={0.85 * hm + 0.1} />
          <Path d={WAVES.c} fill="none" stroke={`url(#${uid}wg)`} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0 7.2" opacity={0.6} />
        </Svg>
      </Animated.View>

      {state === 'thinking' && !reduced && (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]} pointerEvents="none">
          <Svg width={s} height={s} viewBox="0 0 300 300"><Circle cx="150" cy="150" r="118" fill="none" stroke={color.goldBright} strokeWidth="3" strokeDasharray="70 670" strokeLinecap="round" /></Svg>
        </Animated.View>
      )}

      <View style={styles.center} pointerEvents="box-none">{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 1.5 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
