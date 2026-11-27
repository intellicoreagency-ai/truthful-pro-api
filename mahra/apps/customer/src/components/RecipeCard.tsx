import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Glass } from './Glass';
import { Press } from './Press';
import { Text } from './Text';
import { agentById, type AgentId } from '@/data/agents';
import { CARD, CTA } from '@/data/home';
import { useI18n, useTx } from '@/i18n';
import { space } from '@/theme/tokens';

const HERO = require('../../assets/ui/hero-jalal.jpg');
const BASE = '14,24,43'; // الكحلي الأساسي rgb(14,24,43)
const RED = '#FF453A'; // Apple Red
const HERO_H = 96; // ثلث ارتفاع البطاقة تقريباً

/**
 * بطاقة جلال (نموذج): زجاج كحلي rgba(14,24,43,0.86) بتمويه، تدخله إضاءة حمراء شعاعية من أعلى اليمين
 * (38% ثم 14% ثم شفاف عند منتصف البطاقة)، وصورة السيارة في الثلث العلوي تذوب تدريجياً في الزجاج،
 * ثم الاسم والاختصاص، وزر ياقوتي #A52338→#791D32 هو أغنى عنصر أحمر فيها.
 */
export function RecipeCard({ id, width, height, selected, onSelect }: { id: AgentId; width: number; height: number; selected: boolean; onSelect: () => void }) {
  const { lang } = useI18n();
  const tx = useTx();
  const L = lang === 'ar' ? 'ar' : 'en';
  const a = agentById(id)!;
  const c = CARD[id];
  const glow = Platform.OS === 'web' ? ({ boxShadow: selected ? `0 0 26px ${RED}66` : 'none' } as object) : { shadowColor: RED, shadowOpacity: selected ? 0.5 : 0, shadowRadius: 14 };
  const ctaGlow = Platform.OS === 'web' ? ({ boxShadow: '0 6px 16px rgba(165,35,56,0.55), inset 0 1px 0 rgba(255,255,255,0.35)' } as object) : { shadowColor: '#A52338', shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } };
  return (
    <Press onPress={onSelect} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${a.name[L]}. ${a.role[L]}`} style={[{ width, height, borderRadius: 24 }, glow]}>
      <Glass card style={[styles.card, { backgroundColor: `rgba(${BASE},0.86)` }, selected && { borderColor: RED + 'DD' }]}>
        <Image source={HERO} style={styles.hero} resizeMode="cover" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <LinearGradient colors={[`rgba(${BASE},0)`, `rgba(${BASE},0.35)`, `rgba(${BASE},0.93)`]} locations={[0, 0.62, 1]} style={styles.fade} pointerEvents="none" />
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
          <Defs>
            <RadialGradient id="red" cx="1" cy="0" r="0.72">
              <Stop offset="0" stopColor={RED} stopOpacity="0.38" />
              <Stop offset="0.5" stopColor={RED} stopOpacity="0.14" />
              <Stop offset="1" stopColor={RED} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#red)" />
        </Svg>
        <LinearGradient colors={['rgba(243,221,160,0.20)', 'rgba(243,221,160,0)']} style={styles.sheen} pointerEvents="none" />
        <LinearGradient colors={['rgba(243,221,160,0)', 'rgba(243,221,160,0.85)', 'rgba(243,221,160,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.edge} pointerEvents="none" />

        <View style={styles.body}>
          <Text font="display" weight="bold" center numberOfLines={1} style={styles.name}>{a.name[L]}</Text>
          <Text variant="caption" weight="semibold" center numberOfLines={2} style={styles.role}>{a.role[L]}</Text>
          <Text variant="caption" center numberOfLines={1} style={styles.sub}>{tx(...c.sub)}</Text>
          <Press onPress={() => router.push({ pathname: '/chat/[agentId]', params: { agentId: id } })} accessibilityRole="button" accessibilityLabel={tx(...CTA[id])} style={{ alignSelf: 'stretch', marginTop: 'auto' }}>
            <LinearGradient colors={['#A52338', '#791D32']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cta, ctaGlow]}>
              <Text font="display" weight="bold" center numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 15 }}>{tx(...CTA[id])}</Text>
            </LinearGradient>
          </Press>
        </View>
      </Glass>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  hero: { position: 'absolute', top: 0, left: 0, width: '100%', height: HERO_H + 8 },
  fade: { position: 'absolute', top: 0, left: 0, right: 0, height: HERO_H + 8 },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 44 },
  edge: { position: 'absolute', top: 0, left: 16, right: 16, height: 1.5 },
  body: { flex: 1, paddingHorizontal: space.md, paddingTop: HERO_H - 6, paddingBottom: space.md, gap: 3 },
  name: { color: '#FFFFFF', fontSize: 19, lineHeight: 28 },
  role: { color: '#FFFFFF', fontSize: 13, lineHeight: 20, minHeight: 40 },
  sub: { color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 18 },
  cta: { minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
});
