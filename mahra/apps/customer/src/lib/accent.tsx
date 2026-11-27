import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type Ctx = { accent: string | null; setAccent: (c: string | null) => void };
const AccentCtx = createContext<Ctx>({ accent: null, setAccent: () => {} });

/** لون الوكيل المختار (من الرئيسية) يلوّن الأرضية والزجاج والكرة؛ null = الهوية الافتراضية. */
export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccent] = useState<string | null>(null);
  const v = useMemo(() => ({ accent, setAccent }), [accent]);
  return <AccentCtx.Provider value={v}>{children}</AccentCtx.Provider>;
}
export const useAccent = () => useContext(AccentCtx);
