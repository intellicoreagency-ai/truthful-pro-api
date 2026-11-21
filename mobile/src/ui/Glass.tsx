/**
 * Light "Apple glass" building blocks for redesigned screens (dark text on frosted warm-white cards).
 * The dark, photo-backed variant used by sign-in lives in `auth/AuthKit.tsx`.
 */
import React,{useEffect,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,Platform,StyleSheet,TextInput,View,type TextInputProps} from 'react-native';
import {BlurView} from 'expo-blur';
import {Pressable} from '../Touch';
import {Icon,type IconName} from '../Icons';
import {Txt,type Lang} from './Txt';
import {colors,layout,onGlass,radius,space,type} from '../theme';

/** Keeps references, amounts and phone numbers left-to-right inside Arabic text. */
export const ltr=(s:string)=>'⁦'+s+'⁩';
export const rowFor=(lang:Lang)=>lang==='ar'?'row-reverse' as const:'row' as const;

/** "Reduce Transparency": opaque surfaces until the setting is known, so glass never flashes unreadable. */
export function useReduceTransparency(){
  const [reduce,setReduce]=useState(true);
  useEffect(()=>{
    let active=true,changed=false;
    // The setting exists on iOS (Android reports false). react-native-web has neither API: use the blur there.
    if(typeof AccessibilityInfo?.isReduceTransparencyEnabled!=='function'){setReduce(false);return}
    let sub:{remove:()=>void}|undefined;
    try{sub=AccessibilityInfo.addEventListener('reduceTransparencyChanged',v=>{changed=true;if(active)setReduce(v)})}catch{sub=undefined}
    AccessibilityInfo.isReduceTransparencyEnabled().then(v=>{if(active&&!changed)setReduce(v)}).catch(()=>{if(active&&!changed)setReduce(false)});
    return()=>{active=false;sub?.remove()};
  },[]);
  return reduce;
}

/** Frosted card. The shadow sits on an outer View so the inner rounded clip keeps the blur. */
export function GlassCard({children,reduce,tone}:{children:React.ReactNode;reduce:boolean;tone?:'warning'|'success'}){
  return <View style={g.cardShadow}>
    <View style={[g.card,tone==='warning'&&g.cardWarning]}>
      {!reduce&&<BlurView pointerEvents="none" tint="light" intensity={60}
        experimentalBlurMethod={Platform.OS==='android'?'dimezisBlurView':undefined} style={StyleSheet.absoluteFill}/>}
      <View style={[g.cardContent,reduce&&g.opaque,tone==='warning'&&g.warningFill,tone==='success'&&g.successFill]}>{children}</View>
    </View>
  </View>;
}

export function SectionTitle({lang,children}:{lang:Lang;children:React.ReactNode}){
  return <View accessibilityRole="header"><Txt lang={lang} bold style={g.sectionTitle}>{children}</Txt></View>;
}

/** Label on one side, value on the other (amounts are passed already isolated as LTR). */
export function ValueRow({lang,label,value,strong,last,highlight}:{lang:Lang;label:string;value:string;strong?:boolean;last?:boolean;highlight?:boolean}){
  return <View style={[g.valueRow,{flexDirection:rowFor(lang)},last&&g.noBorder,highlight&&g.valueHighlight]}>
    <View style={g.flex1}><Txt lang={lang} bold={strong} style={g.valueLabel}>{label}</Txt></View>
    <Txt lang={lang} bold style={g.valueText}>{value}</Txt>
  </View>;
}

export function Note({lang,children,tone='neutral'}:{lang:Lang;children:React.ReactNode;tone?:'neutral'|'warning'|'danger'|'success'}){
  return <View style={[g.note,tone==='warning'&&g.noteWarning,tone==='danger'&&g.noteDanger,tone==='success'&&g.noteSuccess]}>
    <Txt lang={lang} style={{...g.noteText,...(tone==='danger'?{color:colors.danger}:null)}}>{children}</Txt>
  </View>;
}

/** Filled (primary) or tinted (secondary) button; 52 pt tall, ripple on Android, dims on iOS. */
export function GlassButton({lang,label,onPress,icon,primary,disabled,busy,accessibilityLabel,compact,fill}:{
  lang:Lang;label:string;onPress:()=>void;icon?:IconName;primary?:boolean;disabled?:boolean;busy?:boolean;accessibilityLabel?:string;compact?:boolean;
  /** Share a row equally with its siblings (same width and height). */fill?:boolean;
}){
  const off=!!disabled||!!busy,fg=primary?'#FFFFFF':colors.brand;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel??label} accessibilityState={{disabled:off,busy:!!busy}}
    disabled={off} onPress={onPress} rippleColor={primary?'rgba(255,255,255,0.3)':undefined}
    style={[g.button,compact&&g.buttonCompact,fill&&g.fill,{flexDirection:rowFor(lang)},primary?g.primary:g.secondary,off&&g.disabled]}>
    {busy?<ActivityIndicator color={fg}/>:icon?<Icon name={icon} size={19} color={fg}/>:null}
    {!!label&&<Txt lang={lang} bold style={{...g.buttonText,color:fg}}>{label}</Txt>}
  </Pressable>;
}

