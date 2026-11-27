/**
 * إعدادات الدخول الفعلي. لا أسرار هنا: عنوان Supabase والمفتاح العام (anon) فقط، والأسرار (Google/Apple) في إعدادات Supabase.
 * تفعيل كل طريقة منفصل عن ظهورها: EXPO_PUBLIC_AUTH_LIVE=biometric,google,apple (تُضاف الطريقة بعد نجاح اختبارها على جهاز مدعوم).
 */
const live = (process.env.EXPO_PUBLIC_AUTH_LIVE ?? '').split(',').map((s: string) => s.trim());

export const AUTH_LIVE = {
  biometric: live.includes('biometric'),
  google: live.includes('google'),
  apple: live.includes('apple'),
};
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
