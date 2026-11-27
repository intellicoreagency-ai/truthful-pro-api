// اختبار منطق قراءة رجوع المزوّد وتمييز الإلغاء (بلا أجهزة): node --experimental-strip-types oauth-parse.test.mts
import assert from 'node:assert/strict';
import { isUserCancel, parseCallback } from '../../apps/customer/src/lib/oauthParse.ts';

// نجاح: code في الاستعلام
assert.deepEqual(parseCallback('mohra://auth/callback?code=abc123'), { code: 'abc123', error: undefined });
// إلغاء/رفض من المزوّد (في الاستعلام)
const denied = parseCallback('mohra://auth/callback?error=access_denied&error_description=User+denied+access');
assert.equal(denied.code, undefined);
assert.ok(denied.error && isUserCancel(denied.error));
// خطأ في الـfragment
const frag = parseCallback('mohra://auth/callback#error=server_error&error_description=boom');
assert.equal(frag.error, 'boom');
assert.equal(isUserCancel('boom'), false);
// لا code ولا خطأ
assert.deepEqual(parseCallback('mohra://auth/callback'), { code: undefined, error: undefined });
console.log('oauth-parse: 5 checks passed');