/** Round icon-only button (≥ 44/48 touch target) with a required spoken label. */
export function IconButton({icon,label,onPress,disabled}:{icon:IconName;label:string;onPress:()=>void;disabled?:boolean}){
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:!!disabled}} disabled={disabled}
    onPress={onPress} style={[g.iconButton,disabled&&g.disabled]}>
    <Icon name={icon} size={20} color={colors.brand}/>
  </Pressable>;
}

export function GlassField({lang,label,...input}:{lang:Lang;label:string}&TextInputProps){
  const ar=lang==='ar';
  return <View style={g.field}>
    <Txt lang={lang} style={g.fieldLabel}>{label}</Txt>
    <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" accessibilityLabel={label}
      placeholderTextColor={onGlass.placeholder} {...input}
      style={[g.input,{textAlign:ar?'right':'left',writingDirection:ar?'rtl':'ltr',fontFamily:ar?'CairoRegular':undefined},input.multiline&&g.inputMulti]}/>
  </View>;
}

const shadow=Platform.select({
  ios:{shadowColor:colors.brown,shadowOffset:{width:0,height:10},shadowOpacity:0.1,shadowRadius:22},
  android:{elevation:4},
  default:{},
}) as object;

export const g=StyleSheet.create({
  flex1:{flex:1},
  fill:{flex:1,alignSelf:'stretch'},
  cardShadow:{borderRadius:radius.card+8,...shadow},
  card:{borderRadius:radius.card+8,overflow:'hidden',borderWidth:1,borderColor:onGlass.border},
  cardWarning:{borderColor:'#E7C27A'},
  cardContent:{padding:space.xl,gap:space.lg,backgroundColor:Platform.select({ios:onGlass.field,default:'rgba(255,249,244,0.86)'})},
  opaque:{backgroundColor:colors.white},
  warningFill:{backgroundColor:'rgba(255,240,206,0.82)'},
  successFill:{backgroundColor:'rgba(229,242,217,0.82)'},

  sectionTitle:{fontSize:type.headline,lineHeight:26},

  valueRow:{alignItems:'center',gap:space.md,paddingVertical:space.sm+2,borderBottomWidth:layout.hairline,borderBottomColor:colors.line},
  valueHighlight:{backgroundColor:colors.brandTint,borderRadius:radius.control,paddingHorizontal:space.md,borderBottomWidth:0,marginVertical:2},
  noBorder:{borderBottomWidth:0},
  valueLabel:{fontSize:type.subhead,lineHeight:22,color:onGlass.soft},
  valueText:{fontSize:type.subhead,lineHeight:22},

  note:{padding:space.md,borderRadius:radius.control,backgroundColor:'rgba(255,249,244,0.9)'},
  noteWarning:{backgroundColor:'#FFF0CE'},
  noteDanger:{backgroundColor:'#FBE6E3'},
  noteSuccess:{backgroundColor:'#E5F2D9'},
  noteText:{fontSize:type.footnote+1,lineHeight:22,color:onGlass.soft},

  button:{minHeight:52,borderRadius:16,paddingHorizontal:space.lg,paddingVertical:space.md,alignItems:'center',justifyContent:'center',gap:space.sm+2,overflow:'hidden'},
  buttonCompact:{minHeight:layout.minTouch,paddingVertical:space.sm,paddingHorizontal:space.md},
  primary:{backgroundColor:colors.orange},
  secondary:{backgroundColor:'rgba(255,249,244,0.9)',borderWidth:1,borderColor:colors.line},
  buttonText:{fontSize:type.subhead,textAlign:'center',flexShrink:1},
  disabled:{opacity:0.45},
  iconButton:{width:layout.minTouch,height:layout.minTouch,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',
    backgroundColor:'rgba(255,249,244,0.9)',borderWidth:1,borderColor:colors.line,overflow:'hidden'},

  field:{gap:space.xs+2},
  fieldLabel:{fontSize:type.footnote+1,lineHeight:20,color:onGlass.soft},
  input:{minHeight:layout.minTouch+4,borderRadius:radius.control,borderWidth:1,borderColor:colors.line,backgroundColor:'rgba(255,255,255,0.75)',
    paddingHorizontal:space.md,paddingVertical:space.sm,fontSize:type.callout,color:colors.ink},
  inputMulti:{minHeight:96,textAlignVertical:'top'},
});
