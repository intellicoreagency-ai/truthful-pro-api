// Service search must be forgiving: partial words, Arabic spelling variants, categories and sub-services.
import assert from 'node:assert/strict';
import {catalogueServices} from '../src/services.ts';
import {matchesService,normalize} from '../src/search.ts';

const hits=(q:string,lang:'ar'|'en'='ar',business?:boolean)=>catalogueServices.filter(s=>(business===undefined||s.business===business)&&matchesService(s,q,lang)).map(s=>s.id);

assert.equal(normalize('الإِقَامَة'),'الاقامه');
assert.equal(normalize('Résidence'),'residence');
assert.equal(normalize('٢٠٢٦'),'2026');
for(const q of ['اقامة','إقامة','الإقامة','اقامه','اقا','إقامَة'])assert.ok(hits(q,'ar',false).length>0,`"${q}" finds individual residency services`);
assert.deepEqual(hits('اقامة'),hits('الإقامة'),'with and without the article give the same results');
assert.ok(hits('residency','en',false).length>0,'English word finds residency');
assert.ok(hits('اقامة','en',false).length>0,'Arabic query works while the app is in English');
assert.ok(hits('فيزا','ar').length>0,'everyday word "فيزا" finds visa services');
assert.ok(hits('هوية').length>0,'Emirates ID found');
assert.ok(hits('ايجاري').length>0,'Ejari found (category name)');
assert.equal(hits('').length,catalogueServices.length,'empty query keeps everything');
assert.equal(hits('zzzz-no-such-service').length,0,'nonsense finds nothing');
console.log(`PASS: search finds services from partial and variant spellings (اقامة → ${hits('اقامة').length} services).`);
