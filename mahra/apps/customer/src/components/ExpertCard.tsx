import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Glass } from './Glass';
import { PIC } from './picArt';
import { RecipeCard } from './RecipeCard';
import { Press } from './Press';
import { Text } from './Text';
import { agentById, type AgentId } from '@/data/agents';
import { CARD, CTA } from '@/data/home';
import { THEME } from '@/data/theme';
import { useI18n, useTx } from '@/i18n';
import { space } from '@/theme/tokens';

const PIC_SIZE = 56;
export const CARD_H = 268;

/**
 * بطاقة الخبير (كلها بحجم واحد): جسمها كله بتدرج قطري بلون الوكيل من أعلى اليمين (مضيء) إلى أسفل اليسار (عميق)،
 * ثم انعكاس شمبانيّ رقيق على الحافة العليا، وزر إجراء ممتلئ بتدرج لونه. الاسم عند بداية السطر وصورته عند نهايته.
 * النقر على البطاقة يختارها (يلوّن المشهد)، وزرها يفتح المحادثة.
 */
type Props = { id: AgentId; width: number; selected: boolean; onSelect: () => void };

/** جلال له بطاقة «الوصفة» (RecipeCard: زجاج كحلي بإضاءة حمراء)؛ البقية بالتدرج الكامل إلى أن تُعمَّم. */
export function ExpertCard(p: Props) {
  return p.id === 'jalal' ? <RecipeCard {...p} height={CARD_H} /> : <GradientCard {...p} />;
}

function GradientCard({ id, width, selected, onSelect }: Props) {
  const { lang } = useI18n();
  const tx = useTx();
  const L = lang === 'ar' ? 'ar' : 'en';
  const a = agentById(id)!;
  const c = CARD[id];
  const th = THEME[id];
  const glow = Platform.OS === 'web' ? ({ boxShadow: selected ? `0 0 26px ${th.accent}66` : 'none' } as object) : { shadowColor: th.accent, shadowOpacity: selected ? 0.5 : 0, shadowRadius: 14 };
  return (
    <Press onPress={onSelect} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${a.name[L]}. ${a.role[L]}`} style={[{ width, height: CARD_H, borderRadius: 24 }, glow]}>
      <Glass card style={[styles.card, { backgroundColor: 'transparent' }, selected && { borderColor: th.accent + 'DD' }]}>
        <LinearGradient colors={th.stops} locations={[0, 0.5, 1]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <LinearGradient colors={['rgba(243,221,160,0.22)', 'rgba(243,221,160,0)']} style={styles.sheen} pointerEvents="none" />
        <LinearGradient colors={['rgba(243,221,160,0)', 'rgba(243,221,160,0.85)', 'rgba(243,221,160,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.edge} pointerEvents="none" />
        <View style={styles.head}>
          <Text font="display" weight="semibold" numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 17, lineHeight: 26, flexShrink: 1, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>{a.name[L]}</Text>
          <Image source={PIC[id]} style={styles.pic} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        </View>
        <View style={styles.body}>
          <Text variant="caption" weight="semibold" center numberOfLines={2} style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 21, minHeight: 42 }}>{a.role[L]}</Text>
          <Text variant="caption" center numberOfLines={3} style={{ color: 'rgba(255,255,255,0.84)', fontSize: 12, lineHeight: 19, minHeight: 57 }}>{tx(...c.sub)}</Text>
          <Press onPress={() => router.push({ pathname: '/chat/[agentId]', params: { agentId: id } })} accessibilityRole="button" accessibilityLabel={tx(...CTA[id])} style={{ alignSelf: 'stretch', marginTop: 'auto' }}>
            <LinearGradient colors={th.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
              <Text font="display" weight="semibold" center numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 14 }}>{tx(...CTA[id])}</Text>
            </LinearGradient>
          </Press>
        </View>
      </Glass>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 44 },
  edge: { position: 'absolute', top: 0, left: 16, right: 16, height: 1.5 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 10 },
  pic: { width: PIC_SIZE, height: PIC_SIZE, borderRadius: PIC_SIZE * 0.24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  body: { flex: 1, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md, gap: 6 },
  cta: { minHeight: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)' },
});
