import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,Animated,Image,KeyboardAvoidingView,Platform,ScrollView,StyleSheet,Text,TextInput,useWindowDimensions,View,type TextInputProps} from 'react-native';
import {BlurTargetView,BlurView} from 'expo-blur';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {LinearGradient as Gradient} from 'expo-linear-gradient';
import {GoldText,ScalePressable} from '../ui/Premium';
import {Icon,type IconName} from '../Icons';
import {colors,glass,layout,lux,authGlass,radius,space,type} from '../theme';
import {LanguageButton} from '../ui/LanguageButton';
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

/** Frosted glass over the photo (owner-approved reference, 22 Nov 2026): real blur of what is behind (expo-blur),
 *  a flat 20 % white frost, a thin white edge and white text. No gold border, no dark tint, no opaque sheen. */
export function GlassCard({children,style}:{children:React.ReactNode;style?:object}){
  const target=useContext(BlurCtx);
  return <View style={[s.cardShadow,style]}>
    <View style={s.card}>
      <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={50} blurTarget={Platform.OS==='android'?target:undefined} blurMethod="dimezisBlurViewSdk31Plus"/>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:'rgba(255,255,255,0.20)'}]}/>
      <View style={s.cardInner}>{children}</View>
    </View>
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
            <Stop offset="0%" stopColor={lux.espresso} stopOpacity={0.62}/><Stop offset="42%" stopColor={lux.espresso} stopOpacity={0.32}/>
            <Stop offset="72%" stopColor={lux.espresso} stopOpacity={0.12}/><Stop offset="100%" stopColor={lux.espresso} stopOpacity={0.55}/>
          </LinearGradient></Defs>
          <Rect width="100%" height="100%" fill="url(#authShade)"/>
        </Svg>
      </Backdrop>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} bounces={false}>
          <View style={[s.top,{flexDirection:ar?'row-reverse':'row'}]}>
            <Gradient colors={lux.goldBright} start={{x:0,y:0}} end={{x:1,y:1}} style={s.logoRing}><Image source={logo} style={s.logo} accessible={false}/></Gradient>
            <LanguageButton lang={lang} onPress={()=>onLanguage(lang)} tone="dark"/>
          </View>
          <View style={s.content}>
            <GoldText lang={lang} colors={lux.goldBright} style={{...s.title,textAlign:ar?'right':'left'}}>{title}</GoldText>
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
export function RoundedField({lang,label,icon,error,hint,inputFont,ltr=false,trailing,onFocus,onBlur,...input}:FieldProps&{ltr?:boolean;trailing?:React.ReactNode}){
  const [focused,setFocused]=useState(false);
  const ar=lang==='ar';
  const T=AText;
  return <View style={s.fieldWrap}>
    <T lang={lang} style={[s.label,{textAlign:ar?'right':'left'}]}>{label}</T>
    <View style={[s.field,{flexDirection:ar?'row-reverse':'row'},focused&&s.fieldFocus,!!error&&s.fieldError]}>
      {icon?<Icon name={icon} size={20} color={focused?authGlass.text:authGlass.soft}/>:null}
      <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" accessibilityLabel={label}
        placeholderTextColor={authGlass.placeholder} selectionColor={authGlass.link} keyboardAppearance="light"
        onFocus={e=>{setFocused(true);onFocus?.(e);}} onBlur={e=>{setFocused(false);onBlur?.(e);}}
        {...input} style={[s.input,inputFont&&!ltr?{fontFamily:inputFont}:null,{textAlign:ar?'right':'left',writingDirection:ar&&!ltr?'rtl':'ltr'}]}/>
      {trailing}
    </View>
    {error?<T lang={lang} style={[s.error,{textAlign:ar?'right':'left'}]}>{error}</T>:hint?<T lang={lang} style={[s.hint,{textAlign:ar?'right':'left'}]}>{hint}</T>:null}
  </View>;
}

export function PrimaryButton({lang,label,onPress,busy=false,disabled=false}:{lang:Lang;Text?:AuthText;label:string;onPress:()=>void;busy?:boolean;disabled?:boolean}){
  const T=AText;
  return <ScalePressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:disabled||busy,busy}} disabled={disabled||busy} onPress={onPress}
    rippleColor="rgba(14,21,38,0.18)" style={[s.primary,(disabled||busy)&&s.primaryOff]}>
    <Gradient pointerEvents="none" colors={lux.orange} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    <View pointerEvents="none">{busy?<ActivityIndicator color={lux.onAction}/>:<T lang={lang} style={s.primaryText}>{label}</T>}</View>
  </ScalePressable>;
}
export function SecondaryButton({lang,label,onPress}:{lang:Lang;Text?:AuthText;label:string;onPress:()=>void}){
  const T=AText;
  return <ScalePressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.secondary} rippleColor="rgba(14,21,38,0.12)">
    <T lang={lang} style={s.secondaryText}>{label}</T>
  </ScalePressable>;
}
/** Inline text link ("Create account"). */
export function TextLink({lang,label,onPress,tone='glass'}:{lang:Lang;Text?:AuthText;label:string;onPress:()=>void;tone?:'glass'|'photo'}){
  const T=AText;
  return <ScalePressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={s.link} rippleColor={tone==='photo'?'rgba(255,255,255,0.3)':'rgba(29,58,158,0.15)'}><T lang={lang} style={[s.linkText,tone==='glass'&&{color:authGlass.link}]}>{label}</T></ScalePressable>;
}

