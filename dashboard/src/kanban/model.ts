import type { Status } from '../api'
import type { Lang } from '../i18n'

export type ColId = 'new' | 'progress' | 'pending' | 'done'

/** The four board columns, each grouping one or more server statuses. */
export const COLS: { id: ColId; statuses: Status[] }[] = [
  { id: 'new', statuses: ['submitted'] },
  { id: 'progress', statuses: ['review', 'ready_for_authority', 'authority', 'decision'] },
  { id: 'pending', statuses: ['needs_documents'] },
  { id: 'done', statuses: ['completed', 'rejected', 'cancelled'] },
]
export const ACTIVE: Status[] = ['submitted', 'review', 'needs_documents', 'ready_for_authority', 'authority', 'decision']
export const CLOSED: Status[] = ['rejected', 'cancelled']

/**
 * Copy of the server's state machine (`TRANSITIONS` in api/src/staff.ts), used only to light up valid drop
 * targets while dragging. The server stays the authority: every move is still validated there.
 */
export const FLOW: Partial<Record<Status, Status[]>> = {
  submitted: ['review', 'rejected', 'cancelled'],
  review: ['needs_documents', 'ready_for_authority', 'rejected', 'cancelled'],
  needs_documents: ['review', 'rejected', 'cancelled'],
  ready_for_authority: ['authority', 'needs_documents', 'review', 'rejected', 'cancelled'],
  authority: ['decision', 'needs_documents', 'completed', 'rejected', 'cancelled'],
  decision: ['completed', 'authority', 'needs_documents', 'rejected', 'cancelled'],
}

export const colOf = (s: Status): ColId | null => COLS.find((c) => c.statuses.includes(s))?.id ?? null

/** What dropping a request (currently `from`) into `col` means: a direct status, a missing-documents form, or nothing. */
export type Drop = { kind: 'status'; to: Status } | { kind: 'missing' }
export function dropFor(from: Status, col: ColId): Drop | null {
  if (colOf(from) === col) return null
  const allowed = FLOW[from] ?? []
  if (col === 'progress' && allowed.includes('review')) return { kind: 'status', to: 'review' }
  if (col === 'pending' && allowed.includes('needs_documents')) return { kind: 'missing' }
  if (col === 'done' && allowed.includes('completed')) return { kind: 'status', to: 'completed' }
  return null
}

/** Statuses that need extra input from the staff member before the server accepts them. */
export const NEEDS_INPUT: Partial<Record<Status, 'reference' | 'reason' | 'missing'>> = { authority: 'reference', rejected: 'reason', cancelled: 'reason', needs_documents: 'missing' }

