import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Glass } from './Glass';
import { Text } from './Text';
import { useI18n, type StringKey } from '@/i18n';
import { color } from '@/theme/tokens';
import { Press } from '@/components/Press';

type Icon = ComponentProps<typeof Ionicons>['name'];
const ITEMS: { key: StringKey; icon: Icon; go: () => void }[] = [
  { key: 'stripCv', icon: 'briefcase-outline', go: () => router.push('/profile/cv') },
  { key: 'stripVoice', icon: 'pulse-outline', go: () => router.push('/settings/voice') },
  { key: 'stripAgents', icon: 'people-outline', go: () => router.navigate('/specialists') },
];

/** شريط الخدمات العلوي (كما في الموجّه): ثلاثة اختصارات في حبة زجاجية واحدة. */
export function QuickStrip() {
  const { t } = useI18n();
  return (
    <Glass r={32} strong style={styles.strip}>
      {ITEMS.map((i, n) => (
        <View key={i.key} style={{ flex: 1, flexDirection: 'row' }}>
          {n > 0 && <View style={styles.sep} />}
          <Press onPress={i.go} accessibilityRole="button" accessibilityLabel={t(i.key)} style={styles.item}>
            <Ionicons name={i.icon} size={22} color={color.gold} />
            <Text variant="caption" weight="medium" center numberOfLines={1}>{t(i.key)}</Text>
          </Press>
        </View>
      ))}
    </Glass>
  );
}
const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', minHeight: 70, paddingHorizontal: 6 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 56 },
  sep: { width: 1, alignSelf: 'center', height: 30, backgroundColor: color.hairline },
});