/** Consent row: rounded checkbox + text. */
export function ConsentRow({lang,checked,onToggle,children,label}:{lang:Lang;Text?:AuthText;checked:boolean;onToggle:()=>void;children:React.ReactNode;label:string}){
  const ar=lang==='ar';
  return <ScalePressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked}} onPress={onToggle} style={[s.consent,{flexDirection:ar?'row-reverse':'row'}]} rippleColor="rgba(14,21,38,0.1)">
    <View pointerEvents="none" style={[s.box,checked&&s.boxOn]}>{checked?<Icon name="check" size={14} color={lux.espresso}/>:null}</View>
    <View style={s.consentText}>{children}</View>
  </ScalePressable>;
}

export const authStyles=StyleSheet.create({legal:{color:glass.link,textDecorationLine:'underline'}});

const s=StyleSheet.create({
  fill:{flex:1,backgroundColor:'#0B1226'},
  flex:{flex:1},
  scroll:{flexGrow:1,justifyContent:'space-between',paddingHorizontal:space.xl,paddingTop:space.lg,paddingBottom:space.xxl},
  top:{alignItems:'center',justifyContent:'space-between'},
  logoRing:{width:58,height:58,borderRadius:29,alignItems:'center',justifyContent:'center'},
  logo:{width:52,height:52,borderRadius:26},
  langSwitch:{flexDirection:'row',backgroundColor:'rgba(10,20,48,0.38)',borderRadius:radius.pill,borderWidth:1,borderColor:'rgba(241,221,170,0.55)',padding:3,gap:2},
  langItem:{minHeight:layout.minTouch-4,minWidth:56,alignItems:'center',justifyContent:'center',borderRadius:radius.pill,paddingHorizontal:space.md,overflow:'hidden'},
  langText:{fontSize:type.subhead,color:lux.onDark},langTextOn:{color:lux.espresso,fontWeight:'700'},
  content:{marginTop:space.xxl,gap:space.md},
  title:{fontSize:type.largeTitle,lineHeight:type.largeTitle*1.3},
  subtitle:{fontSize:type.body,lineHeight:type.body*1.5,color:glass.textSoft,textShadowColor:'rgba(0,0,0,0.4)',textShadowOffset:{width:0,height:1},textShadowRadius:6},
  cardShadow:{marginTop:space.sm,borderRadius:28,...Platform.select({
    ios:{shadowColor:'#000',shadowOffset:{width:0,height:16},shadowOpacity:0.28,shadowRadius:30},
    android:{elevation:10},
    default:{shadowColor:'#000',shadowOffset:{width:0,height:16},shadowOpacity:0.28,shadowRadius:30},
  }) as object},
  cardBorder:{borderRadius:28,padding:1},
  card:{borderRadius:28,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.45)'},
  cardInner:{padding:space.xl,gap:space.lg},
  footer:{marginTop:space.sm,alignItems:'center',gap:space.xs},
  fieldWrap:{gap:space.sm-2},
  label:{fontSize:type.footnote,fontWeight:'600',color:authGlass.soft},
  field:{minHeight:52,alignItems:'center',gap:space.md,paddingHorizontal:space.lg,borderRadius:radius.control+4,backgroundColor:authGlass.field,borderWidth:1,borderColor:authGlass.border},
  fieldFocus:{borderColor:'#E8D3A2',borderWidth:2,paddingHorizontal:space.lg-1,backgroundColor:authGlass.fieldFocus},
  fieldError:{borderColor:authGlass.error,borderWidth:2,paddingHorizontal:space.lg-1},
  // no browser focus box on the web preview: the gold field border already shows focus
  input:{flex:1,minWidth:0,minHeight:layout.minTouch,fontSize:type.body,color:authGlass.text,...(Platform.OS==='web'?{outlineStyle:'none',outlineWidth:0}:{})} as object,
  error:{fontSize:type.footnote,color:authGlass.error,fontWeight:'600'},
  hint:{fontSize:type.footnote,color:authGlass.soft},
  primary:{minHeight:54,borderRadius:18,backgroundColor:colors.orange,alignItems:'center',justifyContent:'center',paddingHorizontal:space.xl,overflow:'hidden',...Platform.select({
    ios:{shadowColor:'#1D3A9E',shadowOffset:{width:0,height:8},shadowOpacity:0.3,shadowRadius:14},android:{elevation:4},default:{}}) as object},
  primaryOff:{opacity:0.55},
  primaryText:{fontSize:type.headline,fontWeight:'700',color:lux.onAction},
  secondary:{flex:1,minHeight:50,borderRadius:16,backgroundColor:'rgba(255,255,255,0.10)',borderWidth:1,borderColor:'rgba(255,255,255,0.55)',alignItems:'center',justifyContent:'center',paddingHorizontal:space.sm},
  secondaryText:{fontSize:type.subhead,fontWeight:'600',color:authGlass.text,textAlign:'center'},
  link:{minHeight:layout.minTouch,justifyContent:'center',paddingHorizontal:space.sm},
  linkText:{fontSize:type.callout,fontWeight:'700',color:glass.link},
  consent:{alignItems:'flex-start',gap:space.md,minHeight:layout.minTouch,paddingVertical:space.xs},
  box:{width:24,height:24,borderRadius:7,borderWidth:1.5,borderColor:authGlass.box,alignItems:'center',justifyContent:'center',marginTop:1},
  boxOn:{backgroundColor:'#D9BC7E',borderColor:'#B8893F'},
  consentText:{flex:1},
});
