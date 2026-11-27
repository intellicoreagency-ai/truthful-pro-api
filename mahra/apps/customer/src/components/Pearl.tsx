import { useEffect, useId, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { useReducedMotion, type VoiceState } from '@/lib/voice';
import { color, motion } from '@/theme/tokens';

const ND = Platform.OS !== 'web';

type Props = {
  size: number;
  state: VoiceState;
  children?: ReactNode;
};

/**
 * اللؤلؤة: هوية مهرة. كرة زجاجية بإضاءة داخلية.
 *  idle      تنفّس هادئ
 *  listening نبض أسرع + موجات تتسع
 *  thinking  لمعة تدور ببطء
 *  speaking  نبض متوسط + أعمدة صوت في الوسط
 * مع «تقليل الحركة»: لا حلقات حركة؛ الحالة تظهر بلون الإطار والنص المرافق.
 */
export function Pearl({ size, state, children }: Props) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, '');

  const [breath] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [wave] = useState(() => new Animated.Value(0));
  const [bars] = useState(() => [0, 1, 2, 3, 4].map(() => new Animated.Value(0.3)));

  useEffect(() => {
    breath.setValue(0);
    wave.setValue(0);
    if (reduced) return;
    const anims: Animated.CompositeAnimation[] = [];

    const period =
      state === 'listening' ? motion.breathListening : state === 'speaking' ? motion.breathSpeaking : motion.breathIdle;
    if (state !== 'thinking') {
      anims.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(breath, { toValue: 1, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
            Animated.timing(breath, { toValue: 0, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
          ]),
        ),
      );
    }
    if (state === 'listening') {
      anims.push(
        Animated.loop(Animated.timing(wave, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: ND })),
      );
    }
    if (state === 'thinking') {
      spin.setValue(0);
      anims.push(
        Animated.loop(Animated.timing(spin, { toValue: 1, duration: motion.spinThinking, easing: Easing.linear, useNativeDriver: ND })),
      );
    }
    if (state === 'speaking') {
      bars.forEach((b, i) =>
        anims.push(
          Animated.loop(
            Animated.sequence([
              Animated.timing(b, { toValue: 1, duration: 380 + i * 70, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
              Animated.timing(b, { toValue: 0.25, duration: 380 + i * 70, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
            ]),
          ),
        ),
      );
    }
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [state, reduced, breath, spin, wave, bars]);

  const amp = state === 'listening' ? 0.06 : state === 'speaking' ? 0.04 : 0.025;
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + amp] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rimColor = state === 'idle' ? color.gold : state === 'listening' ? color.aqua : state === 'thinking' ? color.pearl : color.gold;

  const ring = (delay: number) => {
    const p = wave.interpolate({ inputRange: [0, delay, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
    return {
      opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
      transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
    };
  };

  const s = size;
  const inner = s * 0.86;

  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {state === 'listening' && !reduced && (
        <>
          <Animated.View style={[styles.ring, { width: inner, height: inner, borderRadius: inner / 2, borderColor: color.aqua }, ring(0)]} />
          <Animated.View style={[styles.ring, { width: inner, height: inner, borderRadius: inner / 2, borderColor: color.gold }, ring(0.35)]} />
        </>
      )}

      <Animated.View style={{ width: s, height: s, transform: [{ scale }] }}>
        <Svg width={s} height={s} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id={`${uid}glow`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.62" stopColor={color.gold} stopOpacity="0.30" />
              <Stop offset="1" stopColor={color.gold} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`${uid}body`} cx="34%" cy="28%" r="78%">
              <Stop offset="0" stopColor={color.pearl} stopOpacity="0.62" />
              <Stop offset="0.3" stopColor={color.sapphire} stopOpacity="0.5" />
              <Stop offset="0.72" stopColor={color.deep} stopOpacity="0.92" />
              <Stop offset="1" stopColor={color.ink} stopOpacity="1" />
            </RadialGradient>
            <LinearGradient id={`${uid}rim`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={rimColor} stopOpacity="0.95" />
              <Stop offset="0.5" stopColor={color.pearl} stopOpacity="0.25" />
              <Stop offset="1" stopColor={color.aqua} stopOpacity="0.8" />
            </LinearGradient>
          </Defs>
          <Circle cx="100" cy="100" r="98" fill={`url(#${uid}glow)`} />
          <Circle cx="100" cy="100" r="84" fill={`url(#${uid}body)`} />
          <Circle cx="100" cy="100" r="84" fill="none" stroke={`url(#${uid}rim)`} strokeWidth="1.6" />
          <Ellipse cx="72" cy="58" rx="34" ry="17" fill={color.pearl} opacity="0.16" transform="rotate(-28 72 58)" />
        </Svg>
      </Animated.View>

      {/* لمعة تدور أثناء التفكير */}
      {state === 'thinking' && !reduced && (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]} pointerEvents="none">
          <Svg width={s} height={s} viewBox="0 0 200 200">
            <Circle cx="100" cy="100" r="84" fill="none" stroke={color.gold} strokeWidth="2.4" strokeDasharray="60 470" strokeLinecap="round" />
          </Svg>
        </Animated.View>
      )}

      {/* مركز اللؤلؤة: الميكروفون أو أعمدة الصوت */}
      <View style={styles.center} pointerEvents="box-none">
        {state === 'speaking' && !reduced ? (
          <View style={styles.bars} accessibilityElementsHidden>
            {bars.map((b, i) => (
              <Animated.View
                key={i}
                style={{
                  width: Math.max(4, s * 0.022),
                  borderRadius: 4,
                  backgroundColor: color.gold,
                  height: b.interpolate({ inputRange: [0, 1], outputRange: [s * 0.05, s * 0.2] }),
                }}
              />
            ))}
          </View>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 1.5 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
