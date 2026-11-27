'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { asStaff } from '@/lib/db';
import { friendlyError } from '@/lib/strings';

/**
 * كل إجراء يمر عبر دوال قاعدة البيانات التي تتحقق من دور الموظف داخلها
 * (staff_has_role)، فلا نعتمد على الواجهة وحدها: Server Functions يمكن استدعاؤها بـ POST مباشر.
 */
async function perform(fn: () => Promise<unknown>, back: string, paths: string[]): Promise<never> {
  let error: string | null = null;
  try {
    await fn();
  } catch (e) {
    error = friendlyError(e instanceof Error ? e.message : String(e));
  }
  for (const p of paths) revalidatePath(p);
  redirect(error ? `${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(error)}` : back);
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(f: FormData, k: string): string {
  const v = str(f, k);
  if (!uuidRe.test(v)) throw new Error('معرّف غير صالح');
  return v;
}

/** لوحة العمولات: «هل سُدّدت عمولة مهرة؟» نعم/لا */
export async function setCommissionPaid(f: FormData) {
  const back = str(f, 'back') || '/commissions';
  await perform(
    async () => {
      const paid = str(f, 'paid') === 'yes';
      await asStaff((db) => db.query('select staff_set_commission_paid($1, $2)', [id(f, 'id'), paid]));
    },
    back,
    ['/', '/commissions', '/revenue', '/vat'],
  );
}

export async function reviewProof(f: FormData) {
  const back = str(f, 'back') || '/commissions';
  await perform(
    () => asStaff((db) => db.query('select staff_review_proof($1, $2)', [id(f, 'id'), str(f, 'decision') === 'approve'])),
    back,
    ['/', '/commissions', '/revenue', '/vat'],
  );
}

export async function reviewDocument(f: FormData) {
  const pid = str(f, 'provider');
  const back = `/providers/${pid}`;
  await perform(
    () =>
      asStaff((db) =>
        db.query('select staff_review_document($1, $2, $3)', [id(f, 'id'), str(f, 'decision') === 'accept', str(f, 'reason') || null]),
      ),
    back,
    ['/', '/providers', back],
  );
}

export async function setProviderStatus(f: FormData) {
  const pid = id(f, 'provider');
  const back = `/providers/${pid}`;
  const status = str(f, 'status');
  if (!['approved', 'suspended', 'terminated'].includes(status)) redirect(`${back}?error=${encodeURIComponent('حالة غير صالحة')}`);
  // الإلغاء النهائي لا يُنفَّذ بنقرة واحدة: يلزم تأكيد صريح (يُتحقق منه هنا لا في الواجهة وحدها).
  if (status === 'terminated' && str(f, 'confirm') !== 'yes') redirect(`${back}?error=${encodeURIComponent('أكّد الإلغاء النهائي بتحديد خانة التأكيد')}`);
  const days = str(f, 'override_days');
  await perform(
    () =>
      asStaff((db) =>
        db.query('select staff_set_provider_status($1, $2::provider_status, $3, $4)', [
          pid,
          status,
          str(f, 'reason'),
          days ? Number(days) : null,
        ]),
      ),
    back,
    ['/', '/providers', back, '/commissions'],
  );
}
