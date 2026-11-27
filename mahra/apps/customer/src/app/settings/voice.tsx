import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { SubPage } from '@/components/SubPage';
import { Text } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { useTx } from '@/i18n';
import { color, radius, space, TOUCH } from '@/theme/tokens';
import { Press } from '@/components/Press';

/** إعدادات الصوت: صوت مهرة Veda ثابت؛ اللهجة الإماراتية مع المتحدث بالعربية؛ سرعة الكلام والاستماع. */
export default function VoiceSettings() {
  const tx = useTx();
  const [dialect, setDialect] = useState(true);
  const [continuous, setContinuous] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [speed, setSpeed] = useState(1);
  const speeds = [tx('بطيء', 'Slow'), tx('عادي', 'Normal'), tx('سريع', 'Fast')];

  return (
    <SubPage title={tx('إعدادات الصوت', 'Voice settings')} sub={tx('كيف تسمعك مهرة وكيف تردّ عليك.', 'How Mohra hears you and how she answers.')}>
      <Glass r={24} strong style={styles.card}>
        <View style={styles.row}>
          <View style={styles.ico}><Ionicons name="pulse-outline" size={24} color={color.gold} /></View>
          <View style={{ flex: 1 }}>
            <Text weight="bold">Veda</Text>
            <Text variant="caption" tone="dim">{tx('صوت مهرة الثابت في كل اللغات', 'Mohra’s one voice in every language')}</Text>
          </View>
        </View>
        <Button kind="glass" small label={tx('اسمع صوت مهرة', 'Hear Mohra’s voice')} icon={<Ionicons name="play" size={16} color={color.text} />} onPress={() => undefined} />
        <Text variant="caption" tone="dim">{tx('المعاينة تعمل بعد ربط خدمة الصوت.', 'Preview works once the voice service is connected.')}</Text>
      </Glass>

      <Glass r={24} style={styles.card}>
        {[
          { l: tx('الرد الصوتي', 'Spoken replies'), v: speak, s: setSpeak },
          { l: tx('اللهجة الإماراتية مع العربية', 'Emirati dialect for Arabic'), v: dialect, s: setDialect },
          { l: tx('الاستماع المتواصل', 'Continuous listening'), v: continuous, s: setContinuous },
        ].map((r) => (
          <View key={r.l} style={styles.row}><Text style={{ flex: 1 }}>{r.l}</Text><Toggle value={r.v} onChange={r.s} label={r.l} /></View>
        ))}
      </Glass>

      <Glass r={24} style={styles.card}>
        <Text weight="bold">{tx('سرعة الكلام', 'Speaking speed')}</Text>
        <View style={styles.seg}>
          {speeds.map((s, i) => (
            <Press key={s} onPress={() => setSpeed(i)} accessibilityRole="radio" accessibilityState={{ selected: speed === i }} style={[styles.segBtn, speed === i && { backgroundColor: color.gold + '2E', borderColor: color.gold }]}>
              <Text weight="medium" tone={speed === i ? 'gold' : 'normal'}>{s}</Text>
            </Press>
          ))}
        </View>
      </Glass>
    </SubPage>
  );
}
const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  ico: { width: 46, height: 46, borderRadius: 15, backgroundColor: color.gold + '22', borderWidth: 1, borderColor: color.gold + '66', alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', gap: space.sm },
  segBtn: { flex: 1, minHeight: TOUCH, borderRadius: radius.pill, borderWidth: 1, borderColor: color.hairline, alignItems: 'center', justifyContent: 'center' },
});
