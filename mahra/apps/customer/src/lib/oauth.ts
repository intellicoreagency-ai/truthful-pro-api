import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { isUserCancel, parseCallback } from './oauthParse';
import { supabase } from './supabase';

export type OAuthOutcome =
  | { status: 'ok'; userId: string; email: string | null; refreshToken: string }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

type Provider = 'google' | 'apple';

type SessionLike = { user: { id: string; email?: string | null }; refresh_token: string } | null;
const ok = (s: SessionLike): OAuthOutcome => (s ? { status: 'ok', userId: s.user.id, email: s.user.email ?? null, refreshToken: s.refresh_token } : { status: 'error', message: 'no session' });

/** تسجيل دخول المزوّد الرسمي في متصفح النظام ثم تبادل الرمز مع الخادم (PKCE)؛ إغلاق النافذة = إلغاء. */
async function webOAuth(provider: Provider): Promise<OAuthOutcome> {
  if (!supabase) return { status: 'unavailable' };
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) return { status: 'error', message: error?.message ?? 'no auth url' };
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return { status: 'cancelled' };
  const { code, error: providerError } = parseCallback(res.url);
  if (providerError) return isUserCancel(providerError) ? { status: 'cancelled' } : { status: 'error', message: providerError };
  if (!code) return { status: 'error', message: 'no code' };
  const ex = await supabase.auth.exchangeCodeForSession(code);
  return ex.error ? { status: 'error', message: ex.error.message } : ok(ex.data.session);
}

export function signInWithGoogle(): Promise<OAuthOutcome> {
  return webOAuth('google');
}

/** Apple على iOS: نافذة Apple الأصلية ثم تحقق الخادم من الرمز (مع nonce)؛ على غير iOS: متصفح النظام. */
export async function signInWithApple(): Promise<OAuthOutcome> {
  if (!supabase) return { status: 'unavailable' };
  if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) return webOAuth('apple');
  try {
    const raw = Crypto.randomUUID();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
    if (!cred.identityToken) return { status: 'error', message: 'no identity token' };
    const r = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce: raw });
    return r.error ? { status: 'error', message: r.error.message } : ok(r.data.session);
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' };
    return { status: 'error', message: e instanceof Error ? e.message : 'apple sign-in failed' };
  }
}

/** يستعيد جلسة من رمز تحديث محفوظ (بعد البصمة). يعيد رمز التحديث الجديد (يدور عند كل تحديث). */
export async function restoreSession(refreshToken: string): Promise<OAuthOutcome> {
  if (!supabase) return { status: 'unavailable' };
  const r = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  return r.error ? { status: 'error', message: r.error.message } : ok(r.data.session);
}
