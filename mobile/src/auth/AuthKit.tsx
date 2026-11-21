import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,Animated,Image,KeyboardAvoidingView,Platform,ScrollView,StyleSheet,Text,TextInput,useWindowDimensions,View,type TextInputProps} from 'react-native';
import {BlurTargetView,BlurView} from 'expo-blur';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {Pressable} from '../Touch';
import {Icon,type IconName} from '../Icons';
import {colors,glass,layout,onGlass,radius,space,type} from '../theme';
import type {Lang} from './copy';

const cover=require('../../assets/brand/cover-dubai.jpg'); // the approved Dubai cover, full screen behind the glass

export type AuthText=React.ComponentType<{lang:Lang;children:React.ReactNode;style?:object;numberOfLines?:number}>;

/**
 * Text for the auth screens. Arabic: Cairo (Regular / SemiBold / Bold by fontWeight). English: the platform system font
 * (San Francisco / SF Pro on iOS, Roboto on Android): Apple's font is only licensed as the system font, so it is never bundled.
 */
export const AText:AuthText=({lang,children,style,numberOfLines})=>{
  const w=String((StyleSheet.flatten(style) as {fontWeight?:string}|undefined)?.fontWeight??'400');
  const ar=lang==='ar';
  return <Text maxFontSizeMultiplier={layout.maxFontScale} numberOfLines={numberOfLines}
    style={[{color:glass.text,textAlign:ar?'right':'left',writingDirection:ar?'rtl':'ltr'},style,
      ar?{fontFamily:['700','800','900','bold'].includes(w)?'CairoBold':w==='600'?'CairoSemiBold':'CairoRegular',fontWeight:'normal'}:null]}>{children}</Text>;
};
export const inputFontFor=(lang:Lang)=>lang==='ar'?'CairoRegular':undefined;

/** Android needs the content behind the glass wrapped in a BlurTargetView; elsewhere a plain View (iOS/web blur what is behind natively). */
const Backdrop=(Platform.OS==='android'?BlurTargetView:View) as typeof View;
type BlurRef=React.RefObject<React.ComponentRef<typeof View>|null>;
const BlurCtx=createContext<BlurRef|undefined>(undefined);

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

/** Frosted-glass surface: real blur of what is behind (expo-blur) + a 20 % white tint + a light edge. */
export function GlassCard({children,style}:{children:React.ReactNode;style?:object}){
  const target=useContext(BlurCtx);
  return <View style={[s.card,style]}>
    <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={50} blurTarget={Platform.OS==='android'?target:undefined} blurMethod="dimezisBlurViewSdk31Plus"/>
    <View style={[StyleSheet.absoluteFill,{backgroundColor:glass.fill}]} pointerEvents="none"/>
    <View style={s.cardInner}>{children}</View>
  </View>;
}

type ScaffoldProps={
  hero?:'tall'|'compact';
  lang:Lang;onLanguage:(l:Lang)=>void;logo:number;Text?:AuthText;title:string;subtitle:string;children:React.ReactNode;footer?:React.ReactNode;
};
/**
 * Page chrome for every auth screen: the approved Dubai cover fills the screen; brand mark and language switch float on it;
 * the title sits on the photo; the form lives in a frosted-glass card that lets the image show through.
 */
export function AuthScaffold({lang,onLanguage,logo,title,subtitle,children,footer}:ScaffoldProps){
  const ar=lang==='ar';
  const target=useRef<React.ComponentRef<typeof View>>(null);
  const T=AText;
  const {width,height}=useWindowDimensions();
  return <BlurCtx.Provider value={target}>
    <View style={s.fill}>
      <Backdrop ref={target} style={StyleSheet.absoluteFill} accessible={false}>
        {/* explicit size: the portrait cover is scaled to the screen (cover) and anchored to the right so the tower stays in view */}
        <Image source={cover} resizeMode="cover" style={{position:'absolute',top:0,left:0,width,height}} accessible={false}/>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} accessible={false}>
          <Defs><LinearGradient id="authShade" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={glass.scrim} stopOpacity={0.4}/><Stop offset="28%" stopColor={glass.scrim} stopOpacity={0}/>
            <Stop offset="70%" stopColor={glass.scrim} stopOpacity={0.08}/><Stop offset="100%" stopColor={glass.scrim} stopOpacity={0.5}/>
          </LinearGradient></Defs>
          <Rect width="100%" height="100%" fill="url(#authShade)"/>
        </Svg>
      </Backdrop>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} bounces={false}>
          <View style={[s.top,{flexDirection:ar?'row-reverse':'row'}]}>
            <Image source={logo} style={s.logo} accessible={false}/>
            <View style={s.langSwitch} accessibilityRole="tablist">
              {(['ar','en'] as const).map(l=><Pressable key={l} accessibilityRole="tab" accessibilityState={{selected:lang===l}} accessibilityLabel={l==='ar'?'العربية':'English'} onPress={()=>onLanguage(l)} style={[s.langItem,lang===l&&s.langOn]} rippleColor="rgba(255,255,255,0.3)">
                <T lang={l} style={[s.langText,lang===l&&s.langTextOn]}>{l==='ar'?'عربي':'EN'}</T>
              </Pressable>)}
            </View>
          </View>
          <View style={s.content}>
            <T lang={lang} style={[s.title,{textAlign:ar?'right':'left'}]}>{title}</T>
            {subtitle?<T lang={lang} style={[s.subtitle,{textAlign:ar?'right':'left'}]}>{subtitle}</T>:null}
            <GlassCard>{children}</GlassCard>
            {footer?<View style={s.footer}>{footer}</View>:null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  </BlurCtx.Provider>;
}

