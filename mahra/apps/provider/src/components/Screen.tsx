import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ambient } from './Ambient';
import { color, space } from '@/theme/tokens';

type Props = { children: ReactNode; tabs?: boolean; header?: ReactNode; contentStyle?: ViewStyle };

/** هيكل الشاشة: شريط علوي اختياري داكن، ثم محتوى فاتح. الحشوة الجانبية 16 دائماً. */
export function Screen({ children, tabs, header, contentStyle }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <Ambient />
      <ScrollView
        contentContainerStyle={{ paddingBottom: (tabs ? 110 : 28) + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={header ? [0] : undefined}
      >
        {header ? <View style={{ paddingTop: insets.top, backgroundColor: color.ink }}>{header}</View> : <View />}
        <View style={[{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.lg }, contentStyle]}>{children}</View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: color.canvas } });
