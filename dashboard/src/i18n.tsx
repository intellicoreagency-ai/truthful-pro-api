import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Status } from './api'

export type Lang = 'ar' | 'en'
const dict = {
  ar: {
    brand: 'تروثفل برو', team: 'لوحة الفريق', overview: 'نظرة عامة', requests: 'الطلبات', members: 'الفريق', logout: 'تسجيل الخروج',
    loginTitle: 'دخول الفريق', loginHint: 'أدخل رقم جوالك المسجّل، ثم أرسل رسالة التحقق عبر واتساب. الدخول مجاني.', phone: 'رقم الجوال', phonePh: '05XXXXXXXX',
    verifyWa: 'التحقق عبر واتساب', openWa: 'فتح واتساب', waiting: 'بانتظار رسالتك…', waSteps: 'أرسل الرسالة الجاهزة كما هي. إن لم تُملأ تلقائياً فأرسل الرمز التالي:', cancel: 'إلغاء',
    e_phone: 'أدخل رقم جوال إماراتي صحيحاً.', e_not_staff: 'هذا الرقم غير مسجّل ضمن الفريق.', e_many: 'محاولات كثيرة. حاول لاحقاً.', e_net: 'تعذّر الاتصال.', e_gen: 'حدث خطأ. حاول مرة أخرى.', e_expired: 'انتهت المهلة. ابدأ من جديد.', e_not_configured: 'التحقق عبر واتساب غير مفعّل بعد.',
    awaiting: 'بانتظار المراجعة', mine: 'طلباتي', unassigned: 'غير مسنَدة', all: 'الكل', search: 'بحث بالاسم أو الهاتف أو رقم الطلب', statusF: 'الحالة', assigneeF: 'المسؤول',
    empty: 'لا توجد طلبات مطابقة.', loading: 'جارٍ التحميل…', open: 'فتح', back: 'رجوع', customer: 'العميل', call: 'اتصال', whatsapp: 'واتساب',
    details: 'بيانات الطلب', documents: 'المستندات', view: 'عرض', delivery: 'ملف تسليم', invoice: 'فاتورة', noFiles: 'لا مستندات.', timeline: 'السجل', internal: 'داخلي',
    actions: 'الإجراءات', assignToMe: 'إسناد إليّ', release: 'إلغاء الإسناد', assignedTo: 'المسؤول', none: 'لا أحد',
    changeStatus: 'تغيير الحالة', newStatus: 'الحالة الجديدة', note: 'ملاحظة', expected: 'تاريخ الإنجاز المتوقع', apply: 'تطبيق', noTransitions: 'لا تغييرات متاحة لهذه الحالة.',
    askMissing: 'طلب مستندات ناقصة', docNameAr: 'اسم المستند (عربي)', docNameEn: 'اسم المستند (إنجليزي)', noteToCustomer: 'ملاحظة للعميل (اختيارية)', addRow: 'إضافة مستند', send: 'إرسال الطلب',
    missingList: 'المستندات المطلوبة من العميل', resolved: 'تم الرفع', pending: 'بانتظار العميل',
    addNote: 'ملاحظة داخلية', noteHint: 'لا تظهر للعميل أبداً', save: 'حفظ', uploadFile: 'رفع ملف للعميل', fileLabel: 'وصف الملف', choose: 'اختيار ملف', kind: 'النوع',
    saved: 'تم.', failed: 'تعذّر التنفيذ.', invalidTransition: 'هذا الانتقال غير مسموح.',
    created: 'تاريخ الإنشاء', updated: 'آخر تحديث', terms: 'نسخة الشروط المقبولة', expectedAt: 'المتوقع', service: 'الخدمة',
    addMember: 'إضافة عضو', name: 'الاسم', role: 'الدور', active: 'نشط', disable: 'إيقاف', enable: 'تفعيل', onlyYou: 'أنت المالك وصاحب كل الصلاحيات حالياً. أضف أعضاء عندما يكبر الفريق.',
    owner: 'مالك', manager: 'مدير', agent: 'موظف', accountant: 'محاسب', you: 'أنت', lang: 'EN',
    tabCode: 'تطبيق المصادقة', tabSetup: 'أول دخول', tabWa: 'واتساب', code6: 'الرمز المكوّن من 6 أرقام', signIn: 'دخول', codeHint: 'افتح تطبيق المصادقة (Google Authenticator أو Microsoft Authenticator) وأدخل الرمز الظاهر لحسابك.',
    setupHint: 'أدخل رقمك ومفتاح الإعداد الذي سلّمك إياه المالك، ثم امسح الرمز بتطبيق المصادقة وأدخل أول رمز.', setupKey: 'مفتاح الإعداد', continue: 'متابعة', scanQr: 'امسح الرمز بتطبيق المصادقة، أو أدخل المفتاح يدوياً:', openApp: 'فتح في التطبيق', firstCode: 'أدخل أول رمز من التطبيق لإنهاء التفعيل', e_code: 'الرمز غير صحيح أو مستخدم من قبل.', e_setup: 'مفتاح الإعداد غير صحيح أو منتهي.',
    bio: 'الدخول بالبصمة', bioHint: 'استخدم بصمة إصبعك أو وجهك للدخول مباشرة.', bioFail: 'تعذّر الدخول بالبصمة. استخدم الرمز بدلاً منها.', bioNone: 'لا توجد بصمة مسجّلة على هذا الجهاز بعد. ادخل بالرمز ثم فعّلها من «الأمان».',
    security: 'الأمان', bioEnable: 'تفعيل البصمة على هذا الجهاز', bioEnabled: 'تم تفعيل الدخول بالبصمة.', bioDevices: 'الأجهزة المسجّلة', bioRemove: 'إزالة', bioLater: 'لاحقاً', bioBanner: 'فعّل الدخول بالبصمة على هذا الجهاز لدخول أسرع وأكثر أماناً.', bioCancelled: 'أُلغي التفعيل أو لم يدعمه هذا الجهاز.', lastUsed: 'آخر استخدام', never: 'لم يُستخدم',
    hello: 'مرحباً', today: 'اليوم', newToday: 'طلبات جديدة اليوم', doneToday: 'منجزة اليوم', openNow: 'قيد التنفيذ', attention: 'تحتاج متابعة', attentionHint: 'لم تتحرك منذ أكثر من 24 ساعة', waitingH: 'ساعة بلا حركة', noAttention: 'لا شيء متأخر. أحسنت.',
    activity: 'آخر النشاط', workload: 'أعباء الفريق', openReq: 'طلب مفتوح', board: 'اللوحة', list: 'القائمة', customers: 'العملاء', nextStep: 'الخطوة التالية', moveTo: 'نقل إلى', noCustomers: 'لا عملاء بعد.', joined: 'انضم', reqCount: 'طلبات', lastActivity: 'آخر نشاط', consents: 'الموافقات', searchAll: 'بحث سريع…',
    override: 'تجاوز (Override)', overrideHint: 'للمالك والمدير فقط. يتجاوز مسار الحالات المعتاد ويُسجَّل بالسبب في السجل الداخلي وسجل التدقيق. لا يظهر السبب للعميل.', reason: 'السبب (إلزامي)', forceStatus: 'فرض حالة', customerName: 'اسم العميل في الطلب', overrideApply: 'تنفيذ التجاوز', overrideConfirm: 'تأكيد تنفيذ التجاوز؟', overrideDone: 'تم التجاوز وسُجّل.', reopen: 'إعادة فتح', same: '(بدون تغيير)',
    mine2: 'مسنَدة إليّ', kpi: 'المؤشرات',
    waCodeSend: 'إرسال الرمز إلى واتساب', waCodeHint: 'سنرسل رمزاً من 6 أرقام إلى واتساب الخاص بك إن كان رقمك مسجلاً في الفريق.', waCodeSent: 'إن كان الرقم مسجلاً فقد أُرسل الرمز. أدخله هنا.', waUseMessage: 'أو تحقق بإرسال رسالة (مجاني)', waUseCode: 'أو أرسل لي رمزاً على واتساب', newCode: 'رمز جديد',
    authorityRef: 'مرجع التقديم للجهة (إلزامي)', authorityHint: 'يُطلب رقم أو دليل التقديم الفعلي للجهة قبل نقل الطلب إلى «لدى الجهة».', rejectReason: 'سبب الرفض (إلزامي)', conflict: 'عدّل شخص آخر هذا الطلب قبل قليل. حدّثتُ الصفحة، راجع التغييرات ثم أعد المحاولة.', refNeeded: 'أدخل مرجع التقديم للجهة:', rejNeeded: 'أدخل سبب الرفض:',
    delivery2: 'التسليم', deliveryVer: 'نسخة التسليم', ackDone: 'أكد العميل الاستلام', ackWait: 'بانتظار تأكيد العميل', authorityAt: 'مرجع الجهة',
    pkgTitle: 'حزمة التسليم', pkgDraft: 'مسودة (لا يراها العميل)', pkgPublish: 'نشر للعميل', pkgPublishConfirm: 'نشر هذه الحزمة للعميل؟ سيراها العميل ويُطلب منه تأكيد استلامها.', pkgVersion: 'النسخة', pkgPublished: 'منشورة', pkgSuperseded: 'مستبدَلة', pkgEmpty: 'لا ملفات مرفوعة للتسليم بعد.', pkgRemove: 'إزالة من المسودة', pkgNeedFinal: 'أضف ملفاً نهائياً واحداً على الأقل قبل النشر.', pkgHint: 'الملفات المرفوعة تُحفظ في مسودة ولا تظهر للعميل قبل «نشر للعميل».', ackAt: 'تأكيد الاستلام',
    checks: 'فحوص المستند', noChecks: 'لا فحوص بعد', readExpiry: 'قراءة انتهاء الجواز', passportExpiry: 'تاريخ انتهاء الجواز', evaluate: 'تقييم', outPass: 'مطابق', outFail: 'غير مطابق', outManual: 'مراجعة يدوية', docOverride: 'قبول بعد المراجعة', docOverrideReason: 'سبب القبول الداخلي (10 أحرف على الأقل):', overridden: 'قُبل داخلياً', overrideNote: 'اعتماد داخلي وليس إثباتاً للأصالة ولا قبولاً حكومياً.', blockedDocs: 'مستندات غير مطابقة لم تُحسم: لا يمكن الانتقال إلى «جاهزة للتقديم».', nameMismatch: 'تسجيل اختلاف اسم', ruleLabel: 'القاعدة',
    enrollTitle: 'مفتاح إعداد العضو', enrollBody: 'سلّم هذا المفتاح للعضو بشكل خاص. يظهر مرة واحدة فقط وينتهي خلال 24 ساعة. يستخدمه في «أول دخول».', done: 'تم', copy: 'نسخ', copied: 'نُسخ',
  },
  en: {
    brand: 'TRUTHFUL PRO', team: 'Team dashboard', overview: 'Overview', requests: 'Requests', members: 'Team', logout: 'Sign out',
    loginTitle: 'Team sign-in', loginHint: 'Enter your registered mobile number, then send the verification message on WhatsApp. Sign-in is free.', phone: 'Mobile number', phonePh: '05XXXXXXXX',
    verifyWa: 'Verify with WhatsApp', openWa: 'Open WhatsApp', waiting: 'Waiting for your message…', waSteps: 'Send the ready-made message as it is. If it is not pre-filled, send this code:', cancel: 'Cancel',
    e_phone: 'Enter a valid UAE mobile number.', e_not_staff: 'This number is not on the team.', e_many: 'Too many attempts. Try later.', e_net: 'Connection failed.', e_gen: 'Something went wrong. Try again.', e_expired: 'Timed out. Start again.', e_not_configured: 'WhatsApp verification is not enabled yet.',
    awaiting: 'Awaiting review', mine: 'My requests', unassigned: 'Unassigned', all: 'All', search: 'Search by name, phone or request ID', statusF: 'Status', assigneeF: 'Owner',
    empty: 'No matching requests.', loading: 'Loading…', open: 'Open', back: 'Back', customer: 'Customer', call: 'Call', whatsapp: 'WhatsApp',
    details: 'Request details', documents: 'Documents', view: 'View', delivery: 'Delivery file', invoice: 'Invoice', noFiles: 'No documents.', timeline: 'Timeline', internal: 'Internal',
    actions: 'Actions', assignToMe: 'Assign to me', release: 'Release', assignedTo: 'Assigned to', none: 'Nobody',
    changeStatus: 'Change status', newStatus: 'New status', note: 'Note', expected: 'Expected completion date', apply: 'Apply', noTransitions: 'No changes available for this status.',
    askMissing: 'Request missing documents', docNameAr: 'Document name (Arabic)', docNameEn: 'Document name (English)', noteToCustomer: 'Note to customer (optional)', addRow: 'Add document', send: 'Send request',
    missingList: 'Documents requested from the customer', resolved: 'Uploaded', pending: 'Waiting for customer',
    addNote: 'Internal note', noteHint: 'Never shown to the customer', save: 'Save', uploadFile: 'Upload a file for the customer', fileLabel: 'File description', choose: 'Choose file', kind: 'Type',
    saved: 'Done.', failed: 'Could not complete.', invalidTransition: 'That transition is not allowed.',
    created: 'Created', updated: 'Last update', terms: 'Terms version accepted', expectedAt: 'Expected', service: 'Service',
    addMember: 'Add member', name: 'Name', role: 'Role', active: 'Active', disable: 'Disable', enable: 'Enable', onlyYou: 'You are the owner with every permission. Add members when the team grows.',
    owner: 'Owner', manager: 'Manager', agent: 'Agent', accountant: 'Accountant', you: 'You', lang: 'عربي',
    tabCode: 'Authenticator app', tabSetup: 'First sign-in', tabWa: 'WhatsApp', code6: '6-digit code', signIn: 'Sign in', codeHint: 'Open your authenticator app (Google Authenticator or Microsoft Authenticator) and enter the code shown for your account.',
    setupHint: 'Enter your number and the setup key the owner gave you, scan the code with your authenticator app, then enter the first code.', setupKey: 'Setup key', continue: 'Continue', scanQr: 'Scan this code with your authenticator app, or enter the key manually:', openApp: 'Open in app', firstCode: 'Enter the first code from the app to finish', e_code: 'The code is wrong or was already used.', e_setup: 'The setup key is wrong or expired.',
    bio: 'Sign in with fingerprint', bioHint: 'Use your fingerprint or face to sign in directly.', bioFail: 'Biometric sign-in failed. Use your code instead.', bioNone: 'No fingerprint is registered on this device yet. Sign in with your code, then enable it under Security.',
    security: 'Security', bioEnable: 'Enable fingerprint on this device', bioEnabled: 'Fingerprint sign-in enabled.', bioDevices: 'Registered devices', bioRemove: 'Remove', bioLater: 'Later', bioBanner: 'Enable fingerprint sign-in on this device for faster and safer access.', bioCancelled: 'Cancelled, or this device does not support it.', lastUsed: 'Last used', never: 'Never used',
    hello: 'Hello', today: 'Today', newToday: 'New requests today', doneToday: 'Completed today', openNow: 'In progress', attention: 'Needs attention', attentionHint: 'No movement for over 24 hours', waitingH: 'h idle', noAttention: 'Nothing overdue. Well done.',
    activity: 'Recent activity', workload: 'Team workload', openReq: 'open', board: 'Board', list: 'List', customers: 'Customers', nextStep: 'Next step', moveTo: 'Move to', noCustomers: 'No customers yet.', joined: 'Joined', reqCount: 'requests', lastActivity: 'Last activity', consents: 'Consents', searchAll: 'Quick search…',
    override: 'Override', overrideHint: 'Owner and manager only. Bypasses the normal status flow; recorded with the reason in the internal log and the audit trail. The customer never sees the reason.', reason: 'Reason (required)', forceStatus: 'Force status', customerName: 'Customer name on the request', overrideApply: 'Apply override', overrideConfirm: 'Apply this override?', overrideDone: 'Override applied and recorded.', reopen: 'Reopen', same: '(no change)',
    mine2: 'Assigned to me', kpi: 'Key figures',
    waCodeSend: 'Send the code to WhatsApp', waCodeHint: 'We will send a 6-digit code to your WhatsApp if your number is on the team.', waCodeSent: 'If the number is registered, the code was sent. Enter it here.', waUseMessage: 'Or verify by sending a message (free)', waUseCode: 'Or send me a code on WhatsApp', newCode: 'New code',
    authorityRef: 'Authority submission reference (required)', authorityHint: 'The real submission number or evidence is required before moving a request to “With authority”.', rejectReason: 'Rejection reason (required)', conflict: 'Someone else changed this request a moment ago. I reloaded it; review the changes and try again.', refNeeded: 'Enter the authority submission reference:', rejNeeded: 'Enter the rejection reason:',
    delivery2: 'Delivery', deliveryVer: 'Delivery version', ackDone: 'Customer confirmed receipt', ackWait: 'Waiting for the customer to confirm', authorityAt: 'Authority reference',
    pkgTitle: 'Delivery package', pkgDraft: 'Draft (hidden from the customer)', pkgPublish: 'Publish to customer', pkgPublishConfirm: 'Publish this package to the customer? They will see it and be asked to confirm receipt.', pkgVersion: 'Version', pkgPublished: 'Published', pkgSuperseded: 'Superseded', pkgEmpty: 'No delivery files uploaded yet.', pkgRemove: 'Remove from draft', pkgNeedFinal: 'Add at least one final file before publishing.', pkgHint: 'Uploaded files are saved to a draft and stay hidden from the customer until you press “Publish to customer”.', ackAt: 'Receipt confirmed',
    checks: 'Document checks', noChecks: 'No checks yet', readExpiry: 'Read passport expiry', passportExpiry: 'Passport expiry date', evaluate: 'Evaluate', outPass: 'Pass', outFail: 'Fail', outManual: 'Manual review', docOverride: 'Accept after review', docOverrideReason: 'Reason for internal acceptance (min. 10 characters):', overridden: 'Accepted internally', overrideNote: 'Internal approval only: not proof of authenticity or government acceptance.', blockedDocs: 'Failed documents are unresolved: cannot move to “Ready to submit”.', nameMismatch: 'Record name mismatch', ruleLabel: 'Rule',
    enrollTitle: 'Member setup key', enrollBody: 'Give this key to the member privately. It is shown once and expires in 24 hours. They use it under “First sign-in”.', done: 'Done', copy: 'Copy', copied: 'Copied',
  },
} as const
export type Key = keyof typeof dict.ar

