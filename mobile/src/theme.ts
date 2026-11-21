import {Platform, StyleSheet} from 'react-native';

/** Single source of design tokens (see .claude/skills/apple-design/SKILL.md). The values are the approved Truthful palette. */
export const colors={
  background:'#F8F3ED',   // screen background
  white:'#FFF9F4',        // surface / card (warm white)
  ink:'#30251F',          // primary text
  muted:'#76665B',        // secondary text
  line:'#E9DACC',         // separators
  orange:'#FF8A00',       // primary action
  gold:'#FFB341',
  brown:'#3C281B',
  brand:'#98500C',        // selected / brand text (contrast ≥ 4.5:1 on the surface)
  brandTint:'#F5E9CE',    // selected fill
  danger:'#A3261A',
  chrome:'rgba(255,249,244,0.72)', // translucent bar tint over the blur
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

/** Glass (frosted) material used on the photo-backed auth screens: translucent white over a blur, white text. */
/**
 * Premium (concierge) layer: gold gradients, ivory glass, espresso depth.
 * Gold used as TEXT only at display sizes (≥ 22 pt bold) and with the darker stops, so it stays ≥ 3:1 on ivory.
 */
export const lux={
  ivory:'#FBF6EE',
  sand:'#F3E6D2',
  espresso:'#24170E',
  espressoSoft:'#3D2817',
  goldText:['#8A5A1E','#B27A2C','#7A4C14'] as const,     // display text on light grounds
  goldBright:['#F7DFA6','#E2B565','#C08A3A'] as const,   // borders, icons on dark grounds
  goldBadge:['#FCEBC6','#EDC783','#D9A653'] as const,    // icon badge fill (espresso icon on top)
  goldBorder:['rgba(255,255,255,0.95)','rgba(232,196,128,0.9)','rgba(255,255,255,0.6)'] as const,
  sheen:['rgba(255,255,255,0.78)','rgba(255,252,246,0.46)'] as const, // card surface over the blur
  shadow:'#5A3A12',
  /** Action fill with ESPRESSO text/icons (≈ 7:1). White text on bright orange is only ≈ 2.4:1, below AA. */
  orange:['#FFB04D','#FF8A00','#F57F00'] as const,
  /** Deeper fill for WHITE icons on icon-only buttons (≥ 3:1 for graphics). */
  orangeDeep:['#E87400','#D16000','#B85400'] as const,
  onDark:'#FFF6E8',
  onDarkSoft:'rgba(255,246,232,0.78)',
} as const;

export const glass={
  fill:'rgba(255,255,255,0.20)',     // card tint over the blur
  field:'rgba(255,255,255,0.16)',    // inputs inside the card
  border:'rgba(255,255,255,0.38)',
  text:'#FFFFFF',
  textSoft:'rgba(255,255,255,0.92)',
  placeholder:'rgba(255,255,255,0.72)',
  error:'#FFB4A8',
  link:'#FFE1AC',
  scrim:'#080E1C',
} as const;

/** Colours INSIDE the light frosted card: dark text on light glass (Apple "light material"). */
export const onGlass={
  text:'#30251F',
  soft:'#5A4A3F',
  placeholder:'rgba(48,37,31,0.50)',
  field:'rgba(255,255,255,0.42)',
  border:'rgba(255,255,255,0.75)',
  link:'#98500C',
  error:'#A3261A',
  box:'#5A4A3F',
} as const;
