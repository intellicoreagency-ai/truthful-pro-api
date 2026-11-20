import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,Animated,Image,KeyboardAvoidingView,Platform,ScrollView,StyleSheet,TextInput,View,type TextInputProps} from 'react-native';
import {Pressable} from '../Touch';
import {Icon,type IconName} from '../Icons';
import {colors,layout,radius,space,type} from '../theme';
import type {Lang} from './copy';

export type AuthText=React.ComponentType<{lang:Lang;children:React.ReactNode;style?:object;numberOfLines?:number}>;

/** Fade + 12 pt rise between steps (≈ 240 ms). Skipped when the system asks to reduce motion. */
export function StepTransition({stepKey,children}:{stepKey:string;children:React.ReactNode}){
  const v=useRef(new Animated.Value(0)).current;
  const [reduce,setReduce]=useState(false);
  useEffect(()=>{AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(()=>{});},[]);
  useEffect(()=>{
    if(reduce){v.setValue(1);return;}
    v.setValue(0);
    Animated.timing(v,{toValue:1,duration:240,useNativeDriver:true}).start();
  },[stepKey,reduce,v]);
  return <Animated.View style={{opacity:v,transform:[{translateY:v.interpolate({inputRange:[0,1],outputRange:[12,0]})}]}}>{children}</Animated.View>;
}

type ScaffoldProps={
  lang:Lang;onLanguage:(l:Lang)=>void;logo:number;Text:AuthText;title:string;subtitle:string;children:React.ReactNode;footer?:React.ReactNode;
};
/** Page chrome shared by Login / Register: brand mark, language switch, large title, keyboard-safe scrolling. */
export function AuthScaffold({lang,onLanguage,logo,Text:T,title,subtitle,children,footer}:ScaffoldProps){
  const ar=lang==='ar';
  return <KeyboardAvoidingView style={s.fill} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      <View style={[s.top,{flexDirection:ar?'row-reverse':'row'}]}>
        <Image source={logo} style={s.logo} accessible={false}/>
        <View style={[s.langSwitch,{flexDirection:'row'}]} accessibilityRole="tablist">
          {(['ar','en'] as const).map(l=><Pressable key={l} accessibilityRole="tab" accessibilityState={{selected:lang===l}} accessibilityLabel={l==='ar'?'العربية':'English'} onPress={()=>onLanguage(l)} style={[s.langItem,lang===l&&s.langOn]}>
            <T lang={l} style={[s.langText,lang===l&&s.langTextOn]}>{l==='ar'?'عربي':'EN'}</T>
          </Pressable>)}
        </View>
      </View>
      <T lang={lang} style={[s.title,{textAlign:ar?'right':'left'}]}>{title}</T>
      <T lang={lang} style={[s.subtitle,{textAlign:ar?'right':'left'}]}>{subtitle}</T>
      <View style={s.body}>{children}</View>
      {footer?<View style={s.footer}>{footer}</View>:null}
    </ScrollView>
  </KeyboardAvoidingView>;
}

type FieldProps={lang:Lang;Text:AuthText;label:string;icon?:IconName;error?:string|null;hint?:string;inputFont:string}&Omit<TextInputProps,'style'>;
/** Label above, rounded filled field (52 pt), brand focus ring, inline error. */
export function RoundedField({lang,Text:T,label,icon,error,hint,inputFont,onFocus,onBlur,...input}:FieldProps){
  const [focused,setFocused]=useState(false);
  const ar=lang==='ar';
  return <View style={s.fieldWrap}>
    <T lang={lang} style={[s.label,{textAlign:ar?'right':'left'}]}>{label}</T>
    <View style={[s.field,{flexDirection:ar?'row-reverse':'row'},focused&&s.fieldFocus,!!error&&s.fieldError]}>
      {icon?<Icon name={icon} size={20} color={focused?colors.brand:colors.muted}/>:null}
      <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" accessibilityLabel={label}
        placeholderTextColor="#A89A8D" selectionColor={colors.brand}
        onFocus={e=>{setFocused(true);onFocus?.(e);}} onBlur={e=>{setFocused(false);onBlur?.(e);}}
        {...input} style={[s.input,{fontFamily:inputFont,textAlign:ar?'right':'left'}]}/>
    </View>
    {error?<T lang={lang} style={[s.error,{textAlign:ar?'right':'left'}]}>{error}</T>:hint?<T lang={lang} style={[s.hint,{textAlign:ar?'right':'left'}]}>{hint}</T>:null}
  </View>;
}

