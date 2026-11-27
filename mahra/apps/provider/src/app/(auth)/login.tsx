import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Orb } from '@/components/Orb';
import { Text } from '@/components/Text';
import { Card } from '@/components/ui';
import { LANGS, useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { fontFor } from '@/theme/fonts';
import { color, radius, space, TOUCH } from '@/theme/tokens';

const digits = (s: string) => s.replace(/\D/g, '');
const valid = (s: string) => digits(s).length === 9;

export default function Login() {
  const { t, lang, setLang } = useI18n();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [hasWa, setHasWa] = useState(false);
  const [wa, setWa] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const input = [styles.input, { fontFamily: fontFor(lang, 'regular') }];

  const sendCode = () => {
    if (!valid(phone)) return setError(t('phoneInvalid'));
    if (!hasWa && !valid(wa)) return setError(t('whatsappRequired'));
    setError(null); setStep('code');
  };
  const verify = () => {
    if (digits(code).length !== 4) return setError(t('codeInvalid'));
    signIn(`+971${digits(phone)}`, hasWa ? `+971${digits(phone)}` : `+971${digits(wa)}`);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.hero, { paddingTop: insets.top + space.lg }]}>
        <View style={styles.langRow}>
          {LANGS.map((l) => (
            <Pressable key={l.code} onPress={() => setLang(l.code)} accessibilityRole="button" accessibilityState={{ selected: lang === l.code }} style={[styles.chip, lang === l.code && { borderColor: color.gold }]}>
              <Text variant="caption" tone={lang === l.code ? 'gold' : 'onInkDim'} style={lang === l.code ? { color: color.gold } : undefined}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
        <Orb on size={96} />
        <Text variant="display" tone="onInk" center>{step === 'phone' ? t('loginTitle') : t('codeTitle')}</Text>
        <Text tone="onInkDim" center>{step === 'phone' ? t('loginSub') : t('codeSub', { phone: `+971 ${digits(phone)}` })}</Text>
      </View>

      <View style={styles.sheet}>
        <Card style={{ gap: space.lg, padding: space.xl }}>
          {step === 'phone' ? (
            <>
              <View style={{ gap: 6 }}>
                <Text variant="caption" tone="dim">{t('phoneLabel')}</Text>
                <View style={styles.phoneRow}>
                  <Text weight="semibold">+971</Text>
                  <TextInput value={phone} onChangeText={(v) => setPhone(digits(v).slice(0, 9))} inputMode="numeric" autoComplete="tel" placeholder="50 123 4567" placeholderTextColor="#8892AB" accessibilityLabel={t('phoneLabel')} style={[...input, { flex: 1, textAlign: 'left', writingDirection: 'ltr' }]} />
                </View>
              </View>
              <Pressable onPress={() => setHasWa((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: hasWa }} style={styles.check}>
                <Ionicons name={hasWa ? 'checkbox' : 'square-outline'} size={28} color={hasWa ? color.ok : color.dim} />
                <Text style={{ flex: 1 }}>{t('hasWhatsapp')}</Text>
              </Pressable>
              {!hasWa && (
                <View style={{ gap: 6 }}>
                  <Text variant="caption" tone="dim">{t('whatsappLabel')}</Text>
                  <View style={styles.phoneRow}>
                    <Text weight="semibold">+971</Text>
                    <TextInput value={wa} onChangeText={(v) => setWa(digits(v).slice(0, 9))} inputMode="numeric" placeholder="50 123 4567" placeholderTextColor="#8892AB" accessibilityLabel={t('whatsappLabel')} style={[...input, { flex: 1, textAlign: 'left', writingDirection: 'ltr' }]} />
                  </View>
                </View>
              )}
              {error && <Text variant="caption" tone="bad" accessibilityLiveRegion="polite">{error}</Text>}
              <Button label={t('sendCode')} onPress={sendCode} />
            </>
          ) : (
            <>
              <View style={{ gap: 6 }}>
                <Text variant="caption" tone="dim">{t('codeLabel')}</Text>
                <TextInput value={code} onChangeText={(v) => setCode(digits(v).slice(0, 4))} inputMode="numeric" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={4} accessibilityLabel={t('codeLabel')} style={[...input, { textAlign: 'center', letterSpacing: 14, fontSize: 28 }]} />
              </View>
              {error && <Text variant="caption" tone="bad" accessibilityLiveRegion="polite">{error}</Text>}
              <Button label={t('verify')} onPress={verify} />
              <Button kind="ghost" label={t('changeNumber')} onPress={() => { setStep('phone'); setCode(''); setError(null); }} />
            </>
          )}
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },
  hero: { backgroundColor: color.ink, alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: 56, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  langRow: { flexDirection: 'row', gap: space.sm, alignSelf: 'flex-end' },
  chip: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: '#38456B' },
  sheet: { paddingHorizontal: space.lg, marginTop: -36 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, direction: 'ltr' },
  input: { minWidth: 0, minHeight: TOUCH, borderRadius: radius.md, borderWidth: 1.5, borderColor: '#B9C2D6', backgroundColor: '#fff', paddingHorizontal: space.lg, color: color.text, fontSize: 18 },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
});
