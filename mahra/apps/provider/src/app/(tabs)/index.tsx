import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Orb } from '@/components/Orb';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Badge, Card } from '@/components/ui';
import { Button } from '@/components/Button';
import { useI18n } from '@/i18n';
import { aedFmt } from '@/lib/format';
import { fmtCountdown, useNow } from '@/lib/useNow';
import { useStore, type Incoming } from '@/lib/store';
import { color, radius, space, TOUCH } from '@/theme/tokens';

function RequestCard({ r, now }: { r: Incoming; now: number }) {
  const { t, lang } = useI18n();
  const L = lang === 'ar' ? 'ar' : 'en';
  const left = r.deadlineAt - now;
  const dead = left <= 0;
  const hot = left < 60_000;
  return (
    <Card style={{ gap: space.md, opacity: dead ? 0.55 : 1 }}>
      <View style={styles.between}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{r.title[L]}</Text>
          <Text variant="caption" tone="dim">{r.area[L]} · {t('kmAway', { km: r.distanceKm })}</Text>
        </View>
        <View style={[styles.timer, hot && { backgroundColor: color.badBg }]} accessibilityLabel={dead ? t('expired') : t('timeLeft', { t: fmtCountdown(left) })}>
          <Ionicons name="time-outline" size={16} color={hot ? color.bad : color.dim} />
          <Text weight="bold" style={{ color: hot ? color.bad : color.text }}>{dead ? '0:00' : fmtCountdown(left)}</Text>
        </View>
      </View>
      <Text tone="dim" numberOfLines={2}>{r.detail[L]}</Text>
      <View style={styles.chips}>
        {r.urgent && <Badge tone="bad" icon="flame">{t('urgent')}</Badge>}
        <Badge tone="mute" icon="people-outline">{t('askedProviders', { n: r.askedProviders })}</Badge>
      </View>
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button label={dead ? t('expired') : t('makeOffer')} disabled={dead} onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.id } })} />
        </View>
      </View>
    </Card>
  );
}

export default function Opportunities() {
  const { t, lang } = useI18n();
  const { name, status, available, setAvailable, incoming, stats, jobs } = useStore();
  const now = useNow();
  const live = incoming.filter((r) => r.deadlineAt > now - 5000);
  const approved = status === 'approved';
  const doneToday = jobs.filter((j) => j.status === 'completed');
  const earned = doneToday.reduce((a, j) => a + j.quote.providerPrice, 0);

  const header = (
    <View style={styles.header}>
      <View style={styles.between}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="onInkDim">{t('hello', { name })}</Text>
          <Text variant="title" tone="onInk">{available && approved ? t('available') : t('unavailable')}</Text>
          <Text variant="caption" tone="onInkDim">{available && approved ? t('availableHint') : t('unavailableHint')}</Text>
        </View>
        <Orb on={available && approved} size={58} />
      </View>
      <View style={styles.switchRow}>
        <Switch
          value={available && approved}
          disabled={!approved}
          onValueChange={setAvailable}
          trackColor={{ false: '#4A5675', true: color.gold }}
          thumbColor="#fff"
          {...({ activeThumbColor: '#fff' } as object)}
          accessibilityLabel={t('available')}
          style={{ transform: [{ scale: 1.25 }] }}
        />
        <View style={styles.kpis}>
          <View style={styles.kpi}><Text variant="heading" tone="onInk" weight="bold">{aedFmt(earned, lang)}</Text><Text variant="caption" tone="onInkDim">{t('earningsToday')}</Text></View>
          <View style={styles.kpi}><Text variant="heading" tone="onInk" weight="bold">{doneToday.length}</Text><Text variant="caption" tone="onInkDim">{t('jobsToday')}</Text></View>
          <View style={styles.kpi}><Text variant="heading" tone="onInk" weight="bold">★ {stats.rating}</Text><Text variant="caption" tone="onInkDim">{t('ratingShort')}</Text></View>
        </View>
      </View>
    </View>
  );

  return (
    <Screen tabs header={header}>
      {!approved && (
        <Card style={{ gap: space.md, borderColor: status === 'suspended' ? color.bad : color.gold }}>
          <Text variant="heading" tone={status === 'suspended' ? 'bad' : 'warn'}>{status === 'suspended' ? t('suspendedTitle') : t('incompleteTitle')}</Text>
          <Text tone="dim">{status === 'suspended' ? t('suspendedBody') : t('incompleteBody')}</Text>
          <Button kind="dark" label={status === 'suspended' ? t('goWallet') : t('goProfile')} onPress={() => router.push(status === 'suspended' ? '/wallet' : '/profile')} />
        </Card>
      )}

      {approved && !available && stats.missedThisWeek > 0 && (
        <Pressable onPress={() => setAvailable(true)} accessibilityRole="button">
          <Card style={{ backgroundColor: color.warnBg, borderColor: '#ECD49A', gap: 4 }}>
            <Text variant="heading" tone="warn">{t('missedTitle', { n: stats.missedThisWeek })}</Text>
            <Text tone="warn">{t('missedBody')}</Text>
          </Card>
        </Pressable>
      )}

      {approved && (
        <>
          <Text variant="heading">{t('openRequests')} ({available ? live.length : 0})</Text>
          {available && live.length > 0 ? live.map((r) => <RequestCard key={r.id} r={r} now={now} />) : (
            <Card><Text tone="dim">{available ? t('noRequests') : t('offlineNoRequests')}</Text></Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xl, gap: space.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  between: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  kpis: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  kpi: { alignItems: 'center', gap: 0 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: '#ECEFF5' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, minHeight: TOUCH },
});
