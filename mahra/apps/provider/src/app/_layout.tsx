import { useFonts } from 'expo-font';
import { LocaleProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider, useI18n } from '@/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';
import { StoreProvider } from '@/lib/store';
import { fontSources } from '@/theme/fonts';
import { color } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(fontSources);
  useEffect(() => { if (loaded || error) SplashScreen.hideAsync(); }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <StoreProvider>
            <Shell />
          </StoreProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

/** على شاشة الحاسوب يُعرض التطبيق داخل إطار هاتف في الوسط؛ على الهاتف يملأ الشاشة. */
function Shell() {
  const { dir, lang } = useI18n();
  const { signedIn } = useAuth();
  const { width } = useWindowDimensions();
  const framed = Platform.OS === 'web' && width > 560;

  return (
    <LocaleProvider direction={dir}>
      <View {...({ dir, lang } as object)} style={{ flex: 1, direction: dir, backgroundColor: framed ? '#05070F' : color.canvas, alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: framed ? 430 : undefined, overflow: 'hidden', backgroundColor: color.canvas, ...(framed ? { borderInlineWidth: 1, borderColor: '#1B2547' } : null) }}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.canvas }, animation: 'fade_from_bottom' }}>
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="request/[id]" />
              <Stack.Screen name="job/[id]" />
              <Stack.Screen name="proof" />
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
