import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Glass } from './Glass';
import { Press } from './Press';
import { Text } from './Text';
import { agentById, type AgentId } from '@/data/agents';
import { CTA } from '@/data/home';
import { RECIPE } from '@/data/recipes';
import { useI18n, useTx } from '@/i18n';
import { useReducedMotion } from '@/lib/voice';
import { space } from '@/theme/tokens';

const ND = Platform.OS !== 'web';
export const CARD_MIN_H = 276;
const HERO_H = 96; // الثلث العلوي من البطاقة
const SURFACE = 'rgba(17,29,49,0.84)';
const BASE = '17,29,49';

/**
 * بطاقة الوكيل (تصميم «الوصفة» المعتمد من بطاقة جلال): صورة بعرض البطاقة في الثلث العلوي يذوب آخر ربعها في الكحلي،
 * زجاج rgba(17,29,49,0.84) بتمويه وحدّ أبيض 14% وزوايا 24، انعكاس ملوّن 30% عند أعلى اليمين يتلاشى قبل المنتصف،
 * ثم الاسم والاختصاص والوصف القصير، وزر إجراء بتدرج لون الوكيل (ارتفاع لمس ≥48). كل القيم من RECIPE بمعرّف الوكيل.
 * الحركة: عند الضغط تصغر البطاقة إلى 0.98 وتقترب الصورة 160ms؛ مع «تقليل الحركة» تتغير إضاءة الزر فقط.
 */
export function RecipeCard({ id, width, selected, onSelect }: { id: AgentId; width: number; selected: boolean; onSelect: () => void }) {
  const { lang } = useI18n();
  const tx = useTx();
  const reduced = useReducedMotion();
  const [p] = useState(() => new Animated.Value(0));
  const L = lang === 'ar' ? 'ar' : 'en';
  const a = agentById(id)!;
  const r = RECIPE[id];
  const to = (v: number) => Animated.timing(p, { toValue: v, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
  const glowStyle = Platform.OS === 'web' ? ({ boxShadow: selected ? `0 0 26px ${r.glow}66` : 'none' } as object) : { shadowColor: r.glow, shadowOpacity: selected ? 0.5 : 0, shadowRadius: 14 };
  const ctaShadow = Platform.OS === 'web' ? ({ boxShadow: `0 6px 16px ${r.cta[1]}99, inset 0 1px 0 rgba(255,255,255,0.35)` } as object) : { shadowColor: r.cta[0], shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } };
  const cardScale = reduced ? 1 : p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] });
  const heroScale = reduced ? 1 : p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const open = () => router.push({ pathname: '/chat/[agentId]', params: { agentId: id } });

  return (
    <Pressable onPress={onSelect} onPressIn={() => to(1)} onPressOut={() => to(0)} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${a.name[L]}. ${a.role[L]}`} style={{ width, minHeight: CARD_MIN_H }}>
      <Animated.View style={[{ flex: 1, borderRadius: 24, transform: [{ scale: cardScale }] }, glowStyle]}>
        <Glass card style={[styles.card, { backgroundColor: SURFACE }, selected && { borderColor: r.glow + 'DD' }]}>
          <Animated.Image source={r.hero} style={[styles.hero, { transform: [{ scale: heroScale }] }]} resizeMode="cover" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          <LinearGradient colors={[`rgba(${BASE},0)`, `rgba(${BASE},0)`, `rgba(${BASE},0.94)`]} locations={[0, 0.72, 1]} style={styles.fade} pointerEvents="none" />
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
            <Defs>
              <RadialGradient id={`g${id}`} cx="1" cy="0" r="0.5">
                <Stop offset="0" stopColor={r.glow} stopOpacity="0.30" />
                <Stop offset="1" stopColor={r.glow} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#g${id})`} />
          </Svg>
          <LinearGradient colors={['rgba(227,210,167,0.20)', 'rgba(227,210,167,0)']} style={styles.sheen} pointerEvents="none" />
          <LinearGradient colors={['rgba(227,210,167,0)', 'rgba(227,210,167,0.85)', 'rgba(227,210,167,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.edge} pointerEvents="none" />

          <View style={styles.body}>
            <Text font="display" weight="bold" center numberOfLines={1} style={styles.name}>{a.name[L]}</Text>
            <Text font="kufi" weight="medium" center style={styles.role}>{a.role[L]}</Text>
            <Text variant="caption" center style={styles.desc}>{tx(...r.desc)}</Text>
            <Press onPress={open} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={tx(...CTA[id])} style={{ alignSelf: 'stretch', marginTop: 'auto' }}>
              <LinearGradient colors={r.cta} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.cta, ctaShadow]}>
                <Animated.View style={[StyleSheet.absoluteFill, styles.lit, { opacity: p }]} pointerEvents="none" />
                <Text font="display" weight="bold" center numberOfLines={1} style={styles.ctaText}>{tx(...CTA[id])}</Text>
              </LinearGradient>
            </Press>
          </View>
        </Glass>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  hero: { position: 'absolute', top: 0, left: 0, width: '100%', height: HERO_H + 8 },
  fade: { position: 'absolute', top: 0, left: 0, width: '100%', height: HERO_H + 8 },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 44 },
  edge: { position: 'absolute', top: 0, left: 16, right: 16, height: 1.5 },
  body: { flex: 1, paddingHorizontal: space.md, paddingTop: HERO_H - 4, paddingBottom: space.md, gap: 4 },
  name: { color: '#FFFFFF', fontSize: 19, lineHeight: 30 },
  role: { color: '#FFFFFF', fontSize: 13, lineHeight: 22 },
  desc: { color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 19 },
  cta: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', overflow: 'hidden' },
  lit: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999 },
  ctaText: { color: '#FFFFFF', fontSize: 15, lineHeight: 24 },
});