type FieldProps={lang:Lang;Text?:AuthText;label:string;icon?:IconName;error?:string|null;hint?:string;inputFont?:string}&Omit<TextInputProps,'style'>;
/** Label above, glass field (52 pt), white focus ring, inline error. */
export function RoundedField({lang,label,icon,error,hint,inputFont,onFocus,onBlur,...input}:FieldProps){
  const [focused,setFocused]=useState(false);
  const ar=lang==='ar';
  const T=AText;
  return <View style={s.fieldWrap}>
    <T lang={lang} style={[s.label,{textAlign:ar?'right':'left'}]}>{label}</T>
    <View style={[s.field,{flexDirection:ar?'row-reverse':'row'},focused&&s.fieldFocus,!!error&&s.fieldError]}>
      {icon?<Icon name={icon} size={20} color={focused?onGlass.text:onGlass.soft}/>:null}
      <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" accessibilityLabel={label}
        placeholderTextColor={onGlass.placeholder} selectionColor={onGlass.link} keyboardAppearance="light"
        onFocus={e=>{setFocused(true);onFocus?.(e);}} onBlur={e=>{setFocused(false);onBlur?.(e);}}
        {...input} style={[s.input,inputFont?{fontFamily:inputFont}:null,{textAlign:ar?'right':'left',writingDirection:ar?'rtl':'ltr'}]}/>
    </View>
    {error?<T lang={lang} style={[s.error,{textAlign:ar?'right':'left'}]}>{error}</T>:hint?<T lang={lang} style={[s.hint,{textAlign:ar?'right':'left'}]}>{hint}</T>:null}
  </View>;
}

export function PrimaryButton({lang,label,onPress,busy=false,disabled=false}:{lang:Lang;Text?:AuthText;label:string;onPress:()=>void;busy?:boolean;disabled?:boolean}){
  const T=AText;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:disabled||busy,busy}} disabled={disabled||busy} onPress={onPress}
    rippleColor="rgba(48,37,31,0.18)" style={[s.primary,(disabled||busy)&&s.primaryOff]}>
    {busy?<ActivityIndicator color={colors.ink}/>:<T lang={lang} style={s.primaryText}>{label}</T>}
  </Pressable>;
}
export function SecondaryButton({lang,label,onPress}:{lang:Lang;Text?:AuthText;label:string;onPress:()=>void}){
  const T=AText;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.secondary} rippleColor="rgba(48,37,31,0.12)">
    <T lang={lang} style={s.secondaryText}>{label}</T>
  </Pressable>;
}
/** Inline text link ("Create account"). */
export function TextLink({lang,label,onPress,tone='glass'}:{lang:Lang;Text?:AuthText;label:string;onPress:()=>void;tone?:'glass'|'photo'}){
  const T=AText;
  return <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={s.link} rippleColor={tone==='photo'?'rgba(255,255,255,0.3)':'rgba(152,80,12,0.15)'}><T lang={lang} style={[s.linkText,tone==='glass'&&{color:onGlass.link}]}>{label}</T></Pressable>;
}

