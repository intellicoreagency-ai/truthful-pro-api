import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AgentTile } from '@/components/AgentTile';
import { Glass } from '@/components/Glass';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { agentById, type AgentId } from '@/data/agents';
import { useI18n, useTx } from '@/i18n';
import { color, space } from '@/theme/tokens';

type Card = {
  id: string;
  agent: AgentId;
  title: [string, string];
  line: [string, string];
  pill: [string, string];
  /** دفعات مرحلية: [المنجز، الإجمالي] */
  stages?: [number, number];
  go: () => void;
};

/**
 * طلباتي وخدماتي: بطاقة زجاجية لكل طلب بلون وكيله (Apple system colors).
 * الطلب الأول حقيقي المسار (مقارنة عروض)؛ الباقي نماذج للحالات: توظيف، معاينة ودفعات مرحلية، تنظيف، سجل.
 */
export default function Requests() {
  const { t } = useI18n();
  const tx = useTx();
  const chat = (id: AgentId) => () => router.push({ pathname: '/chat/[agentId]', params: { agentId: id } });
  const CARDS: Card[] = [
    { id: 'tow', agent: 'jalal', title: ['سطحة لسيارتي', 'Tow truck for my car'], line: ['الشيخ زايد · 3 عروض بأسعار نهائية', 'Sheikh Zayed · 3 final-price offers'], pill: ['عروض جاهزة', 'Offers ready'], go: () => router.push({ pathname: '/request/[id]', params: { id: 'r1' } }) },
    { id: 'cv', agent: 'meera', title: ['تقديم: مدير مبيعات', 'Application: Sales Manager'], line: ['قُدّم عبر إنديد باسمك · سيرتك محدّثة', 'Submitted on Indeed for you · CV up to date'], pill: ['قيد المراجعة', 'In review'], go: chat('meera') },
    { id: 'inspect', agent: 'khaled', title: ['معاينة موقع وعرض سعر مرحلي', 'Site inspection and staged quote'], line: ['الثلاثاء 4:00 عصراً · الدفعة الأولى عند البدء', 'Tuesday 4:00 pm · first payment on start'], pill: ['معاينة مجدولة', 'Inspection set'], stages: [1, 3], go: chat('khaled') },
    { id: 'clean', agent: 'sara', title: ['تنظيف المنزل والدراي كلين', 'Home cleaning and dry cleaning'], line: ['اكتمل الأسبوع الماضي · قيّم الخدمة', 'Done last week · rate the service'], pill: ['مكتمل', 'Done'], go: chat('sara') },
  ];

  return (
    <Screen tabs>
      <Text variant="display">{t('requestsTitle')}</Text>

      {CARDS.map((c) => {
        const a = agentById(c.agent)!;
        return (
          <Pressable key={c.id} onPress={c.go} accessibilityRole="button" accessibilityLabel={`${tx(c.title[0], c.title[1])}. ${tx(c.pill[0], c.pill[1])}`}>
            <Glass r={24} style={[styles.card, { borderColor: a.accent + '55' }]}>
              <View style={styles.head}>
                <AgentTile agent={a} size={48} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text weight="bold">{tx(c.title[0], c.title[1])}</Text>
                  <Text variant="caption" tone="dim">{tx(a.name.ar, a.name.en)} · {tx(a.role.ar, a.role.en)}</Text>
                </View>
              </View>
              <Text tone="dim">{tx(c.line[0], c.line[1])}</Text>
              {c.stages && (
                <View style={{ gap: 6 }}>
                  <View style={styles.bars}>
                    {Array.from({ length: c.stages[1] }).map((_, i) => (
                      <View key={i} style={[styles.bar, { backgroundColor: i < c.stages![0] ? a.accent : 'rgba(255,255,255,0.14)' }]} />
                    ))}
                  </View>
                  <Text variant="caption" tone="dim">{tx(`الدفعة ${c.stages[0]} من ${c.stages[1]}`, `Payment ${c.stages[0]} of ${c.stages[1]}`)}</Text>
                </View>
              )}
              <View style={[styles.pill, { backgroundColor: a.accent + '26', borderColor: a.accent + '66' }]}>
                <Text variant="caption" weight="semibold" style={{ color: a.accent }}>{tx(c.pill[0], c.pill[1])}</Text>
              </View>
            </Glass>
          </Pressable>
        );
      })}

      <Pressable onPress={() => router.push({ pathname: '/chat/[agentId]', params: { agentId: 'mansour' } })} accessibilityRole="button" accessibilityLabel={tx('سجل المحادثات والملفات', 'Chats and files history')}>
        <Glass r={24} style={[styles.card, { borderColor: color.blue + '55', flexDirection: 'row', alignItems: 'center', gap: space.md }]}>
          <View style={[styles.hist, { backgroundColor: color.blue + '29', borderColor: color.blue + '99' }]}><Ionicons name="folder-open-outline" size={24} color={color.blue} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="bold">{tx('سجل المحادثات والملفات', 'Chats and files')}</Text>
            <Text variant="caption" tone="dim">{tx('آخر محادثة مع منصور · 3 ملفات ومواقع', 'Last chat with Mansour · 3 files and places')}</Text>
          </View>
          <Ionicons name="chevron-back" size={20} color={color.textDim} />
        </Glass>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 3 },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  hist: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
