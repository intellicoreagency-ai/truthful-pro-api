/**
 * رموز تصميم تطبيق المزود: فاتح عالي التباين لأنه يُستعمل في الشمس وبيد واحدة.
 * يشارك العميل هويته (الكحلي والذهبي واللؤلؤة) لكن بسطوح فاتحة.
 */
export const color = {
  ink: '#0B1530',
  deep: '#0E1B3D',
  canvas: '#F3F5F9',
  surface: '#FFFFFF',
  line: '#DCE1EA',
  lineSoft: '#E8ECF3',
  text: '#111A33',
  dim: '#4A5675',
  gold: '#D9B66B',
  goldInk: '#7A5C17',
  sapphire: '#2F54C9',
  aqua: '#6FC7D1',
  ok: '#12805C',
  okBg: '#E3F4EE',
  bad: '#B8332A',
  badBg: '#FBE9E7',
  warn: '#8F5600',
  warnBg: '#FDF1D9',
  info: '#2F54C9',
  infoBg: '#E8EDFB',
  onInk: '#F3EFE6',
  onInkDim: 'rgba(243,239,230,0.74)',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
/** أكبر من الحد الأدنى (44): المزود يلمس بقفازات أحياناً وبيد واحدة */
export const TOUCH = 52;
