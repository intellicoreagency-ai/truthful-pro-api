import { Easing } from 'react-native';

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
  /** مواصفات التصميم الدقيقة: شمبانيا كريمي يساراً ← ذهبي 48% ← كوبالت ملكي يميناً؛ النص عليه #070B14 */
  cta: ['#F3DFC1', '#D9B982', '#254EDB'] as const,
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

/** منحنى خروج قوي (ease-out) لكل استجابة لحظية: يبدأ سريعاً فيبدو التطبيق مستجيباً. */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
/** ضغطة سريعة (100ms) وإفلات أبطأ قليلاً (160ms): الاستجابة أسرع من الإرجاع. */
export const pressMs = { in: 100, out: 160 } as const;

/**
 * زجاج الوكلاء الملوّن (مواصفات Spatial Glass): توهج الحافة والتعبئة والزر لكل وكيل.
 * ميرا زمردي، منصور ياقوتي، سارة ذهبي وردي، جلال وخالد عنبري.
 */
export const glow = {
  emerald: { rim: 'rgba(52,211,153,0.45)', tint: 'rgba(16,185,129,0.14)', btn: ['#166534', '#15803D'] as const, ink: '#34D399' },
  sapphire: { rim: 'rgba(96,165,250,0.45)', tint: 'rgba(37,99,235,0.15)', btn: ['#1E3A8A', '#2563EB'] as const, ink: '#60A5FA' },
  rose: { rim: 'rgba(232,181,158,0.45)', tint: 'rgba(201,138,112,0.14)', btn: ['#A8715A', '#C98A70'] as const, ink: '#E8B59E' },
  amber: { rim: 'rgba(251,191,36,0.45)', tint: 'rgba(217,119,6,0.14)', btn: ['#92400E', '#B45309'] as const, ink: '#FBBF24' },
} as const;
export type Tone = keyof typeof glow;
