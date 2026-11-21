/**
 * Light "Apple glass" building blocks for redesigned screens (dark text on frosted warm-white cards).
 * The dark, photo-backed variant used by sign-in lives in `auth/AuthKit.tsx`.
 */
import React,{useEffect,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,Platform,StyleSheet,TextInput,View,type ScrollViewProps,type TextInputProps} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Entrance,GoldText,LuxCard,ScalePressable} from './Premium';
import {Icon,type IconName} from '../Icons';
import {Txt,type Lang} from './Txt';
import {colors,layout,lux,onGlass,radius,space,type} from '../theme';
import {ScrollView} from '../navigation/TabBarLayout';
import {statusLabels,steps,type Status} from '../clientModel';
import {statusTone} from '../dashboard/statusStyle';
import {COMMON} from '../i18n';
const STATUS_WORD={ar:'الحالة',en:'Status',ru:'Статус',zh:'状态',fr:'Statut',es:'Estado'} as const;
const REQUEST_STATUS={ar:'حالة المعاملة',en:'Request status',ru:'Статус заявки',zh:'申请状态',fr:'État de la demande',es:'Estado de la solicitud'} as const;
import {tr} from '../i18n';

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
  // Premium glass: blur + pearl sheen + gold gradient hairline + soft shadow (see LuxCard); tones add a soft tint.
  return <LuxCard reduce={reduce} contentStyle={[g.luxContent,tone==='warning'&&g.warningTint,tone==='success'&&g.successTint]}>{children}</LuxCard>;
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
  const off=!!disabled||!!busy,fg=primary?lux.onAction:colors.brand;
  return <ScalePressable accessibilityRole="button" accessibilityLabel={accessibilityLabel??label} accessibilityState={{disabled:off,busy:!!busy}}
    disabled={off} onPress={onPress} rippleColor={primary?'rgba(14,21,38,0.18)':undefined}
    style={[g.button,compact&&g.buttonCompact,fill&&g.fill,primary?g.primary:g.secondary,off&&g.disabled]}>
    {primary&&<LinearGradient pointerEvents="none" colors={lux.orange} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>}
    <View pointerEvents="none" style={[g.buttonInner,{flexDirection:rowFor(lang)}]}>
      {busy?<ActivityIndicator color={fg}/>:icon?<Icon name={icon} size={19} color={fg}/>:null}
      {!!label&&<Txt lang={lang} bold style={{...g.buttonText,color:fg}}>{label}</Txt>}
    </View>
  </ScalePressable>;
}

/** Round icon-only button (≥ 44/48 touch target) with a required spoken label. */
export function IconButton({icon,label,onPress,disabled}:{icon:IconName;label:string;onPress:()=>void;disabled?:boolean}){
  return <ScalePressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:!!disabled}} disabled={disabled}
    onPress={onPress} style={[g.iconButton,disabled&&g.disabled]}>
    <View pointerEvents="none"><Icon name={icon} size={20} color={colors.brand}/></View>
  </ScalePressable>;
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

/** Warm, decorative background the glass sits on (hidden from screen readers). */
export function GlassBackdrop(){
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={g.backdrop}>
    <View style={[g.orb,g.orbWarm]}/>
    <View style={[g.orb,g.orbSand]}/>
  </View>;
}

/** Screen title row: round back button (mirrors in Arabic), title, optional trailing control. */
export function ScreenHeader({lang,title,subtitle,onBack,backLabel,trailing}:{lang:Lang;title:string;subtitle?:string;onBack?:()=>void;backLabel?:string;trailing?:React.ReactNode}){
  const ar=lang==='ar';
  return <View style={[g.header,{flexDirection:rowFor(lang)}]}>
    {onBack&&<ScalePressable accessibilityRole="button" accessibilityLabel={backLabel??COMMON[lang].back} onPress={onBack} style={g.backButton}>
      <View pointerEvents="none"><Icon name={ar?'next':'back'} size={24} color={colors.ink}/></View>
    </ScalePressable>}
    <View style={g.flex1}>
      <GoldText lang={lang} style={g.headerTitle}>{title}</GoldText>
      {!!subtitle&&<Txt lang={lang} style={g.headerSubtitle}>{subtitle}</Txt>}
    </View>
    {trailing}
  </View>;
}

