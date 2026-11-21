/**
 * App languages (owner decision, 21 Nov 2026): Arabic, English, Russian, Chinese (Simplified), French, Spanish.
 * Arabic is the only right-to-left language. Any text not yet translated falls back to English, never to a blank.
 */
import {PHRASES} from './phrases';

export const LANGS=['ar','en','ru','zh','fr','es'] as const;
export type Lang=typeof LANGS[number];
export type Extra='ru'|'zh'|'fr'|'es';

export const isLang=(v:unknown):v is Lang=>typeof v==='string'&&(LANGS as readonly string[]).includes(v);
export const isRTL=(l:Lang)=>l==='ar';

/** Each language named in itself, plus a short code for compact controls. */
export const LANG_INFO:Record<Lang,{native:string;short:string;locale:string}>={
  ar:{native:'العربية',short:'ع',locale:'ar-AE'},
  en:{native:'English',short:'EN',locale:'en-GB'},
  ru:{native:'Русский',short:'RU',locale:'ru-RU'},
  zh:{native:'简体中文',short:'中',locale:'zh-CN'},
  fr:{native:'Français',short:'FR',locale:'fr-FR'},
  es:{native:'Español',short:'ES',locale:'es-ES'},
};

/** Bilingual record that may also carry the other languages. */
export type Bi={ar:string;en:string}&Partial<Record<Extra,string>>;
const EXTRA_INDEX:Record<Extra,number>={ru:0,zh:1,fr:2,es:3};
/** Text in `l`: the record's own translation, else the shared service vocabulary (by English text), else English. */
export const tr=(b:Bi|undefined|null,l:Lang):string=>{
  if(!b)return '';
  if(l==='ar'||l==='en')return b[l];
  return b[l]??PHRASES[b.en]?.[EXTRA_INDEX[l]]??b.en;
};

/** Per-screen copy: Arabic and English are required, the others fall back to English key by key. */
export type Copy<T>={ar:T;en:T}&Partial<Record<Extra,Partial<T>>>;
export function pick<C extends {ar:object;en:object}>(copy:C,l:Lang):C['ar']|C['en']{
  if(l==='ar'||l==='en')return copy[l];
  const extra=(copy as unknown as Partial<Record<Extra,object>>)[l];
  return extra?{...copy.en,...extra} as C['en']:copy.en;
}
/** The server and messaging templates speak Arabic and English only. */
export const apiLang=(l:Lang):'ar'|'en'=>l==='ar'?'ar':'en';

/** Each language named in every app language (the language menu shows the native name and this one). */
export const LANG_NAMES:Record<Lang,Record<Lang,string>>={
  ar:{ar:'العربية',en:'الإنجليزية',ru:'الروسية',zh:'الصينية',fr:'الفرنسية',es:'الإسبانية'},
  en:{ar:'Arabic',en:'English',ru:'Russian',zh:'Chinese (Simplified)',fr:'French',es:'Spanish'},
  ru:{ar:'Арабский',en:'Английский',ru:'Русский',zh:'Китайский (упрощённый)',fr:'Французский',es:'Испанский'},
  zh:{ar:'阿拉伯语',en:'英语',ru:'俄语',zh:'简体中文',fr:'法语',es:'西班牙语'},
  fr:{ar:'Arabe',en:'Anglais',ru:'Russe',zh:'Chinois (simplifié)',fr:'Français',es:'Espagnol'},
  es:{ar:'Árabe',en:'Inglés',ru:'Ruso',zh:'Chino (simplificado)',fr:'Francés',es:'Español'},
};
export const LANG_MENU_TITLE:Record<Lang,string>={ar:'اختر اللغة',en:'Choose your language',ru:'Выберите язык',zh:'选择语言',fr:'Choisissez votre langue',es:'Elija su idioma'};

/** Words shared by many controls. */
export const COMMON:Record<Lang,{close:string;noResults:string;back:string;cancel:string;retry:string}>={
  ar:{close:'إغلاق',noResults:'لا نتائج',back:'رجوع',cancel:'إلغاء',retry:'إعادة المحاولة'},
  en:{close:'Close',noResults:'No results',back:'Back',cancel:'Cancel',retry:'Try again'},
  ru:{close:'Закрыть',noResults:'Ничего не найдено',back:'Назад',cancel:'Отмена',retry:'Повторить'},
  zh:{close:'关闭',noResults:'无结果',back:'返回',cancel:'取消',retry:'重试'},
  fr:{close:'Fermer',noResults:'Aucun résultat',back:'Retour',cancel:'Annuler',retry:'Réessayer'},
  es:{close:'Cerrar',noResults:'Sin resultados',back:'Atrás',cancel:'Cancelar',retry:'Reintentar'},
};
