import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Glass } from './Glass';
import { PIC } from './picArt';
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
 * بطاقة الخبير (كلها بحجم واحد): رأس بتدرج لون الوكيل فيه الاسم عند بداية السطر (يميناً بالعربية، يساراً باللغات الأخرى)
 * وصورته الملوّنة عند نهايته، ثم نص الاختصاص موسّطاً، وزر الإجراء. النقر على البطاقة يختارها (يلوّن المشهد)، وزرها يفتح المحادثة.
 */
export function ExpertCard({ id, width, selected, onSelect }: { id: AgentId; width: number; selected: boolean; onSelect: () => void }) {
  const { lang } = useI18n();
  const tx = useTx();
  const L = lang === 'ar' ? 'ar' : 'en';
  const a = agentById(id)!;
  const c = CARD[id];
  const th = THEME[id];
  const glow = Platform.OS === 'web' ? ({ boxShadow: selected ? `0 0 26px ${th.accent}44` : 'none' } as object) : { shadowColor: th.accent, shadowOpacity: selected ? 0.4 : 0, shadowRadius: 14 };
  return (
    <Press onPress={onSelect} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${a.name[L]}. ${a.role[L]}`} style={[{ width, height: CARD_H, borderRadius: 24 }, glow]}>
      <Glass r={28} clear blur={22} style={[styles.card, { borderColor: selected ? th.accent + 'CC' : 'rgba(255,255,255,0.30)' }]}>
        <LinearGradient colors={[th.accent + '3D', th.accent + '0A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
          <Text font="display" weight="semibold" numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 26, flexShrink: 1 }}>{a.name[L]}</Text>
          <Image source={PIC[id]} style={styles.pic} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        </LinearGradient>
        <View style={styles.body}>
          <Text variant="caption" weight="semibold" center numberOfLines={2} style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 21, minHeight: 42 }}>{a.role[L]}</Text>
          <Text variant="caption" tone="dim" center numberOfLines={3} style={{ fontSize: 12, lineHeight: 19, minHeight: 57 }}>{tx(...c.sub)}</Text>
          <Press onPress={() => router.push({ pathname: '/chat/[agentId]', params: { agentId: id } })} accessibilityRole="button" accessibilityLabel={tx(...CTA[id])} style={{ alignSelf: 'stretch', marginTop: 'auto' }}>
            <LinearGradient colors={[th.accent + '38', th.accent + '18']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.cta, { borderColor: th.accent + '99' }]}>
              <Text font="display" weight="semibold" center numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 14 }}>{tx(...CTA[id])}</Text>
            </LinearGradient>
          </Press>
        </View>
      </Glass>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.025)' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 10 },
  pic: { width: PIC_SIZE, height: PIC_SIZE, borderRadius: PIC_SIZE * 0.24 },
  body: { flex: 1, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md, gap: 6 },
  cta: { minHeight: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
});
