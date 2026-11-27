// اختبار قواعد العمل على Postgres حقيقي (PGlite): المال، الصلاحيات، الإيقاف الآلي.
// التشغيل: npm test
import { PGlite } from '@electric-sql/pglite';
import { randomUUID as uuid } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite();

// ── تحميل المخطط ──
await db.exec(readFileSync(join(root, 'tests/stub.sql'), 'utf8'));
for (const f of readdirSync(join(root, 'migrations')).sort()) await db.exec(readFileSync(join(root, 'migrations', f), 'utf8'));
await db.exec(readFileSync(join(root, 'seed.sql'), 'utf8'));
await db.exec('grant all on all tables in schema public to service_role; grant all on all sequences in schema public to service_role;');

// ── أدوات ──
let passed = 0;
const failures = [];
const check = (name, ok, extra = '') => {
  if (ok) passed++;
  else failures.push(`${name} ${extra}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`);
};
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];

async function as(uid, fn) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try { return await fn(); } finally { await db.exec('reset role;'); }
}
async function svc(fn) {
  await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role service_role;`);
  try { return await fn(); } finally { await db.exec('reset role;'); }
}
async function fails(name, fn, pattern) {
  try { await fn(); check(name, false, '(expected an error, none raised)'); }
  catch (e) { check(name, pattern.test(e.message), `(got: ${e.message.slice(0, 120)})`); }
}

// ── بيانات ──
const U = { cust: uuid(), cust2: uuid(), owner: uuid(), fin: uuid(), rev: uuid(), sup: uuid() };
const P = [0, 1, 2, 3].map(() => ({ user: uuid(), id: uuid() }));
for (const id of [...Object.values(U), ...P.map((p) => p.user)]) await db.query('insert into auth.users (id) values ($1)', [id]);
for (const [k, role] of [['owner', 'owner'], ['fin', 'finance'], ['rev', 'reviewer'], ['sup', 'support']])
  await db.query('insert into staff (user_id, role) values ($1, $2)', [U[k], role]);
await db.query(`insert into customers (id, phone, whatsapp) values ($1,'+971500000001','+971500000001'), ($2,'+971500000002','+971500000002')`, [U.cust, U.cust2]);
for (const [i, p] of P.entries()) {
  await db.query(`insert into providers (id, user_id, company_name, phone, whatsapp, maps_url) values ($1,$2,$3,'+97150000010'||$4,'+97150000010'||$4,'https://maps.example/'||$4)`, [p.id, p.user, `مزود ${i + 1}`, String(i)]);
  await db.query(`insert into provider_categories values ($1,'car_tow')`, [p.id]);
  await db.query(`insert into provider_coverage values ($1,'dubai')`, [p.id]);
}

console.log('\n— وثائق المزود واعتماده —');
const ready0 = await one('select dot, missing from provider_readiness where provider_id = $1', [P[0].id]);
check('نقطة حمراء قبل رفع الوثائق', ready0.dot === 'red' && ready0.missing.includes('trade_license'));
await as(P[0].user, async () => {
  await db.query(`insert into provider_documents (provider_id, kind, storage_path) values ($1,'trade_license','p/tl.pdf'), ($1,'tenancy_contract','p/tc.pdf')`, [P[0].id]);
});
check('نقطة خضراء بعد رفع الوثائق', (await one('select dot from provider_readiness where provider_id = $1', [P[0].id])).dot === 'green');
await fails('لا اعتماد قبل قبول الوثائق', () => as(U.owner, () => db.query(`select staff_set_provider_status($1,'approved','ok')`, [P[0].id])), /missing/);
const docs = await q('select id from provider_documents where provider_id = $1', [P[0].id]);
await as(U.rev, async () => { for (const d of docs) await db.query('select staff_review_document($1, true)', [d.id]); });
await as(U.owner, () => db.query(`select staff_set_provider_status($1,'approved','docs ok')`, [P[0].id]));
check('اعتماد بعد قبول الوثائق', (await one('select status from providers where id = $1', [P[0].id])).status === 'approved');
await fails('المزود لا يغيّر حالته بنفسه', () => as(P[1].user, () => db.query(`update providers set status = 'approved' where id = $1`, [P[1].id])), /permission denied/);
await fails('الدعم لا يراجع الوثائق', () => as(U.sup, () => db.query('select staff_review_document($1, true)', [docs[0].id])), /not allowed/);
for (const p of P.slice(1)) {
  await db.query(`insert into provider_documents (provider_id, kind, storage_path, status) values ($1,'trade_license','x','accepted'), ($1,'tenancy_contract','y','accepted')`, [p.id]);
  await db.query(`update providers set status = 'approved' where id = $1`, [p.id]);
}

// ── مساعد: طلب ← مزودون ← عرض ← قبول ──
async function newRequest(customer = U.cust) {
  return as(customer, async () => (await one(`insert into requests (customer_id, agent_id, category_id, title, emirate) values ($1,'jalal','car_tow','سطحة','dubai') returning id`, [customer])).id);
}
async function makeAcceptedJob(providerIdx, price) {
  const rid = await newRequest();
  await svc(() => db.query('select dispatch_request($1, 6)', [rid]));
  const off = await as(P[providerIdx].user, async () => (await one(`insert into offers (request_id, provider_id, provider_price_fils) values ($1,$2,$3) returning id, customer_price_fils, commission_fils`, [rid, P[providerIdx].id, price])));
  const jobId = await as(U.cust, async () => (await one(`select accept_offer($1, 'cash') as id`, [off.id])).id);
  return { rid, jobId, off };
}

console.log('\n— حقول المزود الناقصة (كل فرع) —');
const bare = uuid();
await db.query(`insert into providers (id, company_name) values ($1, 'مزود فارغ')`, [bare]);
const miss = (await one('select missing from provider_readiness where provider_id = $1', [bare])).missing;
check('كل العناصر الناقصة تُرصد', ['phone', 'whatsapp', 'maps_url', 'categories', 'coverage', 'trade_license', 'tenancy_contract'].every((k) => miss.includes(k)), JSON.stringify(miss));
await db.query(`update providers set phone = '+971500000999', maps_url = 'https://maps.example/x' where id = $1`, [bare]);
const miss2 = (await one('select missing from provider_readiness where provider_id = $1', [bare])).missing;
check('الواتساب وحده ناقص يُرصد دون خطأ', miss2.includes('whatsapp') && !miss2.includes('phone') && !miss2.includes('maps_url'), JSON.stringify(miss2));
await db.query('delete from providers where id = $1', [bare]);

console.log('\n— الطلب والعروض —');
const rid = await newRequest();
const n = await svc(async () => (await one('select dispatch_request($1, 6) as n', [rid])).n);
check('الطلب يُرسل لكل المزودين المعتمدين المطابقين', n === 4, `(got ${n})`);
check('حالة الطلب rfq_sent', (await one('select status from requests where id = $1', [rid])).status === 'rfq_sent');

const offer = async (i, price) => as(P[i].user, async () => one(`insert into offers (request_id, provider_id, provider_price_fils) values ($1,$2,$3) returning id, customer_price_fils, commission_fils`, [rid, P[i].id, price]));
const o1 = await offer(0, 15000);
check('السعر النهائي = السعر × 1.2 (150 ← 180)', Number(o1.customer_price_fils) === 18000 && Number(o1.commission_fils) === 3000);
const o2 = await offer(1, 13000);
const o3 = await offer(2, 18000);
check('عرض 13000 ← 15600', (await one('select customer_price_fils c from offers where id = $1', [o2.id])).c == 15600);
await fails('لا عرض رابع (الحد 3)', () => offer(3, 14000), /maximum of 3/);
await fails('المزود لا يحدد العمولة بنفسه', () => as(P[3].user, () => db.query(`insert into offers (request_id, provider_id, provider_price_fils, commission_fils, customer_price_fils) values ($1,$2,1000,0,1000)`, [rid, P[3].id])), /permission denied/);

console.log('\n— خصوصية العميل —');
const direct = await as(U.cust, () => q('select * from offers'));
check('العميل لا يقرأ جدول العروض (سعر المزود/العمولة)', direct.length === 0);
const view = await as(U.cust, () => q('select * from customer_offers where request_id = $1', [rid]));
check('العميل يرى 3 عروض بالسعر النهائي فقط', view.length === 3 && !('provider_price_fils' in view[0]) && !('commission_fils' in view[0]));
check('عميل آخر لا يرى العروض', (await as(U.cust2, () => q('select * from customer_offers'))).length === 0);
check('رقم المزود مخفي قبل القبول', (await as(U.cust, () => q('select * from accepted_provider_contact($1)', [rid]))).length === 0);

console.log('\n— قبول العرض —');
await fails('عميل آخر لا يقبل عرضاً', () => as(U.cust2, () => db.query(`select accept_offer($1,'card')`, [o1.id])), /not your request/);
const jobId = await as(U.cust, async () => (await one(`select accept_offer($1,'card') as id`, [o1.id])).id);
const st = await q('select status, count(*)::int n from offers where request_id = $1 group by status order by status', [rid]);
check('عرض مقبول وعرضان مغلقان آلياً', st.find((x) => x.status === 'accepted')?.n === 1 && st.find((x) => x.status === 'closed')?.n === 2, JSON.stringify(st));
check('طلبات بقية المزودين أُغلقت (عدا الفائز)', (await q(`select 1 from request_dispatches where request_id = $1 and provider_id <> $2 and status in ('sent','offered')`, [rid, P[0].id])).length === 0);
await fails('لا قبول ثانٍ', () => as(U.cust, () => db.query(`select accept_offer($1,'card')`, [o2.id])), /not open for acceptance/);
const contact = await as(U.cust, () => q('select phone from accepted_provider_contact($1)', [rid]));
check('رقم المزود يظهر بعد القبول', contact.length === 1 && !!contact[0].phone);
await fails('مزود مغلق لا يستطيع إرسال عرض', () => as(P[3].user, () => db.query(`insert into offers (request_id, provider_id, provider_price_fils) values ($1,$2,1000)`, [rid, P[3].id])), /not accepting offers/);

console.log('\n— الدفعات والعمولة (20% على كل دفعة محصَّلة) —');
await as(P[0].user, () => db.query(`select provider_set_job_status($1,'in_progress')`, [jobId]));
await as(P[0].user, () => db.query('select record_payment($1, 6000)', [jobId]));
await as(P[0].user, () => db.query('select record_payment($1, 12000)', [jobId]));
const comms = await q('select amount_fils, due_on from commissions where job_id = $1 order by created_at', [jobId]);
check('دفعة 6000 ← عمولة 1000', Number(comms[0].amount_fils) === 1000);
check('مجموع العمولات = عمولة العرض بالضبط (3000)', comms.reduce((a, c) => a + Number(c.amount_fils), 0) === 3000);
await fails('لا تحصيل فوق السعر المتفق', () => as(P[0].user, () => db.query('select record_payment($1, 1)', [jobId])), /exceed/);
const due = new Date((await one('select due_on from commissions where job_id = $1 limit 1', [jobId])).due_on);
check('موعد الاستحقاق يوم عمل بعد اليوم', ![0, 6].includes(due.getUTCDay()) && due > new Date());
await as(P[0].user, () => db.query(`select provider_set_job_status($1,'completed')`, [jobId]));
check('إنجاز العمل يُنهي الطلب', (await one('select status from requests where id = $1', [rid])).status === 'done');
await as(U.cust, () => db.query('select rate_job($1, 5::smallint)', [jobId]));
check('التقييم يحدّث متوسط المزود', Number((await one('select rating_avg from providers where id = $1', [P[0].id])).rating_avg) === 5);
check('المزود لا يرى عمولات غيره', (await as(P[1].user, () => q('select * from commissions'))).length === 0);

console.log('\n— إثبات التحويل والمسح الآلي —');
const ids = comms.length ? (await q('select id from commissions where job_id = $1', [jobId])).map((r) => r.id) : [];
await fails('المبلغ المصرَّح به يجب أن يطابق العمولات', () => as(P[0].user, () => db.query(`select submit_commission_proof($1::uuid[], 'p/proof.png', 2999, 'REF1', current_date)`, [ids])), /must equal/);
const proof = await as(P[0].user, async () => (await one(`select submit_commission_proof($1::uuid[], 'p/proof.png', 3000, 'REF1', current_date) as id`, [ids])).id);
check('العمولات «إثبات مرفوع»', (await q(`select 1 from commissions where status = 'proof_uploaded' and job_id = $1`, [jobId])).length === 2);
const m = await svc(async () => (await one(`select apply_proof_ocr($1, '{"amount_fils":3000,"iban_match":true,"reference":"REF1"}'::jsonb) as m`, [proof])).m);
check('مطابقة كاملة ← مدفوعة آلياً', m === 'matched' && (await q(`select 1 from commissions where status = 'paid' and marked_by = 'auto' and job_id = $1`, [jobId])).length === 2);
const vat = await one('select sum(vat_fils)::int v from vat_ledger');
check('مخصصات الضريبة 5% (50 + 100)', vat.v === 150, `(got ${vat.v})`);
check('الدعم لا يرى مخصصات الضريبة', (await as(U.sup, () => q('select * from vat_ledger'))).length === 0);

console.log('\n— عدم المطابقة والمراجعة اليدوية —');
const j2 = await makeAcceptedJob(1, 20000);
await as(P[1].user, () => db.query('select record_payment($1, $2)', [j2.jobId, Number(j2.off.customer_price_fils)]));
const c2 = (await q('select id, amount_fils from commissions where job_id = $1', [j2.jobId]));
check('عمولة دفعة كاملة = 4000', Number(c2[0].amount_fils) === 4000);
const pr2 = await as(P[1].user, async () => (await one(`select submit_commission_proof($1::uuid[], 'p/2.png', 4000, 'REF2', current_date) as id`, [[c2[0].id]])).id);
const m2 = await svc(async () => (await one(`select apply_proof_ocr($1, '{"amount_fils":4000,"iban_match":false,"reference":"REF2"}'::jsonb) as m`, [pr2])).m);
check('حساب مستفيد غير حسابنا ← عدم مطابقة', m2 === 'mismatch' && (await one('select status from commissions where id = $1', [c2[0].id])).status === 'needs_review');
await as(U.fin, () => db.query('select staff_review_proof($1, true)', [pr2]));
check('المالي يعتمد يدوياً ← مدفوعة', (await one('select status, marked_by from commissions where id = $1', [c2[0].id])).status === 'paid');
const j3 = await makeAcceptedJob(2, 10000);
await as(P[2].user, () => db.query('select record_payment($1, $2)', [j3.jobId, Number(j3.off.customer_price_fils)]));
const c3 = await one('select id from commissions where job_id = $1', [j3.jobId]);
const pr3 = await as(P[2].user, async () => (await one(`select submit_commission_proof($1::uuid[], 'p/3.png', 2000, 'REF1', current_date) as id`, [[c3.id]])).id);
const m3 = await svc(async () => (await one(`select apply_proof_ocr($1, '{"amount_fils":2000,"iban_match":true,"reference":"REF1"}'::jsonb) as m`, [pr3])).m);
check('مرجع تحويل مكرر ← عدم مطابقة (منع التزوير)', m3 === 'mismatch');
await as(U.fin, () => db.query('select staff_review_proof($1, false)', [pr3]));
check('رفض الإثبات يعيد العمولة للاستحقاق', (await one('select status from commissions where id = $1', [c3.id])).status === 'due');

console.log('\n— الإيقاف الآلي و override —');
await db.query(`update commissions set due_on = current_date - 1 where id = $1`, [c3.id]);
const sus = await svc(() => q('select * from suspend_overdue_providers()'));
check('إيقاف آلي لمزود تأخرت عمولته', sus.length === 1 && sus[0].suspend_overdue_providers === P[2].id);
check('حالة المزود موقوف وسببها واضح', (await one('select status, status_reason from providers where id = $1', [P[2].id])).status_reason === 'overdue_commission');
check('سجل التدقيق يحفظ الإيقاف الآلي', (await q(`select 1 from audit_log where actor_kind = 'auto' and entity_id = $1 and action = 'providers.status'`, [P[2].id])).length === 1);
const rid4 = await newRequest();
await svc(() => db.query('select dispatch_request($1, 6)', [rid4]));
check('المزود الموقوف لا يستلم طلبات جديدة', (await q('select 1 from request_dispatches where request_id = $1 and provider_id = $2', [rid4, P[2].id])).length === 0);
await fails('الدعم فقط يوقف/يرجع: المالي لا', () => as(U.fin, () => db.query(`select staff_set_provider_status($1,'approved','x')`, [P[2].id])), /not allowed/);
await fails('السبب مطلوب للإيقاف', () => as(U.owner, () => db.query(`select staff_set_provider_status($1,'suspended','')`, [P[3].id])), /reason is required/);
await as(U.owner, () => db.query(`select staff_set_provider_status($1,'approved','تم الاتفاق مع المزود', 7)`, [P[2].id]));
await svc(() => db.query('select * from suspend_overdue_providers()'));
check('override المدير يمنع إعادة الإيقاف الآلي', (await one('select status from providers where id = $1', [P[2].id])).status === 'approved');
await as(U.owner, () => db.query(`select staff_set_provider_status($1,'terminated','سوء أدب مع عميل')`, [P[3].id]));
await fails('الحساب الملغى لا يعود', () => as(U.owner, () => db.query(`select staff_set_provider_status($1,'approved','x')`, [P[3].id])), /terminated/);

console.log('\n— لوحة العمولات (نعم/لا) —');
await as(U.fin, () => db.query('select staff_set_commission_paid($1, true)', [c3.id]));
check('«نعم» ← مدفوعة + سطر ضريبة', (await one('select status from commissions where id = $1', [c3.id])).status === 'paid' && (await q('select 1 from vat_ledger where commission_id = $1', [c3.id])).length === 1);
await as(U.fin, () => db.query('select staff_set_commission_paid($1, false)', [c3.id]));
check('«لا» ← تعود متأخرة وتُحذف الضريبة', (await one('select status from commissions where id = $1', [c3.id])).status === 'overdue' && (await q('select 1 from vat_ledger where commission_id = $1', [c3.id])).length === 0);
await fails('الدعم لا يعدّل لوحة العمولات', () => as(U.sup, () => db.query('select staff_set_commission_paid($1, true)', [c3.id])), /not allowed/);

console.log('\n— أيام العمل —');
check('الجمعة + 3 أيام عمل = الأربعاء (يتخطى السبت والأحد)', (await one(`select add_business_days('2026-11-27', 3)::text d`)).d === '2026-12-02');
await db.exec(`insert into public_holidays values ('2026-12-02','اليوم الوطني'), ('2026-12-03','اليوم الوطني')`);
check('مع عطلة اليوم الوطني يمتد الموعد', (await one(`select add_business_days('2026-11-27', 3)::text d`)).d === '2026-12-04');

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
