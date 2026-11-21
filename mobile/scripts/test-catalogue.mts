// The unified catalogue must cover every public service exactly once, with bilingual names.
import assert from 'node:assert/strict';
import {catalogueServices,catalogueServiceId} from '../src/services.ts';
import {CATEGORIES,branchesFor,categoriesFor,locate} from '../src/catalogue/categories.ts';

const seen=new Map<string,string>();
for(const c of CATEGORIES){
  assert.ok(c.title.ar&&c.title.en&&c.desc.ar&&c.desc.en,`${c.id}: bilingual title and description`);
  for(const business of [false,true])for(const br of branchesFor(c,business)){
    assert.ok(!seen.has(br.serviceId),`${br.serviceId} appears twice (${seen.get(br.serviceId)} and ${c.id})`);
    seen.set(br.serviceId,c.id);
    const s=catalogueServices.find(x=>x.id===br.serviceId);
    assert.ok(s,`${c.id}: unknown service ${br.serviceId}`);
    assert.equal(s!.business,business,`${br.serviceId} is listed under the wrong audience`);
    assert.ok(br.title.ar&&br.title.en&&br.desc.ar&&br.desc.en,`${br.serviceId}: bilingual branch text`);
  }
}
for(const s of catalogueServices)assert.ok(seen.has(s.id),`${s.id} is missing from the unified catalogue`);
for(const old of ['ejari-companies','license-renewal','license-amendments','moa-amendments','work-permits'])
  assert.equal(locate(old)?.branch.serviceId,catalogueServiceId(old),`historical id ${old} must still resolve`);
// Shared services keep one name in both tabs.
const shared=CATEGORIES.filter(c=>c.individuals.length&&c.companies.length).map(c=>c.id);
for(const id of shared)assert.ok(categoriesFor(false).some(c=>c.id===id)&&categoriesFor(true).some(c=>c.id===id));
console.log(`PASS: unified catalogue (${CATEGORIES.length} main services, ${seen.size} branches, ${shared.length} shared by both audiences).`);
