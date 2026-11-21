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
export const glass={
  fill:'rgba(255,255,255,0.20)',     // card tint over the blur
  depth:'rgba(8,14,28,0.30)',        // faint shade under the tint (legibility over bright areas of the photo)
  field:'rgba(255,255,255,0.16)',    // inputs inside the card
  border:'rgba(255,255,255,0.38)',
  text:'#FFFFFF',
  textSoft:'rgba(255,255,255,0.92)',
  placeholder:'rgba(255,255,255,0.72)',
  error:'#FFB4A8',
  link:'#FFE1AC',
  scrim:'#080E1C',
} as const;
