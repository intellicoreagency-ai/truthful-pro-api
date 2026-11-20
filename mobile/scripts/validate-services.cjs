/* Offline test gate for every service in the bilingual Expo catalogue.
   Compiles the TS source locally and asserts data completeness without customer access. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
function load(relative,localRequire=()=>{throw Error('unexpected import');}) {
  const file=path.join(__dirname,'..',relative);
  const source=fs.readFileSync(file,'utf8');
  const result=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  const module={exports:{}};
  const run=new Function('require','module','exports',result.outputText);
  run(localRequire,module,module.exports);
  return module.exports;
}
const services=load('src/services.ts');
const details=load('src/serviceDetails.ts',id=> {
 if(id==='./services')return services;
 throw Error('Unknown internal import '+id);
});
const items=services.SERVICES,records=details.SERVICE_STRUCTURES;
assert.equal(items.length,30,'The approved 30-service catalogue cannot lose services');
assert.equal(items.filter(x=>x.business).length,20,'20 companies services');
assert.equal(items.filter(x=>!x.business).length,10,'10 individual services');
assert.equal(new Set(items.map(x=>x.id)).size,30,'Service identifiers must not repeat');
assert.equal(Object.keys(records).length,30,'Each service must have a structured detail record');
for(const service of items){
  for(const key of ['id','ar','en','descAr','descEn','slug'])assert.ok(service[key].trim(),'Empty '+service.id+'.'+key);
  const d=records[service.id];
  assert.ok(d,'Missing detail '+service.id);
  assert.equal(d.id,service.id);
  assert.ok(d.about.ar&&d.about.en,'Missing bilingual about '+service.id);
  assert.ok(d.actions.length,'Missing transaction/action '+service.id);
  assert.ok(d.notes.length,'Missing case-dependent note '+service.id);
  assert.equal(d.feeStatus,'not-verified');
  assert.equal(new Set(d.actions.map(action=>action.id)).size,d.actions.length,'Duplicate transaction IDs for '+service.id);
  for(const action of d.actions){
    assert.ok(action.id&&action.ar&&action.en&&action.icon,'Incomplete bilingual action '+service.id);
    assert.equal(new Set(action.documents.map(doc=>doc.id)).size,action.documents.length);
    for(const doc of action.documents)assert.ok(d.documents.includes(doc),'Document outside service catalog: '+service.id+'/'+action.id);
  }
  for(const doc of d.documents)assert.ok(doc.id&&doc.ar&&doc.en,'Untranslated document '+service.id);
  for(const note of d.notes)assert.ok(note.ar&&note.en,'Untranslated note '+service.id);
  if(d.contentStatus==='reference')assert.ok(d.sourcePages.length,'Missing source page '+service.id);
  assert.ok(['reference','review-required'].includes(d.contentStatus));
}
const app=fs.readFileSync(path.join(__dirname,'..','App.tsx'),'utf8');
assert.ok(app.includes("ar?'row-reverse':'row'"),'Arabic RTL and English LTR rows must be explicit');
assert.ok(app.includes("const arrow=ar?'‹':'›'"),'Forward arrows must mirror by locale');
assert.ok(app.includes("ar?'next':'back'"),'Back arrows must mirror by locale');
assert.ok(app.includes('structureFor(chosen.id)'), 'Selected service must drive all detail content');
assert.ok(app.includes("onPress={switchLang}"),'Language toggle missing');
const publicIds=services.catalogueServices.map(service=>service.id);
assert.equal(publicIds.length,24);
assert.ok(!publicIds.includes('complete-business'));
assert.equal(publicIds.filter(id=>id.includes('ejari')&&records[id].id!=='ejari-individuals').join(','),'commercial-ejari');
for(const alias of ['license-renewal','license-amendments','moa-amendments']){
  assert.equal(services.catalogueServiceId(alias),'trade-licenses');
  assert.ok(!publicIds.includes(alias)&&records[alias]);
}
const setupIds=records['company-formation'].actions.map(action=>action.id);
const licenceIds=records['trade-licenses'].actions.map(action=>action.id);
assert.ok(setupIds.includes('issue-licence')&&!licenceIds.includes('issue-licence'));
for(const id of ['renew-licence','amend-moa','add-partner','remove-partner','amend-trade-name','transfer-shares','amend-capital']){
  assert.ok(licenceIds.includes(id)&&!setupIds.includes(id),id);
}
assert.ok(Object.keys(details.tradeLicenceSectionTitles).every(id=>licenceIds.includes(id)));
assert.equal(services.catalogueServiceId('work-permits'),'labor-employment');
assert.ok(!publicIds.includes('work-permits')&&publicIds.includes('labor-employment'));
const laborActions=records['labor-employment'].actions;
for(const action of records['work-permits'].actions){
  const merged=laborActions.find(item=>item.id===action.id);
  assert.ok(merged&&action.documents.every(doc=>merged.documents.some(item=>item.id===doc.id)),
    'Missing work permit action or document in labor services: '+action.id);
}
const permit=records['work-permits'].actions;
const docsFor=(actions,id)=>actions.find(action=>action.id===id).documents.map(doc=>doc.id);
assert.deepEqual(docsFor(permit,'issue-permit'),['licence','passport','offer']);
assert.deepEqual(docsFor(permit,'renew-permit'),['licence','passport','permit']);
assert.ok(records['legal-translation-individuals'].actions.every(action=>action.documents.some(doc=>doc.field==='text')));
assert.ok(records['wage-protection'].actions.every(action=>!action.id.includes('permit')));
assert.deepEqual(docsFor(records['family-sponsorship'].actions,'review-eligibility'),[]);
assert.ok(app.includes('detail.actions.map'), 'Selected service actions missing');
assert.ok(app.includes('detail.notes.map'), 'Selected service notes missing');
assert.ok(app.includes('allowRealSubmission=false'),'Prototype submission must remain disabled');
const rejectedDirectory=path.join(__dirname,'..','assets','service_banners');
assert.ok(!fs.existsSync(rejectedDirectory)||
  fs.readdirSync(rejectedDirectory).filter(x=>/\.(webp|png|jpg|jpeg)$/i.test(x)).length===0,
  'Rejected historical service images must not be bundled');
assert.ok(!app.includes("require('./assets/service_banners/"),
  'All rejected banner requires must stay disconnected');
assert.ok(app.includes('REJECTED_ASSET_QUARANTINE'),
  'Rejection gate must be explicit until approved assets are delivered');
const counts={reference:items.filter(s=>records[s.id].contentStatus==='reference').length,reviewRequired:items.filter(s=>records[s.id].contentStatus==='review-required').length};
console.log('PASS: all 30 structured bilingual services, contextual tabs, safe preview and RTL/LTR invariants',counts);


