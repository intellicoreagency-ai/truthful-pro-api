import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { AgentId } from './agents';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * ترتيب الوكلاء حسب أولوية الاحتياجات الشخصية اليومية للسكان في الإمارات، من الأكثر استعمالاً.
 * هذا اجتهاد تحريري مبني على طبيعة الحاجة وتكرارها، لا على بيانات استخدام فعلية؛ يُستبدل بإحصاءات حقيقية عند توفرها.
 * 1 السيارة (أكثر الأعطال إلحاحاً) 2 الصيانة المنزلية (التكييف) 3 النظافة 4 المعاملات الحكومية 5 الطهي
 * 6 المشتريات 7 الصحة 8 التنقل والسفر 9 التوظيف 10 الخرائط 11 المقاولات 12 المناسبات 13 التعليم 14 التقنية 15 البحث
 */
export const PRIORITY: AgentId[] = ['jalal', 'talal', 'sara', 'rashid', 'noura', 'layla', 'reem', 'karim', 'meera', 'mansour', 'khaled', 'dana', 'omar', 'tareq', 'faisal'];

/** نصوص البطاقة: [عنوان عربي، إنجليزي]، [وصف عربي، إنجليزي]، وأيقونة الخدمة الثانوية لمن لا يملك رسماً في التصميم */
export const CARD: Record<AgentId, { title: [string, string]; sub: [string, string]; second: IconName }> = {
  jalal: { title: ['جلال - مستشار السيارات', 'Jalal – Car advisor'], sub: ['خدمات واستشارات قطع السيارات', 'Car parts services and advice'], second: 'car-outline' },
  talal: { title: ['طلال - الصيانة المنزلية', 'Talal – Home maintenance'], sub: ['تكييف وسباكة وكهرباء وأعطال المنزل', 'AC, plumbing, electrical and home faults'], second: 'snow-outline' },
  sara: { title: ['سارة - رعاية المرافق', 'Sara – Facility care'], sub: ['إدارة الصيانة والمرافق السكنية', 'Maintenance and residential facilities'], second: 'business-outline' },
  rashid: { title: ['راشد - المعاملات الحكومية', 'Rashid – Government services'], sub: ['تخليص معاملاتك عبر تروثفل', 'Paperwork cleared through Truthful'], second: 'shield-checkmark-outline' },
  noura: { title: ['نورة - الطهي والضيافة', 'Noura – Cooking and hosting'], sub: ['وصفات من الموجود وضيافة سهلة', 'Recipes from what you have'], second: 'flame-outline' },
  layla: { title: ['ليلى - المشتريات', 'Layla – Shopping'], sub: ['قوائم احتياجات وتوريد في موعده', 'Needs lists and on-time delivery'], second: 'cart-outline' },
  reem: { title: ['د. ريم - الصحة والعافية', 'Dr Reem – Health and wellness'], sub: ['مواعيد وإرشاد عام دون تشخيص طبي', 'Appointments and general guidance, no diagnosis'], second: 'medkit-outline' },
  karim: { title: ['كريم - التنقل والسفر', 'Karim – Transport and travel'], sub: ['رحلات ومشاوير وحجوزات مرتبة', 'Trips, rides and bookings'], second: 'bus-outline' },
  meera: { title: ['ميرا - أخصائية التوظيف', 'Meera – Recruitment'], sub: ['مساعدة في التوظيف والموارد البشرية', 'Help with jobs and HR'], second: 'document-text-outline' },
  mansour: { title: ['منصور - خبير خرائط الإمارات', 'Mansour – UAE maps'], sub: ['ملاحة ومعلومات جغرافية دقيقة', 'Navigation and precise geo info'], second: 'navigate-outline' },
  khaled: { title: ['خالد - الهندسة والمقاولات', 'Khaled – Engineering'], sub: ['معاينة وعروض مرحلية ومتابعة المشروع', 'Site visits, staged quotes, follow-up'], second: 'hammer-outline' },
  dana: { title: ['دانة - الفعاليات والهدايا', 'Dana – Events and gifts'], sub: ['مناسبات وتصوير وهدايا وأفكار للمظهر', 'Occasions, photography, gifts, style'], second: 'camera-outline' },
  omar: { title: ['أ. عمر - التعليم والتدريب', 'Mr Omar – Education'], sub: ['خطط تعلم ودروس تناسب مستواك', 'Learning plans and lessons'], second: 'book-outline' },
  tareq: { title: ['طارق - الحلول التقنية', 'Tareq – Tech solutions'], sub: ['مشكلة تقنية أو أداة لتطوير عملك', 'A tech problem or business tool'], second: 'laptop-outline' },
  faisal: { title: ['فيصل - البحث والترتيب', 'Faisal – Research'], sub: ['يبحث ويرتب ويلخص لك', 'Searches, organises and summarises'], second: 'newspaper-outline' },
};

/** نص زر الإجراء لكل وكيل: [عربي، إنجليزي] */
export const CTA: Record<AgentId, [string, string]> = {
  jalal: ['اطلب سطحة', 'Request a tow'], talal: ['احجز فنياً', 'Book a technician'], sara: ['اطلب تنظيفاً', 'Request cleaning'],
  rashid: ['ابدأ معاملة', 'Start a transaction'], noura: ['اقترح وصفة', 'Suggest a recipe'], layla: ['جهّز قائمتي', 'Prepare my list'],
  reem: ['احجز موعداً', 'Book an appointment'], karim: ['رتّب رحلة', 'Plan a trip'], meera: ['حدّث سيرتي', 'Update my CV'],
  mansour: ['ابحث عن مكان', 'Find a place'], khaled: ['اطلب معاينة', 'Request inspection'], dana: ['نظّم مناسبة', 'Plan an event'],
  omar: ['ابدأ درساً', 'Start a lesson'], tareq: ['حلّ مشكلة', 'Fix an issue'], faisal: ['ابحث لي', 'Research for me'],
};
