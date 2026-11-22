// Prices shown before a request starts must be owner-approved, sane, and belong to real services (no dummy fees).
import assert from 'node:assert/strict';
import {catalogueServices} from '../src/services.ts';
import {PRICE_GUIDE,formatRange} from '../src/priceGuide.ts';

for(const [id,g] of Object.entries(PRICE_GUIDE)){
  assert.ok(catalogueServices.some(s=>s.id===id),`${id}: not a real service`);
  assert.ok(g.approvedBy.trim().length>1,`${id}: owner approval (name) is required before a price can be shown`);
  assert.match(g.approvedOn,/^20\d\d-\d\d-\d\d$/,`${id}: approval date YYYY-MM-DD`);
  assert.ok(g.government||g.service,`${id}: at least one range`);
  for(const r of [g.government,g.service])if(r){assert.ok(Number.isInteger(r[0])&&Number.isInteger(r[1])&&r[0]>0&&r[0]<=r[1],`${id}: bad range ${r}`)}
}
assert.equal(formatRange([300,1200]),'300 – 1,200');
assert.equal(formatRange([500,500]),'500');
console.log(`PASS: price guide (${Object.keys(PRICE_GUIDE).length} owner-approved ranges; none shown otherwise).`);
