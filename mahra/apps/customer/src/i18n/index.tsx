import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getLocales } from 'expo-localization';
import { ar } from './ar';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { hi } from './hi';
import { ru } from './ru';
import { ltr } from '@/lib/bidi';
import { zh } from './zh';

export type Lang = 'ar' | 'en' | 'ru' | 'es' | 'fr' | 'zh' | 'hi';
export type Dir = 'rtl' | 'ltr';
export type StringKey = keyof typeof ar;

const dictionaries: Record<Lang, Partial<Record<StringKey, string>>> = { ar, en, ru, es, fr, zh, hi };

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
];

export const dirOf = (lang: Lang): Dir => (lang === 'ar' ? 'rtl' : 'ltr');

function initialLang(): Lang {
  // العربية هي الأصل؛ تتبع لغة الجهاز فقط إن كانت من اللغات المدعومة.
  const code = getLocales()[0]?.languageCode;
  return LANGS.some((l) => l.code === code) ? (code as Lang) : 'ar';
}

type I18n = {
  lang: Lang;
  dir: Dir;
  setLang: (l: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  const t = useCallback<I18n['t']>(
    (key, vars) => {
      // الاحتياط: اللغة الحالية ← الإنجليزية ← العربية
      let s = dictionaries[lang][key] ?? en[key] ?? ar[key];
      // القيم اللاتينية/الرقمية (مثل رقم الهاتف) تُعزل داخل الجملة العربية كي لا ينعكس ترتيبها
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, lang === 'ar' && /^[\x20-\x7E]+$/.test(String(v)) ? ltr(v) : String(v));
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, dir: dirOf(lang), setLang, t }), [lang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** نص ثنائي سريع للصفحات الجديدة: ar أو en (غيرهما يرجع للإنجليزية) */
export function useTx(): (ar: string, en: string) => string {
  const { lang } = useI18n();
  return (ar, en) => (lang === 'ar' ? ar : en);
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
}
