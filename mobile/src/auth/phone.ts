/** Digits only, converting Arabic-Indic and Persian digits. */
const phoneDigits=(value:string)=>value.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/\D/g,'');

/** UAE mobile number in E.164 (+9715XXXXXXXX) from what the user typed, or null. Accepts 05XXXXXXXX, 5XXXXXXXX, 9715XXXXXXXX, +9715XXXXXXXX, Arabic-Indic digits. */
export function toE164(input:string):string|null{
  const d=phoneDigits(input);
  const n=d.startsWith('971')?d:d.startsWith('0')?'971'+d.slice(1):d.length===9?'971'+d:'';
  return /^9715\d{8}$/.test(n)?'+'+n:null;
}
/** Optional email check (the server validates again). */
export const isEmail=(v:string)=>/^[^\s@<>"',;:()[\]\\]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(v.trim())&&v.trim().length<=120;
