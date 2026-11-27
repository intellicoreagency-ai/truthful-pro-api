import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { FadeIn } from '@/components/FadeIn';
import { Glass } from '@/components/Glass';
import { Press } from '@/components/Press';
import { Text } from '@/components/Text';
import { LANGS, useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

const BG = require('../../../assets/ui/login-bg.jpg');
/** أبعاد صورة التصميم المرجعية؛ كل المواضع تُحسب بنسبة العرض فتطابق أي شاشة. */
const IMG_W = 768;
const IMG_H = 1376;
const CARD_TOP = 440;
const CARD_SIDE = 100;

const digits = (s: string) => s.replace(/\D/g, '');
const validPhone = (s: string) => digits(s).length === 9;

function GoogleG() {
  return (
    <Svg width={22} height={22} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </Svg>
  );
}

/**
 * شاشة الدخول بتصميم Gemini المعتمد: الخلفية والشعار والكرة من صورة التصميم نفسها (بعد إزالة نصوص البطاقة المرسومة)،
 * وفوقها بطاقة زجاجية حقيقية بالكود: هاتف + واتساب (قرار المالك)، زر الدخول الشمباني، وجه، Google وApple.
 */
export default function Login() {
  const { t, lang, setLang } = useI18n();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(390);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [hasWa, setHasWa] = useState(false);
  const [wa, setWa] = useState('');
  const [code, setCode] = useState('');
  const [langOpen, setLangOpen] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'bad' | 'info'; text: string } | null>(null);
  const font = fontStyle(lang, 'regular');
  const s = w / IMG_W;

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

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
    setMsg({ tone: 'info', text: ok ? t('faceIdNeedsLogin') : t('faceIdUnavailable') });
  };

  const field = (icon: 'call-outline' | 'logo-whatsapp' | 'keypad-outline', children: React.ReactNode) => (
    <View style={styles.field}>
      {children}
      <Ionicons name={icon} size={20} color={color.textDim} />
    </View>
  );

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Image source={BG} style={{ position: 'absolute', top: 0, start: 0, width: w, height: IMG_H * s }} resizeMode="stretch" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <LinearGradient colors={['rgba(6,9,19,0)', '#060913']} style={{ position: 'absolute', top: IMG_H * s - 120 * s, start: 0, end: 0, height: 160 }} pointerEvents="none" />

      <ScrollView contentContainerStyle={{ paddingTop: CARD_TOP * s, paddingBottom: 40 + insets.bottom, paddingHorizontal: CARD_SIDE * s * 0.62 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Glass r={26} strong style={styles.card}>
          <Text variant="title" weight="bold" center>{step === 'phone' ? t('loginTitle') : t('codeTitle')}</Text>
          <Text variant="caption" tone="dim" center>{step === 'phone' ? t('loginSub') : t('codeSub', { phone: `+971 ${digits(phone)}` })}</Text>

          {step === 'phone' ? (
            <>
              {field('call-outline', (
                <View style={styles.phoneRow}>
                  <Text weight="semibold" tone="dim">+971</Text>
                  <TextInput value={phone} onChangeText={(v) => setPhone(digits(v).slice(0, 9))} placeholder={t('phonePlaceholder')} placeholderTextColor={color.textMuted} inputMode="numeric" autoComplete="tel" accessibilityLabel={t('phoneLabel')} style={[styles.input, font]} />
                </View>
              ))}
              <Press onPress={() => setHasWa((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: hasWa }} style={styles.check}>
                <Ionicons name={hasWa ? 'checkbox' : 'square-outline'} size={24} color={hasWa ? color.goldBright : color.textDim} />
                <Text variant="caption" style={{ flex: 1 }}>{t('hasWhatsapp')}</Text>
              </Press>
              {!hasWa && (
                <FadeIn>
                  {field('logo-whatsapp', (
                    <View style={styles.phoneRow}>
                      <Text weight="semibold" tone="dim">+971</Text>
                      <TextInput value={wa} onChangeText={(v) => setWa(digits(v).slice(0, 9))} placeholder={t('phonePlaceholder')} placeholderTextColor={color.textMuted} inputMode="numeric" autoComplete="tel" accessibilityLabel={t('whatsappLabel')} style={[styles.input, font]} />
                    </View>
                  ))}
                </FadeIn>
              )}
            </>
          ) : (
            field('keypad-outline', (
              <TextInput value={code} onChangeText={(v) => setCode(digits(v).slice(0, 4))} inputMode="numeric" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={4} placeholder="••••" placeholderTextColor={color.textMuted} accessibilityLabel={t('codeLabel')} style={[styles.input, font, { textAlign: 'center', letterSpacing: 12, fontSize: 22 }]} />
            ))
          )}

          {msg && <Text variant="caption" tone={msg.tone === 'bad' ? 'danger' : 'gold'} accessibilityLiveRegion="polite">{msg.text}</Text>}

          <Press onPress={step === 'phone' ? sendCode : verify} accessibilityRole="button" accessibilityLabel={step === 'phone' ? t('sendCode') : t('verify')} style={styles.ctaWrap}>
            <LinearGradient colors={['#E9D6AE', '#F6F0E8', '#DDBE86']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.cta}>
              <Text variant="heading" weight="bold" style={{ color: '#070B14' }}>{step === 'phone' ? t('sendCode') : t('verify')}</Text>
            </LinearGradient>
          </Press>

          {step === 'code' ? (
            <Press onPress={() => { setStep('phone'); setCode(''); setMsg(null); }} accessibilityRole="button" style={styles.faceBtn}>
              <Text variant="caption" weight="medium">{t('changeNumber')}</Text>
            </Press>
          ) : (
            <Press onPress={faceId} accessibilityRole="button" accessibilityLabel={t('faceId')} style={styles.faceBtn}>
              <Ionicons name="scan-outline" size={22} color={color.goldBright} />
              <Text variant="caption" font="label" weight="semibold">{t('faceId')}</Text>
            </Press>
          )}
        </Glass>

        {step === 'phone' && (
          <View style={styles.alt}>
            <Text variant="caption" tone="dim">{t('orDivider')}</Text>
            <View style={styles.altRow}>
              <Press onPress={() => setMsg({ tone: 'info', text: t('googleSoon') })} accessibilityRole="button" accessibilityLabel="Google" style={styles.altBtn}><GoogleG /></Press>
              <Press onPress={() => setMsg({ tone: 'info', text: t('googleSoon') })} accessibilityRole="button" accessibilityLabel="Apple" style={styles.altBtn}><Ionicons name="logo-apple" size={24} color="#fff" /></Press>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.langWrap, { top: insets.top + 8 }]}>
        <Press onPress={() => setLangOpen((v) => !v)} accessibilityRole="button" accessibilityLabel={t('language')} style={styles.langBtn}>
          <Ionicons name="globe-outline" size={16} color={color.goldBright} />
          <Text variant="caption" weight="semibold" tone="gold">{LANGS.find((l) => l.code === lang)?.label}</Text>
        </Press>
        {langOpen && (
          <Glass r={20} strong style={styles.langMenu}>
            {LANGS.map((l) => (
              <Press key={l.code} onPress={() => { setLang(l.code); setLangOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: lang === l.code }} style={styles.langItem}>
                <Text variant="caption" weight={lang === l.code ? 'bold' : 'regular'} tone={lang === l.code ? 'gold' : 'normal'}>{l.label}</Text>
              </Press>
            ))}
          </Glass>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060913' },
  card: { padding: space.lg, gap: space.md, backgroundColor: 'rgba(120,130,160,0.10)' },
  field: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)', borderTopColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.09)' },
  phoneRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, direction: 'ltr' },
  input: { flex: 1, minWidth: 0, minHeight: 44, color: color.text, fontSize: 17, textAlign: 'left', writingDirection: 'ltr' },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  ctaWrap: { marginTop: space.xs },
  cta: { minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', ...(Platform.OS === 'web' ? ({ boxShadow: '0 10px 28px rgba(235,208,142,0.38), inset 0 1px 0 rgba(255,255,255,0.8)' } as object) : { shadowColor: '#EBD08E', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }) },
  faceBtn: { alignSelf: 'center', minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.10)' },
  alt: { alignItems: 'center', gap: space.md, marginTop: space.xl },
  altRow: { flexDirection: 'row', gap: space.md },
  altBtn: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.10)' },
  langWrap: { position: 'absolute', end: 16, alignItems: 'flex-end', gap: 6 },
  langBtn: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(235,208,142,0.5)', backgroundColor: 'rgba(10,16,34,0.6)' },
  langMenu: { padding: 6 },
  langItem: { minHeight: 40, paddingHorizontal: 18, justifyContent: 'center' },
});
