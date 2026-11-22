import {COUNTRIES} from './countries';

/** Digits only, converting Arabic-Indic and Persian digits. */
export const phoneDigits=(value:string)=>value.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/\D/g,'');

/** The default country code (UAE). Customers may pick any other country in the phone field. */
export const PHONE_PREFIX='+971';
export const UAE_DIAL='971';

/** The local part as typed (digits only, without a leading trunk 0), at most 14 digits. */
export function localPhone(input:string,dial:string=UAE_DIAL):string{
  let d=phoneDigits(input);
  if(d.startsWith('00'+dial))d=d.slice(2+dial.length);else if(input.trim().startsWith('+')&&d.startsWith(dial))d=d.slice(dial.length);
  else if(dial===UAE_DIAL&&d.startsWith('971')&&d.length>9)d=d.slice(3);
  if(d.startsWith('0'))d=d.slice(1);
  return d.slice(0,dial===UAE_DIAL?9:14);
}

/** A pasted international number ("+86 138…", "0044…"): the country code it starts with (longest match in the list) and the rest. */
export function splitInternational(input:string):{dial:string;local:string}|null{
  const t=input.trim();
  if(!t.startsWith('+')&&!phoneDigits(t).startsWith('00'))return null;
  let d=phoneDigits(t);if(d.startsWith('00'))d=d.slice(2);
  const dial=[...new Set(COUNTRIES.map(c=>c.dial))].sort((a,b)=>b.length-a.length).find(x=>d.startsWith(x));
  if(!dial)return null;
  return {dial,local:localPhone(d.slice(dial.length),dial)};
}

/** E.164 from a country code and the local number, or null. UAE numbers must be mobiles (+9715XXXXXXXX);
 *  other countries: 4–14 local digits and at most 15 digits in total (the E.164 limit). */
export function e164From(dial:string,local:string):string|null{
  const l=localPhone(local,dial);
  if(!/^[1-9]\d{0,3}$/.test(dial))return null;
  if(dial===UAE_DIAL)return /^5\d{8}$/.test(l)?'+971'+l:null;
  if(l.length<4||dial.length+l.length<8||dial.length+l.length>15)return null;
  return '+'+dial+l;
}

/** A phone number from free text (request forms): an international number starting with + or 00, or a UAE number
 *  written locally (05XXXXXXXX, 5XXXXXXXX). Returns E.164 or null. */
export function toE164(input:string):string|null{
  const intl=splitInternational(input);
  if(intl)return e164From(intl.dial,intl.local);
  let d=phoneDigits(input);
  if(d.startsWith('9710'))d='971'+d.slice(4);
  const n=d.startsWith('971')?d:d.startsWith('0')?'971'+d.slice(1):d.length===9?'971'+d:'';
  return /^9715\d{8}$/.test(n)?'+'+n:null;
}
/** Optional email check (the server validates again). */
export const isEmail=(v:string)=>/^[^\s@<>"',;:()[\]\\]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(v.trim())&&v.trim().length<=120;
