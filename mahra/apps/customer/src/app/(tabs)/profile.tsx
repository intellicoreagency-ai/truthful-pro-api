import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { LANGS, useI18n, useTx } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { color, radius, space, TOUCH } from '@/theme/tokens';

type Icon = ComponentProps<typeof Ionicons>['name'];

function Bento({ icon, title, tint = color.gold, onPress, children }: { icon: Icon; title: string; tint?: string; onPress?: () => void; children?: React.ReactNode }) {
  const body = (
    <Glass r={24} style={[styles.bento, { borderColor: tint + '40' }]}>
      <View style={[styles.ico, { backgroundColor: tint + '22', borderColor: tint + '66' }]}><Ionicons name={icon} size={22} color={tint} /></View>
      <Text weight="bold">{title}</Text>
      {children}
    </Glass>
  );
  return onPress ? (
    <Pressable style={styles.half} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>{body}</Pressable>
  ) : (
    <View style={styles.half}>{body}</View>
  );
}

/** مهرة حسابي: بطاقة رأس زجاجية ثم بطاقات bento بأيقونات ذهبية وفضية ومفاتيح بنمط Apple. */
export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const tx = useTx();
  const { phone, signOut } = useAuth();
  const [notif, setNotif] = useState(true);
  const [sound, setSound] = useState(true);
  const [haptic, setHaptic] = useState(true);
  const [history, setHistory] = useState(true);

  return (
    <Screen tabs>
      <Glass r={28} strong style={styles.header}>
        <LinearGradient colors={['#F3D999', color.periwinkle]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}><Text variant="title" weight="bold" style={{ color: color.deep }}>{tx('س', 'S')}</Text></LinearGradient>
        <Text variant="title" center>{tx('مهرة حسابي', 'My Mohra')}</Text>
        <Text tone="dim" style={{ writingDirection: 'ltr' }}>{phone}</Text>
        <View style={styles.verified}><Ionicons name="checkmark-circle" size={16} color={color.gold} /><Text variant="caption" weight="medium" tone="gold">{tx('رقمك موثّق', 'Number verified')}</Text></View>
      </Glass>

      <Glass r={24} style={styles.prefs}>
        <Text weight="bold">{tx('تفضيلاتي', 'My preferences')}</Text>
        {([
          { icon: 'notifications-outline', label: tx('الإشعارات', 'Notifications'), v: notif, set: setNotif },
          { icon: 'volume-high-outline', label: tx('صوت مهرة', 'Mohra’s voice'), v: sound, set: setSound },
          { icon: 'phone-portrait-outline', label: tx('الاهتزاز', 'Haptics'), v: haptic, set: setHaptic },
        ] as { icon: Icon; label: string; v: boolean; set: (v: boolean) => void }[]).map((r) => (
          <View key={r.label} style={styles.prefRow}>
            <Ionicons name={r.icon} size={22} color="#C7CBD6" />
            <Text style={{ flex: 1 }}>{r.label}</Text>
            <Toggle value={r.v} onChange={r.set} label={r.label} />
          </View>
        ))}
      </Glass>

      <View style={styles.row}>
        <Bento icon="document-text-outline" title={tx('السيرة الذاتية والملف المهني', 'CV and professional profile')} tint={color.green} onPress={() => router.push('/profile/cv')}>
          <Text variant="caption" tone="dim">{tx('مرتبطة بميرا · 82% مكتملة', 'Linked to Meera · 82% complete')}</Text>
          <View style={styles.meter}><View style={[styles.meterFill, { width: '82%', backgroundColor: color.green }]} /></View>
        </Bento>
        <Bento icon="location-outline" title={tx('العناوين المحفوظة في الإمارات', 'Saved UAE addresses')} tint="#64A0FF" onPress={() => router.push('/settings/addresses')}>
          <View style={styles.chips}>
            {[tx('دبي', 'Dubai'), tx('الشارقة', 'Sharjah'), tx('أبوظبي', 'Abu Dhabi')].map((c) => <View key={c} style={styles.chip}><Text variant="caption">{c}</Text></View>)}
          </View>
        </Bento>
      </View>

      <View style={styles.row}>
        <Bento icon="lock-closed-outline" title={tx('الخصوصية', 'Privacy')} tint={color.pinkSoft} onPress={() => router.push('/settings/privacy')}>
          <View style={styles.prefRow}>
            <Text variant="caption" tone="dim" style={{ flex: 1 }}>{tx('حفظ السجل', 'Keep history')}</Text>
            <Toggle value={history} onChange={setHistory} label={tx('حفظ السجل', 'Keep history')} />
          </View>
        </Bento>
        <Bento icon="pulse-outline" title={tx('إعدادات الصوت', 'Voice settings')} tint={color.orange} onPress={() => router.push('/settings/voice')}>
          <Text variant="caption" tone="dim">{tx('Veda · اللهجة الإماراتية', 'Veda · Emirati dialect')}</Text>
        </Bento>
      </View>

      <Glass r={24} style={{ padding: space.lg, gap: space.md }}>
        <Text weight="bold">{t('language')}</Text>
        <View style={styles.chips}>
          {LANGS.map((l) => {
            const on = l.code === lang;
            return (
              <Pressable key={l.code} onPress={() => setLang(l.code)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.lang, on && { borderColor: color.gold, backgroundColor: color.gold + '22' }]}>
                {on && <Ionicons name="checkmark" size={18} color={color.gold} />}
                <Text tone={on ? 'gold' : 'normal'}>{l.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Glass>

      <Glass r={24} style={{ padding: space.lg, flexDirection: 'row', gap: space.md, alignItems: 'center', borderColor: color.red + '66' }}>
        <Ionicons name="warning-outline" size={22} color={color.red} />
        <Text style={{ flex: 1 }}>{t('emergencyNote')}</Text>
      </Glass>

      <Button kind="glass" label={t('signOut')} onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: space.sm, padding: space.xl },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: color.gold + '66', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 3, backgroundColor: color.gold + '1A' },
  prefs: { padding: space.lg, gap: space.sm },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'stretch' },
  half: { flex: 1 },
  bento: { padding: space.lg, gap: space.sm, minHeight: 164, flex: 1 },
  ico: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  meter: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: color.hairline, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: color.glass },
  lang: { minHeight: TOUCH - 4, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: color.hairline },
});
