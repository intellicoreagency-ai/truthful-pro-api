import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Glass } from './Glass';
import { Press } from './Press';
import { Text } from './Text';
import { useI18n } from '@/i18n';
import { color } from '@/theme/tokens';

/** رأس صفحة فرعية داخل التبويبات: كبسولة زجاجية (رجوع + عنوان في الوسط) بنفس شريط الرئيسية. */
export function PageHeader({ title, back }: { title: string; back: () => void }) {
  const { t, dir } = useI18n();
  return (
    <Glass r={30} clear style={styles.bar}>
      <Press onPress={back} accessibilityRole="button" accessibilityLabel={t('back')} style={styles.btn}>
        <Ionicons name="arrow-back" size={20} color={color.text} style={{ transform: [{ scaleX: dir === 'rtl' ? -1 : 1 }] }} />
      </Press>
      <Text font="display" weight="bold" numberOfLines={1} center style={styles.title}>{title}</Text>
      <View style={styles.btn} />
    </Glass>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8, minHeight: 60, backgroundColor: 'rgba(20,34,66,0.26)' },
  btn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#FFFFFF', fontSize: 20, lineHeight: 32 },
});
