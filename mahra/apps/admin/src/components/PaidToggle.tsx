'use client';

import { useRef } from 'react';
import { setCommissionPaid } from '@/app/actions';

/**
 * «هل سُدّدت عمولة مهرة؟» نعم / لا. يحفظ فور الاختيار.
 * الحالة المعروضة تأتي من الخادم، ويُعاد رسمها بعد الحفظ.
 */
export function PaidToggle({ id, paid, back, name }: { id: string; paid: boolean; back: string; name: string }) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();
  return (
    <form ref={form} action={setCommissionPaid} className="seg" role="radiogroup" aria-label={`هل سُدّدت عمولة ${name}؟`}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <label className="yes">
        <input type="radio" name="paid" value="yes" defaultChecked={paid} onChange={submit} />
        نعم
      </label>
      <label className="no">
        <input type="radio" name="paid" value="no" defaultChecked={!paid} onChange={submit} />
        لا
      </label>
    </form>
  );
}
