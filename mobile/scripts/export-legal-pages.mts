// Writes the public Privacy Policy and Terms of Use pages (Arabic + English, the authoritative languages) from the same
// texts the app shows, into dashboard/public/legal/. The staging/production Worker serves them as static files at
// /legal/privacy.html and /legal/terms.html — the URL App Store Connect and Google Play ask for.
// Run: node --import ./scripts/ts-resolve.mjs scripts/export-legal-pages.mts
import {mkdirSync,writeFileSync} from 'node:fs';
import {PRIVACY,TERMS,COMPANY,type LegalDoc} from '../src/legal.ts';

const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const block=(d:LegalDoc,l:'ar'|'en')=>`<section lang="${l}" dir="${l==='ar'?'rtl':'ltr'}">
<h1>${esc(d.title[l])}</h1>
<p>${esc(d.intro[l])}</p>
${d.sections.map(s=>`<h2>${esc(s.h[l])}</h2>\n<p>${esc(s.p[l])}</p>`).join('\n')}
</section>`;
const page=(d:LegalDoc,other:string,otherTitle:string)=>`<!doctype html>
<html lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.title.en)} · ${esc(d.title.ar)} · TRUTHFUL PRO</title>
<style>
body{margin:0;background:#F3F5F8;color:#0E1526;font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 20px 64px}
header{display:flex;align-items:center;gap:12px;margin-bottom:24px}header img{width:48px;height:48px;border-radius:50%}
section{background:#fff;border:1px solid #E6E9F0;border-radius:18px;padding:20px 24px;margin:16px 0}
h1{font-size:26px;color:#0A1430;margin:0 0 8px}h2{font-size:18px;color:#1D3A9E;margin:20px 0 4px}
.note{background:#FFF6E5;border:1px solid #D9BC7E;border-radius:12px;padding:10px 14px;font-size:14px}
footer,.meta{font-size:13px;color:#5B6478}a{color:#1D3A9E}
</style></head><body><main>
<header><img src="/logo.png" alt=""><div><strong>TRUTHFUL PRO · تروثفل برو</strong><div class="meta">${esc(COMPANY.name.en)} · ${esc(COMPANY.name.ar)}</div></div></header>
${d.version.startsWith('draft')?`<p class="note" dir="rtl">مسودة بانتظار المراجعة القانونية — النسخة ${esc(d.version)}.</p><p class="note">Draft pending legal review — version ${esc(d.version)}.</p>`:`<p class="meta" dir="rtl">النسخة المعتمدة: ${esc(d.version)}</p><p class="meta">Adopted version: ${esc(d.version)}</p>`}
<p class="meta" dir="rtl">النسختان العربية والإنجليزية هما المعتمدتان.</p><p class="meta">The Arabic and English versions are the authoritative texts.</p>
${block(d,'ar')}
${block(d,'en')}
<footer><a href="${other}">${esc(otherTitle)}</a></footer>
</main></body></html>
`;
const out=new URL('../../dashboard/public/legal/',import.meta.url);
mkdirSync(out,{recursive:true});
writeFileSync(new URL('privacy.html',out),page(PRIVACY,'/legal/terms',`${TERMS.title.ar} · ${TERMS.title.en}`));
writeFileSync(new URL('terms.html',out),page(TERMS,'/legal/privacy',`${PRIVACY.title.ar} · ${PRIVACY.title.en}`));
console.log(`Wrote dashboard/public/legal/privacy.html (${PRIVACY.version}) and terms.html (${TERMS.version})`);
