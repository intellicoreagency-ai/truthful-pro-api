// Pure checks for the auth helpers (phone normalisation, email validation). Run: node scripts/test-auth-phone.mts
import assert from 'node:assert/strict';
import {PHONE_PREFIX,localPhone,toE164,isEmail} from '../src/auth/phone.ts';
assert.equal(PHONE_PREFIX,'+971','the field shows the UAE country code as a fixed label');
// whatever is typed or pasted becomes the local part after +971
for(const [typed,local] of [['0501234567','501234567'],['501234567','501234567'],['+971 50 123 4567','501234567'],['00971501234567','501234567'],['971501234567','501234567'],['٠٥٠١٢٣٤٥٦٧','501234567'],['05012345678999','501234567'],['','']] as const){
  assert.equal(localPhone(typed),local,typed);
  if(local)assert.equal(toE164(PHONE_PREFIX+localPhone(typed)),'+971501234567',typed);
}
for(const [input,want] of [['0501234567','+971501234567'],['501234567','+971501234567'],['971501234567','+971501234567'],['+971 50 123 4567','+971501234567'],['٠٥٠١٢٣٤٥٦٧','+971501234567'],['050-123-4567','+971501234567'],['+971 501234567','+971501234567'],['+971 0501234567','+971501234567'],['00971501234567','+971501234567'],['+٩٧١ ٥٠١٢٣٤٥٦٧','+971501234567']] as const)assert.equal(toE164(input),want,input);
for(const bad of ['+971 ','+971 5','0401234567','05012345','050123456789','abc','+442071234567','0601234567'])assert.equal(toE164(bad),null,bad);
for(const ok of ['a@b.co','name.surname@example.com'])assert.ok(isEmail(ok),ok);
for(const bad of ['+971 ','+971 5','a@b','a b@c.com','a@@b.com','<x>@b.com'])assert.ok(!isEmail(bad),bad);
console.log('PASS: phone normalisation (Latin and Arabic-Indic digits) and email validation.');
