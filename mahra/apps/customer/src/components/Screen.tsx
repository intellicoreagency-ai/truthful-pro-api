import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from './Backdrop';
import { color, space } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  tone?: 'gold' | 'blue';
  /** مساحة سفلية لشريط التبويب العائم */
  tabs?: boolean;
  scroll?: boolean;
  contentStyle?: ViewStyle;
};

/** هيكل الشاشة: خلفية + منطقة آمنة + تمرير. الحشوة الجانبية 16 دائماً (لا تمرير أفقي). */
export function Screen({ children, tone = 'gold', tabs = false, scroll = true, contentStyle }: Props) {
  const insets = useSafeAreaInsets();
  const padBottom = (tabs ? 134 : 24) + insets.bottom;
  const body: ViewStyle = { paddingTop: insets.top + space.lg, paddingBottom: padBottom, paddingHorizontal: space.lg, gap: space.lg };

  return (
    <View style={styles.root}>
      <Backdrop tone={tone} />
      {scroll ? (
        <ScrollView contentContainerStyle={[body, contentStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, body, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: color.ink } });
