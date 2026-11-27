import { useFonts } from 'expo-font';
import { LocaleProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider, useI18n } from '@/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';
import { VoiceProvider } from '@/lib/voice';
import { fontSources } from '@/theme/fonts';
import { color } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(fontSources);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // إن فشل تحميل الخط نكمل بخط النظام بدل شاشة فارغة.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <VoiceProvider>
            <Shell />
          </VoiceProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

/** على الحاسوب يُعرض التطبيق داخل إطار هاتف في الوسط؛ على الهاتف يملأ الشاشة. */
function Shell() {
  const { dir, lang } = useI18n();
  const { signedIn } = useAuth();
  const { width } = useWindowDimensions();
  const framed = Platform.OS === 'web' && width > 560;

  return (
    <LocaleProvider direction={dir}>
      {/* dir للويب، direction للجوال: الاتجاه يتبع لغة التطبيق المختارة */}
      <View {...({ dir, lang } as object)} style={{ flex: 1, direction: dir, backgroundColor: framed ? '#02040B' : color.ink, alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: framed ? 430 : undefined, overflow: 'hidden', backgroundColor: color.ink, ...(framed ? { borderInlineWidth: 1, borderColor: '#1B2547' } : null) }}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ink }, animation: 'fade_from_bottom' }}>
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="chat/[agentId]" />
              <Stack.Screen name="request/[id]" />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="(auth)/login" />
            </Stack.Protected>
          </Stack>
        </View>
      </View>
    </LocaleProvider>
  );
}
