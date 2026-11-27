import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { Press } from '@/components/Press';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { LANGS, useI18n, useTx } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { ltr } from '@/lib/bidi';
import { color, glow, radius, space, TOUCH, type Tone } from '@/theme/tokens';

type Icon = ComponentProps<typeof Ionicons>['name'];

/** أيقونة دائرية زجاجية (شارة) بلون النغمة. */
function Badge({ icon, tone }: { icon: Icon; tone?: Tone }) {
  const g = tone ? glow[tone] : null;
  return (
    <View style={[styles.badge, { backgroundColor: g?.tint ?? 'rgba(255,255,255,0.08)', borderColor: g?.rim ?? 'rgba(255,255,255,0.28)' }]}>
      <Ionicons name={icon} size={18} color={g?.ink ?? color.goldBright} />
    </View>
  );
}

function Cell({ tone, title, onPress, children }: { tone?: Tone; title: string; onPress?: () => void; children: ReactNode }) {
  const card = (
    <Glass card style={styles.cell}>
      <Text weight="bold">{title}</Text>
      {children}
    </Glass>
  );
  return onPress ? <Press style={styles.half} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>{card}</Press> : <View style={styles.half}>{card}</View>;
}

/**
 * مهرة حسابي (مواصفات Spatial Glass): رأس بصورة بإطار شمبانيا وشارة العضوية، ثم شبكة bento غير متماثلة:
 * اللغات + التواصل، العناوين (ياقوتي) + السيرة (زمردي)، الخصوصية + إعدادات الصوت، وزر الحفظ.
 */
