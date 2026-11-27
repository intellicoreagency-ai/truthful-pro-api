import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from './Text';
import { color, radius, space } from '@/theme/tokens';

export function Card({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[{ backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.line, padding: space.lg }, style]} />;
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
