import React from 'react';
import {ActivityIndicator,StyleSheet,View} from 'react-native';
import {onGlass,space,type} from '../theme';
import {PrimaryButton,SecondaryButton,type AuthText} from './AuthKit';
import {authCopy,type Lang} from './copy';
import {pick} from '../i18n';

/** Step 2 of both flows: waiting for the WhatsApp message to arrive. */
export function WaitingStep({lang,Text:T,error,onOpen,onCancel,onRetry}:{lang:Lang;Text:AuthText;error:string;onOpen:()=>void;onCancel:()=>void;onRetry?:()=>void}){
  const t=pick(authCopy,lang);
  return <View style={s.wrap}>
    <View style={s.status} accessibilityLiveRegion="polite"><ActivityIndicator color={onGlass.link}/><T lang={lang} style={s.statusText}>{t.waiting}</T></View>
    {error?<T lang={lang} style={s.error}>{error}</T>:null}
    <PrimaryButton lang={lang} Text={T} label={t.openWa} onPress={onOpen}/>
    {onRetry?<PrimaryButton lang={lang} Text={T} label={t.retry} onPress={onRetry}/>:null}
    <SecondaryButton lang={lang} Text={T} label={t.cancel} onPress={onCancel}/>
  </View>;
}
const s=StyleSheet.create({
  wrap:{gap:space.lg},
  status:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:space.md,paddingVertical:space.lg,borderRadius:16,backgroundColor:onGlass.field,borderWidth:1,borderColor:onGlass.border},
  statusText:{fontSize:type.callout,color:onGlass.text},
  error:{fontSize:type.footnote,color:onGlass.error,fontWeight:'600',textAlign:'center'},
});
