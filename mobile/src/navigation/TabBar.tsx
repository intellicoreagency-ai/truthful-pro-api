import React,{useEffect} from 'react';
import {Platform,StyleSheet,Text,View,useWindowDimensions,type TextStyle} from 'react-native';
import Animated,{useAnimatedStyle,useReducedMotion,useSharedValue,withSpring} from 'react-native-reanimated';
import {BlurView} from 'expo-blur';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Icon} from '../Icons';
import {ScalePressable} from '../ui/Premium';
import {colors,layout,lux,type} from '../theme';
import {TABS,type TabItem,type TabKey} from './tabs';
import {useSetTabBarHeight} from './TabBarLayout';

type Props={
  active:TabKey|null;
  labels:Record<TabKey,string>;
  onSelect:(key:TabKey)=>void;
  /** Android only: the BlurTargetView ref that wraps the content behind the bar (needed for a real blur). */
  blurTarget?:React.RefObject<React.ComponentRef<typeof View>|null>;
  /** Optional strip above the bar (e.g. the "Start request" call to action). */
  accessory?:React.ReactNode;
  /** Label font per state (Cairo for Arabic, system font for English). */
  labelFont:(selected:boolean)=>TextStyle;
  /** Right-to-left: the first tab (Home) sits on the right. */
  rtl?:boolean;
};

const SPRING={damping:15,stiffness:240,mass:0.6};
/** How far the raised "+" rises above the capsule; screens reserve it so their last item is never covered. */
const FAB_RISE=34;

/** One tab: the selected one gets a gold pill that springs in behind its icon. */
function Tab({tab,selected,label,onPress,labelFont,compact}:{tab:TabItem;selected:boolean;label:string;onPress:()=>void;labelFont:(s:boolean)=>TextStyle;compact:boolean}){
  const reduce=useReducedMotion();
  const on=useSharedValue(selected?1:0);
  useEffect(()=>{on.value=reduce?(selected?1:0):withSpring(selected?1:0,SPRING)},[selected,reduce,on]);
  const pill=useAnimatedStyle(()=>({opacity:on.value,transform:[{scale:0.6+0.4*on.value}]}));
  return <ScalePressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{selected}} aria-selected={selected} onPress={onPress}
    android_ripple={{color:'rgba(11,31,58,0.14)',borderless:true,radius:34}} style={s.item}>
    <View style={s.iconBox} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill,pill]}>
        <LinearGradient colors={lux.goldBadge} start={{x:0,y:0}} end={{x:1,y:1}} style={s.pill}/>
      </Animated.View>
      <View><Icon name={tab.icon} filled={selected&&tab.icon==='home'} size={23} color={selected?colors.brand:colors.ink}/></View>
    </View>
    <Text maxFontSizeMultiplier={layout.maxFontScale} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[s.label,compact&&s.labelCompact,selected&&s.labelOn,labelFont(selected)]}>{label}</Text>
  </ScalePressable>;
}

/**
 * Floating glass tab bar: a gradient-bordered capsule (blur + ivory sheen + warm shadow) that floats above the
 * home indicator, a raised gold-ringed "+" for the primary action, and a springy gold pill on the selected tab.
 * Reports its full height (incl. accessory and safe area) so screens keep their last item clear of it.
 */
