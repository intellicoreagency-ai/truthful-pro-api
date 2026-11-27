import type { PGlite } from '@electric-sql/pglite';
import { randomUUID as uuid } from 'node:crypto';

/**
 * بيانات تجريبية للتطوير فقط. تُنتَج بنفس الدوال الحقيقية (dispatch_request, accept_offer, record_payment…)
 * فتخرج الحالات المالية كما ستخرج في الإنتاج: مدفوع آلياً، بحاجة مراجعة، مستحق، متأخر.
 */
const STAFF = '00000000-0000-4000-8000-000000000001';

type Prov = { user: string; id: string };

export async function seedDemo(db: PGlite): Promise<void> {
  const as = async <T>(uid: string, fn: () => Promise<T>) => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
    try { return await fn(); } finally { await db.exec('reset role;'); }
  };
  const svc = async <T>(fn: () => Promise<T>) => {
    await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role service_role;`);
    try { return await fn(); } finally { await db.exec('reset role;'); }
  };
  const one = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];

  // ── مستخدمون ──
  const custs = [uuid(), uuid(), uuid()];
  await db.query('insert into auth.users (id) values ($1)', [STAFF]);
  await db.query(`insert into staff (user_id, role) values ($1, 'owner')`, [STAFF]);
  for (const [i, c] of custs.entries()) {
    await db.query('insert into auth.users (id) values ($1)', [c]);
    await db.query(`insert into customers (id, phone, whatsapp) values ($1, $2, $2)`, [c, `+97150100000${i}`]);
  }

  // ── مزودون ──
  const defs: { name: string; cat: string; emirates: string[]; docs: 'none' | 'partial' | 'uploaded' | 'accepted' }[] = [
    { name: 'سطحات النجمة', cat: 'car_tow', emirates: ['dubai', 'sharjah'], docs: 'accepted' },
    { name: 'الإنقاذ السريع', cat: 'car_tow', emirates: ['dubai'], docs: 'accepted' },
    { name: 'دبي للسحب', cat: 'car_tow', emirates: ['dubai', 'ajman'], docs: 'accepted' },
    { name: 'مركز الخليج للسيارات', cat: 'car_garage', emirates: ['sharjah'], docs: 'partial' },
    { name: 'تكييف الواحة', cat: 'home_ac', emirates: ['dubai'], docs: 'uploaded' },
    { name: 'نظافة بيتك', cat: 'home_clean', emirates: ['abu_dhabi'], docs: 'uploaded' },
    { name: 'فنيو الشارقة', cat: 'home_ac', emirates: ['sharjah'], docs: 'none' },
    { name: 'سطحات الشمال', cat: 'car_tow', emirates: ['ras_al_khaimah'], docs: 'accepted' },
    { name: 'سطحة العين السريعة', cat: 'car_tow', emirates: ['abu_dhabi'], docs: 'accepted' },
  ];
  const provs: Prov[] = [];
  for (const [i, d] of defs.entries()) {
    const p = { user: uuid(), id: uuid() };
    provs.push(p);
    await db.query('insert into auth.users (id) values ($1)', [p.user]);
    const full = d.docs !== 'none';
    await db.query(
      `insert into providers (id, user_id, company_name, phone, whatsapp, maps_url) values ($1,$2,$3,$4,$5,$6)`,
      [p.id, p.user, d.name, `+9715020000${i}0`, full ? `+9715020000${i}0` : null, full ? `https://maps.google.com/?q=${i}` : null],
    );
    await db.query('insert into provider_categories values ($1,$2)', [p.id, d.cat]);
    for (const e of d.emirates) await db.query('insert into provider_coverage values ($1,$2)', [p.id, e]);
    const st = d.docs === 'accepted' ? 'accepted' : 'uploaded';
    if (d.docs !== 'none') {
      await db.query(`insert into provider_documents (provider_id, kind, storage_path, status, expires_on) values ($1,'trade_license',$2,$3, current_date + 300)`, [p.id, `docs/${i}/license.pdf`, st]);
    }
    if (d.docs === 'accepted' || d.docs === 'uploaded') {
      await db.query(`insert into provider_documents (provider_id, kind, storage_path, status, expires_on) values ($1,'tenancy_contract',$2,$3, current_date + 200)`, [p.id, `docs/${i}/lease.pdf`, st]);
    }
  }
  // حالات المزودين
  for (const i of [0, 1, 2, 7, 8]) await db.query(`update providers set status = 'approved' where id = $1`, [provs[i].id]);
  await db.query(`update providers set status = 'incomplete' where id = $1`, [provs[3].id]);
  await db.query(`update providers set status = 'pending_review' where id = any($1::uuid[])`, [[provs[4].id, provs[5].id]]);

  // ── أعمال وعمولات عبر الدوال الحقيقية ──
  async function makeJob(provIdx: number, custIdx: number, title: string, priceAed: number) {
    const price = priceAed * 100;
    const rid = (await as(custs[custIdx], () => one<{ id: string }>(
      `insert into requests (customer_id, agent_id, category_id, title, emirate) values ($1,'jalal','car_tow',$2,'dubai') returning id`, [custs[custIdx], title]))).id;
    await svc(() => db.query('select dispatch_request($1, 6)', [rid]));
    const off = await as(provs[provIdx].user, () => one<{ id: string; customer_price_fils: string }>(
      `insert into offers (request_id, provider_id, provider_price_fils) values ($1,$2,$3) returning id, customer_price_fils`, [rid, provs[provIdx].id, price]));
    const job = (await as(custs[custIdx], () => one<{ id: string }>(`select accept_offer($1, 'cash') as id`, [off.id]))).id;
    await as(provs[provIdx].user, () => db.query(`select provider_set_job_status($1,'in_progress')`, [job]));
    await as(provs[provIdx].user, () => db.query('select record_payment($1, $2)', [job, Number(off.customer_price_fils)]));
    await as(provs[provIdx].user, () => db.query(`select provider_set_job_status($1,'completed')`, [job]));
    const comm = await one<{ id: string; amount_fils: string }>('select id, amount_fils from commissions where job_id = $1', [job]);
    return { job, comm };
  }
  async function submitProof(provIdx: number, commId: string, amount: string, ref: string) {
    return as(provs[provIdx].user, async () => (await one<{ id: string }>(
      `select submit_commission_proof($1::uuid[], $2, $3, $4, current_date) as id`, [[commId], `proofs/${ref}.png`, amount, ref])).id);
  }
  const ocr = (amount: string, iban: boolean, ref: string) => JSON.stringify({ amount_fils: Number(amount), iban_match: iban, reference: ref });

  const a = await makeJob(0, 0, 'سطحة من الشيخ زايد', 150);          // ← مدفوعة آلياً
  const pa = await submitProof(0, a.comm.id, a.comm.amount_fils, 'TRX-1001');
  await svc(() => db.query('select apply_proof_ocr($1, $2::jsonb)', [pa, ocr(a.comm.amount_fils, true, 'TRX-1001')]));

  await makeJob(0, 1, 'سطحة من القوز', 200);                          // ← مستحقة

  const c = await makeJob(1, 2, 'سطحة من مردف', 130);                // ← حساب مستفيد خاطئ: بحاجة مراجعة
  const pc = await submitProof(1, c.comm.id, c.comm.amount_fils, 'TRX-2002');
  await svc(() => db.query('select apply_proof_ocr($1, $2::jsonb)', [pc, ocr(c.comm.amount_fils, false, 'TRX-2002')]));

  const d = await makeJob(2, 0, 'سطحة من الخوانيج', 180);            // ← متأخرة
  await db.query(`update commissions set due_on = current_date - 4, status = 'overdue' where id = $1`, [d.comm.id]);

  const e = await makeJob(1, 1, 'سطحة من البرشاء', 90);              // ← مدفوعة يدوياً
  await as(STAFF, () => db.query('select staff_set_commission_paid($1, true)', [e.comm.id]));

  const f = await makeJob(0, 2, 'سطحة من جميرا', 120);               // ← إثبات مرفوع بانتظار المسح
  await submitProof(0, f.comm.id, f.comm.amount_fils, 'TRX-3003');

  // مزود موقوف بسبب عمولة متأخرة، وآخر ملغى
  await db.query(`update providers set status = 'suspended', status_reason = 'overdue_commission' where id = $1`, [provs[7].id]);
  await db.query(`update providers set status = 'terminated', status_reason = 'سوء أدب مع عميل' where id = $1`, [provs[8].id]);
}
