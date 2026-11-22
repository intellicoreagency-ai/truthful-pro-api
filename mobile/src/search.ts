/**
 * Service search: forgiving, partial-word matching across languages.
 * - Arabic is normalised: diacritics (tashkeel) and tatweel removed, أ/إ/آ/ٱ → ا, ة → ه, ى → ي, ؤ → و, ئ → ي,
 *   and a leading "ال" is ignored, so «اقامة», «الإقامة» and «إقامه» all match each other.
 * - Arabic-Indic digits become 0-9; Latin text is lower-cased and accents are dropped.
 * - Every word of the query must appear somewhere in the service's text (partial words count).
 * - The searched text covers the service, its actions, and the main category and branch it sits under,
 *   in Arabic, English and the current app language.
 */
import {serviceDescription,serviceLabel,type Service} from './services';
import {structureFor,wording} from './serviceDetails';
import {CATEGORIES} from './catalogue/categories';
import {tr,type Bi,type Lang} from './i18n';

const TASHKEEL=/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const ARABIC_DIGITS=/[٠-٩۰-۹]/g;

export function normalize(text:string):string{
  return text.toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g,'')   // Latin accents (é → e)
    .replace(TASHKEEL,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
    .replace(ARABIC_DIGITS,d=>String((d.charCodeAt(0)&0xF)%10))
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .trim();
}

/** Everyday words people type, mapped to the wording the catalogue uses. */
const SYNONYMS:Record<string,string[]>={
  'فيزا':['تاشيره'],'visa':['تاشيره'],'تاشيره':['visa'],
  'اقامه':['residency','residence'],'residency':['اقامه'],'residence':['اقامه'],
  'هويه':['emirates id'],'رخصه':['ترخيص','licence','license'],'license':['licence'],
  'عقد':['contract'],'ايجار':['ejari','tenancy'],
};

/** Removes a leading Arabic definite article ("ال") from a word, keeping short words intact. */
const stem=(word:string)=>word.length>4&&word.startsWith('ال')?word.slice(2):word;

const both=(b:Bi,lang:Lang)=>[b.ar,b.en,tr(b,lang)];

const cache=new Map<string,string>();
function haystack(service:Service,lang:Lang):string{
  const key=service.id+'|'+lang;
  const hit=cache.get(key);if(hit!==undefined)return hit;
  const parts:string[]=[service.ar,service.en,serviceLabel(service,lang),serviceDescription(service,lang),service.descAr??'',service.descEn??''];
  for(const a of structureFor(service.id)?.actions??[])parts.push(a.ar,a.en,wording(a,lang));
  for(const c of CATEGORIES)for(const br of [...c.individuals,...c.companies])if(br.serviceId===service.id){
    parts.push(...both(c.title,lang),...both(c.desc,lang),...both(br.title,lang),...both(br.desc,lang));
  }
  const text=' '+normalize(parts.filter(Boolean).join(' '))+' ';
  cache.set(key,text);return text;
}

/** True when every word of the query (or one of its everyday synonyms) appears in the service's text. */
export function matchesService(service:Service,query:string,lang:Lang):boolean{
  const words=normalize(query).split(' ').filter(Boolean);
  if(!words.length)return true;
  const text=haystack(service,lang);
  return words.every(w=>{const s=stem(w);return [s,...(SYNONYMS[s]??[]),...(SYNONYMS[w]??[])].some(v=>text.includes(v))});
}
