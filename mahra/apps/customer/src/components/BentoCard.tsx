import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Glass } from './Glass';
import { Press } from './Press';
import { Text } from './Text';
import { glow, space, type Tone } from '@/theme/tokens';

type Icon = ComponentProps<typeof Ionicons>['name'];

/** بطاقة وكيل بتوهج حافة ملوّن (2×2 في الاستوديو): أيقونة، اسم الوكيل، سطر وصف. */
export function BentoCard({ tone, icon, title, sub, onPress }: { tone: Tone; icon: Icon; title: string; sub: string; onPress: () => void }) {
  const g = glow[tone];
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} style={styles.cell}>
      <Glass r={26} tone={tone} style={styles.card}>
        <View style={[styles.badge, { backgroundColor: g.tint, borderColor: g.rim }]}>
          <Ionicons name={icon} size={24} color={g.ink} />
        </View>
        <Text font="display" weight="semibold" style={{ color: '#FFFFFF' }}>{title}</Text>
        <Text variant="caption" tone="dim">{sub}</Text>
      </Glass>
    </Press>
  );
}

const styles = StyleSheet.create({
  cell: { width: '48%' },
  card: { padding: space.lg, gap: space.sm, minHeight: 148 },
  badge: { width: 46, height: 46, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
