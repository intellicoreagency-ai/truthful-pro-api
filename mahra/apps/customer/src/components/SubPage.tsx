import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from './Screen';
import { Text } from './Text';
import { useI18n } from '@/i18n';
import { color, space, TOUCH } from '@/theme/tokens';
import { Press } from '@/components/Press';

/** هيكل صفحات فرعية: زر رجوع + عنوان + محتوى. */
export function SubPage({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const { t, dir } = useI18n();
  return (
    <Screen>
      <Press onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('back')} style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={color.text} style={{ transform: [{ scaleX: dir === 'rtl' ? -1 : 1 }] }} />
      </Press>
      <View style={{ gap: 4 }}>
        <Text variant="display">{title}</Text>
        {sub ? <Text tone="dim">{sub}</Text> : null}
      </View>
      <View style={{ gap: space.md }}>{children}</View>
    </Screen>
  );
}
const styles = StyleSheet.create({ back: { width: TOUCH, height: TOUCH, justifyContent: 'center' } });
