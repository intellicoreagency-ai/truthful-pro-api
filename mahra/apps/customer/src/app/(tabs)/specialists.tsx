import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AgentBadge } from '@/components/AgentBadge';
import { Glass } from '@/components/Glass';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { AGENTS, nationality } from '@/data/agents';
import { useI18n } from '@/i18n';
import { color, radius, space } from '@/theme/tokens';

export default function Specialists() {
  const { t, lang } = useI18n();
  const L = lang === 'ar' ? 'ar' : 'en';

  return (
    <Screen tabs>
      <View style={{ gap: space.xs }}>
        <Text variant="title">{t('specialistsTitle')}</Text>
        <Text tone="dim">{t('specialistsSub')}</Text>
      </View>

      {AGENTS.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => router.push({ pathname: '/chat/[agentId]', params: { agentId: a.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${a.name[L]}، ${a.role[L]}. ${a.status === 'live' ? t('tagLive') : t('tagSoon')}`}
        >
          <Glass style={styles.card}>
            <AgentBadge agent={a} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.head}>
                <Text weight="semibold">{a.name[L]}</Text>
                <View style={[styles.tag, a.status === 'live' && { borderColor: color.gold }]}>
                  <Text variant="caption" tone={a.status === 'live' ? 'gold' : 'dim'}>
                    {a.status === 'live' ? t('tagLive') : t('tagSoon')}
                  </Text>
                </View>
              </View>
              <Text variant="caption" tone="gold">
                {a.role[L]} · {nationality(a, L)}
              </Text>
              <Text variant="caption" tone="dim">
                {a.summary[L]}
              </Text>
            </View>
          </Glass>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tag: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: color.hairline },
});
