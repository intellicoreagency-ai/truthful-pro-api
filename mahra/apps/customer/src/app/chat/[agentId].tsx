import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgentBadge } from '@/components/AgentBadge';
import { Backdrop } from '@/components/Backdrop';
import { Glass } from '@/components/Glass';
import { Text } from '@/components/Text';
import { agentById } from '@/data/agents';
import { useI18n } from '@/i18n';
import { fontFor } from '@/theme/fonts';
import { color, radius, space, TOUCH } from '@/theme/tokens';

type Msg = { id: string; from: 'user' | 'agent' | 'system'; text: string };

// ردود نموذجية (محاكاة). تُستبدل بالنموذج الحقيقي بعد ربط الوكلاء.
const SCRIPT = {
  ar: {
    jalal: [
      'معك جلال. أسمعك. إن كنت على طريق سريع فابتعد عن السير وشغّل الإشارات أولاً، ثم أخبرني ماذا يحدث مع السيارة.',
      'شكراً. ما نوع السيارة وموديلها؟ ويمكنك إرسال صورة للوحة العدادات أو للمنطقة التي تخرج منها المشكلة.',
    ],
    other: ['أهلاً بك. أسمعك، ما الذي تحتاجه بالضبط؟', 'فهمت. سأرتب لك الخطوة التالية.'],
  },
  en: {
    jalal: [
      'This is Jalal. I’m listening. If you are on a highway, move away from traffic and switch on your hazard lights first, then tell me what the car is doing.',
      'Thanks. What is the car’s make and model? You can also send a photo of the dashboard or where the problem is coming from.',
    ],
    other: ['Hello, I’m listening. What exactly do you need?', 'Understood. I’ll arrange the next step for you.'],
  },
} as const;

export default function Chat() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const agent = agentById(agentId);
  const { t, lang, dir } = useI18n();
  const insets = useSafeAreaInsets();
  const L = lang === 'ar' ? 'ar' : 'en';

  const lines = agent?.id === 'jalal' ? SCRIPT[L].jalal : SCRIPT[L].other;
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { id: 's', from: 'system', text: agent ? t('handoffFrom', { name: agent.name[L] }) : '' },
    { id: 'a0', from: 'agent', text: lines[0] },
  ]);
  const [draft, setDraft] = useState('');
  const turn = useRef(1);
  const listRef = useRef<FlatList<Msg>>(null);

  if (!agent) return null;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const n = turn.current++;
    setMsgs((m) => [...m, { id: `u${n}`, from: 'user', text }]);
    setTimeout(() => {
      setMsgs((m) => [...m, { id: `a${n}`, from: 'agent', text: lines[Math.min(n, lines.length - 1)] }]);
      listRef.current?.scrollToEnd({ animated: true });
    }, 900);
  };

  return (
    <View style={styles.root}>
      <Backdrop />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('back')} style={styles.back}>
            <Ionicons name="arrow-back" size={24} color={color.text} style={{ transform: [{ scaleX: dir === 'rtl' ? -1 : 1 }] }} />
          </Pressable>
          <AgentBadge agent={agent} size={44} />
          <View style={{ flex: 1 }}>
            <Text weight="semibold">{agent.name[L]}</Text>
            <Text variant="caption" tone="dim" numberOfLines={1}>
              {agent.role[L]}
            </Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.md }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            <Text variant="caption" tone="dim" center style={{ marginTop: space.md }}>
              {t('demoNotice')}
            </Text>
          }
          renderItem={({ item }) =>
            item.from === 'system' ? (
              <View style={styles.system}>
                <Ionicons name="swap-horizontal" size={16} color={color.gold} />
                <Text variant="caption" tone="gold">
                  {item.text}
                </Text>
              </View>
            ) : (
              <Glass
                strong={item.from === 'user'}
                r={radius.lg}
                style={[
                  styles.bubble,
                  item.from === 'user' ? { alignSelf: 'flex-end', backgroundColor: 'rgba(61,99,221,0.35)' } : { alignSelf: 'flex-start' },
                ]}
              >
                <Text>{item.text}</Text>
              </Glass>
            )
          }
        />

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('attachPhoto')} style={styles.round}>
            <Ionicons name="camera-outline" size={24} color={color.text} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            placeholder={t('chatInputPlaceholder')}
            placeholderTextColor={color.textMuted}
            accessibilityLabel={t('chatInputPlaceholder')}
            returnKeyType="send"
            style={[styles.input, { fontFamily: fontFor(lang, 'regular') }]}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel={t('send')}
            style={[styles.round, { backgroundColor: color.gold, opacity: draft.trim() ? 1 : 0.5 }]}
          >
            <Ionicons name="send" size={20} color={color.ink} style={{ transform: [{ scaleX: dir === 'rtl' ? -1 : 1 }] }} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: color.hairline },
  back: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  system: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 4 },
  bubble: { maxWidth: '86%', padding: space.lg },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  round: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glassStrong },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: TOUCH,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: space.lg,
    color: color.text,
    fontSize: 16,
  },
});
