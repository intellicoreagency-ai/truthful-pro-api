import { StyleSheet, View } from 'react-native';
import { AgentCard } from '@/components/AgentCard';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { AGENTS } from '@/data/agents';
import { useI18n } from '@/i18n';
import { space } from '@/theme/tokens';

export default function Specialists() {
  const { t } = useI18n();
  return (
    <Screen tabs>
      <View style={{ gap: space.xs }}>
        <Text variant="display">{t('specialistsTitle')}</Text>
        <Text tone="dim">{t('specialistsSub')}</Text>
      </View>
      <View style={styles.grid}>
        {AGENTS.map((a) => <AgentCard key={a.id} agent={a} tag={a.status === 'live' ? t('tagLive') : t('tagSoon')} />)}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'space-between' } });
