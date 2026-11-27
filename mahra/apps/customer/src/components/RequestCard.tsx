import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { Glass } from '@/components/Glass';
import { Pill } from '@/components/Pill';
import { PIC } from '@/components/picArt';
import { Text } from '@/components/Text';
import type { AgentId } from '@/data/agents';
import { THEME } from '@/data/theme';
import { useTx } from '@/i18n';
import { space } from '@/theme/tokens';

export type RequestItem = { id: string; agent: AgentId; title: [string, string]; line: [string, string]; pill: [string, string]; go: () => void };

export const chatWith = (agentId: string) => () => router.push({ pathname: '/chat/[agentId]', params: { agentId } });

/** بطاقة طلب: زجاج شفاف بحجم موحّد بلون الوكيل الذي قدّم الخدمة، وصورته أيقونةً. */
export function RequestCard({ c }: { c: RequestItem }) {
  const tx = useTx();
  const ac = THEME[c.agent].accent;
  return (
    <Glass card style={styles.card}>
      <View style={styles.head}>
        <Image source={PIC[c.agent]} style={[styles.badge, { borderColor: ac + '88' }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <Text weight="bold" numberOfLines={2} style={{ flex: 1, color: '#FFFFFF' }}>{tx(c.title[0], c.title[1])}</Text>
      </View>
      <Text variant="caption" tone="dim" numberOfLines={2} style={{ minHeight: 40 }}>{tx(c.line[0], c.line[1])}</Text>
      <View style={{ marginTop: 'auto' }}><Pill accent={ac} label={tx(c.pill[0], c.pill[1])} onPress={c.go} /></View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md, height: 208 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 52, height: 52, borderRadius: 14, borderWidth: 1 },
});
