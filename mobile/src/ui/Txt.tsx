import React from 'react';
import {StyleSheet,Text} from 'react-native';
import {colors,layout} from '../theme';

import type {Lang} from '../i18n';
export type {Lang};
/**
 * Text for redesigned screens (dark ink on light surfaces). Arabic: Cairo. English: the platform system font (SF Pro on iOS).
 * Weight comes from `fontWeight` in the style or the `bold` shortcut.
 */
export function Txt({lang,bold=false,style,numberOfLines,children}:{lang:Lang;bold?:boolean;style?:object;numberOfLines?:number;children:React.ReactNode}){
  const w=String((StyleSheet.flatten(style) as {fontWeight?:string}|undefined)?.fontWeight??(bold?'700':'400'));
  const ar=lang==='ar';
  return <Text maxFontSizeMultiplier={layout.maxFontScale} numberOfLines={numberOfLines}
    style={[{color:colors.ink,textAlign:ar?'right':'left',writingDirection:ar?'rtl':'ltr'},bold?{fontWeight:'700'}:null,style,
      ar?{fontFamily:['700','800','900','bold'].includes(w)?'CairoBold':w==='600'?'CairoSemiBold':'CairoRegular',fontWeight:'normal'}:null]}>{children}</Text>;
}