/**
 * Top-level sections of a screen, with fragments unpacked so each keeps the page spacing.
 * Keys come from React's own positional keys (stable when conditional sections appear or disappear),
 * so a section never remounts or swaps state because something above it changed.
 */
function sections(nodes:React.ReactNode,prefix=''):[string,React.ReactElement][]{
  return React.Children.toArray(nodes).flatMap((child):[string,React.ReactElement][]=>{
    if(!React.isValidElement(child))return [];
    const key=prefix+String(child.key);
    if(child.type===React.Fragment)return sections((child.props as {children?:React.ReactNode}).children,key+'/');
    return [[key,child]];
  });
}

/** Full-screen glass page: backdrop + scroll view (keeps clear of the tab bar) + centred column. */
export function GlassScreen({children,refreshControl,scrollRef}:{children:React.ReactNode;refreshControl?:ScrollViewProps['refreshControl'];scrollRef?:React.Ref<React.ComponentRef<typeof ScrollView>>}){
  return <View style={g.screen}>
    <GlassBackdrop/>
    <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
      refreshControl={refreshControl} contentContainerStyle={g.content}>
      <View style={g.page}>{sections(children).map(([key,el],i)=><Entrance key={key} index={i}>{el}</Entrance>)}</View>
    </ScrollView>
  </View>;
}

const STATUS_ICON:Partial<Record<Status,IconName>>={completed:'check',needs_documents:'info',rejected:'close',cancelled:'close'};
/** Status as icon + text on its tint (never colour alone). */
export function StatusBadge({lang,status}:{lang:Lang;status:Status}){
  const tone=statusTone(status),label=tr(statusLabels[status],lang);
  return <View accessible accessibilityLabel={`${STATUS_WORD[lang]}: ${label}`}
    style={[g.badge,{backgroundColor:tone.bg,flexDirection:rowFor(lang)}]}>
    <Icon name={STATUS_ICON[status]??'clock'} size={15} color={tone.fg}/>
    <Txt lang={lang} bold style={{...g.badgeText,color:tone.fg}}>{label}</Txt>
  </View>;
}

/** Small pill label (e.g. "Sample data", "Missing"). */
export function Tag({lang,children,tone='warning'}:{lang:Lang;children:React.ReactNode;tone?:'warning'|'brand'}){
  return <View style={[g.tag,tone==='brand'&&g.tagBrand]}><Txt lang={lang} bold style={{...g.tagText,...(tone==='brand'?{color:colors.brand}:null)}}>{children}</Txt></View>;
}

