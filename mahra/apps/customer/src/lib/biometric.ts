import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'mohra.session.refresh';
const FLAG_KEY = 'mohra.bio.enabled';
const DECLINED_KEY = 'mohra.bio.declined';

/** التخزين الآمن غير متاح على الويب؛ هناك لا بصمة ولا تفعيل. */
const secure = () => SecureStore.isAvailableAsync();

export async function biometricAvailable(): Promise<boolean> {
  if (!(await secure())) return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await secure()) && (await SecureStore.getItemAsync(FLAG_KEY)) === '1';
}
export async function wasOfferDeclined(): Promise<boolean> {
  return (await secure()) && (await SecureStore.getItemAsync(DECLINED_KEY)) === '1';
}
export async function declineOffer(): Promise<void> {
  if (await secure()) await SecureStore.setItemAsync(DECLINED_KEY, '1');
}

/** يحفظ رمز التحديث في التخزين الآمن محمياً بالبصمة/الوجه (requireAuthentication)، بعد تحقق المستخدم الآن. */
export async function enableBiometric(refreshToken: string): Promise<boolean> {
  if (!(await biometricAvailable())) return false;
  const a = await LocalAuthentication.authenticateAsync({ promptMessage: 'مهرة', cancelLabel: 'إلغاء' });
  if (!a.success) return false;
  await SecureStore.setItemAsync(TOKEN_KEY, refreshToken, { requireAuthentication: true });
  await SecureStore.setItemAsync(FLAG_KEY, '1');
  return true;
}

/** يفتح الاعتماد المحفوظ بالبصمة/الوجه؛ null عند الإلغاء أو الفشل. */
export async function unlockWithBiometric(): Promise<string | null> {
  if (!(await isBiometricEnabled())) return null;
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY, { requireAuthentication: true });
  } catch {
    return null;
  }
}

/** يدوّر الاعتماد بعد كل تحديث للجلسة. */
export async function updateStoredToken(refreshToken: string): Promise<void> {
  if (await isBiometricEnabled()) await SecureStore.setItemAsync(TOKEN_KEY, refreshToken, { requireAuthentication: true });
}

export async function disableBiometric(): Promise<void> {
  if (!(await secure())) return;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(FLAG_KEY);
}
