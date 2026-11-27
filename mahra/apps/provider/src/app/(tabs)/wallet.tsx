import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Badge, Card } from '@/components/ui';
import { useI18n, type StringKey } from '@/i18n';
import { aedFmt, dateFmt } from '@/lib/format';
import { businessDaysBetween, useStore, type CommissionStatus } from '@/lib/store';
import { useNow } from '@/lib/useNow';
import { color, radius, space } from '@/theme/tokens';

const LABEL: Record<CommissionStatus, StringKey> = { due: 'statusDue', proof_uploaded: 'statusProof', paid: 'statusPaid', overdue: 'statusOverdue', needs_review: 'statusReview' };
const TONE: Record<CommissionStatus, 'ok' | 'bad' | 'warn' | 'info' | 'mute'> = { due: 'info', proof_uploaded: 'warn', paid: 'ok', overdue: 'bad', needs_review: 'warn' };

/**
 * عمولات مهرة: لا مفاجآت. عدّاد بأيام العمل بدل إيقاف مفاجئ، وتنبيه قبل الموعد.
 * المبلغ المستحق = مجموع العمولات غير المسددة؛ ومن رفع إثباتاً لا يُحسب متأخراً حتى تراجعه الإدارة.
 */
export default function Wallet() {
  const { t, lang } = useI18n();
  const L = lang === 'ar' ? 'ar' : 'en';
  const { commissions, status } = useStore();
  const open = commissions.filter((c) => c.status === 'due' || c.status === 'overdue' || c.status === 'needs_review');
  const total = open.reduce((a, c) => a + c.amountFils, 0);
  const now = useNow(60_000);
  const nearest = open.length ? Math.min(...open.map((c) => c.dueOn)) : null;
  const days = nearest !== null ? businessDaysBetween(now, nearest) : null;
  const soon = days !== null && days <= 2;

  return (
    <Screen tabs contentStyle={{ paddingTop: 56 }}>
      <Text variant="title">{t('walletTitle')}</Text>

      {status === 'suspended' && (
        <Card style={{ borderColor: color.bad, gap: space.sm }}>
          <Text variant="heading" tone="bad">{t('suspendedTitle')}</Text>
          <Text tone="dim">{t('suspendedBody')}</Text>
        </Card>
      )}

      <View style={styles.hero}>
        <Text variant="caption" tone="onInkDim">{t('dueTotal')}</Text>
        <Text variant="display" tone="onInk">{aedFmt(total, L)}</Text>
        {days !== null ? (
          <Text tone="onInkDim">{t('nextDeadline')}: {days < 0 ? t('overdueBy', { n: -days }) : days === 0 ? t('lastDay') : t('daysLeft', { n: days })}</Text>
        ) : (
          <Text tone="onInkDim">{t('allClear')}</Text>
        )}
      </View>

      {soon && (
        <Card style={{ backgroundColor: color.warnBg, borderColor: '#ECD49A' }}>
          <Text tone="warn" weight="medium">{t('warnSoon')}</Text>
        </Card>
      )}

      {open.length > 0 && <Button label={t('transferNow')} onPress={() => router.push('/proof')} />}

      <View style={{ gap: space.md }}>
        {commissions.map((c) => (
          <Card key={c.id} style={styles.row}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text weight="semibold">{c.title[L]}</Text>
              <Text variant="caption" tone="dim">{dateFmt(c.dueOn, L)}</Text>
              <Badge tone={TONE[c.status]}>{t(LABEL[c.status])}</Badge>
            </View>
            <Text weight="bold">{aedFmt(c.amountFils, L)}</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  hero: { backgroundColor: color.ink, borderRadius: radius.xl, padding: space.xl, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
