import {Platform, StyleSheet} from 'react-native';

/** Single source of design tokens (see .claude/skills/apple-design/SKILL.md). The values are the approved Truthful palette. */
export const colors={
  background:'#F3F5F8',   // pearl screen background
  white:'#FFFFFF',        // surface / card
  ink:'#0E1526',          // primary text (ink navy)
  muted:'#5B6475',        // secondary text (slate, ≥ 5.5:1 on pearl)
  line:'#E3E7EE',         // separators
  orange:'#1D3A9E',       // primary action / progress (sapphire). Name kept so existing styles keep working.
  gold:'#D9BC7E',         // champagne gold accents (graphics only, not body text)
  brown:'#0A1430',        // deep navy (dark grounds, shadows)
  brand:'#1D3A9E',        // selected / brand text: sapphire (≈ 9:1 on white)
  brandTint:'#E8EDFB',    // selected fill
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
 * Premium layer — "Sapphire & gold": deep navy grounds, pearl pages, sapphire actions, champagne-gold details.
 * Gold is used as TEXT only with the dark stops (≥ 4.5:1 on white); bright gold is for icons, rings and hairlines.
 * Key names predate the palette (ivory/espresso/orange) and are kept so every screen picks up the new values.
 */
export const lux={
  ivory:'#F3F5F8',                                        // pearl page
  sand:'#E9ECF2',
  espresso:'#0A1430',                                     // deep navy: dark grounds and glyphs on gold
  espressoSoft:'#14214A',
  goldText:['#76592A','#8A6A2F','#6A4F24'] as const,      // display text on light grounds
  goldBright:['#F1DDAA','#D9BC7E','#B8893F'] as const,    // borders, icons on dark grounds
  goldBadge:['#F6EBD0','#E9D3A0','#D9BC7E'] as const,     // icon badge fill (navy icon on top)
  goldBorder:['rgba(255,255,255,0.95)','rgba(217,188,126,0.85)','rgba(255,255,255,0.6)'] as const,
  sheen:['rgba(255,255,255,0.82)','rgba(248,250,253,0.52)'] as const, // card surface over the blur
  shadow:'#0A1430',
  /** Primary action fill (sapphire) with WHITE text/icons (≥ 7:1). */
  orange:['#2A4BB8','#1D3A9E','#17318A'] as const,
  /** Deeper fill for white icons on icon-only buttons. */
  orangeDeep:['#2443AA','#1A3590','#132A75'] as const,
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
  link:'#F1DDAA',
  scrim:'#080E1C',
} as const;

/** Colours INSIDE the light frosted card: dark text on light glass (Apple "light material"). */
export const onGlass={
  text:'#0E1526',
  soft:'#3E4860',
  placeholder:'rgba(14,21,38,0.50)',
  field:'rgba(255,255,255,0.42)',
  border:'rgba(255,255,255,0.75)',
  link:'#1D3A9E',
  error:'#A3261A',
  box:'#3E4860',
} as const;
