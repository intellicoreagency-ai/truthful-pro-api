import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from './Text';
import { color, radius, space } from '@/theme/tokens';

/**
 * بطاقة زجاجية نهارية (Spatial Glass): ضبابية فاتحة + لمعان + حافة علوية بيضاء أسطع + ظل بإزاحة.
 * إن مُرِّر لها backgroundColor (تنبيه ملوّن) تُترك الطبقة اللامعة كي يبقى اللون.
 */
export function Card({ style, children, ...rest }: ViewProps) {
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  const tinted = !!flat?.backgroundColor;
  const shadow = Platform.select<ViewStyle>({
    web: { boxShadow: '0 1px 2px rgba(11,21,48,0.05), 0 14px 34px rgba(31,50,110,0.12)' } as ViewStyle,
    default: { shadowColor: '#1F326E', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  })!;
  return (
    <View {...rest} style={[{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(17,26,51,0.07)', borderTopWidth: 1.5, borderTopColor: '#FFFFFF', padding: space.lg }, shadow, style]}>
      {!tinted && <BlurView intensity={28} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} />}
      {!tinted && <LinearGradient colors={['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.6)']} style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} pointerEvents="none" />}
      {children}
    </View>
  );
}

type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'mute';
const BG: Record<Tone, string> = { ok: color.okBg, bad: color.badBg, warn: color.warnBg, info: color.infoBg, mute: '#ECEFF5' };
const FG: Record<Tone, string> = { ok: color.ok, bad: color.bad, warn: color.warn, info: color.info, mute: color.dim };

export function Badge({ tone, children, icon }: { tone: Tone; children: ReactNode; icon?: ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={[styles.badge, { backgroundColor: BG[tone] }]}>
      {icon && <Ionicons name={icon} size={14} color={FG[tone]} />}
      <Text variant="caption" weight="medium" style={{ color: FG[tone] }}>{children}</Text>
    </View>
  );
}

export function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'ok' | 'gold' | 'normal' }) {
  return (
    <View style={styles.kv}>
      <Text tone="dim" style={{ flex: 1 }}>{label}</Text>
      <Text variant={strong ? 'heading' : 'body'} weight={strong ? 'bold' : 'medium'} tone={tone === 'ok' ? 'ok' : tone === 'gold' ? 'gold' : 'normal'}>{value}</Text>
    </View>
  );
}

/** حلقة تقدم (اكتمال الملف) */
export function Ring({ pct, size = 84, label }: { pct: number; size?: number; label: string }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={`${label} ${pct}%`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color.lineSoft} strokeWidth={9} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={pct === 100 ? color.ok : color.gold} strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text variant="heading" weight="bold">{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 26, paddingHorizontal: 10, borderRadius: radius.pill, alignSelf: 'flex-start' },
  kv: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8 },
});
