import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { Pearl } from '@/components/Pearl';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { LANGS, useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space, TOUCH } from '@/theme/tokens';
import { FadeIn } from '@/components/FadeIn';
import { Press } from '@/components/Press';

const digits = (s: string) => s.replace(/\D/g, '');
const validPhone = (s: string) => digits(s).length === 9;

/** شعار Google الرسمي بألوانه الأربعة (مطلوب في أزرار الدخول بجوجل). */
function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </Svg>
  );
}

/**
 * الدخول بالهاتف مع تأكيد واتساب (قرار المالك). Google وFace ID بديلان:
 * Google يحتاج إعداد حساب Google للتطبيق، وFace ID يعمل بعد أول دخول. Apple ينتظر حساب Apple Developer.
 */
export default function Login() {
  const { t, lang, setLang } = useI18n();
  const { signIn } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [hasWa, setHasWa] = useState(false);
  const [wa, setWa] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ tone: 'bad' | 'info'; text: string } | null>(null);
  const input = [styles.input, fontStyle(lang, 'regular')];

  const sendCode = () => {
    if (!validPhone(phone)) return setMsg({ tone: 'bad', text: t('phoneInvalid') });
    if (!hasWa && !validPhone(wa)) return setMsg({ tone: 'bad', text: t('whatsappRequired') });
    setMsg(null);
    setStep('code');
  };
  const verify = () => {
    if (digits(code).length !== 4) return setMsg({ tone: 'bad', text: t('codeInvalid') });
    signIn(`+971${digits(phone)}`, hasWa ? `+971${digits(phone)}` : `+971${digits(wa)}`);
  };
  const faceId = async () => {
    if (Platform.OS === 'web') return setMsg({ tone: 'info', text: t('faceIdUnavailable') });
    const ok = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
    // لا نملك بعد جلسة محفوظة لنفتحها بالبصمة؛ تُفعَّل بعد أول دخول ناجح.
    setMsg({ tone: 'info', text: ok ? t('faceIdNeedsLogin') : t('faceIdUnavailable') });
  };

  return (
    <Screen tone="gold">
      <View style={styles.langRow}>
        {LANGS.map((l) => (
          <Press key={l.code} onPress={() => setLang(l.code)} accessibilityRole="button" accessibilityState={{ selected: lang === l.code }} style={[styles.chip, lang === l.code && { borderColor: color.gold }]}>
            <Text variant="caption" tone={lang === l.code ? 'gold' : 'dim'}>{l.label}</Text>
          </Press>
        ))}
      </View>

      <View style={styles.hero}>
        <Pearl size={190} state="idle" />
        <Text variant="display" center>{step === 'phone' ? t('loginTitle') : t('codeTitle')}</Text>
        <Text tone="dim" center>{step === 'phone' ? t('loginSub') : t('codeSub', { phone: `+971 ${digits(phone)}` })}</Text>
      </View>

      <Glass r={28} strong style={styles.card}>
        {step === 'phone' ? (
          <>
            <View style={{ gap: 6 }}>
              <Text variant="caption" tone="dim">{t('phoneLabel')}</Text>
              <View style={styles.phoneRow}>
                <Text weight="semibold">+971</Text>
                <TextInput value={phone} onChangeText={(v) => setPhone(digits(v).slice(0, 9))} placeholder={t('phonePlaceholder')} placeholderTextColor={color.textMuted} inputMode="numeric" autoComplete="tel" accessibilityLabel={t('phoneLabel')} style={[...input, { flex: 1, textAlign: 'left', writingDirection: 'ltr' }]} />
              </View>
            </View>
            <Press onPress={() => setHasWa((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: hasWa }} style={styles.check}>
              <Ionicons name={hasWa ? 'checkbox' : 'square-outline'} size={28} color={hasWa ? color.gold : color.textDim} />
              <Text style={{ flex: 1 }}>{t('hasWhatsapp')}</Text>
            </Press>
            {!hasWa && (
              <FadeIn style={{ gap: 6 }}>
                <Text variant="caption" tone="dim">{t('whatsappLabel')}</Text>
                <View style={styles.phoneRow}>
                  <Text weight="semibold">+971</Text>
                  <TextInput value={wa} onChangeText={(v) => setWa(digits(v).slice(0, 9))} placeholder={t('phonePlaceholder')} placeholderTextColor={color.textMuted} inputMode="numeric" autoComplete="tel" accessibilityLabel={t('whatsappLabel')} style={[...input, { flex: 1, textAlign: 'left', writingDirection: 'ltr' }]} />
                </View>
              </FadeIn>
            )}
            <Button kind="cta" label={t('sendCode')} onPress={sendCode} />
          </>
        ) : (
          <>
            <View style={{ gap: 6 }}>
              <Text variant="caption" tone="dim">{t('codeLabel')}</Text>
              <TextInput value={code} onChangeText={(v) => setCode(digits(v).slice(0, 4))} inputMode="numeric" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={4} accessibilityLabel={t('codeLabel')} style={[...input, { textAlign: 'center', letterSpacing: 14, fontSize: 28 }]} />
            </View>
            <Button kind="cta" label={t('verify')} onPress={verify} />
            <Button kind="ghost" label={t('changeNumber')} onPress={() => { setStep('phone'); setCode(''); setMsg(null); }} />
          </>
        )}

        {msg && <Text variant="caption" tone={msg.tone === 'bad' ? 'danger' : 'gold'} accessibilityLiveRegion="polite">{msg.text}</Text>}

        {step === 'phone' && (
          <>
            <View style={styles.divider}><View style={styles.line} /><Text variant="caption" tone="dim">{t('orDivider')}</Text><View style={styles.line} /></View>
            <View style={styles.alt}>
              <View style={{ flex: 1 }}>
                <Button kind="glass" label="Google" icon={<GoogleG />} onPress={() => setMsg({ tone: 'info', text: t('googleSoon') })} hint={t('google')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button kind="glass" label="Face ID" icon={<Ionicons name="scan-outline" size={22} color={color.text} />} onPress={faceId} hint={t('faceId')} />
              </View>
            </View>
          </>
        )}
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'flex-end' },
  chip: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: color.hairline },
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  card: { padding: space.xl, gap: space.lg },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, direction: 'ltr' },
  input: { minWidth: 0, minHeight: TOUCH + 8, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(6,10,18,0.55)', paddingHorizontal: space.lg, color: color.text, fontSize: 18 },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: 1, backgroundColor: color.hairline },
  alt: { flexDirection: 'row', gap: space.md },
});
