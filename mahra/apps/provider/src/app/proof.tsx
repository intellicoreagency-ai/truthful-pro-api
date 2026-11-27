import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, Row } from '@/components/ui';
import { useI18n } from '@/i18n';
import { aedFmt } from '@/lib/format';
import { useStore } from '@/lib/store';
import { fontFor } from '@/theme/fonts';
import { color, radius, space, TOUCH } from '@/theme/tokens';

/**
 * رفع إثبات التحويل. المبلغ المصرَّح به يجب أن يساوي مجموع العمولات المختارة (تفرضه القاعدة أيضاً).
 * الصورة هنا محاكاة؛ الرفع الحقيقي يأتي مع التخزين.
 */
export default function Proof() {
  const { t, lang, dir } = useI18n();
  const L = lang === 'ar' ? 'ar' : 'en';
  const { commissions, submitProof } = useStore();
  const open = commissions.filter((c) => c.status === 'due' || c.status === 'overdue' || c.status === 'needs_review');
  const total = open.reduce((a, c) => a + c.amountFils, 0);
  const [ref, setRef] = useState('');
  const [attached, setAttached] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = (
    <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('back')} style={{ width: TOUCH, height: TOUCH, justifyContent: 'center' }}>
      <Ionicons name="arrow-back" size={26} color={color.text} style={{ transform: [{ scaleX: dir === 'rtl' ? -1 : 1 }] }} />
    </Pressable>
  );

  if (done) {
    return (
      <Screen>
        {back}
        <Card style={{ alignItems: 'center', gap: space.md, padding: space.xxl }} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={64} color={color.ok} />
          <Text variant="title" center>{t('proofSent')}</Text>
          <Button label={t('backToOpps')} onPress={() => router.replace('/wallet')} style={{ alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    );
  }

  const send = () => {
    if (!ref.trim() || !attached) return setError(t('proofNeedsRef'));
    submitProof(open.map((c) => c.id));
    setDone(true);
  };

  return (
    <Screen>
      {back}
      <Text variant="title">{t('proofTitle')}</Text>
      <Card style={{ gap: space.sm }}>
        <Text weight="semibold">{t('transferTo')}</Text>
        <Text tone="dim">{t('bankPending')}</Text>
      </Card>
      <Card style={{ gap: 2 }}>
        <Row label={t('transferAmount')} value={aedFmt(total, L)} strong tone="gold" />
        {open.map((c) => <Row key={c.id} label={c.title[L]} value={aedFmt(c.amountFils, L)} />)}
      </Card>
      <View style={{ gap: 6 }}>
        <Text variant="caption" tone="dim">{t('reference')}</Text>
        <TextInput value={ref} onChangeText={setRef} autoCapitalize="characters" accessibilityLabel={t('reference')} style={[styles.input, { fontFamily: fontFor(lang, 'regular'), textAlign: 'left', writingDirection: 'ltr' }]} />
      </View>
      <Button kind="secondary" label={attached ? t('attached') : t('attach')} icon={<Ionicons name={attached ? 'checkmark-circle' : 'camera-outline'} size={22} color={attached ? color.ok : color.text} />} onPress={() => setAttached(true)} />
      {error && <Text variant="caption" tone="bad" accessibilityLiveRegion="polite">{error}</Text>}
      <Button label={t('submitProof')} onPress={send} />
      <Text variant="caption" tone="dim" center>{t('demoNotice')}</Text>
    </Screen>
  );
}
const styles = StyleSheet.create({
  input: { minHeight: TOUCH, borderRadius: radius.md, borderWidth: 1.5, borderColor: '#B9C2D6', backgroundColor: '#fff', paddingHorizontal: space.lg, color: color.text, fontSize: 18 },
});
