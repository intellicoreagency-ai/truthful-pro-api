import type { AgentId } from './agents';

/** ألوان الوكلاء: ألوان Apple النظامية بعد تخفيف التشبع (هدوء)، وكل تدرج رأس بتباين ≥4.5:1 مع النص الأبيض. accent = لون التوهج والنص على الداكن. */
export const THEME: Record<AgentId, { accent: string; grad: [string, string] }> = {
  jalal: { accent: '#C19147', grad: ['#986C26', '#7A561F'] },
  talal: { accent: '#7CB2C9', grad: ['#4D7B8D', '#3E6271'] },
  sara: { accent: '#B66978', grad: ['#AE5667', '#8B4552'] },
  rashid: { accent: '#7F9BE8', grad: ['#1A3578', '#10265C'] },
  noura: { accent: '#B1554F', grad: ['#B7443D', '#923631'] },
  layla: { accent: '#82C3C1', grad: ['#497977', '#3A615F'] },
  reem: { accent: '#63A7B3', grad: ['#3E7B86', '#32626B'] },
  karim: { accent: '#59589D', grad: ['#4A489E', '#3B3A7E'] },
  meera: { accent: '#5BAB6F', grad: ['#39844B', '#2D693C'] },
  mansour: { accent: '#3673B0', grad: ['#1D69B5', '#175491'] },
  khaled: { accent: '#D3BF59', grad: ['#7F7129', '#665A21'] },
  dana: { accent: '#915EAA', grad: ['#8E50AE', '#72408B'] },
  omar: { accent: '#8A7C69', grad: ['#817059', '#685947'] },
  tareq: { accent: '#7E8390', grad: ['#6E7483', '#585D69'] },
  faisal: { accent: '#969698', grad: ['#757577', '#5D5D5F'] },
};
