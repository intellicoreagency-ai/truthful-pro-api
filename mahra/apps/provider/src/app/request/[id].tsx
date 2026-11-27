import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { PriceInput } from '@/components/PriceInput';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Badge, Card, Row } from '@/components/ui';
import { useI18n } from '@/i18n';
import { aedFmt } from '@/lib/format';
import { DEFAULT_COMMISSION_RATE, quote, toFils } from '@/lib/pricing';
import { useStore } from '@/lib/store';
import { color, radius, space, TOUCH } from '@/theme/tokens';

const ETAS = [10, 15, 20, 30, 45, 60];

/**
 * عرض السعر. المزود يكتب سعره، ويرى فوراً: ما يراه العميل، وما يحصل عليه هو كاملاً،
 * وعمولة مهرة المضافة فوق سعره. الحساب نفسه الذي تفرضه قاعدة البيانات.
 */
export default function RequestOffer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, dir } = useI18n();
  const L = lang === 'ar' ? 'ar' : 'en';
  const { incoming, submitOffer, declineRequest } = useStore();
  const [sent, setSent] = useState(false);
  const r = incoming.find((x) => x.id === id);

  const [text, setText] = useState('');
  const [eta, setEta] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);

  const price = Number(text);
  const okPrice = Number.isFinite(price) && price >= 1 && price <= 50_000;
  const q = okPrice ? quote(toFils(price)) : null;

  const back = (
    <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('back')} style={styles.back}>
      <Ionicons name="arrow-back" size={26} color={color.text} style={{ transform: [{ scaleX: dir === 'rtl' ? -1 : 1 }] }} />
    </Pressable>
  );

  if (sent) {
    return (
      <Screen>
        {back}
        <Card style={{ alignItems: 'center', gap: space.md, padding: space.xxl }} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={64} color={color.ok} />
          <Text variant="title" center>{t('offerSent')}</Text>
          <Text tone="dim" center>{t('offerSentBody')}</Text>
          <Button label={t('backToOpps')} onPress={() => router.replace('/')} style={{ alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    );
  }
  if (!r) {
    return <Screen>{back}<Card><Text tone="dim">{t('noRequests')}</Text></Card></Screen>;
  }

  const send = () => {
    if (!q) return setError(t('priceInvalid'));
    setError(null);
    submitOffer(r.id, q.providerPrice, eta);
    setSent(true);
  };

  return (
    <Screen>
      {back}
      <View style={{ gap: 4 }}>
        <Text variant="title">{r.title[L]}</Text>
        <Text tone="dim">{r.area[L]} · {t('kmAway', { km: r.distanceKm })}</Text>
      </View>
      <Card style={{ gap: space.sm }}>
        <Text>{r.detail[L]}</Text>
        {r.urgent && <Badge tone="bad" icon="flame">{t('urgent')}</Badge>}
      </Card>

      <Card style={{ gap: space.md }}>
        <Text variant="caption" tone="dim">{t('yourPrice')}</Text>
        <PriceInput value={text} onChange={setText} placeholder={t('pricePlaceholder')} label={t('yourPrice')} size={48} />
        {error && <Text variant="caption" tone="bad" accessibilityLiveRegion="polite">{error}</Text>}
      </Card>

      <Card style={{ gap: 2, backgroundColor: q ? color.surface : '#F8F9FC' }}>
        <Row label={t('customerSees')} value={q ? aedFmt(q.customerPrice, L) : '—'} />
        <Row label={`${t('youReceive')} · ${t('youReceiveNote')}`} value={q ? aedFmt(q.providerPrice, L) : '—'} strong tone="ok" />
        <Row label={t('commission', { rate: DEFAULT_COMMISSION_RATE * 100 })} value={q ? aedFmt(q.commission, L) : '—'} />
        <Text variant="caption" tone="dim" style={{ marginTop: 6 }}>{t('commissionNote')}</Text>
      </Card>

      <View style={{ gap: space.sm }}>
        <Text variant="caption" tone="dim">{t('eta')}</Text>
        <View style={styles.chips}>
          {ETAS.map((m) => (
            <Pressable key={m} onPress={() => setEta(m)} accessibilityRole="radio" accessibilityState={{ selected: eta === m }} style={[styles.chip, eta === m && { backgroundColor: color.ink, borderColor: color.ink }]}>
              <Text weight="medium" style={{ color: eta === m ? color.onInk : color.text }}>{t('etaMin', { m })}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Button label={t('sendOffer')} onPress={send} disabled={!okPrice} />

      {!declining ? (
        <Button kind="ghost" label={t('decline')} onPress={() => setDeclining(true)} />
      ) : (
        <Card style={{ gap: space.sm }}>
          <Text weight="semibold">{t('declineReason')}</Text>
          {(['reasonBusy', 'reasonFar', 'reasonNoVehicle'] as const).map((k) => (
            <Button key={k} kind="secondary" label={t(k)} onPress={() => { declineRequest(r.id); router.replace('/'); }} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: TOUCH, height: TOUCH, justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: TOUCH - 6, minWidth: 92, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.line, backgroundColor: color.surface },
});
