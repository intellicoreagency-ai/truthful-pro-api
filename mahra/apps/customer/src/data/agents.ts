import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type AgentId =
  | 'jalal' | 'layla' | 'noura' | 'talal' | 'khaled' | 'sara' | 'rashid' | 'karim'
  | 'reem' | 'dana' | 'omar' | 'tareq' | 'mansour' | 'faisal' | 'meera';

/** لهجات الوكلاء بالعربية: خمس لهجات، بلا مغاربية. الاستثناء الوحيد: راشد إماراتي (يمثل جهة إماراتية وحيدة). مهرة نفسها إماراتية. */
export type Dialect = 'emirati' | 'jordanian' | 'lebanese' | 'syrian' | 'egyptian' | 'saudi';

/** الجنسية بحسب جنس الوكيل: [مذكر, مؤنث] */
export const DIALECT_LABEL: Record<Dialect, { ar: [string, string]; en: string }> = {
  emirati: { ar: ['إماراتي', 'إماراتية'], en: 'Emirati' },
  jordanian: { ar: ['أردني', 'أردنية'], en: 'Jordanian' },
  lebanese: { ar: ['لبناني', 'لبنانية'], en: 'Lebanese' },
  syrian: { ar: ['سوري', 'سورية'], en: 'Syrian' },
  egyptian: { ar: ['مصري', 'مصرية'], en: 'Egyptian' },
  saudi: { ar: ['سعودي', 'سعودية'], en: 'Saudi' },
};

export type Agent = {
  id: AgentId;
  name: { ar: string; en: string };
  role: { ar: string; en: string };
  summary: { ar: string; en: string };
  icon: IconName;
  accent: string;
  gender: 'm' | 'f';
  /** لهجة الوكيل وجنسيته عند التحدث بالعربية؛ مع غير العرب يتبع لغة العميل */
  dialect: Dialect;
  /** live: يعمل في الإصدار الأول. soon: يُفعَّل لاحقاً. */
  status: 'live' | 'soon';
  /** الوكيل يرتبط بمزودي خدمة وعمولة؟ فيصل وعمر وميرا بلا عمولة. */
  hasCommission: boolean;
};

/**
 * ترتيب العرض: السيارات أولاً لأنها المسار الأول، ثم البيت والطعام (أولويات اليوم)، ثم الباقي.
 * المصدر: دليل الوكلاء v18.
 */
