import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { AgentTile } from '@/components/AgentTile';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { agentById } from '@/data/agents';
import { requestById, type Offer } from '@/data/requests';
import { useI18n, useTx } from '@/i18n';
import { formatAed } from '@/lib/pricing';
import { color, space, TOUCH } from '@/theme/tokens';
import { FadeIn } from '@/components/FadeIn';
import { Press } from '@/components/Press';

type Pay = 'card' | 'cash';

function Meta({ icon, children, gold }: { icon: 'star' | 'time-outline' | 'shield-checkmark'; children: React.ReactNode; gold?: boolean }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={16} color={icon === 'star' ? color.gold : icon === 'shield-checkmark' ? color.green : color.textDim} />
      <Text variant="caption" tone={gold ? 'gold' : 'dim'}>{children}</Text>
    </View>
  );
}

/**
 * مقارنة العروض (حتى 3). السعر النهائي فقط. التسلسل: «الأفضل قيمة» كبيرة، ثم الأقل سعراً والأسرع كصفّين مدمجين.
 * رقم المزود مخفي حتى التأكيد، والتأكيد يغلق بقية العروض تلقائياً.
 */
export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const req = requestById(id);
  const { t, lang, dir } = useI18n();
  const tx = useTx();
  const L = lang === 'ar' ? 'ar' : 'en';
  const [picked, setPicked] = useState<Offer | null>(null);
  const [pay, setPay] = useState<Pay>('card');
  const [confirmed, setConfirmed] = useState(false);

  const { best, cheapest, fastest } = useMemo(() => {
    const o = req?.offers ?? [];
    if (!o.length) return { best: undefined, cheapest: undefined, fastest: undefined };
    const cheapest = [...o].sort((a, b) => a.quote.customerPrice - b.quote.customerPrice)[0];
    const fastest = [...o].sort((a, b) => a.etaMin - b.etaMin)[0];
    // الأفضل قيمة: أعلى تقييماً بين من ليس الأقل سعراً ولا الأسرع إن وُجد، وإلا الأعلى تقييماً
    const rest = o.filter((x) => x !== cheapest && x !== fastest);
    const best = (rest.length ? rest : o).sort((a, b) => b.rating - a.rating)[0];
    return { best, cheapest, fastest };
  }, [req]);

  if (!req) return null;
  const agent = agentById(req.agent)!;
  const others = req.offers.filter((o) => o !== best);

  const back = (
    <Press onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('back')} style={styles.back}>
      <Ionicons name="arrow-back" size={24} color={color.text} style={{ transform: [{ scaleX: dir === 'rtl' ? -1 : 1 }] }} />
    </Press>
  );

  const price = (o: Offer, big?: boolean) => (
    <View style={{ alignItems: 'flex-end' }}>
      {big && <Text variant="caption" tone="dim">{tx('السعر النهائي', 'Final price')}</Text>}
      <Text variant={big ? 'display' : 'title'} weight="bold" accessibilityLabel={formatAed(o.quote.customerPrice, lang)}>{formatAed(o.quote.customerPrice, lang)}</Text>
    </View>
  );

  if (confirmed && picked) {
    return (
      <Screen>
        {back}
        <Glass r={28} strong style={[styles.card, { borderColor: color.green + '88', alignItems: 'center', gap: space.md }]} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={60} color={color.green} />
          <Text variant="title" center>{t('chosen')}: {picked.provider}</Text>
          <Text tone="dim" center>{t('othersClosed')}</Text>
          <Button kind="gold" label={tx('اتصل بالمزود', 'Call the provider')} icon={<Ionicons name="call" size={20} color={color.deep} />} onPress={() => Linking.openURL('tel:+971500000000')} style={{ alignSelf: 'stretch' }} />
          <Text variant="caption" tone="dim" center>{tx('رقم تجريبي: الرقم الحقيقي يظهر من ملف المزود بعد التأكيد فقط.', 'Demo number: the real one comes from the provider profile after confirming.')}</Text>
        </Glass>
      </Screen>
    );
  }

  return (
    <Screen>
      {back}
      <View style={{ gap: 2 }}>
        <Text variant="display">{t('offersTitle')}</Text>
      </View>

      <Glass r={22} style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 }]}>
        <AgentTile agent={agent} size={44} />
        <View style={{ flex: 1 }}>
          <Text weight="semibold">{req.title[L]}</Text>
          <Text variant="caption" tone="dim">{req.detail[L]}</Text>
        </View>
      </Glass>

      <View style={styles.live}><View style={styles.liveDot} /><Text variant="caption" tone="dim">{tx(`وصلت ${req.offers.length} عروض خلال دقيقتين`, `${req.offers.length} offers arrived within two minutes`)}</Text></View>

      {best && (
        <Glass r={28} strong style={[styles.card, { borderColor: color.gold + 'AA', gap: space.md }]}>
          <View style={styles.between}>
            <View style={{ gap: 8, flex: 1 }}>
              <View style={styles.tag}><Text variant="caption" weight="bold" tone="gold">{tx('الأفضل قيمة', 'Best value')}</Text></View>
              <Text variant="title">{best.provider}</Text>
              <Meta icon="shield-checkmark">{tx('وثائق موثقة', 'Verified documents')}</Meta>
            </View>
            {price(best, true)}
          </View>
          <View style={styles.metaRow}>
            <Meta icon="star">{best.rating} {tx('تقييم', 'rating')}</Meta>
            <Meta icon="time-outline">{t('eta', { m: best.etaMin })}</Meta>
          </View>
          {!picked || picked.id !== best.id ? <Button kind="gold" label={t('choose')} onPress={() => setPicked(best)} /> : null}
        </Glass>
      )}

      {others.map((o, i) => (
        <FadeIn key={o.id} delay={[0, 60, 110][Math.min(i, 2)]}>
        <Glass r={24} style={[styles.card, styles.compact, picked?.id === o.id && { borderColor: color.gold + 'AA' }]}>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.metaRow}>
              <Text weight="semibold">{o.provider}</Text>
              {o === cheapest && <View style={[styles.mini, { borderColor: color.green + '88' }]}><Text variant="caption" weight="semibold" style={{ color: color.green }}>{tx('الأقل سعراً', 'Lowest price')}</Text></View>}
              {o === fastest && <View style={[styles.mini, { borderColor: color.cyan + '88' }]}><Text variant="caption" weight="semibold" style={{ color: color.cyan }}>{tx('الأسرع', 'Fastest')}</Text></View>}
            </View>
            <View style={styles.metaRow}><Meta icon="star">{o.rating}</Meta><Meta icon="time-outline">{t('eta', { m: o.etaMin })}</Meta></View>
          </View>
          {price(o)}
          <Button kind="glass" small label={tx('اختر', 'Choose')} onPress={() => setPicked(o)} />
        </Glass>
        </FadeIn>
      ))}

      {picked && (
        <Glass r={26} strong style={[styles.card, { gap: space.md }]}>
          <Text weight="bold">{t('payTitle')}</Text>
          <View style={styles.metaRow}>
            {(['card', 'cash'] as const).map((p) => (
              <Press key={p} onPress={() => setPay(p)} accessibilityRole="radio" accessibilityState={{ selected: pay === p }} style={[styles.payBtn, pay === p && { borderColor: color.gold, backgroundColor: color.gold + '22' }]}>
                <Ionicons name={p === 'card' ? 'card-outline' : 'cash-outline'} size={20} color={pay === p ? color.gold : color.textDim} />
                <Text tone={pay === p ? 'gold' : 'normal'}>{t(p === 'card' ? 'payCard' : 'payCash')}</Text>
              </Press>
            ))}
          </View>
          <Text variant="caption" tone="dim">{t('payNote')} {t('providerContactHidden')}</Text>
          <Button kind="gold" label={t('confirmOffer')} onPress={() => setConfirmed(true)} />
          <Button kind="ghost" label={t('cancel')} onPress={() => setPicked(null)} />
        </Glass>
      )}

      <View style={styles.note}>
        <Ionicons name="lock-closed-outline" size={18} color={color.gold} />
        <Text variant="caption" tone="dim" style={{ flex: 1 }}>{t('offersHint')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: TOUCH, height: TOUCH, justifyContent: 'center' },
  card: { padding: space.lg },
  compact: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14 },
  between: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderColor: color.gold + '99', backgroundColor: color.gold + '22', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 2 },
  mini: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.green },
  payBtn: { flex: 1, minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 99, borderWidth: 1, borderColor: color.hairline },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});
