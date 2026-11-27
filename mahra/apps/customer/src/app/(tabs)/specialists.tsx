import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { ExpertCard } from '@/components/ExpertCard';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { AGENTS, type AgentId } from '@/data/agents';
import { HIDDEN_CARDS, PRIORITY } from '@/data/home';
import { THEME } from '@/data/theme';
import { useI18n } from '@/i18n';
import { useAccent } from '@/lib/accent';
import { fontStyle } from '@/theme/fonts';
import { color, space } from '@/theme/tokens';

const GAP = space.md;
const ORDERED = PRIORITY.filter((id) => !HIDDEN_CARDS.includes(id)).map((id) => AGENTS.find((a) => a.id === id)!);

/**
 * وكلاء مهرة: عنوان وبحث ثم الخمسة عشر وكيلاً (بحسب أولوية الاحتياج).
 * اختيار بطاقة يلوّن الأرضية وطابع الزجاج بلون الوكيل؛ زر البطاقة يفتح المحادثة.
 */
export default function Specialists() {
  const { t, lang } = useI18n();
  const { setAccent } = useAccent();
  const [q, setQ] = useState('');
  const [w, setW] = useState(358);
  const [id, setId] = useState<AgentId | null>(null);
  const accent = id ? THEME[id].accent : null;
  const cols = w < 300 ? 1 : 2;
  const colW = (w - GAP * (cols - 1)) / cols;

  useFocusEffect(useCallback(() => {
    setAccent(accent);
    return () => setAccent(null);
  }, [accent, setAccent]));

  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return ORDERED;
    return ORDERED.filter((a) => [a.name.ar, a.name.en, a.role.ar, a.role.en].some((x) => x.toLowerCase().includes(k)));
  }, [q]);

  return (
    <Screen tabs>
      <Text font="display" weight="bold" center style={styles.title}>{t('specialistsTitle')}</Text>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={20} color={color.textDim} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('searchAgent')} placeholderTextColor={color.textDim} accessibilityLabel={t('searchAgent')} returnKeyType="search" style={[styles.input, fontStyle(lang, 'regular')]} />
        {q.length > 0 && <Ionicons name="close-circle" size={20} color={color.textDim} accessibilityLabel="×" onPress={() => setQ('')} />}
      </View>
      <View style={styles.grid} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        {list.map((a) => <ExpertCard key={a.id} id={a.id} width={colW} selected={a.id === id} onSelect={() => setId(a.id === id ? null : a.id)} />)}
      </View>
      {list.length === 0 && <Text tone="dim" center>{t('noAgents')}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { alignSelf: 'stretch', textAlign: 'center', color: '#FFFFFF', fontSize: 26, lineHeight: 42 },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)', borderTopColor: 'rgba(255,255,255,0.45)', backgroundColor: 'rgba(20,34,66,0.26)' },
  input: { flex: 1, minWidth: 0, minHeight: 48, color: color.text, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
