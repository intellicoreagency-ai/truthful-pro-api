import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AgentIcon } from './AgentIcon';
import { Glass } from './Glass';
import { Press } from './Press';
import { Text } from './Text';
import type { Agent } from '@/data/agents';
import { useI18n } from '@/i18n';
import { color, space } from '@/theme/tokens';

/** بطاقة وكيل (تصميم Gemini): أيقونة، الاسم والاختصاص، وصف، وكبسولة «تحدث معي». العرض يُحسب من الحاوية لا بنسبة ثابتة. */
export function AgentCard({ agent, width }: { agent: Agent; width: number }) {
  const { lang, t } = useI18n();
  const L = lang === 'ar' ? 'ar' : 'en';
  const open = () => router.push({ pathname: '/chat/[agentId]', params: { agentId: agent.id } });
  return (
    <Press onPress={open} accessibilityRole="button" accessibilityLabel={`${agent.name[L]}، ${agent.role[L]}`} style={{ width }}>
      <Glass card style={styles.card}>
        <AgentIcon agent={agent} size={56} />
        <Text font="display" weight="semibold" center style={{ color: '#FFFFFF' }} numberOfLines={1}>{agent.name[L]}</Text>
        <Text variant="caption" tone="dim" center numberOfLines={3} style={{ fontSize: 12, lineHeight: 20, minHeight: 60 }}>{agent.summary[L]}</Text>
        <View style={styles.pill}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={color.goldBright} />
          <Text variant="caption" weight="semibold" style={{ color: color.goldBright }}>{t('talkToMe')}</Text>
        </View>
      </Glass>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, gap: 6, alignItems: 'center', backgroundColor: 'rgba(8,13,28,0.34)' },
  pill: { alignSelf: 'stretch', minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.07)' },
});
