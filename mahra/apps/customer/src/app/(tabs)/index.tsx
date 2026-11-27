import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useState } from 'react';
import { Glass } from '@/components/Glass';
import { Press } from '@/components/Press';
import { Screen } from '@/components/Screen';
import { StudioOrb } from '@/components/StudioOrb';
import { Text } from '@/components/Text';
import { useI18n, type StringKey } from '@/i18n';
import { useVoice, type VoiceState } from '@/lib/voice';
import { color } from '@/theme/tokens';

const WORDMARK = require('../../../assets/ui/mohra-wordmark.png');
const STATUS: Record<VoiceState, StringKey> = { idle: 'statusIdle', listening: 'statusListening', thinking: 'statusThinking', speaking: 'statusSpeaking' };

/**
 * الرئيسية («ابدأ الحديث») بحسب التصميم المعتمد: شريط مهرة مع الإشعارات، الكرة الصوتية بالميكروفون والموجات،
 * «شو أقدر أساعدك فيه اليوم؟»، زر «ابدأ الحديث» بتدرج أزرق–ذهبي، ثم «اطلب خدمة» و«جدول اليوم».
 */
export default function Home() {
  const { t } = useI18n();
  const { state, toggle } = useVoice();
  const [w, setW] = useState(358);
  const active = state !== 'idle';

  return (
    <Screen tabs contentStyle={{ flexGrow: 1 }}>
      <Glass r={30} clear style={styles.bar}>
        <View style={[styles.bell, { backgroundColor: "transparent" }]} />
        <Image source={WORDMARK} style={styles.wordmark} resizeMode="contain" accessibilityLabel="مهرة" />
        <Press onPress={() => router.push('/settings/privacy')} accessibilityRole="button" accessibilityLabel={t('notifications')} style={styles.bell}>
          <Ionicons name="notifications-outline" size={20} color={color.text} />
        </Press>
      </Glass>

      <View style={styles.center} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        <Press onPress={toggle} accessibilityRole="button" accessibilityLabel={active ? t('stop') : t('talkToMohra')} style={{ borderRadius: 200 }}>
          <StudioOrb width={Math.min(w * 1.08, 460)} state={state} />
        </Press>
        <Text font="display" weight="bold" center style={styles.prompt}>{active ? t(STATUS[state]) : t('greeting')}</Text>

        <Press onPress={toggle} accessibilityRole="button" accessibilityLabel={active ? t('stop') : t('startTalking')} style={styles.ctaWrap}>
          {active ? (
            <Glass r={28} clear style={styles.cta}>
              <Ionicons name="stop" size={20} color={color.text} />
              <Text weight="bold" style={styles.ctaText}>{t('stop')}</Text>
            </Glass>
          ) : (
            <LinearGradient colors={['#5B7FE8', '#E9DCC0', '#D9B779']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.cta}>
              <Ionicons name="mic-outline" size={22} color="#101830" />
              <Text weight="bold" style={[styles.ctaText, { color: '#101830' }]}>{t('startTalking')}</Text>
            </LinearGradient>
          )}
        </Press>

        <View style={styles.chips}>
          <Chip icon="layers-outline" label={t('chipRequest')} onPress={() => router.navigate('/specialists')} />
          <Chip icon="calendar-outline" label={t('chipToday')} onPress={() => router.navigate('/requests')} />
        </View>
      </View>
    </Screen>
  );
}

function Chip({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1 }}>
      <Glass r={22} clear style={styles.chip}>
        <Ionicons name={icon} size={20} color={color.goldBright} />
        <Text variant="caption" weight="medium" style={{ color: color.text, fontSize: 14, lineHeight: 22 }}>{label}</Text>
      </Glass>
    </Press>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8, minHeight: 60, backgroundColor: 'rgba(20,34,66,0.5)' },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  wordmark: { height: 44, width: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  prompt: { color: '#FFFFFF', fontSize: 22, lineHeight: 36, alignSelf: 'stretch', textAlign: 'center' },
  ctaWrap: { alignSelf: 'stretch', borderRadius: 28 },
  cta: { minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  ctaText: { fontSize: 18, lineHeight: 28, color: color.text },
  chips: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  chip: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
});
