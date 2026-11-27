import type { AgentId } from './agents';

/** لون كل وكيل بحسب طبيعة عمله (ألوان Apple هادئة)، ورأس كل بطاقة بتباين ≥4.5:1 مع الأبيض. accent = لون التوهج والموجات. */
export const THEME: Record<AgentId, { accent: string; grad: [string, string] }> = {
  jalal: { accent: '#EB9F6A', grad: ['#A0673E', '#805232'] }, // الطريق والوقود: برتقالي
  talal: { accent: '#75C7EB', grad: ['#417A93', '#346276'] }, // التبريد والتكييف: سماوي
  sara: { accent: '#81EBC7', grad: ['#3D7D68', '#316453'] }, // النظافة والانتعاش: نعناعي
  rashid: { accent: '#7175EB', grad: ['#565ACC', '#4548A3'] }, // الرسمي والحكومي: كحلي نيلي
  noura: { accent: '#EB7175', grad: ['#BC4F53', '#963F42'] }, // الطهي والنار: أحمر
  layla: { accent: '#CDEB75', grad: ['#677835', '#53602A'] }, // التسوق الطازج: ليموني
  reem: { accent: '#EB7AA9', grad: ['#B4537C', '#904263'] }, // التجميل: وردي
  karim: { accent: '#71A5EB', grad: ['#4974AD', '#3A5D8B'] }, // السفر والسماء: أزرق
  meera: { accent: '#75EB8D', grad: ['#398248', '#2E6839'] }, // العمل والنمو: أخضر
  mansour: { accent: '#75EBEB', grad: ['#377D7D', '#2C6464'] }, // المواقع والخرائط: فيروزي
  khaled: { accent: '#EBC959', grad: ['#88722B', '#6D5B23'] }, // الإنشاءات: كهرماني
  dana: { accent: '#D97FEB', grad: ['#9E53AD', '#7F438B'] }, // المناسبات: بنفسجي
  omar: { accent: '#A37AEB', grad: ['#865ECC', '#6B4BA3'] }, // التعليم: بنفسجي مزرق
  tareq: { accent: '#C5D3EB', grad: ['#6A7588', '#555D6D'] }, // التقنية: رمادي معدني
  faisal: { accent: '#EBCC96', grad: ['#826E4C', '#68583C'] }, // الموسوعة والمعرفة: رملي/برونزي
};
