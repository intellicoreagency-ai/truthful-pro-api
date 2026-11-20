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
  },
} as const
export type Key = keyof typeof dict.ar

export const STATUS_LABEL: Record<Status, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' }, submitted: { ar: 'تم الإرسال', en: 'Submitted' }, review: { ar: 'قيد المراجعة', en: 'Under review' },
  needs_documents: { ar: 'مطلوب استكمال', en: 'Action required' }, authority: { ar: 'لدى الجهة', en: 'With authority' }, decision: { ar: 'بانتظار القرار', en: 'Decision pending' },
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
