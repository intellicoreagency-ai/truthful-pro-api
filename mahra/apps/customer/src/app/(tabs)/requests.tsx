import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AgentBadge } from '@/components/AgentBadge';
import { Glass } from '@/components/Glass';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { agentById } from '@/data/agents';
import { DEMO_REQUESTS, type RequestStatus } from '@/data/requests';
import { useI18n, type StringKey } from '@/i18n';
import { color, radius, space } from '@/theme/tokens';

const LABEL: Record<RequestStatus, StringKey> = {
  offers: 'statusOffers',
  accepted: 'statusAccepted',
  inProgress: 'statusInProgress',
  done: 'statusDone',
};

/** لكل حالة أيقونة ونص؛ اللون لا يحمل المعنى وحده. */
const ICON: Record<RequestStatus, React.ComponentProps<typeof Ionicons>['name']> = {
  offers: 'pricetags-outline',
  accepted: 'checkmark-circle-outline',
  inProgress: 'time-outline',
  done: 'checkmark-done-outline',
};

export default function Requests() {
  const { t, lang } = useI18n();
  const L = lang === 'ar' ? 'ar' : 'en';

  return (
    <Screen tabs>
      <Text variant="title">{t('requestsTitle')}</Text>

      {DEMO_REQUESTS.length === 0 ? (
        <Text tone="dim">{t('requestsEmpty')}</Text>
      ) : (
        DEMO_REQUESTS.map((r) => {
          const agent = agentById(r.agent)!;
          return (
            <Pressable
              key={r.id}
              onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${r.title[L]}. ${t(LABEL[r.status])}`}
            >
              <Glass style={styles.card}>
                <AgentBadge agent={agent} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text weight="semibold">{r.title[L]}</Text>
                  <Text variant="caption" tone="dim" numberOfLines={2}>
                    {r.detail[L]}
                  </Text>
                  <View style={styles.status}>
                    <Ionicons name={ICON[r.status]} size={16} color={r.status === 'offers' ? color.gold : color.textDim} />
                    <Text variant="caption" tone={r.status === 'offers' ? 'gold' : 'dim'}>
                      {t(LABEL[r.status])}
                    </Text>
                  </View>
                </View>
              </Glass>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
});
