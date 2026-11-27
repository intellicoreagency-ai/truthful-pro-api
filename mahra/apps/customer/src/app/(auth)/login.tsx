import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { Pearl } from '@/components/Pearl';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { LANGS, useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { fontFor } from '@/theme/fonts';
import { color, radius, space, TOUCH } from '@/theme/tokens';

const digits = (s: string) => s.replace(/\D/g, '');
const validPhone = (s: string) => digits(s).length === 9;

/**
 * الدخول برقم الهاتف. مربع «هذا الرقم عليه واتساب» إجباري؛
 * إن لم يكن، يُطلب رقم واتساب آخر. الرمز هنا نموذجي (أي 4 أرقام تُقبل).
 */
export default function Login() {
  const { t, lang, setLang } = useI18n();
  const { signIn } = useAuth();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [hasWa, setHasWa] = useState(false);
  const [wa, setWa] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const inputStyle = [styles.input, { fontFamily: fontFor(lang, 'regular') }];

  const sendCode = () => {
    if (!validPhone(phone)) return setError(t('phoneInvalid'));
    if (!hasWa && !validPhone(wa)) return setError(t('whatsappRequired'));
    setError(null);
    setStep('code');
  };

  const verify = () => {
    if (digits(code).length !== 4) return setError(t('codeInvalid'));
    setError(null);
    signIn(`+971${digits(phone)}`, hasWa ? `+971${digits(phone)}` : `+971${digits(wa)}`);
  };

  return (
    <Screen>
      <View style={styles.langRow}>
        {LANGS.map((l) => (
          <Pressable
            key={l.code}
            onPress={() => setLang(l.code)}
            accessibilityRole="button"
            accessibilityState={{ selected: lang === l.code }}
            style={[styles.langChip, lang === l.code && { borderColor: color.gold }]}
          >
            <Text variant="caption" tone={lang === l.code ? 'gold' : 'dim'}>
              {l.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.hero}>
        <Pearl size={132} state="idle" />
        <Text variant="display" center>
          {step === 'phone' ? t('loginTitle') : t('codeTitle')}
        </Text>
        <Text tone="dim" center>
          {step === 'phone' ? t('loginSub') : t('codeSub', { phone: `+971 ${digits(phone)}` })}
        </Text>
      </View>

      <Glass style={styles.card}>
        {step === 'phone' ? (
          <>
            <View style={{ gap: space.sm }}>
              <Text variant="caption" tone="dim">
                {t('phoneLabel')}
              </Text>
              <View style={styles.phoneRow}>
                <Text weight="semibold" style={styles.prefix}>
                  +971
                </Text>
                <TextInput
                  value={phone}
                  onChangeText={(v) => setPhone(digits(v).slice(0, 9))}
                  placeholder={t('phonePlaceholder')}
                  placeholderTextColor={color.textMuted}
                  inputMode="numeric"
                  autoComplete="tel"
                  accessibilityLabel={t('phoneLabel')}
                  style={[inputStyle, { flex: 1, textAlign: 'left', writingDirection: 'ltr' }]}
                />
              </View>
            </View>

            <Pressable
              onPress={() => setHasWa((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: hasWa }}
              style={styles.checkRow}
            >
              <Ionicons name={hasWa ? 'checkbox' : 'square-outline'} size={28} color={hasWa ? color.gold : color.textDim} />
              <Text style={{ flex: 1 }}>{t('hasWhatsapp')}</Text>
            </Pressable>

            {!hasWa && (
              <View style={{ gap: space.sm }}>
                <Text variant="caption" tone="dim">
                  {t('whatsappLabel')}
                </Text>
                <View style={styles.phoneRow}>
                  <Text weight="semibold" style={styles.prefix}>
                    +971
                  </Text>
                  <TextInput
                    value={wa}
                    onChangeText={(v) => setWa(digits(v).slice(0, 9))}
                    placeholder={t('phonePlaceholder')}
                    placeholderTextColor={color.textMuted}
                    inputMode="numeric"
                    accessibilityLabel={t('whatsappLabel')}
                    style={[inputStyle, { flex: 1, textAlign: 'left', writingDirection: 'ltr' }]}
                  />
                </View>
              </View>
            )}

            {error && (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {error}
              </Text>
            )}
            <Button label={t('sendCode')} onPress={sendCode} />
          </>
        ) : (
          <>
            <View style={{ gap: space.sm }}>
              <Text variant="caption" tone="dim">
                {t('codeLabel')}
              </Text>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(digits(v).slice(0, 4))}
                inputMode="numeric"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={4}
                accessibilityLabel={t('codeLabel')}
                style={[inputStyle, styles.code]}
              />
            </View>
            {error && (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {error}
              </Text>
            )}
            <Button label={t('verify')} onPress={verify} />
            <Button
              kind="ghost"
              label={t('changeNumber')}
              onPress={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
            />
          </>
        )}
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  langRow: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
  langChip: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: color.hairline },
  hero: { alignItems: 'center', gap: space.md, paddingVertical: space.lg },
  card: { padding: space.xl, gap: space.lg },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, direction: 'ltr' },
  prefix: { minWidth: 56 },
  input: {
    minWidth: 0,
    minHeight: TOUCH + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: space.lg,
    color: color.text,
    fontSize: 18,
  },
  code: { textAlign: 'center', letterSpacing: 12, fontSize: 26 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
});
