import type { AgentId } from './agents';

/** ألوان الوكلاء: تدرّج من الكحلي والأزرق إلى الأحمر بحسب ترتيب الأولوية (ألوان Apple System). accent = التوهج والموجات، grad = رأس البطاقة والزر (تباين ≥4.5:1 مع الأبيض). */
export const THEME: Record<AgentId, { accent: string; grad: [string, string] }> = {
  jalal: { accent: '#4C6FD6', grad: ['#1E3A8A', '#16296B'] }, // السيارات والطريق
  talal: { accent: '#30D158', grad: ['#1F7A3A', '#196230'] }, // الصيانة المنزلية: أخضر Apple
  sara: { accent: '#0A84FF', grad: ['#0971DB', '#075DB4'] }, // المرافق
  rashid: { accent: '#2677F7', grad: ['#2470E8', '#1D5CBE'] }, // المعاملات الحكومية
  noura: { accent: '#4269EE', grad: ['#4269EE', '#3656C3'] }, // الطهي
  layla: { accent: '#5E5CE6', grad: ['#5E5CE6', '#4D4BBD'] }, // المشتريات
  reem: { accent: '#7E5BEA', grad: ['#7B59E3', '#6449BA'] }, // التجميل
  karim: { accent: '#9F5BEE', grad: ['#9153D9', '#7744B2'] }, // السفر
  meera: { accent: '#BF5AF2', grad: ['#A44DD0', '#863FAA'] }, // العمل
  mansour: { accent: '#D44EC1', grad: ['#B643A6', '#963788'] }, // المواقع
  khaled: { accent: '#EA4390', grad: ['#C9397C', '#A52F65'] }, // الإنشاءات
  dana: { accent: '#FF375F', grad: ['#DB2F52', '#B42743'] }, // المناسبات
  omar: { accent: '#FF3C53', grad: ['#D43245', '#AE2938'] }, // التعليم
  tareq: { accent: '#FF4046', grad: ['#D4363B', '#AE2C30'] }, // التقنية
  faisal: { accent: '#FF453A', grad: ['#D43930', '#AE2F28'] }, // الموسوعة
};
