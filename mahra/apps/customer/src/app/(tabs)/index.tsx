import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { ExpertCard } from '@/components/ExpertCard';
import { Glass } from '@/components/Glass';
import { Press } from '@/components/Press';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TintedOrb } from '@/components/TintedOrb';
import { PRIORITY } from '@/data/home';
import { THEME } from '@/data/theme';
import { useI18n, useTx, type StringKey } from '@/i18n';
import { useAccent } from '@/lib/accent';
import { useVoice, type VoiceState } from '@/lib/voice';
import { color, space } from '@/theme/tokens';

const STATUS: Record<VoiceState, StringKey> = { idle: 'statusIdle', listening: 'statusListening', thinking: 'statusThinking', speaking: 'statusSpeaking' };
const GAP = space.md;

/**
 * الرئيسية (تصميم الاستوديو): شريط علوي، الكرة الصوتية، «اختر مساعدك الشخصي» موسّطاً، ثم الخمسة عشر وكيلاً
 * بحسب أولوية الاحتياج. اختيار بطاقة يلوّن الأرضية والكرة وطابع الزجاج بلون الوكيل (ألوان Apple هادئة).
 */
export default function Home() {
  const { t } = useI18n();
  const tx = useTx();
  const { state, toggle } = useVoice();
  const { setAccent } = useAccent();
  const [w, setW] = useState(358);
  const [id, setId] = useState(PRIORITY[0]);
  const active = state !== 'idle';
  const th = THEME[id];
  const colW = (w - GAP) / 2;

  useFocusEffect(useCallback(() => {
    setAccent(th.accent);
    return () => setAccent(null);
  }, [th.accent, setAccent]));

  return (
    <Screen tabs>
      <Glass r={36} clear style={styles.bar}>
        <BarItem icon="briefcase-outline" label={tx('تحديث السيرة CV', 'Update CV')} onPress={() => router.push('/profile/cv')} />
        <BarItem icon="settings-outline" label={tx('إعدادات الصوت', 'Voice settings')} onPress={() => router.push('/settings/voice')} />
        <BarItem icon="person-outline" label={tx('الوكلاء', 'Agents')} accent={th.accent} onPress={() => router.navigate('/specialists')} />
      </Glass>

      <View style={{ alignItems: 'center' }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        <Press onPress={toggle} accessibilityRole="button" accessibilityLabel={active ? t('stop') : t('talkToMohra')} style={{ borderRadius: 200 }}>
          <TintedOrb width={Math.min(w, 400)} agent={id} accent={th.accent} state={state} />
        </Press>
        {active && <Text variant="caption" weight="semibold" accessibilityLiveRegion="polite" center style={{ color: th.accent }}>{t(STATUS[state])}</Text>}
      </View>

      <View style={styles.titleWrap}>
        <Text font="display" weight="bold" center style={styles.title}>{t('chooseAssistant')}</Text>
      </View>

      <View style={styles.grid}>
        {PRIORITY.map((k) => <ExpertCard key={k} id={k} width={colW} selected={k === id} onSelect={() => setId(k)} />)}
      </View>
    </Screen>
  );
}

function BarItem({ icon, label, onPress, accent }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; accent?: string }) {
  const c = accent ?? color.textDim;
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.item}>
      <Ionicons name={icon} size={26} color={c} />
      <Text variant="caption" weight="medium" center style={{ fontSize: 11, lineHeight: 18, color: c }}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 10, backgroundColor: 'rgba(8,13,28,0.34)' },
  item: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
  titleWrap: { alignSelf: 'stretch', alignItems: 'center' },
  title: { alignSelf: 'stretch', textAlign: 'center', color: '#FFFFFF', fontSize: 26, lineHeight: 42 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
