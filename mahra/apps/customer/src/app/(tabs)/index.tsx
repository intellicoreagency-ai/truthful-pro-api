import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AgentCard } from '@/components/AgentCard';
import { Glass } from '@/components/Glass';
import { Pearl } from '@/components/Pearl';
import { QuickStrip } from '@/components/QuickStrip';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { agentById, type AgentId } from '@/data/agents';
import { DEMO_REQUESTS } from '@/data/requests';
import { useI18n, type StringKey } from '@/i18n';
import { useVoice, type VoiceState } from '@/lib/voice';
import { color, space, TOUCH } from '@/theme/tokens';
import { Press } from '@/components/Press';

const STATUS: Record<VoiceState, StringKey> = { idle: 'statusIdle', listening: 'statusListening', thinking: 'statusThinking', speaking: 'statusSpeaking' };
/** الأربعة الأساسية كما في الموجّه: ميرا، منصور، سارة، جلال */
const FEATURED: AgentId[] = ['meera', 'mansour', 'sara', 'jalal'];

export default function Home() {
  const { t, lang } = useI18n();
  const { state, toggle, stop } = useVoice();
  const active = state !== 'idle';
  const pending = DEMO_REQUESTS.find((r) => r.status === 'offers');
  const L = lang === 'ar' ? 'ar' : 'en';

  return (
    <Screen tabs>
      <QuickStrip />

      <View style={styles.stage}>
        <Press onPress={toggle} accessibilityRole="button" accessibilityLabel={active ? t('stop') : t('talkToMohra')} style={{ borderRadius: 200 }}>
          <Pearl size={236} state={state}>
            <View style={styles.micDisc}><Ionicons name="mic-outline" size={34} color={color.text} /></View>
          </Pearl>
        </Press>

        <Text variant="heading" tone={active ? 'gold' : 'dim'} accessibilityLiveRegion="polite" center>
          {active ? t(STATUS[state]) : t('listeningLive')}
        </Text>

        {active && (
          <Press onPress={stop} accessibilityRole="button" accessibilityLabel={t('stop')} style={styles.stopBtn}>
            <Ionicons name="stop-circle-outline" size={22} color={color.text} />
            <Text weight="medium">{t('stop')}</Text>
          </Press>
        )}
      </View>

      {pending && (
        <Press onPress={() => router.push({ pathname: '/request/[id]', params: { id: pending.id } })} accessibilityRole="button" accessibilityLabel={`${t('activeRequest')}: ${pending.title[L]}`}>
          <Glass r={22} strong style={styles.active}>
            <View style={styles.dot} />
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="gold">{t('activeRequest')}</Text>
              <Text weight="semibold">{pending.title[L]}</Text>
            </View>
            <Text variant="caption" tone="dim">{t('offersReady', { n: pending.offers.length })}</Text>
          </Glass>
        </Press>
      )}

      <View style={styles.titleRow}>
        <Text variant="title">{t('studioWord')} <Text variant="title" tone="gold">{t('appName')}</Text> AI</Text>
        <Press onPress={() => router.navigate('/specialists')} accessibilityRole="button" style={{ minHeight: TOUCH, justifyContent: 'center' }}>
          <Text variant="caption" tone="gold" weight="medium">{t('allSpecialists')}</Text>
        </Press>
      </View>

      <View style={styles.grid}>
        {FEATURED.map((id) => {
          const a = agentById(id)!;
          return <AgentCard key={id} agent={a} />;
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  micDisc: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', alignItems: 'center', justifyContent: 'center' },
  stopBtn: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, borderRadius: 99, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.glass },
  active: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 12 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.gold },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'space-between' },
});
