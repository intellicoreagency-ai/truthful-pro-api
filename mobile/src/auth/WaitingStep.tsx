import React,{useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,View} from 'react-native';
import {onGlass,space,type} from '../theme';
import {PrimaryButton,SecondaryButton,type AuthText} from './AuthKit';
import {authCopy,type Lang} from './copy';
import {pick} from '../i18n';

const LRI='⁦',PDI='⁩'; // keep the code and timer left-to-right inside Arabic text

/**
 * Step 2 of sign-in and registration: confirm the number on WhatsApp.
 * The screen shows the code, says exactly what to do (open, send, come back) and counts down; WhatsApp opens only when
 * the person taps the button. The app keeps checking in the background and signs the person in by itself once the
 * message has arrived, so there is nothing to type back.
 */
export function WaitingStep({lang,Text:T,error,code,expiresAt,onOpen,onCancel,onRetry,onStagingConfirm}:{lang:Lang;Text:AuthText;error:string;code?:string;expiresAt?:number;onOpen:()=>void;onCancel:()=>void;onRetry?:()=>void;onStagingConfirm?:()=>void}){
  const t=pick(authCopy,lang),ar=lang==='ar';
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{if(!expiresAt)return;const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[expiresAt]);
  const left=expiresAt?Math.max(0,Math.round((expiresAt-now)/1000)):0;
  const clock=`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
  const align={textAlign:(ar?'right':'left') as 'right'|'left'};
  const steps=[t.step1,t.step2,t.step3];
  return <View style={s.wrap}>
    {code?<View style={s.codeCard} accessible accessibilityLabel={`${t.codeLabel}: ${code.split('').join(' ')}`}>
      <T lang={lang} style={s.codeLabel}>{t.codeLabel}</T>
      <T lang="en" style={s.code} numberOfLines={1}>{code}</T>
      {expiresAt?<T lang={lang} style={s.expires}>{t.expires} {LRI}{clock}{PDI}</T>:null}
    </View>:null}

    <View style={s.steps}>
      {steps.map((text,i)=><View key={i} style={[s.step,{flexDirection:ar?'row-reverse':'row'}]}>
        <View style={s.num}><T lang="en" style={s.numText}>{String(i+1)}</T></View>
        <T lang={lang} style={[s.stepText,align]}>{text}</T>
      </View>)}
    </View>

    <PrimaryButton lang={lang} Text={T} label={t.openWa} onPress={onOpen}/>
    <View style={s.status} accessibilityLiveRegion="polite"><ActivityIndicator color={onGlass.link}/><T lang={lang} style={s.statusText}>{t.waiting}</T></View>
    {error?<T lang={lang} style={s.error}>{error}</T>:null}
    {onStagingConfirm?<View style={s.staging}><T lang={lang} style={s.stagingNote}>{t.stagingNote}</T><PrimaryButton lang={lang} Text={T} label={t.stagingConfirm} onPress={onStagingConfirm}/></View>:null}
    {onRetry?<PrimaryButton lang={lang} Text={T} label={t.retry} onPress={onRetry}/>:null}
    <SecondaryButton lang={lang} Text={T} label={t.cancel} onPress={onCancel}/>
  </View>;
}
const s=StyleSheet.create({
  wrap:{gap:space.md},
  codeCard:{alignItems:'center',gap:2,paddingVertical:space.md,borderRadius:18,backgroundColor:onGlass.field,borderWidth:1,borderColor:onGlass.border},
  codeLabel:{fontSize:type.footnote,color:onGlass.soft},
  code:{fontSize:28,lineHeight:36,letterSpacing:2,fontWeight:'700',color:onGlass.text,fontVariant:['tabular-nums']},
  expires:{fontSize:type.footnote,color:onGlass.soft},
  steps:{gap:space.sm},
  step:{alignItems:'flex-start',gap:space.sm},
  num:{width:24,height:24,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(217,188,126,0.9)',marginTop:1},
  numText:{fontSize:13,lineHeight:16,fontWeight:'700',color:'#0A1430'},
  stepText:{flex:1,fontSize:type.subhead,lineHeight:22,color:onGlass.text},
  status:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:space.sm,paddingVertical:space.sm},
  statusText:{fontSize:type.footnote+1,color:onGlass.soft},
  staging:{gap:space.sm,padding:space.md,borderRadius:16,borderWidth:1,borderStyle:'dashed',borderColor:'#B8893F',backgroundColor:'rgba(217,188,126,0.14)'},
  stagingNote:{fontSize:type.footnote,color:onGlass.text,textAlign:'center'},
  error:{fontSize:type.footnote,color:onGlass.error,fontWeight:'600',textAlign:'center'},
});
