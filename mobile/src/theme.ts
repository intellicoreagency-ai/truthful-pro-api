import {Platform, StyleSheet} from 'react-native';

/** Single source of design tokens (see .claude/skills/apple-design/SKILL.md). The values are the approved Truthful palette. */
export const colors={
  background:'#F4F5F7',   // pearl screen background
  white:'#FFFFFF',        // surface / card
  ink:'#0B1F3A',          // primary text (royal navy)
  muted:'#55606F',        // secondary text (slate, ≥ 5.5:1 on pearl)
  line:'#E3E7EE',         // separators
  orange:'#0B1F3A',       // primary action / progress (royal navy). Name kept so existing styles keep working.
  gold:'#C9A45C',         // royal gold accents (graphics only, not body text)
  brown:'#0B1F3A',        // royal navy (dark grounds, shadows)
  brand:'#0B1F3A',        // selected / brand text: royal navy (≈ 16:1 on white)
  brandTint:'#E6EAF2',    // selected fill
  danger:'#A3261A',
  chrome:'rgba(255,255,255,0.78)', // translucent bar tint over the blur
};

/** 4 pt rhythm. */
export const space={xs:4,sm:8,md:12,lg:16,xl:20,xxl:24} as const;
export const radius={control:12,card:20,pill:999} as const;
/** HIG text styles (pt). Nothing a user must read goes below `caption`. */
export const type={largeTitle:34,title:28,title2:22,headline:17,body:17,callout:16,subhead:15,footnote:13,caption:12,tabLabel:11} as const;
export const layout={
  tabBar:49,                                   // HIG tab bar content height (excl. home-indicator inset)
  minTouch:Platform.OS==='android'?48:44,      // 48 dp on Android, 44 pt on iOS
  hairline:StyleSheet.hairlineWidth,
  maxFontScale:1.35,
} as const;

/**
 * Premium layer — "Royal navy & gold": navy grounds and actions, pearl pages, royal-gold details.
 * Gold is used as TEXT only with the dark stops (≥ 4.5:1 on white); bright gold is for icons, rings and hairlines.
 * Key names predate the palette (ivory/espresso/orange) and are kept so every screen picks up the new values.
 */
export const lux={
  ivory:'#F4F5F7',                                        // pearl page
  sand:'#E9ECF2',
  espresso:'#0B1F3A',                                     // deep navy: dark grounds and glyphs on gold
  espressoSoft:'#16305A',
  goldText:['#6E5426','#80622C','#5E4720'] as const,      // display text on light grounds
  goldBright:['#E9D5A6','#C9A45C','#A8843F'] as const,    // borders, icons on dark grounds
  goldBadge:['#F3EAD6','#E2CC97','#C9A45C'] as const,     // icon badge fill (navy icon on top)
  goldBorder:['rgba(255,255,255,0.95)','rgba(201,164,92,0.85)','rgba(255,255,255,0.6)'] as const,
  sheen:['rgba(255,255,255,0.82)','rgba(248,250,253,0.52)'] as const, // card surface over the blur
  shadow:'#0B1F3A',
  /** Primary action fill (royal navy) with WHITE text/icons (≥ 12:1). */
  orange:['#16305A','#0B1F3A','#08182E'] as const,
  /** Deeper fill for white icons on icon-only buttons. */
  orangeDeep:['#16305A','#0B1F3A','#08182E'] as const,
  onAction:'#FFFFFF',
  onDark:'#F2F5FB',
  onDarkSoft:'rgba(242,245,251,0.78)',
} as const;

export const glass={
  fill:'rgba(255,255,255,0.20)',     // card tint over the blur
  field:'rgba(255,255,255,0.16)',    // inputs inside the card
  border:'rgba(255,255,255,0.38)',
  text:'#FFFFFF',
  textSoft:'rgba(255,255,255,0.92)',
  placeholder:'rgba(255,255,255,0.72)',
  error:'#FFB4A8',
  link:'#E9D5A6',
  scrim:'#080E1C',
} as const;

/** Colours INSIDE the light frosted card: dark text on light glass (Apple "light material"). */
export const onGlass={
  text:'#0B1F3A',
  soft:'#3E4860',
  placeholder:'rgba(11,31,58,0.50)',
  field:'rgba(255,255,255,0.42)',
  border:'rgba(255,255,255,0.75)',
  link:'#0B1F3A',
  error:'#A3261A',
  box:'#3E4860',
} as const;
