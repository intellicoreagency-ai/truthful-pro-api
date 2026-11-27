import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getLocales } from 'expo-localization';
import { ar } from './ar';
import { en } from './en';

/**
 * عربي وإنجليزي الآن. الأوردو والهندية أولوية قبل الإطلاق: كثير من سائقي السطحات وفنيي الورش
 * في الإمارات لا يقرؤون العربية ولا الإنجليزية بطلاقة.
 */
export type Lang = 'ar' | 'en';
export type Dir = 'rtl' | 'ltr';
export type StringKey = keyof typeof ar;

const dictionaries: Record<Lang, Record<StringKey, string>> = { ar, en };
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
];
export const dirOf = (l: Lang): Dir => (l === 'ar' ? 'rtl' : 'ltr');

type I18n = { lang: Lang; dir: Dir; setLang: (l: Lang) => void; t: (k: StringKey, vars?: Record<string, string | number>) => string };
const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (getLocales()[0]?.languageCode === 'en' ? 'en' : 'ar'));
  const t = useCallback<I18n['t']>(
    (key, vars) => {
      let s: string = dictionaries[lang][key] ?? en[key] ?? ar[key];
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );
  const value = useMemo(() => ({ lang, dir: dirOf(lang), setLang, t }), [lang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
}
