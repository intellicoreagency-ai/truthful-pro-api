import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { AgentCard } from '@/components/AgentCard';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { AGENTS } from '@/data/agents';
import { useI18n } from '@/i18n';
import { fontStyle } from '@/theme/fonts';
import { color, space } from '@/theme/tokens';

const GAP = space.md;
/** الأربعة الرئيسيون كما في التصميم أولاً، ثم بقية الوكلاء بترتيب السجل */
const FIRST = ['meera', 'mansour', 'sara', 'jalal'];
const ORDERED = [...FIRST.map((id) => AGENTS.find((a) => a.id === id)!), ...AGENTS.filter((a) => !FIRST.includes(a.id))];

/** وكلاء مهرة: بحث حي بالاسم والاختصاص، وشبكة عمودين يُحسب عرضهما من الحاوية (عمود واحد على الشاشات الضيقة). */
export default function Specialists() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const [w, setW] = useState(358);
  const cols = w < 300 ? 1 : 2;
  const colW = (w - GAP * (cols - 1)) / cols;

  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return ORDERED;
    return ORDERED.filter((a) => [a.name.ar, a.name.en, a.role.ar, a.role.en].some((x) => x.toLowerCase().includes(k)));
  }, [q]);

  return (
    <Screen tabs>
      <Text variant="display" center style={{ fontSize: 26, lineHeight: 42 }}>{t('specialistsTitle')}</Text>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={20} color={color.textDim} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('searchAgent')} placeholderTextColor={color.textDim} accessibilityLabel={t('searchAgent')} returnKeyType="search" style={[styles.input, fontStyle(lang, 'regular')]} />
        {q.length > 0 && <Ionicons name="close-circle" size={20} color={color.textDim} accessibilityLabel="×" onPress={() => setQ('')} />}
      </View>
      <View style={styles.grid} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        {list.map((a) => <AgentCard key={a.id} agent={a} width={colW} />)}
      </View>
      {list.length === 0 && <Text tone="dim" center>{t('noAgents')}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)', borderTopColor: 'rgba(255,255,255,0.45)', backgroundColor: 'rgba(8,13,28,0.34)' },
  input: { flex: 1, minWidth: 0, minHeight: 48, color: color.text, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