/** Consent row: rounded checkbox + text. */
export function ConsentRow({lang,checked,onToggle,children,label}:{lang:Lang;Text?:AuthText;checked:boolean;onToggle:()=>void;children:React.ReactNode;label:string}){
  const ar=lang==='ar';
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked}} onPress={onToggle} style={[s.consent,{flexDirection:ar?'row-reverse':'row'}]} rippleColor="rgba(48,37,31,0.1)">
    <View style={[s.box,checked&&s.boxOn]}>{checked?<Icon name="check" size={14} color={colors.ink}/>:null}</View>
    <View style={s.consentText}>{children}</View>
  </Pressable>;
}

export const authStyles=StyleSheet.create({legal:{color:glass.link,textDecorationLine:'underline'}});

const s=StyleSheet.create({
  fill:{flex:1,backgroundColor:'#0B1226'},
  flex:{flex:1},
  scroll:{flexGrow:1,justifyContent:'space-between',paddingHorizontal:space.xl,paddingTop:space.lg,paddingBottom:space.xxl},
  top:{alignItems:'center',justifyContent:'space-between'},
  logo:{width:52,height:52,borderRadius:26,borderWidth:1,borderColor:'rgba(255,255,255,0.6)'},
  langSwitch:{flexDirection:'row',backgroundColor:'rgba(255,255,255,0.2)',borderRadius:radius.pill,borderWidth:layout.hairline*2,borderColor:glass.border,padding:3},
  langItem:{minHeight:layout.minTouch-8,minWidth:52,alignItems:'center',justifyContent:'center',borderRadius:radius.pill,paddingHorizontal:space.md},
  langOn:{backgroundColor:'rgba(255,255,255,0.92)'},
  langText:{fontSize:type.subhead,color:glass.text},langTextOn:{color:colors.ink,fontWeight:'700'},
  content:{marginTop:space.xxl,gap:space.md},
  title:{fontSize:type.largeTitle,lineHeight:type.largeTitle*1.3,fontWeight:'800',color:glass.text,textShadowColor:'rgba(0,0,0,0.45)',textShadowOffset:{width:0,height:1},textShadowRadius:8},
  subtitle:{fontSize:type.body,lineHeight:type.body*1.5,color:glass.textSoft,textShadowColor:'rgba(0,0,0,0.4)',textShadowOffset:{width:0,height:1},textShadowRadius:6},
  card:{marginTop:space.sm,borderRadius:28,overflow:'hidden',borderWidth:1,borderColor:glass.border},
  cardInner:{padding:space.xl,gap:space.lg},
  footer:{marginTop:space.sm,alignItems:'center',gap:space.xs},
  fieldWrap:{gap:space.sm-2},
  label:{fontSize:type.footnote,fontWeight:'600',color:onGlass.soft},
  field:{minHeight:52,alignItems:'center',gap:space.md,paddingHorizontal:space.lg,borderRadius:radius.control+2,backgroundColor:onGlass.field,borderWidth:1,borderColor:onGlass.border},
  fieldFocus:{borderColor:colors.brand,borderWidth:2,paddingHorizontal:space.lg-1},
  fieldError:{borderColor:onGlass.error,borderWidth:2,paddingHorizontal:space.lg-1},
  input:{flex:1,minWidth:0,minHeight:layout.minTouch,fontSize:type.body,color:onGlass.text},
  error:{fontSize:type.footnote,color:onGlass.error,fontWeight:'600'},
  hint:{fontSize:type.footnote,color:onGlass.soft},
  primary:{minHeight:52,borderRadius:14,backgroundColor:colors.orange,alignItems:'center',justifyContent:'center',paddingHorizontal:space.xl},
  primaryOff:{opacity:0.55},
  primaryText:{fontSize:type.headline,fontWeight:'700',color:colors.ink},
  secondary:{flex:1,minHeight:48,borderRadius:14,backgroundColor:onGlass.field,borderWidth:1,borderColor:onGlass.border,alignItems:'center',justifyContent:'center',paddingHorizontal:space.sm},
  secondaryText:{fontSize:type.subhead,fontWeight:'600',color:onGlass.text,textAlign:'center'},
  link:{minHeight:layout.minTouch,justifyContent:'center',paddingHorizontal:space.sm},
  linkText:{fontSize:type.callout,fontWeight:'700',color:glass.link},
  consent:{alignItems:'flex-start',gap:space.md,minHeight:layout.minTouch,paddingVertical:space.xs},
  box:{width:24,height:24,borderRadius:7,borderWidth:1.5,borderColor:onGlass.box,alignItems:'center',justifyContent:'center',marginTop:1},
  boxOn:{backgroundColor:colors.orange,borderColor:colors.orange},
  consentText:{flex:1},
});
