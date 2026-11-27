import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { PriceInput } from '@/components/PriceInput';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Badge, Card, Row } from '@/components/ui';
import { useI18n } from '@/i18n';
import { aedFmt, dateFmt } from '@/lib/format';
import { toFils } from '@/lib/pricing';
import { useStore } from '@/lib/store';
import { color, space, TOUCH } from '@/theme/tokens';
import { Press } from '@/components/Press';

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, dir } = useI18n();
  const L = lang === 'ar' ? 'ar' : 'en';
  const { jobs, advanceJob, recordPayment } = useStore();
  const job = jobs.find((j) => j.id === id);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const back = (
    <Press onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('back')} style={styles.back}>
      <Ionicons name="arrow-back" size={26} color={color.text} style={{ transform: [{ scaleX: dir === 'rtl' ? -1 : 1 }] }} />
    </Press>
  );
  if (!job) return <Screen>{back}<Card><Text tone="dim">{t('noJobs')}</Text></Card></Screen>;

  const stepIdx = job.status === 'completed' ? 3 : job.status === 'in_progress' ? 2 : job.onTheWay ? 1 : 0;
  const steps = [t('stepAccepted'), t('stepOnWay'), t('stepWorking'), t('stepDone')];
  const nextLabel = [t('nextOnWay'), t('nextStart'), t('nextDone'), ''][stepIdx];
  const remaining = job.quote.customerPrice - job.collectedFils;

  const record = () => {
    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) return setMsg({ tone: 'bad', text: t('priceInvalid') });
    const res = recordPayment(job.id, toFils(n));
    if (res.error) return setMsg({ tone: 'bad', text: t('exceeds') });
    setText('');
    setMsg({ tone: 'ok', text: `${t('recorded')}. ${t('commissionDue', { amount: aedFmt(res.commission!.amountFils, L), date: dateFmt(res.commission!.dueOn, L) })}` });
  };

  return (
    <Screen>
      {back}
      <View style={{ gap: 4 }}>
        <Text variant="title">{job.title[L]}</Text>
        <Text tone="dim">{job.area[L]}</Text>
      </View>
      <Badge tone="ok" icon="checkmark-circle">{t('chosen')}</Badge>

      <Card style={{ gap: space.md }}>
        <View style={styles.stepper}>
          {steps.map((s, i) => (
            <View key={s} style={styles.step}>
              <View style={[styles.dot, i <= stepIdx && { backgroundColor: color.ok, borderColor: color.ok }]}>
                {i <= stepIdx && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text variant="caption" weight={i === stepIdx ? 'bold' : 'regular'} tone={i <= stepIdx ? 'normal' : 'dim'} center>{s}</Text>
            </View>
          ))}
        </View>
        {stepIdx < 3 && <Button kind="dark" label={nextLabel} onPress={() => advanceJob(job.id)} />}
      </Card>

      <Card style={{ gap: space.md }}>
        <Text weight="semibold">{t('customer')}: {job.customer.name}</Text>
        <Text tone="dim" style={{ writingDirection: 'ltr' }}>{job.customer.phone}</Text>
        <View style={styles.contacts}>
          <View style={{ flex: 1 }}><Button kind="secondary" label={t('call')} icon={<Ionicons name="call" size={20} color={color.text} />} onPress={() => Linking.openURL(`tel:${job.customer.phone}`)} /></View>
          <View style={{ flex: 1 }}><Button kind="secondary" label={t('whatsapp')} icon={<Ionicons name="logo-whatsapp" size={20} color={color.ok} />} onPress={() => Linking.openURL(`https://wa.me/${job.customer.whatsapp.replace('+', '')}`)} /></View>
        </View>
        <Button kind="secondary" label={t('navigate')} icon={<Ionicons name="navigate" size={20} color={color.sapphire} />} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.area.en)}`)} />
      </Card>

      <Card style={{ gap: 2 }}>
        <Row label={t('customerSees')} value={aedFmt(job.quote.customerPrice, L)} />
        <Row label={t('youReceive')} value={aedFmt(job.quote.providerPrice, L)} strong tone="ok" />
        <Row label={t('payMethod')} value={job.paymentMethod === 'cash' ? t('payCash') : t('payCard')} />
      </Card>

      {stepIdx >= 2 && (
        <Card style={{ gap: space.md }}>
          <Text variant="heading">{t('recordTitle')}</Text>
          <Text variant="caption" tone="dim">{t('recordHint')}</Text>
          <Text variant="caption" tone="dim">{t('agreedTotal', { amount: aedFmt(job.quote.customerPrice, L) })} · {aedFmt(job.collectedFils, L)} / {aedFmt(job.quote.customerPrice, L)}</Text>
          {remaining > 0 && (
            <>
              <PriceInput value={text} onChange={setText} placeholder={String(Math.round(remaining / 100))} label={t('collected')} size={34} />
              <Button label={t('recordPay')} onPress={record} disabled={!text} />
            </>
          )}
          {msg && <Text tone={msg.tone === 'ok' ? 'ok' : 'bad'} accessibilityLiveRegion="polite">{msg.text}</Text>}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: TOUCH, height: TOUCH, justifyContent: 'center' },
  stepper: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: color.line, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  contacts: { flexDirection: 'row', gap: space.sm },
});