const digits=(n:number,lang:Lang)=>lang==='ar'?String(n).replace(/[0-9]/g,d=>'٠١٢٣٤٥٦٧٨٩'[+d]):String(n);
/** Five-stage tracker; done stages are filled, the current one is ringed. Spoken as "Stage n of 5: name". */
export function StageTracker({lang,stage}:{lang:Lang;stage:number}){
  const ar=lang==='ar',row=rowFor(lang),current=tr(steps[stage-1],lang)??'';
  const count=ar?`المرحلة ${digits(stage,lang)} من ${digits(5,lang)}`:`Stage ${stage} of 5`;
  return <View style={g.stages}>
    <View style={[g.between,{flexDirection:row}]}>
      <Txt lang={lang} bold style={g.sectionTitle}>{REQUEST_STATUS[lang]}</Txt>
      <Txt lang={lang} style={g.stageCount}>{count}</Txt>
    </View>
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${count}: ${current}`}
      accessibilityValue={{min:1,max:5,now:stage}} style={{flexDirection:row}}>
      {steps.map((step,i)=>{const done=i<stage-1||stage===5,now=i===stage-1&&stage!==5;
        return <View key={step.en} style={g.step}>
          {i<steps.length-1&&<View style={[g.connector,ar?{right:'50%'}:{left:'50%'},i<stage-1&&g.connectorDone]}/>}
          <View style={[g.dot,done&&g.dotDone,now&&g.dotNow]}>{done&&<Icon name="check" size={15} color="#FFFFFF"/>}</View>
          <Txt lang={lang} bold={now} style={{...g.stepText,...(now?{color:colors.brand}:null)}}>{tr(step,lang)}</Txt>
        </View>;})}
    </View>
  </View>;
}

/** Checkbox row (label + tick), for choices such as what to share. */
export function CheckRow({lang,label,checked,onPress,disabled}:{lang:Lang;label:string;checked:boolean;onPress:()=>void;disabled?:boolean}){
  return <ScalePressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked,disabled:!!disabled}} aria-checked={checked} disabled={disabled} onPress={onPress}
    style={[g.check,checked&&g.checkOn,disabled&&g.disabled]}>
    <View pointerEvents="none" style={[g.checkInner,{flexDirection:rowFor(lang)}]}>
      <View style={[g.checkBox,checked&&g.checkBoxOn]}>{checked&&<Icon name="check" size={16} color="#FFFFFF"/>}</View>
      <View style={g.flex1}><Txt lang={lang} bold={checked} style={g.valueText}>{label}</Txt></View>
    </View>
  </ScalePressable>;
}

const shadow=Platform.select({
  ios:{shadowColor:colors.brown,shadowOffset:{width:0,height:10},shadowOpacity:0.1,shadowRadius:22},
  android:{elevation:4},
  default:{},
}) as object;

export const g=StyleSheet.create({
  flex1:{flex:1},
  luxContent:{padding:space.xl,gap:space.lg},
  warningTint:{backgroundColor:'rgba(246,237,214,0.55)'},
  successTint:{backgroundColor:'rgba(222,240,208,0.55)'},
  between:{alignItems:'center',justifyContent:'space-between',gap:space.md},
  screen:{flex:1,backgroundColor:lux.ivory},
  backdrop:{position:'absolute',top:0,right:0,bottom:0,left:0,overflow:'hidden'},
  orb:{position:'absolute',width:320,height:320,borderRadius:160},
  orbWarm:{backgroundColor:'#AFC0F2',opacity:0.22,top:60,left:-140},
  orbSand:{backgroundColor:lux.sand,opacity:0.9,top:440,right:-160},
  content:{flexGrow:1,paddingHorizontal:space.lg,paddingTop:space.md,paddingBottom:space.xxl+space.sm},
  page:{width:'100%',maxWidth:600,alignSelf:'center',gap:space.lg},
  header:{alignItems:'center',gap:space.md},
  backButton:{width:layout.minTouch+4,height:layout.minTouch+4,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',
    backgroundColor:onGlass.field,borderWidth:1,borderColor:onGlass.border,overflow:'hidden'},
  headerTitle:{fontSize:type.title2+2,lineHeight:34},
  headerSubtitle:{fontSize:type.subhead,lineHeight:22,color:colors.muted},
  badge:{alignItems:'center',gap:6,borderRadius:radius.pill,paddingHorizontal:space.md,paddingVertical:5,alignSelf:'flex-start'},
  badgeText:{fontSize:type.footnote,lineHeight:20},
  tag:{borderRadius:radius.pill,paddingHorizontal:space.md,paddingVertical:5,backgroundColor:'#F6EDD6'},
  tagBrand:{backgroundColor:colors.brandTint},
  tagText:{fontSize:type.footnote,lineHeight:20,color:'#76592A'},
  stages:{gap:space.lg},
  stageCount:{fontSize:type.footnote,lineHeight:20,color:colors.brand},
  step:{flex:1,alignItems:'center',gap:space.sm},
  connector:{position:'absolute',top:13,width:'100%',height:2,backgroundColor:colors.line},
  connectorDone:{backgroundColor:colors.orange},
  dot:{width:28,height:28,borderRadius:14,borderWidth:2,borderColor:colors.line,backgroundColor:colors.white,alignItems:'center',justifyContent:'center'},
  dotDone:{backgroundColor:colors.orange,borderColor:colors.orange},
  dotNow:{borderColor:colors.orange,borderWidth:4,backgroundColor:'#E8EDFB'},
  stepText:{fontSize:type.caption,lineHeight:18,textAlign:'center',color:colors.muted},
  checkInner:{alignItems:'center',gap:space.md,paddingHorizontal:space.md,paddingVertical:space.sm},
  check:{minHeight:layout.minTouch+4,justifyContent:'center',borderRadius:radius.control,
    borderWidth:1,borderColor:colors.line,backgroundColor:'rgba(255,255,255,0.9)',overflow:'hidden'},
  checkOn:{borderColor:'#D9BC7E',backgroundColor:'#E8EDFB'},
  checkBox:{width:24,height:24,borderRadius:6,borderWidth:1.5,borderColor:colors.muted,alignItems:'center',justifyContent:'center'},
  checkBoxOn:{backgroundColor:colors.orange,borderColor:colors.orange},
  body:{fontSize:type.subhead,lineHeight:24,color:onGlass.soft},
  meta:{fontSize:type.caption,lineHeight:18,color:colors.muted},
  fill:{flex:1,alignSelf:'stretch'},
  cardShadow:{borderRadius:radius.card+8,...shadow},
  card:{borderRadius:radius.card+8,overflow:'hidden',borderWidth:1,borderColor:onGlass.border},
  cardWarning:{borderColor:'#D9BC7E'},
  cardContent:{padding:space.xl,gap:space.lg,backgroundColor:Platform.select({ios:onGlass.field,default:'rgba(255,255,255,0.86)'})},
  opaque:{backgroundColor:colors.white},
  warningFill:{backgroundColor:'rgba(246,237,214,0.82)'},
  successFill:{backgroundColor:'rgba(229,242,217,0.82)'},

  sectionTitle:{fontSize:type.headline,lineHeight:26},

  valueRow:{alignItems:'center',gap:space.md,paddingVertical:space.sm+2,borderBottomWidth:layout.hairline,borderBottomColor:colors.line},
  valueHighlight:{backgroundColor:colors.brandTint,borderRadius:radius.control,paddingHorizontal:space.md,borderBottomWidth:0,marginVertical:2},
  noBorder:{borderBottomWidth:0},
  valueLabel:{fontSize:type.subhead,lineHeight:22,color:onGlass.soft},
  valueText:{fontSize:type.subhead,lineHeight:22},

  note:{padding:space.md,borderRadius:radius.control,backgroundColor:'rgba(255,255,255,0.9)'},
  noteWarning:{backgroundColor:'#F6EDD6'},
  noteDanger:{backgroundColor:'#FBE6E3'},
  noteSuccess:{backgroundColor:'#E5F2D9'},
  noteText:{fontSize:type.footnote+1,lineHeight:22,color:onGlass.soft},

  button:{minHeight:52,borderRadius:18,justifyContent:'center',overflow:'hidden'},
  buttonInner:{alignItems:'center',justifyContent:'center',gap:space.sm+2,paddingHorizontal:space.lg,paddingVertical:space.md,flexWrap:'nowrap'},
  buttonCompact:{minHeight:layout.minTouch},
  primary:{backgroundColor:colors.orange,borderWidth:0},
  secondary:{backgroundColor:'rgba(255,255,255,0.9)',borderWidth:1,borderColor:'rgba(217,188,126,0.55)'},
  buttonText:{fontSize:type.subhead,textAlign:'center',flexShrink:1},
  disabled:{opacity:0.45},
  iconButton:{width:layout.minTouch,height:layout.minTouch,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',
    backgroundColor:'rgba(255,255,255,0.9)',borderWidth:1,borderColor:'rgba(217,188,126,0.55)',overflow:'hidden'},

  field:{gap:space.xs+2},
  fieldLabel:{fontSize:type.footnote+1,lineHeight:20,color:onGlass.soft},
  input:{minHeight:layout.minTouch+4,borderRadius:radius.control,borderWidth:1,borderColor:colors.line,backgroundColor:'rgba(255,255,255,0.75)',
    paddingHorizontal:space.md,paddingVertical:space.sm,fontSize:type.callout,color:colors.ink},
  inputMulti:{minHeight:96,textAlignVertical:'top'},
});
