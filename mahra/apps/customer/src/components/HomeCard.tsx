import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { AgentTile } from './AgentTile';
import { Glass } from './Glass';
import { Press } from './Press';
import { Text } from './Text';
import { agentById, type AgentId } from '@/data/agents';
import { CARD } from '@/data/home';
import { useTx } from '@/i18n';
import { space } from '@/theme/tokens';

const FIRST: Partial<Record<string, number>> = {
  meera: require('../../assets/ui/agent-meera.png'),
  mansour: require('../../assets/ui/agent-mansour.png'),
  sara: require('../../assets/ui/agent-sara.png'),
  jalal: require('../../assets/ui/agent-jalal.png'),
};
const SECOND: Partial<Record<string, number>> = {
  meera: require('../../assets/ui/agent2-meera.png'),
  mansour: require('../../assets/ui/agent2-mansour.png'),
  sara: require('../../assets/ui/agent2-sara.png'),
  jalal: require('../../assets/ui/agent2-jalal.png'),
};
const TILE = 56;

/** بطاقة الوكيل كما في التصميم: أيقونتان (خدمة خافتة + هوية ملونة متوهجة)، العنوان، والوصف. */
export function HomeCard({ id, width }: { id: AgentId; width: number }) {
  const tx = useTx();
  const a = agentById(id)!;
  const c = CARD[id];
  const art1 = FIRST[id];
  const art2 = SECOND[id];
  return (
    <Press onPress={() => router.push({ pathname: '/chat/[agentId]', params: { agentId: id } })} accessibilityRole="button" accessibilityLabel={`${tx(...c.title)}. ${tx(...c.sub)}`} style={{ width }}>
      <Glass card style={styles.card}>
        <View style={styles.tiles}>
          {art2 ? (
            <Image source={art2} style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          ) : (
            <View style={[styles.dim, { width: TILE, height: TILE }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name={c.second} size={28} color={a.accent} />
            </View>
          )}
          {art1 ? (
            <Image source={art1} style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          ) : (
            <AgentTile agent={a} size={TILE} />
          )}
        </View>
        <Text font="display" weight="semibold" style={{ color: '#FFFFFF', fontSize: 14, lineHeight: 24 }}>{tx(...c.title)}</Text>
        <Text variant="caption" tone="dim" style={{ fontSize: 12, lineHeight: 19 }}>{tx(...c.sub)}</Text>
      </Glass>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, gap: 6, minHeight: 176, backgroundColor: 'rgba(8,13,28,0.34)' },
  tiles: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  art: { width: TILE, height: TILE, borderRadius: TILE * 0.24 },
  dim: { borderRadius: TILE * 0.24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
});
