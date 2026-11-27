/** نصوص اللوحة (عربية أولاً). مركزة هنا لتسهيل الترجمة لاحقاً. */

export const PROVIDER_STATUS: Record<string, string> = {
  invited: 'مدعو',
  incomplete: 'ناقص',
  pending_review: 'بانتظار المراجعة',
  approved: 'معتمد',
  suspended: 'موقوف',
  terminated: 'ملغى',
};

export const COMMISSION_STATUS: Record<string, string> = {
  due: 'مستحقة',
  proof_uploaded: 'إثبات مرفوع',
  paid: 'مدفوعة',
  needs_review: 'بحاجة مراجعة',
  overdue: 'متأخرة',
  waived: 'معفاة',
};

export const DOC_KIND: Record<string, string> = {
  trade_license: 'الرخصة التجارية',
  tenancy_contract: 'عقد الإيجار',
  owner_id: 'هوية المالك',
  other: 'وثيقة أخرى',
};

export const DOC_STATUS: Record<string, string> = {
  uploaded: 'بانتظار المراجعة',
  accepted: 'مقبولة',
  rejected: 'مرفوضة',
};

/** عناصر ناقصة من اكتمال المزود */
export const MISSING: Record<string, string> = {
  phone: 'رقم الهاتف',
  whatsapp: 'رقم الواتساب',
  maps_url: 'موقع Google Maps',
  categories: 'فئات الخدمة',
  coverage: 'مناطق التغطية',
  trade_license: 'الرخصة التجارية',
  tenancy_contract: 'عقد الإيجار',
};

export const EMIRATE: Record<string, string> = {
  abu_dhabi: 'أبوظبي',
  dubai: 'دبي',
  sharjah: 'الشارقة',
  ajman: 'عجمان',
  umm_al_quwain: 'أم القيوين',
  ras_al_khaimah: 'رأس الخيمة',
  fujairah: 'الفجيرة',
};

export const SUSPEND_REASON: Record<string, string> = {
  overdue_commission: 'تأخر في تحويل العمولة',
};

/** يحوّل رسائل قاعدة البيانات إلى جمل مفهومة للمدير */
export function friendlyError(raw: string): string {
  const m = raw.replace(/^error:\s*/i, '');
  if (/cannot be approved/.test(m)) return 'لا يمكن اعتماد المزود: وثائق أو بيانات ناقصة أو غير مقبولة.';
  if (/reason is required/.test(m)) return 'السبب مطلوب لهذا الإجراء.';
  if (/not allowed/.test(m)) return 'ليست لديك صلاحية لهذا الإجراء.';
  if (/terminated provider/.test(m)) return 'الحساب الملغى نهائي ولا يمكن إرجاعه.';
  return m;
}
