// Pure checks for the auth helpers: country code + number, pasted international numbers, UAE mobile rule, email.
import assert from 'node:assert/strict';
import {PHONE_PREFIX,e164From,localPhone,splitInternational,toE164,isEmail} from '../src/auth/phone.ts';
import {COUNTRIES,DEFAULT_COUNTRY,flagOf} from '../src/auth/countries.ts';

assert.equal(PHONE_PREFIX,'+971');assert.equal(DEFAULT_COUNTRY.iso,'AE');assert.equal(flagOf('AE'),'🇦🇪');
assert.equal(new Set(COUNTRIES.map(c=>c.iso)).size,COUNTRIES.length,'no duplicate countries');
for(const c of COUNTRIES)assert.ok(/^[1-9]\d{0,3}$/.test(c.dial)&&c.en&&c.ar,c.iso);
// UAE (default): mobiles only, whatever way the local part is typed
for(const typed of ['0501234567','501234567','٠٥٠١٢٣٤٥٦٧','050-123-4567'])assert.equal(e164From('971',typed),'+971501234567',typed);
for(const bad of ['','5','0401234567','05012345'])assert.equal(e164From('971',bad),null,bad);
// other countries: code first, then the number
assert.equal(e164From('86','13800138000'),'+8613800138000','China');
assert.equal(e164From('7','9161234567'),'+79161234567','Russia');
assert.equal(e164From('44','07911123456'),'+447911123456','UK, leading trunk 0 dropped');
assert.equal(e164From('966','0501234567'),'+966501234567','Saudi');
assert.equal(e164From('1','123'),null,'too short');
assert.equal(e164From('86','1380013800012345'),null,'over 15 digits');
// pasting a full international number picks the code
assert.deepEqual(splitInternational('+86 138 0013 8000'),{dial:'86',local:'13800138000'});
assert.deepEqual(splitInternational('0044 7911 123456'),{dial:'44',local:'7911123456'});
assert.deepEqual(splitInternational('+971 50 123 4567'),{dial:'971',local:'501234567'});
assert.equal(splitInternational('0501234567'),null,'a local number is not international');
assert.equal(localPhone('+971 50 123 4567','971'),'501234567');
// free-text numbers in request forms
for(const [input,want] of [['0501234567','+971501234567'],['+971 50 123 4567','+971501234567'],['00971501234567','+971501234567'],['+86 138 0013 8000','+8613800138000'],['+7 916 123 45 67','+79161234567']] as const)assert.equal(toE164(input),want,input);
for(const bad of ['','0401234567','abc','+97145551234'])assert.equal(toE164(bad),null,bad);
for(const ok of ['a@b.co','name.surname@example.com'])assert.ok(isEmail(ok),ok);
for(const bad of ['','a@b','a b@c.com','a@@b.com','<x>@b.com'])assert.ok(!isEmail(bad),bad);
console.log(`PASS: phone numbers with a country code (${COUNTRIES.length} countries; UAE mobiles enforced), pasted international numbers, email.`);
