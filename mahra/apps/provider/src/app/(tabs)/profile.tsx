import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Badge, Card, Ring, Row } from '@/components/ui';
import { LANGS, useI18n, type StringKey } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useStore, type AccountStatus, type DocState } from '@/lib/store';
import { color, radius, space, TOUCH } from '@/theme/tokens';
import { Press } from '@/components/Press';

const DOC_LABEL: Record<DocState, StringKey> = { missing: 'stMissing', uploaded: 'stUploaded', accepted: 'stAccepted', rejected: 'stRejected' };
const DOC_TONE: Record<DocState, 'ok' | 'bad' | 'warn' | 'info' | 'mute'> = { missing: 'bad', uploaded: 'info', accepted: 'ok', rejected: 'bad' };

export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const { signOut } = useAuth();
  const { name, readiness, stats, status, setStatus } = useStore();
  const present = readiness.filter((r) => r.state === 'accepted' || r.state === 'uploaded').length;
  const pct = Math.round((present / readiness.length) * 100);

  return (
    <Screen tabs contentStyle={{ paddingTop: 56 }}>
      <Text variant="title">{name}</Text>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <Ring pct={pct} label={t('complete')} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="heading">{t('complete')}</Text>
          <Text variant="caption" tone="dim">{t('completeHint')}</Text>
        </View>
      </Card>

      <Card style={{ gap: space.md }}>
        {readiness.map((r) => (
          <View key={r.key} style={styles.docRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="medium">{t(r.key)}</Text>
              {r.note && <Text variant="caption" tone="bad">{r.note}</Text>}
            </View>
            {(r.state === 'missing' || r.state === 'rejected') ? (
              <Press accessibilityRole="button" accessibilityLabel={`${t('uploadDoc')} ${t(r.key)}`} style={styles.upload}>
                <Ionicons name="cloud-upload-outline" size={18} color={color.ink} />
                <Text weight="semibold">{t('uploadDoc')}</Text>
              </Press>
            ) : (
              <Badge tone={DOC_TONE[r.state]}>{t(DOC_LABEL[r.state])}</Badge>
            )}
          </View>
        ))}
      </Card>

      <Card style={{ gap: 2 }}>
        <Text weight="semibold" style={{ marginBottom: 4 }}>{t('stats')}</Text>
        <Row label={t('rating')} value={`★ ${stats.rating}`} />
        <Row label={t('responseRate')} value={`${stats.responseRate}%`} />
        <Row label={t('completedJobs')} value={String(stats.completed)} />
      </Card>

      <Card style={{ gap: space.md }}>
        <Text weight="semibold">{t('language')}</Text>
        <View style={styles.langs}>
          {LANGS.map((l) => (
            <Press key={l.code} onPress={() => setLang(l.code)} accessibilityRole="radio" accessibilityState={{ selected: lang === l.code }} style={[styles.lang, lang === l.code && { backgroundColor: color.ink, borderColor: color.ink }]}>
              <Text weight="medium" style={{ color: lang === l.code ? color.onInk : color.text }}>{l.label}</Text>
            </Press>
          ))}
        </View>
      </Card>

      <Card style={{ gap: space.md, borderStyle: 'dashed' }}>
        <Text weight="semibold">{t('preview')}</Text>
        <View style={styles.langs}>
          {(['approved', 'suspended', 'incomplete'] as AccountStatus[]).map((s) => (
            <Press key={s} onPress={() => setStatus(s)} accessibilityRole="radio" accessibilityState={{ selected: status === s }} style={[styles.lang, status === s && { backgroundColor: color.gold, borderColor: color.gold }]}>
              <Text weight="medium">{s}</Text>
            </Press>
          ))}
        </View>
      </Card>

      <Button kind="secondary" label={t('signOut')} onPress={signOut} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  docRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  upload: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: color.gold },
  langs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  lang: { minHeight: TOUCH - 6, justifyContent: 'center', paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.line },
});
