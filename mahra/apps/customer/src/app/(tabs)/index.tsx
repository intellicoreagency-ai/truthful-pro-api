import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { BentoCard } from '@/components/BentoCard';
import { Glass } from '@/components/Glass';
import { Pearl } from '@/components/Pearl';
import { Press } from '@/components/Press';
import { Screen } from '@/components/Screen';
import { StudioMic } from '@/components/StudioMic';
import { Text } from '@/components/Text';
import { LANGS, useI18n, useTx, type StringKey } from '@/i18n';
import { useVoice, type VoiceState } from '@/lib/voice';
import { ltr } from '@/lib/bidi';
import { color, space } from '@/theme/tokens';

const STATUS: Record<VoiceState, StringKey> = { idle: 'statusIdle', listening: 'statusListening', thinking: 'statusThinking', speaking: 'statusSpeaking' };
const chat = (agentId: string) => () => router.push({ pathname: '/chat/[agentId]', params: { agentId } });

/**
 * استوديو مهرة AI: كبسولة عنوان عائمة، كرة زجاجية قزحية بميكروفون استوديو وموجات (ذهبية يساراً، فيروزية يميناً)،
 * ثم شبكة 2×2 بتوهج حواف: ميرا زمردي، منصور ياقوتي، سارة وردي ذهبي، جلال وخالد عنبري.
 * الضغط على الكرة يبدأ الاستماع ويوجّه الأمر الصوتي للوكيل المناسب.
 */
export default function Home() {
  const { t, lang } = useI18n();
  const tx = useTx();
  const { state, toggle, stop } = useVoice();
  const active = state !== 'idle';
  const langLabel = LANGS.find((l) => l.code === lang)?.label ?? '';

  return (
    <Screen tabs>
      <Glass r={999} strong style={styles.header}>
        <View style={styles.live} />
        <Text variant="heading" weight="bold" style={{ flex: 1 }}>{tx('استوديو مهرة', 'Mohra')} {ltr('AI')}</Text>
        <Press onPress={() => router.navigate('/profile')} accessibilityRole="button" accessibilityLabel={t('language')} style={styles.langBadge}>
          <Ionicons name="globe-outline" size={16} color={color.goldBright} />
          <Text variant="caption" font="label" weight="semibold" style={{ color: color.goldBright }}>{langLabel}</Text>
        </Press>
      </Glass>

      <View style={styles.stage}>
        <Press onPress={toggle} accessibilityRole="button" accessibilityLabel={active ? t('stop') : t('talkToMohra')} style={{ borderRadius: 200 }}>
          <Pearl size={236} state={state} glassy>
            <StudioMic size={92} />
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

      <View style={styles.grid}>
        <BentoCard tone="emerald" icon="briefcase-outline" title={tx('ميرا · التوظيف والسيرة', 'Meera · Jobs and CV')} sub={tx('سيرتك الذاتية وطلبات العمل في الإمارات', 'Your CV and UAE job applications')} onPress={chat('meera')} />
        <BentoCard tone="sapphire" icon="map-outline" title={tx('منصور · خرائط الإمارات', 'Mansour · UAE maps')} sub={tx('أقرب خدمة وطريق الوصول', 'Nearest service and directions')} onPress={chat('mansour')} />
        <BentoCard tone="rose" icon="sparkles-outline" title={tx('سارة · رعاية المرافق', 'Sara · Facility care')} sub={tx('تنظيف الغرف والمكاتب والدراي كلين', 'Room, office and dry cleaning')} onPress={chat('sara')} />
        <BentoCard tone="amber" icon="car-sport-outline" title={tx('جلال وم. خالد', 'Jalal and Eng. Khaled')} sub={tx('السيارات والمقاولات وعروض الأسعار', 'Cars, contracting and quotes')} onPress={chat('jalal')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 56 },
  live: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.green },
  langBadge: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(235,208,142,0.5)', backgroundColor: 'rgba(235,208,142,0.10)' },
  stage: { alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  stopBtn: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, borderRadius: 99, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.glass },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'space-between' },
});
