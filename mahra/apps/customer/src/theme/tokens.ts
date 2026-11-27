/**
 * رموز التصميم لمهرة (العميل).
 * اللون يُستعمل دائماً مع نص أو أيقونة؛ لا يُعتمد عليه وحده لنقل المعنى.
 */
export const color = {
  ink: '#060A18',
  deep: '#0B1530',
  pearl: '#EDE7DA',
  gold: '#D9B66B',
  sapphire: '#3D63DD',
  aqua: '#6FC7D1',

  text: '#F3EFE6',
  textDim: 'rgba(237,231,218,0.74)',
  textMuted: 'rgba(237,231,218,0.58)', // للعناصر الثانوية الكبيرة فقط، لا لنص القراءة الصغير

  glass: 'rgba(255,255,255,0.07)',
  glassStrong: 'rgba(255,255,255,0.12)',
  hairline: 'rgba(255,255,255,0.16)',

  success: '#3FA58A',
  warning: '#E0A33C',
  danger: '#D8584E',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 } as const;

/** الحد الأدنى لمساحة اللمس (نقطة) */
export const TOUCH = 48;

export const motion = {
  press: 120,
  base: 220,
  breathIdle: 2800,
  breathListening: 950,
  breathSpeaking: 700,
  spinThinking: 2600,
} as const;
