/**
 * رموز تصميم مهرة (العميل). الألوان من لوحة Apple للوضع الداكن (system colors) وأدوار النص (label)،
 * مع كحلي ليلي للأرضية (من apple-design: deep navy) وذهبي «شمبانيا» للعلامة والفعل الرئيسي.
 * اللون لا يحمل المعنى وحده: يقترن دائماً بنص أو أيقونة.
 */
export const color = {
  // الأرضية
  night: '#050816',
  ink: '#050816',
  deep: '#0A1430',
  deep2: '#0E1B3D',

  // أدوار النص (Apple label, dark)
  text: '#FFFFFF',
  textDim: 'rgba(235,235,245,0.64)', // secondaryLabel
  textMuted: 'rgba(235,235,245,0.38)', // tertiaryLabel: للزخرفة فقط، لا لنص القراءة

  // الزجاج والفواصل
  glass: 'rgba(255,255,255,0.07)',
  glassStrong: 'rgba(255,255,255,0.12)',
  hairline: 'rgba(255,255,255,0.15)',
  hairlineSoft: 'rgba(255,255,255,0.08)',

  // العلامة
  gold: '#D9BC7E',
  goldBright: '#EBD08E',
  goldDeep: '#A8842F',
  goldText: '#EBD08E',
  pearl: '#EDE7DA',
  periwinkle: '#6B8CFF', // أزرق ناعم لضوء الكرة والحلقة الصوتية (Spatial Glass)
  sapphire: '#0A84FF',
  aqua: '#64D2FF',

  // Apple system colors (dark appearance)
  blue: '#0A84FF',
  green: '#30D158',
  orange: '#FF9F0A',
  pink: '#FF375F',
  pinkSoft: '#FF6482',
  teal: '#40C8E0',
  cyan: '#64D2FF',
  indigo: '#5E5CE6',
  purple: '#BF5AF2',
  yellow: '#FFD60A',
  mint: '#63E6E2',
  red: '#FF453A',
  gray: '#98989D',
  brown: '#AC8E68',

  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF453A',
} as const;

/** تدرّج زر الدخول الرئيسي: أزرق ناعم ← لؤلؤي ← شمبانيا (المنتصف اللؤلؤي يمنع الاخضرار الطيني) */
export const gradient = {
  cta: ['#6B8CFF', '#C3CCEB', '#F3D999'] as const,
  gold: ['#F3DDA0', '#D9BC7E', '#B8924A'] as const,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 } as const;
export const TOUCH = 48;

export const motion = {
  press: 120,
  base: 220,
  breathIdle: 2800,
  breathListening: 950,
  breathSpeaking: 700,
  spinThinking: 2600,
} as const;
