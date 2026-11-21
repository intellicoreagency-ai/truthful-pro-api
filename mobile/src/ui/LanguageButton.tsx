/**
 * Language control: a slim pill with a fine gold ring, a gold globe and the current language's short code.
 * `tone="dark"` sits on photos and navy grounds, `tone="light"` on pearl pages. It opens the app-wide language menu.
 */
import React from 'react';
import {Platform,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {BlurView} from 'expo-blur';
import {ScalePressable} from './Premium';
import {Icon} from '../Icons';
import {Txt} from './Txt';
import {LANG_INFO,type Lang} from '../i18n';
import {colors,layout,lux,radius,space,type} from '../theme';

const LABEL:Record<Lang,string>={ar:'اللغة',en:'Language',ru:'Язык',zh:'语言',fr:'Langue',es:'Idioma'};

export function LanguageButton({lang,onPress,tone='light'}:{lang:Lang;onPress:()=>void;tone?:'light'|'dark'}){
  const dark=tone==='dark';
  return <ScalePressable accessibilityRole="button" accessibilityLabel={`${LABEL[lang]}: ${LANG_INFO[lang].native}`} onPress={onPress}
    rippleColor={dark?'rgba(255,255,255,0.25)':'rgba(29,58,158,0.14)'} style={s.hit}>
    <LinearGradient colors={lux.goldBright} start={{x:0,y:0}} end={{x:1,y:1}} style={s.ring}>
      <View style={[s.inner,dark?s.innerDark:s.innerLight]}>
        {dark&&Platform.OS!=='web'?<BlurView pointerEvents="none" tint="dark" intensity={40} style={StyleSheet.absoluteFill}/>:null}
        <View pointerEvents="none" style={s.row}>
          <Icon name="globe" size={17} color={dark?lux.goldBright[0]:lux.goldText[1]}/>
          <Txt lang={lang==='ar'?'ar':'en'} bold style={{...s.code,color:dark?lux.onDark:colors.ink}}>{LANG_INFO[lang].short}</Txt>
        </View>
      </View>
    </LinearGradient>
  </ScalePressable>;
}

const s=StyleSheet.create({
  hit:{minHeight:layout.minTouch,justifyContent:'center'},
  ring:{borderRadius:radius.pill,padding:1.2},
  inner:{minHeight:layout.minTouch-4,minWidth:68,paddingHorizontal:space.md,borderRadius:radius.pill,overflow:'hidden',justifyContent:'center'},
  innerDark:{backgroundColor:'rgba(10,20,48,0.55)'},
  innerLight:{backgroundColor:'rgba(255,255,255,0.92)'},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},
  code:{fontSize:type.subhead,lineHeight:20,letterSpacing:0.4},
});
