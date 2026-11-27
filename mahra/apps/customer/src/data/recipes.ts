import type { AgentId } from './agents';

/**
 * بطاقات الوكلاء (تصميم «الوصفة»): الصورة، تدرج زر الإجراء (من أعلى اليمين إلى أسفل اليسار)، لون الانعكاس على الصورة، والوصف القصير.
 * مربوطة بمعرّف الوكيل فيبقى لون كل وكيل ثابتاً بعد البحث أو إعادة الترتيب.
 */
export type Recipe = { hero: number; cta: [string, string]; glow: string; desc: [string, string] };

export const RECIPE: Record<AgentId, Recipe> = {
  jalal: { hero: require('../../assets/ui/hero-jalal.jpg'), cta: ['#A52338', '#741B30'], glow: '#FF453A', desc: ['أساعدك في أعطال الطريق واختيار خدمة السيارة المناسبة', 'I help with roadside faults and choosing the right car service'] },
  talal: { hero: require('../../assets/ui/hero-talal.jpg'), cta: ['#176448', '#104635'], glow: '#47FFBC', desc: ['أفحص أعطال التكييف والكهرباء والسباكة', 'I check AC, electrical and plumbing faults'] },
  sara: { hero: require('../../assets/ui/hero-sara.jpg'), cta: ['#126568', '#10474D'], glow: '#47F9FF', desc: ['ترتيب المنزل والتنظيف وإدارة الصيانة', 'Home tidying, cleaning and maintenance'] },
  rashid: { hero: require('../../assets/ui/hero-rashid.jpg'), cta: ['#264D96', '#193465'], glow: '#4787FF', desc: ['أتابع معاملاتك الحكومية خطوة بخطوة', 'I follow your government paperwork step by step'] },
  noura: { hero: require('../../assets/ui/hero-noura.jpg'), cta: ['#974424', '#6A3020'], glow: '#FF7A47', desc: ['وصفات وطبخ وضيافة جاهزة لمناسبتك', 'Recipes, cooking and hospitality for your occasion'] },
  layla: { hero: require('../../assets/ui/hero-layla.jpg'), cta: ['#536530', '#394824'], glow: '#C1FF47', desc: ['أجهّز مقاضيك وأوصّلها لباب بيتك', 'I prepare your groceries and deliver them home'] },
  reem: { hero: require('../../assets/ui/hero-reem.jpg'), cta: ['#8B4267', '#602D49'], glow: '#FF47A4', desc: ['مواعيد العناية والتجميل ونصائح الجمال', 'Beauty appointments and personal-care tips'] },
  karim: { hero: require('../../assets/ui/hero-karim.jpg'), cta: ['#255B78', '#193F57'], glow: '#47BFFF', desc: ['رحلات وحجوزات وتنقّل مرتّب من الباب للباب', 'Trips, bookings and door-to-door travel'] },
  meera: { hero: require('../../assets/ui/hero-meera.jpg'), cta: ['#803950', '#592838'], glow: '#FF4783', desc: ['سيرتك الذاتية وتقديماتك وتحضير المقابلة', 'Your CV, applications and interview prep'] },
  mansour: { hero: require('../../assets/ui/hero-mansour.jpg'), cta: ['#275E59', '#1B423F'], glow: '#47FFEE', desc: ['أقرب الخدمات والمواقع في الإمارات وطريق الوصول', 'Nearest services and places in the UAE, with directions'] },
  khaled: { hero: require('../../assets/ui/hero-khaled.jpg'), cta: ['#855334', '#583B2B'], glow: '#FF8E47', desc: ['معاينة ومخططات وعروض أسعار لمشروعك', 'Inspections, plans and quotes for your project'] },
  dana: { hero: require('../../assets/ui/hero-dana.jpg'), cta: ['#794172', '#542D50'], glow: '#FF47E8', desc: ['هدايا وزهور ومناسبات منسّقة بذوق', 'Gifts, flowers and tastefully planned occasions'] },
  omar: { hero: require('../../assets/ui/hero-omar.jpg'), cta: ['#504E8A', '#37365F'], glow: '#4E47FF', desc: ['دروس وتدريب ومتابعة لتقدّمك', 'Lessons, training and progress follow-up'] },
  tareq: { hero: require('../../assets/ui/hero-tareq.jpg'), cta: ['#64479D', '#45316E'], glow: '#8547FF', desc: ['حلول تقنية وشبكات وتجهيزات لعملك', 'Tech fixes, networks and set-ups for your work'] },
  faisal: { hero: require('../../assets/ui/hero-faisal.jpg'), cta: ['#455B73', '#303F52'], glow: '#479FFF', desc: ['بحث وتنظيم وملاحظات وخطة أسبوعك', 'Search, organisation, notes and your weekly plan'] },
};