export const STATUS_LABEL: Record<Status, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' }, submitted: { ar: 'تم الإرسال', en: 'Submitted' }, review: { ar: 'قيد المراجعة', en: 'Under review' },
  needs_documents: { ar: 'مطلوب استكمال', en: 'Action required' }, ready_for_authority: { ar: 'جاهزة للتقديم', en: 'Ready to submit' }, authority: { ar: 'لدى الجهة', en: 'With authority' }, decision: { ar: 'بانتظار القرار', en: 'Decision pending' },
  completed: { ar: 'منجزة', en: 'Completed' }, cancelled: { ar: 'ملغاة', en: 'Cancelled' }, rejected: { ar: 'مرفوضة', en: 'Rejected' },
}

type Ctx = { lang: Lang; t: (k: Key) => string; toggle: () => void; fmt: (ms: number) => string; day: (iso: string) => string }
const I18n = createContext<Ctx>(null as unknown as Ctx)
export const useI18n = () => useContext(I18n)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => { try { return (localStorage.getItem('tp.lang') as Lang) || 'ar' } catch { return 'ar' } })
  useEffect(() => {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title = lang === 'ar' ? 'تروثفل برو — لوحة الفريق' : 'TRUTHFUL PRO — Team'
    try { localStorage.setItem('tp.lang', lang) } catch { /* */ }
  }, [lang])
  const value = useMemo<Ctx>(() => {
    const loc = lang === 'ar' ? 'ar-AE' : 'en-GB'
    const dt = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })
    const d = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' })
    return { lang, t: (k) => dict[lang][k], toggle: () => setLang((l) => (l === 'ar' ? 'en' : 'ar')), fmt: (ms) => dt.format(new Date(ms)), day: (iso) => d.format(new Date(iso)) }
  }, [lang])
  return <I18n.Provider value={value}>{children}</I18n.Provider>
}
