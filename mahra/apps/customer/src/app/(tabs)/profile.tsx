import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { LANGS, useI18n, type StringKey } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { color, radius, space, TOUCH } from '@/theme/tokens';

const ROWS: { key: StringKey; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'myCars', icon: 'car-outline' },
  { key: 'myAddresses', icon: 'location-outline' },
  { key: 'privacy', icon: 'lock-closed-outline' },
  { key: 'help', icon: 'help-buoy-outline' },
];

export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const { phone, signOut } = useAuth();

  return (
    <Screen tabs>
      <View style={{ gap: space.xs }}>
        <Text variant="title">{t('profileTitle')}</Text>
        <Text tone="dim" style={{ writingDirection: 'ltr' }}>
          {phone}
        </Text>
      </View>

      <Glass style={{ padding: space.lg, gap: space.md }}>
        <Text weight="semibold">{t('language')}</Text>
        <View style={styles.langs}>
          {LANGS.map((l) => {
            const on = l.code === lang;
            return (
              <Pressable
                key={l.code}
                onPress={() => setLang(l.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.lang, on && { borderColor: color.gold, backgroundColor: 'rgba(217,182,107,0.12)' }]}
              >
                {on && <Ionicons name="checkmark" size={18} color={color.gold} />}
                <Text tone={on ? 'gold' : 'normal'}>{l.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Glass>

      <Glass style={{ paddingVertical: space.xs }}>
        {ROWS.map((r, i) => (
          <Pressable
            key={r.key}
            accessibilityRole="button"
            accessibilityHint={t('comingSoon')}
            style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: color.hairline }]}
          >
            <Ionicons name={r.icon} size={22} color={color.gold} />
            <Text style={{ flex: 1 }}>{t(r.key)}</Text>
            <Text variant="caption" tone="dim">
              {t('comingSoon')}
            </Text>
          </Pressable>
        ))}
      </Glass>

      <Glass style={{ padding: space.lg, flexDirection: 'row', gap: space.md, alignItems: 'center', borderColor: color.danger + '88' }}>
        <Ionicons name="warning-outline" size={22} color={color.danger} />
        <Text style={{ flex: 1 }}>{t('emergencyNote')}</Text>
      </Glass>

      <Button kind="secondary" label={t('signOut')} onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  langs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  lang: {
    minHeight: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  row: { minHeight: TOUCH + 8, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
});
