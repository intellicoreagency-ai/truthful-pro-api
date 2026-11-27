import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './authConfig';

/**
 * عميل Supabase للتحقق من هوية Google وApple على الخادم. null إلى أن يُضبط EXPO_PUBLIC_SUPABASE_URL وANON_KEY.
 * الجلسة لا تُحفظ تلقائياً (persistSession=false): نحفظ رمز التحديث نحن في التخزين الآمن (انظر biometric.ts).
 */
export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: 'pkce', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    : null;

export const authConfigured = supabase !== null;
