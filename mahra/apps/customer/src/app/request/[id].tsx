import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { AgentBadge } from '@/components/AgentBadge';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { agentById } from '@/data/agents';
import { requestById, type Offer } from '@/data/requests';
import { useI18n } from '@/i18n';
import { formatAed } from '@/lib/pricing';
import { color, radius, space, TOUCH } from '@/theme/tokens';

type Pay = 'card' | 'cash';

/** رقم تجريبي؛ الرقم الحقيقي يأتي من ملف المزود بعد التأكيد فقط. */
const DEMO_PROVIDER_PHONE = '+971500000000';

/**
 * مقارنة العروض (حتى 3). العميل يرى السعر النهائي فقط.
 * رقم المزود مخفي حتى التأكيد. تأكيد العرض يُغلق بقية العروض تلقائياً.
 */
export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const req = requestById(id);
  const { t, lang, dir } = useI18n();
  const L = lang === 'ar' ? 'ar' : 'en';

  const [picked, setPicked] = useState<Offer | null>(null);
  const [pay, setPay] = useState<Pay>('card');
  const [confirmed, setConfirmed] = useState(false);

  if (!req) return null;
  const agent = agentById(req.agent)!;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('back')} style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={color.text} style={{ transform: [{ scaleX: dir === 'rtl' ? -1 : 1 }] }} />
      </Pressable>

      <View style={styles.head}>
        <AgentBadge agent={agent} />
        <View style={{ flex: 1 }}>
          <Text variant="title">{req.title[L]}</Text>
          <Text tone="dim">{req.detail[L]}</Text>
        </View>
      </View>

      {req.offers.length > 0 && (
        <>
          <View style={{ gap: space.xs }}>
            <Text variant="heading">{t('offersTitle')}</Text>
            <Text variant="caption" tone="dim">
              {t('offersHint')}
            </Text>
          </View>

          {req.offers.map((o) => {
            const closed = confirmed && picked?.id !== o.id;
            const isPicked = picked?.id === o.id;
            return (
              <Glass
                key={o.id}
                strong={isPicked}
                style={[styles.offer, isPicked && { borderColor: color.gold }, closed && { opacity: 0.45 }]}
                accessibilityState={{ disabled: closed, selected: isPicked }}
              >
                <View style={styles.offerTop}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text weight="semibold">{o.provider}</Text>
                    <View style={styles.meta}>
                      <Ionicons name="star" size={14} color={color.gold} />
                      <Text variant="caption" tone="dim">
                        {t('ratingLabel', { r: o.rating })}
                      </Text>
                    </View>
                    <View style={styles.meta}>
                      <Ionicons name="time-outline" size={14} color={color.textDim} />
                      <Text variant="caption" tone="dim">
                        {t('eta', { m: o.etaMin })}
                      </Text>
                    </View>
                  </View>
                  <Text variant="title" tone="gold" accessibilityLabel={formatAed(o.quote.customerPrice, lang)}>
                    {formatAed(o.quote.customerPrice, lang)}
                  </Text>
                </View>

                {!confirmed && !isPicked && <Button kind="secondary" label={t('choose')} onPress={() => setPicked(o)} />}
              </Glass>
            );
          })}

          {picked && !confirmed && (
            <Glass strong style={{ padding: space.lg, gap: space.md }}>
              <Text weight="semibold">{t('payTitle')}</Text>
              <View style={styles.payRow}>
                {(['card', 'cash'] as const).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setPay(p)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: pay === p }}
                    style={[styles.pay, pay === p && { borderColor: color.gold, backgroundColor: 'rgba(217,182,107,0.12)' }]}
                  >
                    <Ionicons name={p === 'card' ? 'card-outline' : 'cash-outline'} size={20} color={pay === p ? color.gold : color.textDim} />
                    <Text tone={pay === p ? 'gold' : 'normal'}>{t(p === 'card' ? 'payCard' : 'payCash')}</Text>
                  </Pressable>
                ))}
              </View>
              <Text variant="caption" tone="dim">
                {t('payNote')} {t('providerContactHidden')}
              </Text>
              <Button label={t('confirmOffer')} onPress={() => setConfirmed(true)} />
              <Button kind="ghost" label={t('cancel')} onPress={() => setPicked(null)} />
            </Glass>
          )}

          {confirmed && picked && (
            <Glass strong style={{ padding: space.lg, gap: space.sm, borderColor: color.success }} accessibilityLiveRegion="polite">
              <View style={styles.meta}>
                <Ionicons name="checkmark-circle" size={22} color={color.success} />
                <Text weight="semibold" tone="success">
                  {t('chosen')}: {picked.provider}
                </Text>
              </View>
              <Text variant="caption" tone="dim">
                {t('othersClosed')}
              </Text>
              <Button
                kind="secondary"
                label={`${t('callProvider')}`}
                icon={<Ionicons name="call-outline" size={20} color={color.text} />}
                onPress={() => Linking.openURL(`tel:${DEMO_PROVIDER_PHONE}`)}
              />
            </Glass>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: TOUCH, height: TOUCH, justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  offer: { padding: space.lg, gap: space.md },
  offerTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payRow: { flexDirection: 'row', gap: space.sm },
  pay: {
    flex: 1,
    minHeight: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.hairline,
  },
});
