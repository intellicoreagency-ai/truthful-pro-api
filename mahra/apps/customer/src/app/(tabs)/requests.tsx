import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Glass } from '@/components/Glass';
import { Press } from '@/components/Press';
import { RequestCard, chatWith, type RequestItem } from '@/components/RequestCard';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useI18n, useTx } from '@/i18n';
import { color, space } from '@/theme/tokens';

/**
 * طلباتي وخدماتي: قسم «النشطة والمتابعة» فقط، وبعده مدخل «سجل المعاملات» الذي يفتح صفحة خاصة به.
 * الطلب الأول (سطحة) هو مسار المقارنة الحقيقي بين العروض.
 */
export default function Requests() {
  const tx = useTx();
  const { dir } = useI18n();
  const active: RequestItem[] = [
    { id: 'tow', agent: 'jalal', title: ['سطحة لسيارتي', 'Tow truck for my car'], line: ['الشيخ زايد • 3 عروض بأسعار نهائية. جلال', 'Sheikh Zayed • 3 final-price offers. Jalal'], pill: ['قارن العروض', 'Compare offers'], go: () => router.push({ pathname: '/request/[id]', params: { id: 'r1' } }) },
    { id: 'cv', agent: 'meera', title: ['السيرة الذاتية والتقديمات الذكية', 'CV and smart applications'], line: ['تحديث الملف المهني والتقديم أونلاين وإنديد. وكيلة التوظيف ميرا', 'Update your profile and apply online and on Indeed. Recruiter Meera'], pill: ['تواصل الآن', 'Contact now'], go: chatWith('meera') },
    { id: 'inspect', agent: 'khaled', title: ['معاينة المقاولة والكوتيشن والمواعيد', 'Contracting inspection, quotes and slots'], line: ['معاينة ميدانية، اعتماد عرض السعر، والمواعيد. المهندس خالد', 'Site inspection, quote approval and slots. Eng. Khaled'], pill: ['تحديث / موافقة الآن', 'Update / approve now'], go: chatWith('khaled') },
  ];

  return (
    <Screen tabs>
      <View style={styles.title}>
        <Ionicons name="notifications-outline" size={24} color={color.goldBright} />
        <Text variant="title" weight="bold" style={{ flex: 1 }} center>{tx('طلباتي وخدماتي', 'My requests and services')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text variant="heading" weight="bold">{tx('النشطة والمتابعة', 'Active and follow-ups')}</Text>
      {active.map((c) => <RequestCard key={c.id} c={c} />)}

      <Press onPress={() => router.push('/history')} accessibilityRole="button" accessibilityLabel={tx('سجل المعاملات', 'Transaction history')}>
        <Glass card style={styles.history}>
          <Ionicons name="time-outline" size={24} color={color.goldBright} />
          <Text weight="bold" style={{ flex: 1, color: '#FFFFFF' }}>{tx('سجل المعاملات', 'Transaction history')}</Text>
          <Ionicons name={dir === 'rtl' ? 'chevron-back' : 'chevron-forward'} size={22} color={color.textDim} />
        </Glass>
      </Press>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  history: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, minHeight: 72 },
});
