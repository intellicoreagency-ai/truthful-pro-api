import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type Auth = {
  signedIn: boolean;
  phone: string | null;
  whatsapp: string | null;
  signIn: (phone: string, whatsapp: string) => void;
  signOut: () => void;
};

const Ctx = createContext<Auth | null>(null);

/** حالة دخول في الذاكرة فقط (نموذج). الجلسة الحقيقية والتحقق الهاتفي يأتيان مع الخلفية. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);

  const value = useMemo<Auth>(
    () => ({
      signedIn: phone !== null,
      phone,
      whatsapp,
      signIn: (p, w) => {
        setPhone(p);
        setWhatsapp(w);
      },
      signOut: () => {
        setPhone(null);
        setWhatsapp(null);
      },
    }),
    [phone, whatsapp],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
