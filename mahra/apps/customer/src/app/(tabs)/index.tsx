import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Glass } from '@/components/Glass';
import { Pearl } from '@/components/Pearl';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import type { AgentId } from '@/data/agents';
import { DEMO_REQUESTS } from '@/data/requests';
import { useI18n, type StringKey } from '@/i18n';
import { useVoice, type VoiceState } from '@/lib/voice';
import { color, radius, space, TOUCH } from '@/theme/tokens';

const STATUS: Record<VoiceState, StringKey> = {
  idle: 'statusIdle',
  listening: 'statusListening',
  thinking: 'statusThinking',
  speaking: 'statusSpeaking',
};

const QUICK: { key: StringKey; agent: AgentId }[] = [
  { key: 'quickCar', agent: 'jalal' },
  { key: 'quickAc', agent: 'talal' },
  { key: 'quickCook', agent: 'noura' },
  { key: 'quickJob', agent: 'meera' },
];

export default function Home() {
  const { t, lang } = useI18n();
  const { state, toggle, stop } = useVoice();
  const active = state !== 'idle';
  const pending = DEMO_REQUESTS.find((r) => r.status === 'offers');

  return (
    <Screen tabs>
      <Text variant="title">{t('greeting')}</Text>

      <View style={styles.stage}>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={active ? t('stop') : t('talkToMohra')}
          style={styles.pearlPress}
        >
          <Pearl size={264} state={state}>
            <View style={styles.micDisc}>
              <Ionicons name="mic-outline" size={36} color={color.pearl} />
            </View>
          </Pearl>
        </Pressable>

        {/* حالة صوتية مقروءة للشاشة أيضاً */}
        <Text variant="heading" tone={active ? 'gold' : 'dim'} accessibilityLiveRegion="polite" center>
          {t(STATUS[state])}
        </Text>

        {active && (
          <Pressable onPress={stop} accessibilityRole="button" accessibilityLabel={t('stop')} style={styles.stopBtn}>
            <Ionicons name="stop-circle-outline" size={22} color={color.text} />
            <Text weight="medium">{t('stop')}</Text>
          </Pressable>
        )}
      </View>

      {pending && (
        <Pressable
          onPress={() => router.push({ pathname: '/request/[id]', params: { id: pending.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${t('activeRequest')}: ${pending.title[lang === 'ar' ? 'ar' : 'en']}`}
        >
          <Glass strong style={styles.active}>
            <View style={styles.dot} />
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="gold">
                {t('activeRequest')}
              </Text>
              <Text weight="semibold">{pending.title[lang === 'ar' ? 'ar' : 'en']}</Text>
              <Text variant="caption" tone="dim">
                {t('offersReady', { n: pending.offers.length })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={color.textDim} style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
          </Glass>
        </Pressable>
      )}

      <View style={{ gap: space.sm }}>
        <Text variant="caption" tone="dim">
          {t('quickTitle')}
        </Text>
        <View style={styles.chips}>
          {QUICK.map((q) => (
            <Pressable
              key={q.key}
              onPress={() => router.push({ pathname: '/chat/[agentId]', params: { agentId: q.agent } })}
              accessibilityRole="button"
              style={styles.chip}
            >
              <Text>{t(q.key)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', gap: space.lg, paddingVertical: space.md },
  pearlPress: { borderRadius: 200 },
  micDisc: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(237,231,218,0.14)',
    borderWidth: 1,
    borderColor: color.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtn: {
    minHeight: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: color.glass,
  },
  active: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.gold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: TOUCH,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: color.glass,
  },
});
