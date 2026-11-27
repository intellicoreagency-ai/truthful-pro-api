import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Badge, Card } from '@/components/ui';
import { useI18n } from '@/i18n';
import { aedFmt } from '@/lib/format';
import { useStore, type Job } from '@/lib/store';
import { color, space } from '@/theme/tokens';
import { Press } from '@/components/Press';

function JobCard({ j }: { j: Job }) {
  const { t, lang, dir } = useI18n();
  const L = lang === 'ar' ? 'ar' : 'en';
  return (
    <Press onPress={() => router.push({ pathname: '/job/[id]', params: { id: j.id } })} accessibilityRole="button" accessibilityLabel={j.title[L]}>
      <Card style={styles.row}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text weight="semibold">{j.title[L]}</Text>
          <Text variant="caption" tone="dim">{j.area[L]}</Text>
          <Badge tone={j.status === 'completed' ? 'ok' : 'info'}>{j.status === 'completed' ? t('stepDone') : j.status === 'in_progress' ? t('stepWorking') : j.onTheWay ? t('stepOnWay') : t('stepAccepted')}</Badge>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text weight="bold" tone="ok">{aedFmt(j.quote.providerPrice, L)}</Text>
          <Ionicons name="chevron-forward" size={20} color={color.dim} style={{ transform: [{ scaleX: dir === 'rtl' ? -1 : 1 }] }} />
        </View>
      </Card>
    </Press>
  );
}

export default function Jobs() {
  const { t, lang } = useI18n();
  const L = lang === 'ar' ? 'ar' : 'en';
  const { jobs, offers } = useStore();
  const active = jobs.filter((j) => j.status !== 'completed');
  const done = jobs.filter((j) => j.status === 'completed');
  const empty = !jobs.length && !offers.length;

  return (
    <Screen tabs contentStyle={{ paddingTop: 56 }}>
      <Text variant="title">{t('jobsTitle')}</Text>
      {empty && <Card><Text tone="dim">{t('noJobs')}</Text></Card>}

      {offers.length > 0 && (
        <View style={{ gap: space.md }}>
          <Text variant="heading">{t('pendingOffers')}</Text>
          {offers.map((o) => (
            <Card key={o.id} style={styles.row}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text weight="semibold">{o.title[L]}</Text>
                <Badge tone="warn" icon="hourglass-outline">{t('pendingOffers')}</Badge>
              </View>
              <Text weight="bold">{aedFmt(o.quote.providerPrice, L)}</Text>
            </Card>
          ))}
        </View>
      )}

      {active.length > 0 && (
        <View style={{ gap: space.md }}>
          <Text variant="heading">{t('activeJobs')}</Text>
          {active.map((j) => <JobCard key={j.id} j={j} />)}
        </View>
      )}

      {done.length > 0 && (
        <View style={{ gap: space.md }}>
          <Text variant="heading">{t('doneJobs')}</Text>
          {done.map((j) => <JobCard key={j.id} j={j} />)}
        </View>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: space.md } });
