/**
 * Install only the owner's approved WebP package, validate every file,
 * then generate a deterministic Metro-compatible static require registry.
 * No network access or production service modifications.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const source=path.resolve(process.argv[2]||'');
if(!process.argv[2]){console.error('Usage: node scripts/install-approved-banners.cjs <unpacked approved banner package directory>');process.exit(2);}
const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
const approved=['complete-business','category-companies','immigration-visas','moa-amendments','bank-account','ejari-companies','rta-companies','courts-legal-companies','corporate-tax','mohre-company-registration','labor-employment','residency-individuals','emirates-id','ejari-individuals','notary-individuals','courts-individuals','legal-translation-individuals','attestation-individuals','rta-individuals','family-sponsorship','residency-fines','company-formation','trade-licenses','customs','notary-companies','legal-translation-companies','license-renewal','license-amendments','work-permits','wage-protection'];
const expected = new Set(approved);
const ids=Object.keys(manifest.metadata||{});
if(ids.length!==30||ids.some(id=>!expected.has(id))) throw Error('Approved asset inventory mismatch: expected exactly 30 banner roles');
const target=path.join(root,'assets','approved_banners');fs.mkdirSync(target,{recursive:true});
let count=0;let out="import type {ImageSourcePropType} from 'react-native';\n\n";
out+="type Language='ar'|'en';\ntype BannerSet=Partial<Record<Language|'bilingual',ImageSourcePropType>>;\n";
out+="const REGISTRY:Record<string,BannerSet>={\n";
for(const id of ids){
 const variants=manifest.metadata[id],parts=[];
 if(id==='commercial-ejari')throw Error('Commercial Ejari has no separately approved image: do not substitute');
 for(const lang of ['bilingual','ar','en']){
  if(!variants[lang])continue;
  const rel=variants[lang].path;
  const file=path.resolve(source,rel);
  if(!file.startsWith(source+path.sep)||!fs.existsSync(file)||!file.endsWith('.webp'))throw Error('Invalid asset '+rel);
  const buffer=fs.readFileSync(file);
  if(buffer.length<1000 || buffer.toString('ascii',0,4)!=='RIFF' || buffer.toString('ascii',8,12)!=='WEBP')throw Error('Invalid WebP '+rel);
  const dst=path.join(target,lang,id+'.webp');
  fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,buffer);
  parts.push(lang+":require('../assets/approved_banners/"+lang+"/"+id+".webp')");
  count++;
 }
 out+="  "+JSON.stringify(id)+":{"+parts.join(',')+"},\n";
}
out+="};\nexport const approvedBannerFor=(id:string,lang:Language):ImageSourcePropType|undefined=>REGISTRY[id]?.[lang]??REGISTRY[id]?.bilingual;\nexport const approvedBannerCount=()=>Object.keys(REGISTRY).length;\n";
fs.writeFileSync(path.join(root,'src','approvedBanners.ts'),out);
console.log('Installed',count,'approved WebP cut-outs across',ids.length,'roles (29 actual service IDs + category), requires generated; 1 service missing independent approved art.');

