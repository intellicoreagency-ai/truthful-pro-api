import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AgentTile } from './AgentTile';
import { Glass } from './Glass';
import { Text } from './Text';
import { nationality, type Agent } from '@/data/agents';
import { useI18n } from '@/i18n';
import { color, space } from '@/theme/tokens';
import { Press } from '@/components/Press';

/**
 * بطاقة وكيل زجاجية بعمودين (كما في الموجّه): بلاطة بلون الوكيل، الاسم والدور، سطر وصف، وزر «تحدث الآن» بلونه.
 * البطاقة كلها قابلة للضغط؛ الزر هنا عنصر بصري فقط كي لا يتداخل زر داخل زر.
 */
export function AgentCard({ agent, tag }: { agent: Agent; tag?: string }) {
  const { lang, t } = useI18n();
  const L = lang === 'ar' ? 'ar' : 'en';
  return (
    <Press
      style={styles.cell}
      onPress={() => router.push({ pathname: '/chat/[agentId]', params: { agentId: agent.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${agent.name[L]}، ${agent.role[L]}`}
    >
      <Glass r={24} style={[styles.card, { borderColor: agent.accent + '66' }]}>
        <View style={styles.top}>
          <AgentTile agent={agent} size={50} />
          {tag ? (
            <View style={[styles.tag, { borderColor: agent.accent + '88' }]}><Text variant="caption" weight="medium" style={{ color: agent.accent }}>{tag}</Text></View>
          ) : null}
        </View>
        <View style={{ gap: 2 }}>
          <Text weight="bold">{agent.name[L]} <Text tone="dim" weight="regular">· {nationality(agent, L)}</Text></Text>
          <Text variant="caption" style={{ color: agent.accent }} numberOfLines={1}>{agent.role[L]}</Text>
        </View>
        <Text variant="caption" tone="dim" numberOfLines={2}>{agent.summary[L]}</Text>
        <LinearGradient colors={[lighten(agent.accent), agent.accent]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.cta}>
          <Ionicons name="mic" size={16} color={color.deep} />
          <Text variant="caption" weight="bold" style={{ color: color.deep }}>{t('talkNow')}</Text>
        </LinearGradient>
      </Glass>
    </Press>
  );
}

/** يفتّح لوناً سداسياً بنسبة (للتدرّج الجوهري) */
function lighten(hex: string, amt = 0.32): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v + (255 - v) * amt);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
}

const styles = StyleSheet.create({
  cell: { width: '48%' },
  card: { padding: 14, gap: 10, minHeight: 196 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  tag: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 1 },
  cta: { minHeight: 36, borderRadius: 99, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 'auto', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
});
void space;
