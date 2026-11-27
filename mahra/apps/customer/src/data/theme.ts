import type { AgentId } from './agents';

/**
 * ألوان الوكلاء (Apple System، الوضع الداكن). accent = التوهج؛ stops = تدرج جسم البطاقة قطرياً من أعلى اليمين (مضيء) إلى أسفل اليسار (عميق) بتباين ≥5:1 للنص الأبيض عند الوسط؛ cta = تدرج زر الإجراء الممتلئ.
 */
export const THEME: Record<AgentId, { accent: string; stops: [string, string, string]; cta: [string, string] }> = {
  jalal: { accent: '#FF4245', stops: ['#FF4245', '#A52338', '#350E20'], cta: ['#C42B45', '#A52338'] }, // السيارات والطريق: أحمر System Red (جدول Apple Dark)
  talal: { accent: '#30D158', stops: ['#30D158', '#198033', '#082910'], cta: ['#1C8A37', '#156E2B'] }, // الصيانة المنزلية: أخضر زمردي
  sara: { accent: '#30D5C8', stops: ['#30D5C8', '#177871', '#082926'], cta: ['#19827A', '#136761'] }, // المرافق: فيروزي
  rashid: { accent: '#0A6CFF', stops: ['#0A6CFF', '#0062F5', '#001D49'], cta: ['#006AFF', '#0054D3'] }, // المعاملات الحكومية: أزرق ياقوتي
  noura: { accent: '#4269EE', stops: ['#4269EE', '#3960E4', '#111C45'], cta: ['#3D67F7', '#2F51C4'] }, // الطهي
  layla: { accent: '#5E5CE6', stops: ['#5E5CE6', '#5E5CE6', '#1A1A45'], cta: ['#6663F8', '#4B49C6'] }, // المشتريات
  reem: { accent: '#7E5BEA', stops: ['#7E5BEA', '#7552E1', '#231843'], cta: ['#7E58F3', '#6445C1'] }, // التجميل
  karim: { accent: '#9F5BEE', stops: ['#9F5BEE', '#8A4BD3', '#29163F'], cta: ['#9551E3', '#7640B5'] }, // السفر
  meera: { accent: '#BF5AF2', stops: ['#BF5AF2', '#9A44C5', '#2E143B'], cta: ['#A64AD5', '#843AAA'] }, // العمل
  mansour: { accent: '#D44EC1', stops: ['#D44EC1', '#B43EA3', '#361231'], cta: ['#C243B0', '#9B348C'] }, // المواقع
  khaled: { accent: '#EA4390', stops: ['#EA4390', '#C73377', '#3C0F24'], cta: ['#D73781', '#AB2B66'] }, // الإنشاءات
  dana: { accent: '#FF375F', stops: ['#FF375F', '#D02648', '#3E0B15'], cta: ['#E1294E', '#B3203D'] }, // المناسبات
  omar: { accent: '#FF3C53', stops: ['#FF3C53', '#D02B3E', '#3E0C12'], cta: ['#E12E43', '#B32334'] }, // التعليم
  tareq: { accent: '#FF4046', stops: ['#FF4046', '#D02E33', '#3E0D0F'], cta: ['#E13237', '#B3262B'] }, // التقنية
  faisal: { accent: '#FF453A', stops: ['#FF453A', '#D03229', '#3E0F0C'], cta: ['#E1362C', '#B32A22'] }, // الموسوعة
};
