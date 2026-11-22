/** Digits only, converting Arabic-Indic and Persian digits. */
const phoneDigits=(value:string)=>value.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/\D/g,'');

/** The UAE country code, shown as a fixed label at the start of the phone field; the person types only the rest. */
export const PHONE_PREFIX='+971';
/** What the person typed or pasted, reduced to the local part after +971 (at most 9 digits): accepts 05XXXXXXXX,
 *  5XXXXXXXX, +971 5X…, 00971…, spaces, dashes and Arabic-Indic digits. */
export function localPhone(input:string):string{
  let d=phoneDigits(input);
  if(d.startsWith('00971'))d=d.slice(5);else if(d.startsWith('971'))d=d.slice(3);
  if(d.startsWith('0'))d=d.slice(1);
  return d.slice(0,9);
}
/** UAE mobile number in E.164 (+9715XXXXXXXX) from what the user typed, or null.
 *  Accepts +971 5X XXX XXXX (the default), 00971…, 05XXXXXXXX, 5XXXXXXXX, a stray 0 after +971, Arabic-Indic digits. */
export function toE164(input:string):string|null{
  let d=phoneDigits(input);
  if(d.startsWith('00'))d=d.slice(2);
  if(d.startsWith('9710'))d='971'+d.slice(4);
  const n=d.startsWith('971')?d:d.startsWith('0')?'971'+d.slice(1):d.length===9?'971'+d:'';
  return /^9715\d{8}$/.test(n)?'+'+n:null;
}
/** Optional email check (the server validates again). */
export const isEmail=(v:string)=>/^[^\s@<>"',;:()[\]\\]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(v.trim())&&v.trim().length<=120;
