import { Ionicons } from '@expo/vector-icons';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useI18n, type StringKey } from '@/i18n';
import { useStore } from '@/lib/store';
import { color, TOUCH } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];
type BtnProps = TabTriggerSlotProps & { icon: IconName; iconOn: IconName; label: string; badge?: number };

function TabButton({ icon, iconOn, label, badge, isFocused, ...rest }: BtnProps) {
  const on = !!isFocused;
  return (
    <Pressable {...(rest as unknown as PressableProps)} accessibilityRole="tab" accessibilityLabel={badge ? `${label} (${badge})` : label} accessibilityState={{ selected: on }} style={styles.tab}>
      <View>
        <Ionicons name={on ? iconOn : icon} size={26} color={on ? color.ink : color.dim} />
        {!!badge && (
          <View style={styles.badge}>
            <Text variant="caption" weight="bold" style={{ color: '#fff', fontSize: 11, lineHeight: 14 }}>{badge}</Text>
          </View>
        )}
      </View>
      <Text variant="caption" weight={on ? 'semibold' : 'regular'} style={{ color: on ? color.ink : color.dim, fontSize: 12 }}>{label}</Text>
      {on && <View style={styles.bar} />}
    </Pressable>
  );
}

const TABS: { name: string; key: StringKey; icon: IconName; on: IconName }[] = [
  { name: 'opportunities', key: 'tabOpportunities', icon: 'flash-outline', on: 'flash' },
  { name: 'jobs', key: 'tabJobs', icon: 'briefcase-outline', on: 'briefcase' },
  { name: 'wallet', key: 'tabWallet', icon: 'wallet-outline', on: 'wallet' },
  { name: 'profile', key: 'tabProfile', icon: 'person-circle-outline', on: 'person-circle' },
];

/** شريط سفلي بأيقونات كبيرة ونص ظاهر. شارة الفرص = طلبات تنتظر، وشارة العمولات = مستحقات. */
export function TabBar() {
  const { t } = useI18n();
  const { incoming, commissions, available, status } = useStore();
  const insets = useSafeAreaInsets();
  const badges: Record<string, number> = {
    opportunities: available && status === 'approved' ? incoming.length : 0,
    wallet: commissions.filter((c) => c.status === 'due' || c.status === 'overdue').length,
  };
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((x) => (
        <TabTrigger key={x.name} name={x.name} asChild>
          <TabButton icon={x.icon} iconOn={x.on} label={t(x.key)} badge={badges[x.name]} />
        </TabTrigger>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 0, end: 0, bottom: 0, flexDirection: 'row', backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.line, paddingTop: 6 },
  tab: { flex: 1, minHeight: TOUCH + 12, alignItems: 'center', justifyContent: 'center', gap: 2 },
  bar: { position: 'absolute', top: -6, width: 28, height: 3, borderRadius: 2, backgroundColor: color.gold },
  badge: { position: 'absolute', top: -6, end: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: color.bad, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
