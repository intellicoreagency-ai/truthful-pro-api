import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from './Glass';
import { Text } from './Text';
import { useI18n, type StringKey } from '@/i18n';
import { useVoice } from '@/lib/voice';
import { color, radius, TOUCH } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

type ButtonProps = TabTriggerSlotProps & { icon: IconName; iconActive: IconName; label: string };

function TabButton({ icon, iconActive, label, isFocused, ...rest }: ButtonProps) {
  return (
    <Pressable
      {...(rest as unknown as PressableProps)}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}
      style={styles.tab}
    >
      <Ionicons name={isFocused ? iconActive : icon} size={24} color={isFocused ? color.gold : color.textDim} />
      <Text style={[styles.tabLabel, { color: isFocused ? color.gold : color.textDim }]}>{label}</Text>
    </Pressable>
  );
}

const TABS: { name: string; key: StringKey; icon: IconName; active: IconName }[] = [
  { name: 'home', key: 'tabHome', icon: 'home-outline', active: 'home' },
  { name: 'requests', key: 'tabRequests', icon: 'receipt-outline', active: 'receipt' },
  { name: 'specialists', key: 'tabSpecialists', icon: 'people-outline', active: 'people' },
  { name: 'profile', key: 'tabProfile', icon: 'person-outline', active: 'person' },
];

/**
 * شريط سفلي عائم. زر الميكروفون في الوسط أكبر عناصره ومتاح للإبهام من كل تبويب.
 * التبويبات تُعرَّف في _layout (TabList مخفي)، وهذا الشريط يستدعيها بالاسم.
 */
export function TabBar() {
  const { t } = useI18n();
  const { state, toggle } = useVoice();
  const insets = useSafeAreaInsets();
  const active = state !== 'idle';

  const onMic = () => {
    router.navigate('/');
    toggle();
  };

  const tab = (i: number) => {
    const x = TABS[i];
    return (
      <TabTrigger key={x.name} name={x.name} asChild>
        <TabButton icon={x.icon} iconActive={x.active} label={t(x.key)} />
      </TabTrigger>
    );
  };

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <Glass strong r={radius.xl} style={styles.bar}>
        {tab(0)}
        {tab(1)}
        <View style={styles.micSlot}>
          <Pressable
            onPress={onMic}
            accessibilityRole="button"
            accessibilityLabel={active ? t('stop') : t('talkToMohra')}
            accessibilityState={{ selected: active }}
            style={[styles.mic, active && { backgroundColor: color.aqua }]}
          >
            <Ionicons name={active ? 'stop' : 'mic'} size={28} color={color.ink} />
          </Pressable>
        </View>
        {tab(2)}
        {tab(3)}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 16, end: 16 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, minHeight: 68, backgroundColor: 'rgba(11,16,29,0.88)', borderTopColor: 'rgba(235,208,142,0.8)' },
  tab: { flex: 1, minHeight: TOUCH + 8, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontSize: 12, lineHeight: 16 },
  micSlot: { width: 76, alignItems: 'center' },
  mic: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginTop: -26,
    backgroundColor: color.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: color.ink,
  },
});
