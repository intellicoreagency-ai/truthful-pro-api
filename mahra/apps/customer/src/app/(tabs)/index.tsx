import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Glass } from '@/components/Glass';
import { PIC } from '@/components/picArt';
import { Press } from '@/components/Press';
import { Screen } from '@/components/Screen';
import { StudioOrb } from '@/components/StudioOrb';
import { Text } from '@/components/Text';
import type { AgentId } from '@/data/agents';
import { THEME } from '@/data/theme';
import { useI18n, useTx, type StringKey } from '@/i18n';
import { useVoice, type VoiceState } from '@/lib/voice';
import { color, space } from '@/theme/tokens';

const WORDMARK = require('../../../assets/ui/mohra-wordmark.png');
const STATUS: Record<VoiceState, StringKey> = { idle: 'statusIdle', listening: 'statusListening', thinking: 'statusThinking', speaking: 'statusSpeaking' };

/** مجالات العميل بصيغة المتكلم (سيارتي، منزلي، مناسباتي…): لمسة واحدة تفتح محادثة وكيل المجال. */
const SUGGEST: { agent: AgentId; ar: string; en: string }[] = [
  { agent: 'jalal', ar: 'سيارتي', en: 'My car' },
  { agent: 'talal', ar: 'منزلي', en: 'My home' },
  { agent: 'dana', ar: 'مناسباتي', en: 'My events' },
  { agent: 'noura', ar: 'مطبخي', en: 'My kitchen' },
  { agent: 'reem', ar: 'جمالي', en: 'My beauty' },
];

/**
 * الرئيسية: شريط مهرة، ترحيب باسم العميل، الكرة الصوتية، «شو أقدر أساعدك فيه اليوم؟»، اقتراحات صوتية،
 * بطاقة «نشط الآن» لأهم طلب مفتوح، وأسفلها «اطلب خدمة» و«جدول اليوم». بدء المحادثة من زر مهرة في الفوتر أو بلمس الكرة.
 */
export default function Home() {
  const { t } = useI18n();
  const tx = useTx();
  const { state, toggle } = useVoice();
  const [w, setW] = useState(358);
  const active = state !== 'idle';
  const hello = new Date().getHours() < 12 ? t('helloMorning') : t('helloEvening');
  const ac = THEME.jalal.accent;

  return (
    <Screen tabs contentStyle={{ flexGrow: 1 }}>
      <Glass r={30} clear style={styles.bar}>
        <View style={[styles.bell, { backgroundColor: 'transparent' }]} />
        <Image source={WORDMARK} style={styles.wordmark} resizeMode="contain" accessibilityLabel="مهرة" />
        <Press onPress={() => router.push('/settings/privacy')} accessibilityRole="button" accessibilityLabel={t('notifications')} style={styles.bell}>
          <Ionicons name="notifications-outline" size={20} color={color.text} />
        </Press>
      </Glass>

      <View style={styles.center} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        <Text font="kufi" weight="medium" center style={styles.hello}>{hello}، {tx('محمود', 'Mahmoud')}</Text>
        <Press onPress={toggle} accessibilityRole="button" accessibilityLabel={active ? t('stop') : t('talkToMohra')} style={{ borderRadius: 200 }}>
          <StudioOrb width={Math.min(w * 0.86, 360)} state={state} />
        </Press>
        <Text font="display" weight="bold" center style={styles.prompt}>{active ? t(STATUS[state]) : t('greeting')}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggest} style={styles.suggestWrap}>
        {SUGGEST.map((x) => (
          <Press key={x.agent} onPress={() => router.push({ pathname: '/chat/[agentId]', params: { agentId: x.agent } })} accessibilityRole="button" accessibilityLabel={tx(x.ar, x.en)}>
            <Glass r={26} clear style={styles.sChip}>
              <Image source={PIC[x.agent]} style={styles.sPic} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
              <Text variant="caption" font="kufi" weight="medium" style={{ color: color.text, fontSize: 13, lineHeight: 21 }}>{tx(x.ar, x.en)}</Text>
            </Glass>
          </Press>
        ))}
      </ScrollView>

      <Press onPress={() => router.push({ pathname: '/request/[id]', params: { id: 'r1' } })} accessibilityRole="button" accessibilityLabel={tx('سطحة لسيارتي', 'Tow truck for my car')}>
        <Glass card style={styles.now}>
          <Image source={PIC.jalal} style={[styles.nPic, { borderColor: ac + '88' }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="caption" font="kufi" weight="medium" style={{ color: color.goldBright, fontSize: 12, lineHeight: 18 }}>{t('activeNow')}</Text>
            <Text font="kufi" weight="bold" numberOfLines={1} style={{ color: '#FFFFFF' }}>{tx('سطحة لسيارتي', 'Tow truck for my car')}</Text>
            <Text variant="caption" tone="dim" numberOfLines={1}>{tx('3 عروض بأسعار نهائية', '3 final-price offers')}</Text>
          </View>
          <Ionicons name="chevron-back" size={22} color={color.textDim} style={{ transform: [{ scaleX: 1 }] }} />
        </Glass>
      </Press>

      <View style={styles.chips}>
        <Chip icon="layers-outline" label={t('chipRequest')} onPress={() => router.navigate('/specialists')} />
        <Chip icon="calendar-outline" label={t('chipToday')} onPress={() => router.navigate('/requests')} />
      </View>
    </Screen>
  );
}

function Chip({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1 }}>
      <Glass r={22} clear style={styles.chip}>
        <Ionicons name={icon} size={20} color={color.goldBright} />
        <Text variant="caption" font="kufi" weight="medium" style={{ color: color.text, fontSize: 14, lineHeight: 22 }}>{label}</Text>
      </Glass>
    </Press>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8, minHeight: 60, backgroundColor: 'rgba(20,34,66,0.26)' },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  wordmark: { height: 44, width: 120 },
  center: { alignItems: 'center', gap: 10 },
  hello: { color: color.goldBright, fontSize: 16, lineHeight: 26 },
  prompt: { color: '#FFFFFF', fontSize: 22, lineHeight: 36, alignSelf: 'stretch', textAlign: 'center' },
  suggestWrap: { marginHorizontal: -space.lg, flexGrow: 0 },
  suggest: { paddingHorizontal: space.lg, gap: 10 },
  sChip: { ...({ boxShadow: 'none' } as object), shadowOpacity: 0, elevation: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, paddingEnd: 14, minHeight: 48 },
  sPic: { width: 34, height: 34, borderRadius: 10 },
  now: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 84 },
  nPic: { width: 56, height: 56, borderRadius: 14, borderWidth: 1 },
  chips: { flexDirection: 'row', gap: 12, alignSelf: 'stretch', marginTop: 'auto' },
  chip: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
});