const S = {
  ar: {
    board: 'لوحة الطلبات', new: 'جديدة', progress: 'قيد التنفيذ', pending: 'بانتظار العميل', done: 'منجزة',
    newHint: 'وصلت ولم تُراجع بعد', progressHint: 'مراجعة، تقديم، جهة، قرار', pendingHint: 'بانتظار مستندات من العميل', doneHint: 'أُغلقت',
    search: 'بحث بالاسم أو الهاتف أو الرقم', everyone: 'الجميع', mine: 'مسنَدة إليّ', unassigned: 'غير مسنَدة', closed: 'إظهار المرفوضة والملغاة',
    refresh: 'تحديث', updated: 'حُدّث', empty: 'لا طلبات هنا', dropHere: 'أفلت هنا', notAllowed: 'غير متاح من هذه الحالة',
    moved: 'نُقل الطلب إلى', undo: 'تراجع', cantMove: 'لا يمكن نقل هذا الطلب إلى هذا العمود من حالته الحالية.', failed: 'تعذّر التحديث. أُعيد الطلب لمكانه.',
    overdue: 'متأخرة', unassignedShort: 'بلا مسؤول', list: 'القائمة', kanban: 'اللوحة', loadFail: 'تعذّر تحميل الطلبات.', retry: 'إعادة المحاولة',
    close: 'إغلاق', fullPage: 'فتح الصفحة الكاملة', client: 'العميل', call: 'اتصال', whatsapp: 'واتساب', email: 'البريد', verified: 'مؤكَّد', unverified: 'غير مؤكَّد',
    nextStep: 'الخطوة التالية', waitingOn: 'بانتظار', w_customer: 'العميل', w_staff: 'الفريق', w_authority: 'الجهة', w_none: 'لا أحد',
    status: 'تحديث الحالة', moveTo: 'نقل إلى', noMoves: 'لا انتقالات متاحة لهذه الحالة.', confirm: 'تأكيد', cancel: 'إلغاء',
    reference: 'مرجع التقديم لدى الجهة', referenceHint: 'رقم أو دليل التقديم الفعلي (3 أحرف على الأقل).', reason: 'السبب', reasonHint: 'يظهر في السجل. 3 أحرف على الأقل.',
    authorityReason: 'ما الذي طلبته الجهة؟', missingTitle: 'ما المستندات المطلوبة من العميل؟', docAr: 'اسم المستند (عربي)', docEn: 'اسم المستند (إنجليزي)', docNote: 'ملاحظة للعميل (اختيارية)', addDoc: 'إضافة مستند', removeDoc: 'حذف',
    sendMissing: 'إرسال للعميل', note: 'ملاحظة داخلية (اختيارية)', payGate: 'الدفع غير مكتمل. اكتب سبب المتابعة رغم ذلك (10 أحرف على الأقل، يُسجَّل):', payBlocked: 'لا يمكن التقديم للجهة قبل التحقق من الدفع.',
    documents: 'المستندات', noDocs: 'لا مستندات مرفوعة.', view: 'عرض', source: 'من العميل', final: 'تسليم', invoice: 'فاتورة', requested: 'مطلوبة من العميل', uploaded: 'رُفع', waiting: 'بانتظار',
    details: 'بيانات الطلب', service: 'الخدمة', created: 'أُنشئ', assignee: 'المسؤول', activity: 'آخر النشاط', internal: 'داخلي', loading: 'جارٍ التحميل…',
    saved: 'تم التحديث.', e_conflict: 'عدّل شخص آخر هذا الطلب للتو. حُدّثت البيانات، راجعها وأعد المحاولة.', e_invalid: 'هذا الانتقال غير مسموح من الحالة الحالية.',
    e_blocked: 'توجد مستندات غير مطابقة لم تُحسم.', e_scan: 'لم يكتمل فحص بعض المستندات بعد.', e_ref: 'أدخل مرجع التقديم (3–100 حرف).', e_reason: 'اكتب السبب (3 أحرف على الأقل).', e_finished: 'لا يمكن الإنجاز قبل انتهاء الجهة.', e_gen: 'تعذّر التنفيذ.',
    shortcuts: 'اسحب البطاقة بين الأعمدة، أو افتحها لتغيير الحالة.',
  },
  en: {
    board: 'Requests board', new: 'New', progress: 'In progress', pending: 'Pending client', done: 'Completed',
    newHint: 'Arrived, not reviewed yet', progressHint: 'Review, submission, authority, decision', pendingHint: 'Waiting for client documents', doneHint: 'Closed',
    search: 'Search name, phone or ID', everyone: 'Everyone', mine: 'Assigned to me', unassigned: 'Unassigned', closed: 'Show rejected and cancelled',
    refresh: 'Refresh', updated: 'Updated', empty: 'Nothing here', dropHere: 'Drop here', notAllowed: 'Not available from this status',
    moved: 'Moved to', undo: 'Undo', cantMove: "This request can't move to that column from its current status.", failed: "Couldn't update. The card was put back.",
    overdue: 'Overdue', unassignedShort: 'Unassigned', list: 'List', kanban: 'Board', loadFail: "Couldn't load requests.", retry: 'Try again',
    close: 'Close', fullPage: 'Open full page', client: 'Client', call: 'Call', whatsapp: 'WhatsApp', email: 'Email', verified: 'Verified', unverified: 'Not verified',
    nextStep: 'Next step', waitingOn: 'Waiting on', w_customer: 'Client', w_staff: 'Team', w_authority: 'Authority', w_none: 'Nobody',
    status: 'Update status', moveTo: 'Move to', noMoves: 'No transitions available for this status.', confirm: 'Confirm', cancel: 'Cancel',
    reference: 'Authority submission reference', referenceHint: 'The actual submission number or proof (at least 3 characters).', reason: 'Reason', reasonHint: 'Recorded in the log. At least 3 characters.',
    authorityReason: 'What did the authority ask for?', missingTitle: 'Which documents do you need from the client?', docAr: 'Document name (Arabic)', docEn: 'Document name (English)', docNote: 'Note to client (optional)', addDoc: 'Add document', removeDoc: 'Remove',
    sendMissing: 'Send to client', note: 'Internal note (optional)', payGate: 'Payment is incomplete. Write why you are proceeding anyway (at least 10 characters, logged):', payBlocked: "Can't submit to the authority until payment is verified.",
    documents: 'Documents', noDocs: 'No documents uploaded.', view: 'View', source: 'From client', final: 'Delivery', invoice: 'Invoice', requested: 'Requested from client', uploaded: 'Uploaded', waiting: 'Waiting',
    details: 'Request details', service: 'Service', created: 'Created', assignee: 'Assignee', activity: 'Recent activity', internal: 'Internal', loading: 'Loading…',
    saved: 'Status updated.', e_conflict: 'Someone else just changed this request. It has been refreshed; check and try again.', e_invalid: "That move isn't allowed from the current status.",
    e_blocked: 'Some documents failed checks and are unresolved.', e_scan: 'Some documents are still being scanned.', e_ref: 'Enter the submission reference (3–100 characters).', e_reason: 'Write a reason (at least 3 characters).', e_finished: "Can't complete before the authority has finished.", e_gen: "Couldn't complete that.",
    shortcuts: 'Drag cards between columns, or open one to change its status.',
  },
}
export type SK = keyof typeof S.en
export const useS = (lang: Lang) => (k: SK) => S[lang][k]

/** Maps a server error code to a sentence the staff member can act on. */
export function errorKey(code: string | undefined): SK {
  switch (code) {
    case 'version_conflict': return 'e_conflict'
    case 'invalid_transition': return 'e_invalid'
    case 'documents_blocked': return 'e_blocked'
    case 'scan_pending': return 'e_scan'
    case 'reference_required': return 'e_ref'
    case 'reason_required': return 'e_reason'
    case 'payment_required': return 'payBlocked'
    case 'authority_not_finished': return 'e_finished'
    default: return 'e_gen'
  }
}

/** Two Latin initials ("OF"); Arabic letters change shape when split from their word, so Arabic names get one letter. */
export const initials = (name: string) => {
  const w = name.trim().split(/\s+/).filter(Boolean)
  if (!w.length) return '?'
  if (/[\u0600-\u06FF]/.test(w[0]!)) return w[0]![0]!
  return w.slice(0, 2).map((x) => x[0] ?? '').join('').toUpperCase()
}
export const fileSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`)
