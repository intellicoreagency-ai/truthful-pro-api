import { Ionicons } from '@expo/vector-icons';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentProps } from 'react';
import { StyleSheet, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from './Glass';
import { Press } from './Press';
import { Text } from './Text';
import { useI18n, type StringKey } from '@/i18n';
import { color, radius } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];
type ButtonProps = TabTriggerSlotProps & { icon: IconName; iconActive: IconName; label: string };

function TabButton({ icon, iconActive, label, isFocused, ...rest }: ButtonProps) {
  return (
    <Press
      {...(rest as unknown as PressableProps)}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}
      style={[styles.tab, isFocused && styles.tabOn]}
    >
      <Ionicons name={isFocused ? iconActive : icon} size={24} color={isFocused ? color.goldBright : color.textDim} />
      <Text font="label" weight={isFocused ? 'semibold' : 'medium'} style={[styles.tabLabel, { color: isFocused ? color.goldBright : color.textDim }]} numberOfLines={1}>{label}</Text>
    </Press>
  );
}

/** الترتيب كما في المواصفات: الرئيسية، الوكلاء، طلباتي، حسابي. */
const TABS: { name: string; key: StringKey; icon: IconName; active: IconName }[] = [
  { name: 'home', key: 'tabHome', icon: 'home-outline', active: 'home' },
  { name: 'specialists', key: 'tabSpecialists', icon: 'people-outline', active: 'people' },
  { name: 'requests', key: 'tabRequests', icon: 'receipt-outline', active: 'receipt' },
  { name: 'profile', key: 'tabProfile', icon: 'person-outline', active: 'person' },
];

/** دوك زجاجي عائم: كبسولة بأربعة أزرار، والتبويب النشط في مربع زجاجي مضيء. */
export function TabBar() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <Glass strong r={radius.xl} style={styles.bar}>
        {TABS.map((x) => (
          <TabTrigger key={x.name} name={x.name} asChild>
            <TabButton icon={x.icon} iconActive={x.active} label={t(x.key)} />
          </TabTrigger>
        ))}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 20, end: 20 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 6, backgroundColor: 'rgba(9,13,26,0.72)' },
  tab: { flex: 1, minHeight: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderColor: 'transparent' },
  tabOn: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.30)' },
  tabLabel: { fontSize: 11, lineHeight: 15 },
});