export const AGENTS: Agent[] = [
  { id: 'jalal', name: { ar: 'جلال', en: 'Jalal' }, role: { ar: 'السيارات والمساعدة على الطريق', en: 'Cars and roadside help' },
    summary: { ar: 'يفهم العطل من صورة وأسئلة، ويطلب لك سطحة أو ورشة.', en: 'Diagnoses from a photo and questions, then gets you a tow or a garage.' },
    icon: 'car-sport-outline', accent: '#FF9F0A', gender: 'm', dialect: 'jordanian', status: 'live', hasCommission: true },
  { id: 'sara', name: { ar: 'سارة', en: 'Sara' }, role: { ar: 'إدارة المنزل والتنظيف', en: 'Home management and cleaning' },
    summary: { ar: 'ترتيب الغرف، تنظيف، دراي كلين، وعناية بالمنزل.', en: 'Room tidying, cleaning, dry cleaning and home care.' },
    icon: 'sparkles-outline', accent: '#FF6482', gender: 'f', dialect: 'syrian', status: 'soon', hasCommission: true },
  { id: 'noura', name: { ar: 'نورة', en: 'Noura' }, role: { ar: 'الطهي والوصفات والضيافة', en: 'Cooking, recipes and hosting' },
    summary: { ar: 'وصفات من الموجود عندك، وترتيب ضيافة سهلة.', en: 'Recipes from what you have, and easy hosting plans.' },
    icon: 'restaurant-outline', accent: '#FF453A', gender: 'f', dialect: 'lebanese', status: 'soon', hasCommission: false },
  { id: 'talal', name: { ar: 'طلال', en: 'Talal' }, role: { ar: 'الصيانة والمرافق المنزلية', en: 'Home maintenance' },
    summary: { ar: 'تكييف، سباكة، كهرباء، وأعطال المنزل.', en: 'AC, plumbing, electrical and household faults.' },
    icon: 'construct-outline', accent: '#40C8E0', gender: 'm', dialect: 'jordanian', status: 'soon', hasCommission: true },
  { id: 'layla', name: { ar: 'ليلى', en: 'Layla' }, role: { ar: 'المشتريات والتوريد المنزلي', en: 'Shopping and household supplies' },
    summary: { ar: 'قوائم الاحتياجات والبدائل والتوريد في موعده.', en: 'Needs lists, substitutes and on-time delivery.' },
    icon: 'basket-outline', accent: '#64D2FF', gender: 'f', dialect: 'syrian', status: 'soon', hasCommission: true },
  { id: 'khaled', name: { ar: 'خالد', en: 'Khaled' }, role: { ar: 'الهندسة والمقاولات والديكور', en: 'Engineering, contracting and décor' },
    summary: { ar: 'معاينة، عروض مرحلية، ومتابعة المشروع حتى الاكتمال.', en: 'Site visits, staged quotes and project follow-through.' },
    icon: 'business-outline', accent: '#FFD60A', gender: 'm', dialect: 'egyptian', status: 'soon', hasCommission: true },
  { id: 'rashid', name: { ar: 'راشد', en: 'Rashid' }, role: { ar: 'المعاملات والخدمات الحكومية', en: 'Paperwork and government services' },
    summary: { ar: 'يستقبل طلبك ويجهز مستنداتك ويسلّمه لـ«تروثفل لخدمات التخليص»، الجهة الوحيدة لهذه المعاملات.', en: 'Takes your request, prepares your documents and hands it to Truthful Clearance Services, our only provider for these transactions.' },
    icon: 'document-text-outline', accent: '#D9BC7E', gender: 'm', dialect: 'emirati', status: 'soon', hasCommission: true },
  { id: 'karim', name: { ar: 'كريم', en: 'Karim' }, role: { ar: 'التنقل والسفر', en: 'Transport and travel' },
    summary: { ar: 'رحلات، مشاوير، وحجوزات مرتبة.', en: 'Trips, rides and organised bookings.' },
    icon: 'airplane-outline', accent: '#5E5CE6', gender: 'm', dialect: 'saudi', status: 'soon', hasCommission: true },
  { id: 'reem', name: { ar: 'د. ريم', en: 'Dr Reem' }, role: { ar: 'الصحة والعافية والتجميل', en: 'Health, wellness and beauty' },
    summary: { ar: 'مواعيد وإرشاد عام، دون تشخيص طبي.', en: 'Appointments and general guidance, no medical diagnosis.' },
    icon: 'heart-outline', accent: '#FF375F', gender: 'f', dialect: 'lebanese', status: 'soon', hasCommission: true },
  { id: 'dana', name: { ar: 'دانة', en: 'Dana' }, role: { ar: 'الفعاليات والهدايا والستايل', en: 'Events, gifts and styling' },
    summary: { ar: 'مناسبات وتصوير وهدايا وأفكار للمظهر.', en: 'Occasions, photography, gifts and style ideas.' },
    icon: 'gift-outline', accent: '#BF5AF2', gender: 'f', dialect: 'jordanian', status: 'soon', hasCommission: true },
  { id: 'omar', name: { ar: 'أ. عمر', en: 'Mr Omar' }, role: { ar: 'التعليم والتدريب', en: 'Education and training' },
    summary: { ar: 'خطط تعلم ودروس مناسبة لمستواك.', en: 'Learning plans and lessons that fit your level.' },
    icon: 'school-outline', accent: '#63E6E2', gender: 'm', dialect: 'egyptian', status: 'soon', hasCommission: false },
  { id: 'tareq', name: { ar: 'طارق', en: 'Tareq' }, role: { ar: 'الحلول التقنية والأعمال', en: 'Tech and business solutions' },
    summary: { ar: 'مشكلة تقنية أو أداة لتطوير عملك.', en: 'A tech problem or a tool to grow your work.' },
    icon: 'hardware-chip-outline', accent: '#AEB4C4', gender: 'm', dialect: 'egyptian', status: 'soon', hasCommission: true },
  { id: 'mansour', name: { ar: 'منصور', en: 'Mansour' }, role: { ar: 'الخرائط والمواقع في الإمارات', en: 'Maps and places in the UAE' },
    summary: { ar: 'أقرب خدمة، ورابط خرائط جوجل، وتفاصيل الوصول.', en: 'Nearest service, a Google Maps link and directions.' },
    icon: 'map-outline', accent: '#0A84FF', gender: 'm', dialect: 'syrian', status: 'soon', hasCommission: false },
  { id: 'faisal', name: { ar: 'فيصل', en: 'Faisal' }, role: { ar: 'البحث والترتيب العام', en: 'Research and general organisation' },
    summary: { ar: 'يبحث ويرتب المعلومات ويلخصها لك.', en: 'Searches, organises and summarises for you.' },
    icon: 'search-outline', accent: '#AC8E68', gender: 'm', dialect: 'saudi', status: 'soon', hasCommission: false },
  { id: 'meera', name: { ar: 'ميرا', en: 'Meera' }, role: { ar: 'التوظيف والسيرة الذاتية', en: 'Jobs and CV' },
    summary: { ar: 'تبحث عن وظائف، تجهز سيرتك، وتقدّم نيابة عنك.', en: 'Finds jobs, prepares your CV and applies for you.' },
    icon: 'briefcase-outline', accent: '#30D158', gender: 'f', dialect: 'lebanese', status: 'soon', hasCommission: false },
];

export const agentById = (id: string): Agent | undefined => AGENTS.find((a) => a.id === id);

/** جنسية الوكيل للعرض: «أردني/أردنية» بالعربية، وبالإنجليزية الاسم نفسه */
export function nationality(a: Agent, lang: 'ar' | 'en'): string {
  const l = DIALECT_LABEL[a.dialect];
  return lang === 'ar' ? l.ar[a.gender === 'm' ? 0 : 1] : l.en;
}
