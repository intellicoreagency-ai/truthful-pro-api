// Run with: node scripts/test-sync-map.mts  (Node 22+ strips types)
import assert from 'node:assert/strict';
import {toClientRequest,missingIdFor,isServerId,holdsUpload} from '../src/syncMap.ts';

const U='11111111-1111-4111-8111-111111111111',F1='22222222-2222-4222-8222-222222222222',F2='33333333-3333-4333-8333-333333333333',M1='44444444-4444-4444-8444-444444444444';
const row=(over:any={})=>({id:U,service_id:'emirates-id',status:'submitted',data:JSON.stringify({name:'Ali',title:{ar:'تجديد',en:'Renew'},actionId:'renew-id',fields:{a:'1'},fileLabels:{[F1]:{label:{ar:'جواز',en:'Passport'},kind:'source',name:'p.pdf'}}}),staff_data:'{}',renewal_of:null,created_at:1_700_000_000_000,updated_at:1_700_000_100_000,...over});
const file=(id:string,o:any={})=>({id,name:'f.pdf',mime:'application/pdf',size:10,kind:'source',label:null,created_at:1_700_000_050_000,...o});

// 1. A request made on another device is rebuilt from the server.
let r=toClientRequest(row(),{files:[file(F1)]});
assert.equal(r.remoteId,U);assert.equal(r.status,'submitted');assert.equal(r.stage,1);assert.equal(r.name,'Ali');
assert.deepEqual(r.files[0].label,{ar:'جواز',en:'Passport'},'source file keeps the label the customer chose');
assert.equal(r.money.quoted,false);

// 2. Staff status, expected date, timeline and requested documents reach the customer.
r=toClientRequest(row({status:'needs_documents',staff_data:JSON.stringify({expectedAt:'2026-12-01'})}),{
  files:[file(F1)],
  events:[{id:'e1',text_ar:'قيد المراجعة',text_en:'Under review',created_at:1_700_000_060_000},{id:'e2',text_ar:'طُلب استكمال مستندات',text_en:'Additional documents requested',created_at:1_700_000_070_000}],
  missing:[{id:M1,label_ar:'صورة الإقامة',label_en:'Residence copy',note_ar:'غير واضحة',note_en:'Unclear',replacement_file_id:null,resolved_at:null}]});
assert.equal(r.status,'needs_documents');assert.equal(r.stage,2);
assert.equal(r.events.length,2);assert.equal(r.events[1].text.en,'Additional documents requested');
assert.equal(r.missing.length,1);assert.deepEqual(r.missing[0].label,{ar:'صورة الإقامة',en:'Residence copy'});assert.equal(r.missing[0].replacement,undefined);
assert.ok(r.expectedAt&&r.expectedAt.startsWith('2026-11-30T20:00'),'expected date is midnight in Dubai (UTC+4)');

// 3. A replacement chosen on the phone but not uploaded yet is kept, and knows which request it answers.
const local={...r,files:[...r.files,{id:'loc-1',name:'res.jpg',mime:'image/jpeg',size:5,kind:'source' as const,label:{ar:'x',en:'x'},createdAt:'2026-11-20T00:00:00Z'}],missing:[{...r.missing[0],replacement:'loc-1'}]};
let r2=toClientRequest(row({status:'needs_documents'}),{files:[file(F1)],missing:[{id:M1,label_ar:'ا',label_en:'a',note_ar:'',note_en:'',replacement_file_id:null,resolved_at:null}]},local);
assert.equal(r2.missing[0].replacement,'loc-1');assert.ok(r2.files.some(f=>f.id==='loc-1'&&!f.remoteId));
assert.equal(missingIdFor(local,'loc-1'),M1);assert.equal(missingIdFor(local,'other'),undefined);
assert.equal(missingIdFor({...local,missing:[{...local.missing[0],id:'m-local'}]},'loc-1'),undefined,'only server ids are sent');

// 3b. While the request still needs documents the answer is held; pressing Send (status review) releases it.
assert.equal(holdsUpload(local,local.files.find(f=>f.id==='loc-1')!),true);
assert.equal(holdsUpload({...local,status:'review'},local.files.find(f=>f.id==='loc-1')!),false);
assert.equal(holdsUpload(local,local.files[0]!),false,'ordinary files are never held');

// 4. After upload the server resolves it; the local file id stays the one the app already knows.
const uploaded={...local,files:local.files.map(f=>f.id==='loc-1'?{...f,remoteId:F2}:f)};
r2=toClientRequest(row({status:'review'}),{files:[file(F1),file(F2)],missing:[{id:M1,label_ar:'ا',label_en:'a',note_ar:'',note_en:'',replacement_file_id:F2,resolved_at:1}]},uploaded);
assert.equal(r2.status,'review');assert.equal(r2.missing[0].replacement,'loc-1');assert.equal(r2.files.filter(f=>f.remoteId===F2).length,1);

// 4b. A file the customer's other device uploaded is referenced by its server id.
r2=toClientRequest(row({status:'review'}),{files:[file(F1),file(F2)],missing:[{id:M1,label_ar:'ا',label_en:'a',note_ar:'',note_en:'',replacement_file_id:F2,resolved_at:1}]});
assert.equal(r2.missing[0].replacement,F2);

// 5. Delivery: completed + a final file => delivered with the staff label; no final => not delivered; reopening clears it.
const done=toClientRequest(row({status:'completed',staff_data:JSON.stringify({completedAt:'2026-12-02T08:00:00.000Z'})}),{files:[file(F1),file(F2,{kind:'final',label:'Emirates ID (final)',name:'id.pdf'})]});
assert.equal(done.stage,5);assert.equal(done.completedAt,'2026-12-02T08:00:00.000Z');assert.equal(done.deliveredAt,'2026-12-02T08:00:00.000Z');
const fin=done.files.find(f=>f.kind==='final')!;assert.equal(fin.label.en,'Emirates ID (final)');
const noFinal=toClientRequest(row({status:'completed'}),{files:[file(F1)]});assert.equal(noFinal.deliveredAt,undefined);assert.ok(noFinal.completedAt);
const reopened=toClientRequest(row({status:'review'}),{files:[file(F1),file(F2,{kind:'final'})]},done);
assert.equal(reopened.completedAt,undefined);assert.equal(reopened.deliveredAt,undefined);

// 6. Rejection reason from staff is shown.
assert.equal(toClientRequest(row({status:'rejected',staff_data:JSON.stringify({issue:'Expired passport'})}),{files:[]}).issue,'Expired passport');

assert.ok(isServerId(U));assert.ok(!isServerId('abc-123'));
console.log('PASS: server-to-app mapping (status, timeline, requested documents, delivery, dates, pending uploads).');