export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const tx = useTx();
  const { signOut } = useAuth();
  const [listen, setListen] = useState(true);
  const [recog, setRecog] = useState(true);
  const [equalizer, setEqualizer] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 2200);
    return () => clearTimeout(id);
  }, [saved]);

  return (
    <Screen tabs>
      <View style={styles.headWrap}>
        <LinearGradient colors={['#F3DFC1', '#D9B982', '#8C6B34']} style={styles.frame}>
          <View style={styles.avatarIn}><Ionicons name="person" size={40} color={color.goldBright} /></View>
        </LinearGradient>
        <Glass r={28} strong style={styles.header}>
          <Text variant="title" weight="bold" center>{tx('محمود الأحمد', 'Mahmoud Al-Ahmad')}</Text>
          <View style={styles.member}>
            <Ionicons name="checkmark-circle" size={16} color={color.goldBright} />
            <Text variant="caption" font="label" weight="semibold" tone="gold">{tx('عضوية مهرة الذكية • الإمارات العربية المتحدة', 'Mohra Smart Member • UAE')}</Text>
          </View>
        </Glass>
      </View>

      <View style={styles.row}>
        <Cell title={tx('اللغات', 'Languages')}>
          <View style={styles.chips}>
            {LANGS.map((l) => {
              const on = l.code === lang;
              return (
                <Press key={l.code} onPress={() => setLang(l.code)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.lang, on && styles.langOn]}>
                  <Text variant="caption" font="label" weight={on ? 'bold' : 'regular'} tone={on ? 'gold' : 'normal'}>{l.label}</Text>
                </Press>
              );
            })}
          </View>
        </Cell>
        <Cell title={tx('التواصل والواتساب', 'Contact and WhatsApp')}>
          <View style={styles.badges}><Badge icon="call-outline" /><Badge icon="logo-whatsapp" tone="emerald" /><Badge icon="location-outline" tone="sapphire" /></View>
          <Text variant="caption" tone="dim">{ltr('+971 50 XXXXX')} • {tx('الشارقة، الإمارات', 'Sharjah, UAE')}</Text>
          <Text variant="caption" tone="dim">{tx('واتساب مفعّل', 'WhatsApp active')}</Text>
        </Cell>
      </View>

      <View style={styles.row}>
        <Cell tone="sapphire" title={tx('العناوين المحفوظة في الإمارات', 'Saved UAE addresses')} onPress={() => router.push('/settings/addresses')}>
          <View style={styles.badges}><Badge icon="pin-outline" tone="sapphire" /><Badge icon="pin-outline" tone="sapphire" /><Badge icon="pin-outline" tone="sapphire" /></View>
          <Text variant="caption" tone="dim">{tx('دبي • الشارقة • أبوظبي', 'Dubai • Sharjah • Abu Dhabi')}</Text>
          <Text variant="caption" weight="semibold" style={{ color: glow.sapphire.ink }}>{tx('4 عناوين مفعّلة', '4 active addresses')}</Text>
        </Cell>
        <Cell tone="emerald" title={tx(`السيرة الذاتية ${ltr('CV')}`, 'CV')} onPress={() => router.push('/profile/cv')}>
          <Text variant="caption" tone="dim">{tx(`ملف ${ltr('CV')} مرفوع ومرتبط مع ميرا`, 'CV uploaded and linked to Meera')}</Text>
          <View style={styles.badges}>
            <View style={styles.docBtn}><Ionicons name="document-text-outline" size={18} color={color.goldBright} /><Text variant="caption" weight="semibold" tone="gold">{tx('معاينة', 'Preview')}</Text></View>
            <View style={styles.docBtn}><Ionicons name="cloud-upload-outline" size={18} color={color.goldBright} /><Text variant="caption" weight="semibold" tone="gold">{tx('رفع', 'Upload')}</Text></View>
          </View>
        </Cell>
      </View>

      <View style={styles.row}>
        <Cell title={tx('الخصوصية والأمان', 'Privacy and security')} onPress={() => router.push('/settings/privacy')}>
          <View style={styles.badges}><Badge icon="lock-closed-outline" /><Badge icon="finger-print-outline" /><Badge icon="shield-checkmark-outline" tone="emerald" /></View>
          <View style={styles.tog}>
            <Text variant="caption" tone="dim" style={{ flex: 1 }}>{tx('الاستماع المتواصل والتعرّف على الصوت', 'Continuous listening and voice recognition')}</Text>
            <Toggle value={listen} onChange={setListen} label={tx('الاستماع المتواصل', 'Continuous listening')} />
          </View>
        </Cell>
        <Cell title={tx('إعدادات الصوت', 'Voice settings')} onPress={() => router.push('/settings/voice')}>
          <View style={styles.badges}><Badge icon="mic-outline" /><Badge icon="pulse-outline" tone="sapphire" /></View>
          <View style={styles.tog}>
            <Text variant="caption" tone="dim" style={{ flex: 1 }}>{tx('موجات الصوت والمعادل', 'Waveform and equalizer')}</Text>
            <Toggle value={equalizer} onChange={setEqualizer} label={tx('المعادل', 'Equalizer')} />
          </View>
          <View style={styles.tog}>
            <Text variant="caption" tone="dim" style={{ flex: 1 }}>{tx('التعرّف على صوتي', 'Recognise my voice')}</Text>
            <Toggle value={recog} onChange={setRecog} label={tx('التعرّف على صوتي', 'Recognise my voice')} />
          </View>
        </Cell>
      </View>

      <Button kind="cta" label={tx('حفظ التفضيلات وتحديث الضبط', 'Save preferences')} onPress={() => setSaved(true)} />
      {saved && (
        <Glass r={20} tone="emerald" style={styles.toast} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={20} color={glow.emerald.ink} />
          <Text weight="semibold">{tx('تم حفظ التفضيلات', 'Preferences saved')}</Text>
        </Glass>
      )}

      <Glass r={24} style={styles.emergency}>
        <Ionicons name="warning-outline" size={22} color={color.red} />
        <Text style={{ flex: 1 }}>{t('emergencyNote')}</Text>
      </Glass>
      <Button kind="glass" label={t('signOut')} onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headWrap: { alignItems: 'center', paddingTop: 40 },
  frame: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 0, zIndex: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  avatarIn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#0B1224', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#0B1224' },
  header: { alignSelf: 'stretch', alignItems: 'center', gap: space.sm, paddingTop: 58, paddingBottom: space.lg, paddingHorizontal: space.lg },
  member: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(235,208,142,0.5)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(235,208,142,0.10)' },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'stretch' },
  half: { flex: 1 },
  cell: { padding: space.md, gap: space.sm, flex: 1, minHeight: 224 },
  badge: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  docBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(235,208,142,0.5)', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(235,208,142,0.10)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lang: { minHeight: 32, paddingHorizontal: 10, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  langOn: { borderColor: color.goldBright, backgroundColor: 'rgba(235,208,142,0.14)' },
  tog: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: TOUCH - 8 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, alignSelf: 'center' },
  emergency: { padding: space.lg, flexDirection: 'row', gap: space.md, alignItems: 'center', borderColor: 'rgba(255,69,58,0.4)' },
});