export function TabBar({active,labels,onSelect,blurTarget,accessory,labelFont,rtl=false}:Props){
  const insets=useSafeAreaInsets();
  const compact=useWindowDimensions().width<380; // small phones: slightly smaller labels so none truncate
  const setHeight=useSetTabBarHeight();
  React.useEffect(()=>()=>setHeight(0),[setHeight]); // content gets the full screen back when the bar is hidden
  return <View style={[s.root,{paddingBottom:Math.max(insets.bottom,10)}]} onLayout={e=>setHeight(e.nativeEvent.layout.height+(accessory?0:FAB_RISE))} pointerEvents="box-none">
    {accessory}
    <View style={s.capsuleShadow}>
      <LinearGradient colors={lux.goldBorder} start={{x:0,y:0}} end={{x:1,y:1}} style={s.capsuleBorder}>
        <View style={s.capsule}>
          {/* clipped material layer; the row above it stays unclipped so the "+" can rise out of the capsule */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill,s.material]}>
            <BlurView style={StyleSheet.absoluteFill}
              tint={Platform.OS==='ios'?'systemChromeMaterialLight':'light'} intensity={Platform.OS==='ios'?90:70}
              blurTarget={Platform.OS==='android'?blurTarget:undefined} blurMethod="dimezisBlurViewSdk31Plus"/>
            <LinearGradient colors={['rgba(255,255,255,0.82)','rgba(244,245,247,0.66)']} style={StyleSheet.absoluteFill}/>
          </View>
          <View style={[s.row,{flexDirection:rtl?'row-reverse':'row'}]} accessibilityRole="tablist">
            {TABS.map(tab=>tab.primary
              ?<View key={tab.key} style={[s.item,s.fabItem]}>
                <ScalePressable accessibilityRole="button" accessibilityLabel={labels[tab.key]} onPress={()=>onSelect(tab.key)} scaleTo={0.92}
                  rippleColor="rgba(255,255,255,0.3)" style={s.fabHit}>
                  <View pointerEvents="none" style={s.fabShadow}>
                    <LinearGradient colors={lux.goldBright} start={{x:0,y:0}} end={{x:1,y:1}} style={s.fabRing}>
                      <LinearGradient colors={lux.orangeDeep} start={{x:0,y:0}} end={{x:1,y:1}} style={s.fab}>
                        <Icon name="plus" size={28} color="#FFFFFF"/>
                      </LinearGradient>
                    </LinearGradient>
                  </View>
                </ScalePressable>
                <Text maxFontSizeMultiplier={layout.maxFontScale} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.label,compact&&s.labelCompact,s.fabLabel,labelFont(false)]}>{labels[tab.key]}</Text>
              </View>
              :<Tab key={tab.key} tab={tab} selected={active===tab.key} label={labels[tab.key]} onPress={()=>onSelect(tab.key)} labelFont={labelFont} compact={compact}/>)}
          </View>
        </View>
      </LinearGradient>
    </View>
  </View>;
}

const s=StyleSheet.create({
  root:{position:'absolute',left:0,right:0,bottom:0,paddingHorizontal:12}, // not clipped: the raised "+" rises above the capsule
  capsuleShadow:{borderRadius:34,width:'100%',maxWidth:560,alignSelf:'center',...Platform.select({
    ios:{shadowColor:lux.shadow,shadowOffset:{width:0,height:12},shadowOpacity:0.18,shadowRadius:24},
    android:{elevation:12,backgroundColor:'rgba(255,255,255,0.6)'},
    default:{shadowColor:lux.shadow,shadowOffset:{width:0,height:12},shadowOpacity:0.18,shadowRadius:24},
  }) as object},
  capsuleBorder:{borderRadius:34,padding:1},
  capsule:{borderRadius:33,overflow:'visible'},
  material:{borderRadius:33,overflow:'hidden'},
  row:{height:layout.tabBar+18,alignItems:'center',justifyContent:'space-around',paddingHorizontal:2,borderRadius:33},
  item:{flex:1,minHeight:layout.minTouch+8,alignItems:'center',justifyContent:'center',gap:2,paddingHorizontal:2},
  iconBox:{width:52,height:32,alignItems:'center',justifyContent:'center'},
  pill:{flex:1,borderRadius:16},
  label:{fontSize:type.tabLabel,color:colors.muted,textAlign:'center',maxWidth:'100%'},
  labelCompact:{fontSize:type.tabLabel-1},
  labelOn:{color:colors.brand,fontWeight:'700'},
  fabHit:{marginTop:-FAB_RISE,borderRadius:34},
  fabShadow:{borderRadius:33,...Platform.select({
    ios:{shadowColor:'#0B1F3A',shadowOffset:{width:0,height:8},shadowOpacity:0.38,shadowRadius:14},
    android:{elevation:10},
    default:{shadowColor:'#0B1F3A',shadowOffset:{width:0,height:8},shadowOpacity:0.38,shadowRadius:14},
  }) as object},
  fabRing:{width:66,height:66,borderRadius:33,padding:3},
  fab:{flex:1,borderRadius:30,alignItems:'center',justifyContent:'center'},
  fabItem:{flex:1.25}, // a little wider so "Start Request" fits without shrinking
  fabLabel:{marginTop:2,alignSelf:'stretch'},
});
