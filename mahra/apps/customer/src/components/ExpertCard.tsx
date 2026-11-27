import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Glass } from './Glass';
import { Press } from './Press';
import { Text } from './Text';
import { agentById, type AgentId } from '@/data/agents';
import { CARD, CTA } from '@/data/home';
import { THEME } from '@/data/theme';
import { useI18n, useTx } from '@/i18n';
import { space } from '@/theme/tokens';

const FIRST: Partial<Record<string, number>> = { meera: require('../../assets/ui/agent-meera.png'), mansour: require('../../assets/ui/agent-mansour.png'), sara: require('../../assets/ui/agent-sara.png'), jalal: require('../../assets/ui/agent-jalal.png') };
const SECOND: Partial<Record<string, number>> = { meera: require('../../assets/ui/agent2-meera.png'), mansour: require('../../assets/ui/agent2-mansour.png'), sara: require('../../assets/ui/agent2-sara.png'), jalal: require('../../assets/ui/agent2-jalal.png') };
const TILE = 38;

/**
 * بطاقة الخبير: رأس بتدرج هادئ بلون الوكيل فيه أيقونتا الخدمة واسم الوكيل بجانبهما، ثم نص الاختصاص تحتهما،
 * وزر إجراء بلون الوكيل. النقر على البطاقة يختارها فيتلوّن المشهد بلونها؛ زر الإجراء يفتح المحادثة.
 */
export function ExpertCard({ id, width, selected, onSelect }: { id: AgentId; width: number; selected: boolean; onSelect: () => void }) {
  const { lang } = useI18n();
  const tx = useTx();
  const L = lang === 'ar' ? 'ar' : 'en';
  const a = agentById(id)!;
  const c = CARD[id];
  const th = THEME[id];
  const glow = Platform.OS === 'web' ? ({ boxShadow: selected ? `0 0 26px ${th.accent}44` : 'none' } as object) : { shadowColor: th.accent, shadowOpacity: selected ? 0.4 : 0, shadowRadius: 14 };
  const second = SECOND[id] ? <Image source={SECOND[id]!} style={styles.art} /> : <View style={styles.dim}><Ionicons name={c.second} size={20} color="#FFFFFF" /></View>;
  const first = FIRST[id] ? <Image source={FIRST[id]!} style={styles.art} /> : <View style={[styles.dim, { backgroundColor: 'rgba(255,255,255,0.26)' }]}><Ionicons name={a.icon} size={22} color="#FFFFFF" /></View>;
  return (
    <Press onPress={onSelect} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${a.name[L]}. ${a.role[L]}`} style={[{ width, opacity: selected ? 1 : 0.8, borderRadius: 24 }, glow]}>
      <Glass r={24} clear style={[styles.card, { borderColor: selected ? th.accent + 'CC' : 'rgba(255,255,255,0.20)' }]}>
        <LinearGradient colors={th.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
          <View style={styles.tiles}>{second}{first}</View>
          <Text font="display" weight="bold" numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 26, flexShrink: 1 }}>{a.name[L]}</Text>
        </LinearGradient>
        <View style={styles.body}>
          <Text variant="caption" weight="semibold" center numberOfLines={2} style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 21 }}>{a.role[L]}</Text>
          <Text variant="caption" tone="dim" center numberOfLines={3} style={{ fontSize: 12, lineHeight: 19, minHeight: 57 }}>{tx(...c.sub)}</Text>
          <Press onPress={() => router.push({ pathname: '/chat/[agentId]', params: { agentId: id } })} accessibilityRole="button" accessibilityLabel={tx(...CTA[id])} style={{ alignSelf: 'stretch' }}>
            <LinearGradient colors={th.grad} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.cta}>
              <Text font="display" weight="semibold" center numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 14 }}>{tx(...CTA[id])}</Text>
            </LinearGradient>
          </Press>
        </View>
      </Glass>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, backgroundColor: 'rgba(8,13,28,0.34)' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingVertical: 10 },
  tiles: { flexDirection: 'row', gap: 6 },
  art: { width: TILE, height: TILE, borderRadius: TILE * 0.24 },
  dim: { width: TILE, height: TILE, borderRadius: TILE * 0.24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  body: { padding: space.sm, gap: 6 },
  cta: { minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
});