export function PrimaryButton({lang,Text:T,label,onPress,busy=false,disabled=false}:{lang:Lang;Text:AuthText;label:string;onPress:()=>void;busy?:boolean;disabled?:boolean}){
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:disabled||busy,busy}} disabled={disabled||busy} onPress={onPress}
    rippleColor="rgba(48,37,31,0.18)" style={[s.primary,(disabled||busy)&&s.primaryOff]}>
    {busy?<ActivityIndicator color={colors.ink}/>:<T lang={lang} style={s.primaryText}>{label}</T>}
  </Pressable>;
}
export function SecondaryButton({lang,Text:T,label,onPress}:{lang:Lang;Text:AuthText;label:string;onPress:()=>void}){
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.secondary}>
    <T lang={lang} style={s.secondaryText}>{label}</T>
  </Pressable>;
}
/** Inline text link ("Create account"). */
export function TextLink({lang,Text:T,label,onPress}:{lang:Lang;Text:AuthText;label:string;onPress:()=>void}){
  return <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={s.link}><T lang={lang} style={s.linkText}>{label}</T></Pressable>;
}

/** Consent row: rounded checkbox + text; the legal names inside the sentence open the documents. */
export function ConsentRow({lang,Text:T,checked,onToggle,children,label}:{lang:Lang;Text:AuthText;checked:boolean;onToggle:()=>void;children:React.ReactNode;label:string}){
  const ar=lang==='ar';
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked}} onPress={onToggle} style={[s.consent,{flexDirection:ar?'row-reverse':'row'}]}>
    <View style={[s.box,checked&&s.boxOn]}>{checked?<Icon name="check" size={14} color={colors.white}/>:null}</View>
    <View style={s.consentText}>{children}</View>
  </Pressable>;
}

export const authStyles=StyleSheet.create({legal:{color:colors.brand,textDecorationLine:'underline'}});

const s=StyleSheet.create({
  fill:{flex:1,backgroundColor:colors.background},
  scroll:{flexGrow:1,paddingHorizontal:space.xl,paddingTop:space.lg,paddingBottom:space.xxl*2},
  top:{alignItems:'center',justifyContent:'space-between',marginBottom:space.xl},
  logo:{width:56,height:56,borderRadius:28},
  langSwitch:{backgroundColor:colors.white,borderRadius:radius.pill,borderWidth:layout.hairline,borderColor:colors.line,padding:3},
  langItem:{minHeight:layout.minTouch-8,minWidth:52,alignItems:'center',justifyContent:'center',borderRadius:radius.pill,paddingHorizontal:space.md},
  langOn:{backgroundColor:colors.brandTint},
  langText:{fontSize:type.subhead,color:colors.muted},langTextOn:{color:colors.brand,fontWeight:'700'},
  title:{fontSize:type.largeTitle,lineHeight:type.largeTitle*1.25,fontWeight:'800',color:colors.ink},
  subtitle:{marginTop:space.sm,fontSize:type.body,lineHeight:type.body*1.5,color:colors.muted},
  body:{marginTop:space.xxl,gap:space.lg},
  footer:{marginTop:space.xxl,alignItems:'center',gap:space.sm},
  fieldWrap:{gap:space.sm-2},
  label:{fontSize:type.footnote,fontWeight:'600',color:colors.muted},
  field:{minHeight:52,alignItems:'center',gap:space.md,paddingHorizontal:space.lg,borderRadius:radius.control,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line},
  fieldFocus:{borderColor:colors.brand,borderWidth:2,paddingHorizontal:space.lg-1},
  fieldError:{borderColor:colors.danger,borderWidth:2,paddingHorizontal:space.lg-1},
  input:{flex:1,minWidth:0,minHeight:layout.minTouch,fontSize:type.body,color:colors.ink},
  error:{fontSize:type.footnote,color:colors.danger},
  hint:{fontSize:type.footnote,color:colors.muted},
  primary:{minHeight:52,borderRadius:14,backgroundColor:colors.orange,alignItems:'center',justifyContent:'center',paddingHorizontal:space.xl},
  primaryOff:{opacity:0.5},
  primaryText:{fontSize:type.headline,fontWeight:'700',color:colors.ink},
  secondary:{minHeight:52,borderRadius:14,backgroundColor:colors.brandTint,alignItems:'center',justifyContent:'center',paddingHorizontal:space.xl},
  secondaryText:{fontSize:type.headline,fontWeight:'600',color:colors.brand},
  link:{minHeight:layout.minTouch,justifyContent:'center',paddingHorizontal:space.sm},
  linkText:{fontSize:type.callout,fontWeight:'700',color:colors.brand},
  consent:{alignItems:'flex-start',gap:space.md,minHeight:layout.minTouch,paddingVertical:space.xs},
  box:{width:24,height:24,borderRadius:7,borderWidth:1.5,borderColor:colors.muted,alignItems:'center',justifyContent:'center',marginTop:1},
  boxOn:{backgroundColor:colors.brand,borderColor:colors.brand},
  consentText:{flex:1},
});
