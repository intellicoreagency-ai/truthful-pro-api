import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Animated, Image, Platform, StyleSheet, View, useWindowDimensions, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Press } from './Press';
import { Text } from './Text';
import { useI18n, type StringKey } from '@/i18n';
import { useReducedMotion, useVoice } from '@/lib/voice';
import { color } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];
type ButtonProps = TabTriggerSlotProps & { icon: IconName; iconActive: IconName; label: string; compact: boolean };

const WORDMARK = require('../../assets/ui/mohra-wordmark.png');
/** الميكروفون الذهبي (صورة المالك بعد إزالة الخلفية) */
const MIC = require('../../assets/ui/mohra-mic-gold.png');
const ND = Platform.OS !== 'web';
/** ارتفاع الزر المرتفع فوق الكبسولة (كما في Truthful) */
const FAB_RISE = 34;
const GOLD = ['#F3DDA0', '#D9BC7E', '#B8924A'] as const;

/** تبويب: المحدَّد تظهر خلف أيقونته حبّة ذهبية بنابض (كما في Truthful)، وتسميته Cairo. */
function TabButton({ icon, iconActive, label, isFocused, compact, ...rest }: ButtonProps) {
  const reduced = useReducedMotion();
  const [on] = useState(() => new Animated.Value(isFocused ? 1 : 0));
  const [last, setLast] = useState(!!isFocused);
  if (last !== !!isFocused) {
    setLast(!!isFocused);
    if (reduced) on.setValue(isFocused ? 1 : 0);
    else Animated.spring(on, { toValue: isFocused ? 1 : 0, damping: 15, stiffness: 240, mass: 0.6, useNativeDriver: ND }).start();
  }
  return (
    <Press {...(rest as unknown as PressableProps)} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: !!isFocused }} style={styles.item}>
      <View style={styles.iconBox} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: on, transform: [{ scale: on.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
          <LinearGradient colors={['rgba(235,208,142,0.34)', 'rgba(217,188,126,0.14)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pill} />
        </Animated.View>
        <Ionicons name={isFocused ? iconActive : icon} size={23} color={isFocused ? color.goldBright : color.textDim} />
      </View>
      <Text font="tab" weight={isFocused ? 'bold' : 'semibold'} numberOfLines={1} style={[styles.label, compact && styles.labelCompact, { color: isFocused ? color.goldBright : color.textDim }]}>{label}</Text>
    </Press>
  );
}

/**
 * زر مهرة في المنتصف (مثل «+» في Truthful): دائرة مرتفعة بحلقة ذهبية وميكروفون. الضغط يفتح الرئيسية ويبدأ الاستماع
 * فوراً (أو يوقفه)، ويظهر في كل صفحات التبويبات. تحته اسم «مهرة» بالخط الخطي.
 */
function CenterButton({ label }: { label: string }) {
  const { state, toggle } = useVoice();
  const path = usePathname();
  const on = state !== 'idle';
  const press = () => {
    if (path !== '/') router.navigate('/');
    toggle();
  };
  return (
    <View style={[styles.item, styles.fabItem]}>
      <Press onPress={press} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} style={styles.fabHit}>
        <View pointerEvents="none" style={styles.fabShadow}>
          <LinearGradient colors={on ? ['#BAE6FD', '#38BDF8', '#0EA5E9'] : GOLD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabRing}>
            <LinearGradient colors={['#1B3A9A', '#0A1638']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
              <Image source={MIC} style={styles.mic} resizeMode="contain" />
            </LinearGradient>
          </LinearGradient>
        </View>
      </Press>
      <Image source={WORDMARK} style={[styles.word, { opacity: path === '/' || on ? 1 : 0.8 }]} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
    </View>
  );
}

/** الترتيب: الوكلاء، طلباتي، مهرة (في المنتصف)، معاملاتي، حسابي. */
const TABS: { name: string; key: StringKey; icon: IconName; active: IconName }[] = [
  { name: 'specialists', key: 'tabSpecialists', icon: 'people-outline', active: 'people' },
  { name: 'requests', key: 'tabRequests', icon: 'receipt-outline', active: 'receipt' },
  { name: 'home', key: 'tabHome', icon: 'headset-outline', active: 'headset' },
  { name: 'history', key: 'tabHistory', icon: 'time-outline', active: 'time' },
  { name: 'profile', key: 'tabProfile', icon: 'person-outline', active: 'person' },
];

/** كبسولة زجاجية عائمة بحدّ ذهبي متدرج وتمويه (بنية شريط Truthful)، والزر الأوسط يرتفع فوقها. */
export function TabBar() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const compact = useWindowDimensions().width < 380;
  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={styles.shadow}>
        <View style={styles.border}>
          <View style={styles.capsule}>
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.material]}>
              <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,26,52,0.34)' }]} />
            </View>
            <View style={styles.row} accessibilityRole="tablist">
              {TABS.map((x) => x.name === 'home' ? <CenterButton key="home" label={t(x.key)} /> : (
                <TabTrigger key={x.name} name={x.name} asChild>
                  <TabButton icon={x.icon} iconActive={x.active} label={t(x.key)} compact={compact} />
                </TabTrigger>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  shadow: { borderRadius: 34, width: '100%', maxWidth: 560, alignSelf: 'center', ...(Platform.select({ web: { boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 12 } }) as object) },
  border: { borderRadius: 34, borderWidth: 1, borderColor: 'rgba(235,208,142,0.5)', borderTopColor: 'rgba(243,221,160,0.8)' },
  capsule: { borderRadius: 33, overflow: 'visible' },
  material: { borderRadius: 33, overflow: 'hidden' },
  row: { height: 67, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 2, borderRadius: 33 },
  item: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
  iconBox: { width: 52, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(235,208,142,0.45)' },
  label: { fontSize: 11, lineHeight: 18, textAlign: 'center', maxWidth: '100%' },
  labelCompact: { fontSize: 10 },
  fabItem: { flex: 1.25 },
  fabHit: { marginTop: -FAB_RISE, borderRadius: 34 },
  fabShadow: { borderRadius: 33, ...(Platform.select({ web: { boxShadow: '0 8px 18px rgba(39,72,184,0.5)' }, default: { shadowColor: '#2748B8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 10 } }) as object) },
  fabRing: { width: 66, height: 66, borderRadius: 33, padding: 3 },
  mic: { width: 27, height: 50 },
  fab: { flex: 1, borderRadius: 30, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  word: { width: 44, height: 18, marginTop: 2 },
});
