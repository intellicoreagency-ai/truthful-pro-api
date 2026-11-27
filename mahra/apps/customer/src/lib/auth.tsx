import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type SignInMethod = 'phone' | 'google' | 'apple' | 'biometric';

type Auth = {
  signedIn: boolean;
  phone: string | null;
  whatsapp: string | null;
  /** طريقة الدخول الحالية، ورمز التحديث (فقط للدخول الحقيقي عبر الخادم؛ الدخول بالهاتف نموذجي بلا رمز) */
  method: SignInMethod | null;
  refreshToken: string | null;
  signIn: (phone: string, whatsapp: string) => void;
  /** جلسة حقيقية من الخادم (Google/Apple/بصمة) */
  signInWithSession: (method: Exclude<SignInMethod, 'phone'>, label: string, refreshToken: string) => void;
  setRefreshToken: (token: string) => void;
  signOut: () => void;
};

const Ctx = createContext<Auth | null>(null);

/** حالة الدخول في الذاكرة. الدخول بالهاتف ما زال نموذجياً (التحقق برمز يأتي مع الخلفية)؛ Google/Apple/البصمة جلسات خادم حقيقية. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [method, setMethod] = useState<SignInMethod | null>(null);
  const [refreshToken, setRefresh] = useState<string | null>(null);

  const value = useMemo<Auth>(
    () => ({
      signedIn: method !== null,
      phone,
      whatsapp,
      method,
      refreshToken,
      signIn: (p, w) => {
        setPhone(p);
        setWhatsapp(w);
        setMethod('phone');
        setRefresh(null);
      },
      signInWithSession: (m, label, token) => {
        setPhone(label);
        setWhatsapp(null);
        setMethod(m);
        setRefresh(token);
      },
      setRefreshToken: setRefresh,
      signOut: () => {
        setPhone(null);
        setWhatsapp(null);
        setMethod(null);
        setRefresh(null);
      },
    }),
    [phone, whatsapp, method, refreshToken],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
