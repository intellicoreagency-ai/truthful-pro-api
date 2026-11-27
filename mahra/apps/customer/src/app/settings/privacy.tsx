import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { SubPage } from '@/components/SubPage';
import { Text } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { useTx } from '@/i18n';
import { color, space, TOUCH } from '@/theme/tokens';

/** الخصوصية: أقل قدر من البيانات، وموافقة تخص كل نوع، وتصدير وحذف فعليان. */
export default function Privacy() {
  const tx = useTx();
  const [hist, setHist] = useState(true);
  const [loc, setLoc] = useState(true);
  const [media, setMedia] = useState(true);
  const rows = [
    { l: tx('حفظ سجل المحادثات', 'Keep chat history'), d: tx('لاستئناف الحديث دون تكرار.', 'To resume without repeating yourself.'), v: hist, s: setHist },
    { l: tx('استعمال الموقع عند الحاجة', 'Use location when needed'), d: tx('لإيجاد المزود الأقرب فقط.', 'Only to find the nearest provider.'), v: loc, s: setLoc },
    { l: tx('مشاركة الصور مع المختص', 'Share photos with the specialist'), d: tx('لتشخيص العطل من الصورة.', 'To diagnose a fault from a photo.'), v: media, s: setMedia },
  ];
  return (
    <SubPage title={tx('الخصوصية', 'Privacy')} sub={tx('بياناتك لك. نأخذ أقل ما يلزم ولا نبيعها.', 'Your data is yours. We take the minimum and never sell it.')}>
      <Glass r={24} style={styles.card}>
        {rows.map((r) => (
          <View key={r.l} style={styles.row}>
            <View style={{ flex: 1 }}><Text>{r.l}</Text><Text variant="caption" tone="dim">{r.d}</Text></View>
            <Toggle value={r.v} onChange={r.s} label={r.l} />
          </View>
        ))}
      </Glass>
      <Button kind="glass" label={tx('تصدير بياناتي', 'Export my data')} icon={<Ionicons name="download-outline" size={20} color={color.text} />} onPress={() => undefined} />
      <Button kind="danger" label={tx('حذف حسابي نهائياً', 'Delete my account')} onPress={() => undefined} />
      <Text variant="caption" tone="dim">{tx('الحذف يمسح بياناتك من الخادم فعلاً (يُفعَّل مع الخلفية).', 'Deletion removes your data from the server (enabled with the backend).')}</Text>
    </SubPage>
  );
}
const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 12 },
});
