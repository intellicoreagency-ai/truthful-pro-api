import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Glass } from '@/components/Glass';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useTx } from '@/i18n';
import { color, glow, space, type Tone } from '@/theme/tokens';

type Icon = ComponentProps<typeof Ionicons>['name'];
type Card = { id: string; tone: Tone; icon: Icon; title: [string, string]; line: [string, string]; pill: [string, string]; go: () => void };

const chat = (agentId: string) => () => router.push({ pathname: '/chat/[agentId]', params: { agentId } });

/**
 * طلباتي وخدماتي (مواصفات Spatial Glass): كبسولة Dynamic Island، عنوان بجرس، قسم «النشطة والمتابعة»
 * وقسم «مكتملة وسجل المعاملات»؛ لكل بطاقة لون وكيلها وزر كبسولة بتدرجه.
 * الطلب الأول (سطحة) هو مسار المقارنة الحقيقي بين العروض.
 */
export default function Requests() {
  const tx = useTx();
  const active: Card[] = [
    { id: 'tow', tone: 'amber', icon: 'car-sport-outline', title: ['سطحة لسيارتي', 'Tow truck for my car'], line: ['الشيخ زايد • 3 عروض بأسعار نهائية. جلال', 'Sheikh Zayed • 3 final-price offers. Jalal'], pill: ['قارن العروض', 'Compare offers'], go: () => router.push({ pathname: '/request/[id]', params: { id: 'r1' } }) },
    { id: 'cv', tone: 'emerald', icon: 'briefcase-outline', title: ['السيرة الذاتية والتقديمات الذكية', 'CV and smart applications'], line: ['تحديث الملف المهني والتقديم أونلاين وإنديد. وكيلة التوظيف ميرا', 'Update your profile and apply online and on Indeed. Recruiter Meera'], pill: ['تواصل الآن', 'Contact now'], go: chat('meera') },
    { id: 'inspect', tone: 'amber', icon: 'business-outline', title: ['معاينة المقاولة والكوتيشن والمواعيد', 'Contracting inspection, quotes and slots'], line: ['معاينة ميدانية، اعتماد عرض السعر، والمواعيد. المهندس خالد', 'Site inspection, quote approval and slots. Eng. Khaled'], pill: ['تحديث / موافقة الآن', 'Update / approve now'], go: chat('khaled') },
  ];
  const done: Card[] = [
    { id: 'clean', tone: 'rose', icon: 'sparkles-outline', title: ['تنظيف ودراي كلين الغرف والمكاتب', 'Room and office cleaning, dry cleaning'], line: ['ترتيب، تنظيف، وخدمة دراي كلين. سارة', 'Tidying, cleaning and dry cleaning. Sara'], pill: ['تكرار الطلب', 'Repeat order'], go: chat('sara') },
    { id: 'hist', tone: 'sapphire', icon: 'folder-open-outline', title: ['سجل المحادثات والملفات', 'Chats and files history'], line: ['آخر 5 محادثات و3 ملفات. جلال، فيصل، ميرا', 'Last 5 chats and 3 files. Jalal, Faisal, Meera'], pill: ['فتح السجل', 'Open history'], go: chat('mansour') },
  ];

  const render = (c: Card) => {
    const g = glow[c.tone];
    return (
      <Glass key={c.id} r={26} tone={c.tone} style={styles.card}>
        <View style={styles.head}>
          <View style={[styles.badge, { backgroundColor: g.tint, borderColor: g.rim }]}><Ionicons name={c.icon} size={22} color={g.ink} /></View>
          <Text weight="bold" style={{ flex: 1, color: '#FFFFFF' }}>{tx(c.title[0], c.title[1])}</Text>
        </View>
        <Text variant="caption" tone="dim">{tx(c.line[0], c.line[1])}</Text>
        <Pill tone={c.tone} label={tx(c.pill[0], c.pill[1])} onPress={c.go} />
      </Glass>
    );
  };

  return (
    <Screen tabs>
      <View style={styles.title}>
        <Ionicons name="notifications-outline" size={24} color={color.goldBright} />
        <Text variant="title" weight="bold" style={{ flex: 1 }} center>{tx('طلباتي وخدماتي', 'My requests and services')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text variant="heading" weight="bold">{tx('النشطة والمتابعة', 'Active and follow-ups')}</Text>
      {active.map(render)}

      <Text variant="heading" weight="bold">{tx('مكتملة وسجل المعاملات', 'Completed and history')}</Text>
      {done.map(render)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  card: { padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
