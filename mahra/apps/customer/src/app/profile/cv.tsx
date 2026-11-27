import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { SubPage } from '@/components/SubPage';
import { Text } from '@/components/Text';
import { useTx } from '@/i18n';
import { color, space } from '@/theme/tokens';

/** السيرة الذاتية والملف المهني: يربطها بميرا (التوظيف، إنديد). الرفع الحقيقي مع التخزين. */
export default function Cv() {
  const tx = useTx();
  const fields = [
    [tx('المسمى الوظيفي', 'Job title'), tx('مدير مبيعات', 'Sales manager')],
    [tx('سنوات الخبرة', 'Experience'), tx('9 سنوات', '9 years')],
    [tx('نوع العقد المفضل', 'Preferred contract'), tx('دوام كامل، عن قرب', 'Full time, on site')],
    [tx('الحد الأدنى للراتب', 'Minimum salary'), tx('يُحدَّد مع ميرا', 'Set with Meera')],
  ];
  return (
    <SubPage title={tx('السيرة الذاتية', 'Your CV')} sub={tx('ميرا تبحث وتقدّم باسمك بحسب ما تكتبه هنا.', 'Meera searches and applies for you from what you write here.')}>
      <Glass r={24} strong style={[styles.card, { borderColor: color.green + '66' }]}>
        <View style={styles.row}>
          <View style={styles.ico}><Ionicons name="document-text" size={26} color={color.green} /></View>
          <View style={{ flex: 1 }}><Text weight="bold">CV_Salem.pdf</Text><Text variant="caption" tone="dim">{tx('محدّثة قبل 3 أيام', 'Updated 3 days ago')}</Text></View>
        </View>
        <View style={{ gap: 6 }}>
          <View style={styles.meter}><View style={styles.fill} /></View>
          <Text variant="caption" tone="dim">{tx('اكتمال الملف 82%', 'Profile 82% complete')}</Text>
        </View>
      </Glass>

      <Glass r={24} style={styles.card}>
        {fields.map(([k, v]) => (
          <View key={k} style={styles.kv}><Text tone="dim" style={{ flex: 1 }}>{k}</Text><Text weight="medium">{v}</Text></View>
        ))}
      </Glass>

      <Button kind="tint" tint={color.green} label={tx('ارفع سيرة جديدة', 'Upload a new CV')} icon={<Ionicons name="cloud-upload-outline" size={20} color={color.deep} />} onPress={() => undefined} />
      <Button kind="glass" label={tx('أنشئ سيرة ذكية مع ميرا', 'Build a CV with Meera')} icon={<Ionicons name="sparkles-outline" size={20} color={color.text} />} onPress={() => undefined} />
    </SubPage>
  );
}
const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ico: { width: 50, height: 50, borderRadius: 16, backgroundColor: color.green + '22', borderWidth: 1, borderColor: color.green + '66', alignItems: 'center', justifyContent: 'center' },
  meter: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  fill: { width: '82%', height: 6, borderRadius: 3, backgroundColor: color.green },
  kv: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
});
