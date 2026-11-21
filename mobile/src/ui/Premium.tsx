/**
 * Premium layer: spring press feedback, staggered entrances, gold gradients and gradient-bordered glass.
 * Motion is off when the system "Reduce motion" setting is on (Reanimated reads it).
 */
import React from 'react';
import {Platform,StyleSheet,View,type PressableProps,type StyleProp,type ViewStyle} from 'react-native';
import Animated,{FadeInDown,ReduceMotion,useAnimatedStyle,useReducedMotion,useSharedValue,withSpring} from 'react-native-reanimated';
import {LinearGradient} from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
// The package's class typings predate React 19; the component itself is supported in SDK 58 / Expo Go.
const Masked=MaskedView as unknown as React.ComponentType<{maskElement:React.ReactElement;children:React.ReactNode;importantForAccessibility?:'no-hide-descendants';accessibilityElementsHidden?:boolean}>;
import {BlurView} from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {Pressable} from '../Touch';
import {Icon,type IconName} from '../Icons';
import {Txt,type Lang} from './Txt';
import {lux,radius} from '../theme';

const SPRING={damping:16,stiffness:260,mass:0.6};

/** Pressable that settles with a spring (scale 0.97) and a light haptic tick; native ripple/highlight kept. */
export function ScalePressable({style,children,onPressIn,onPressOut,onPress,haptic=true,scaleTo=0.97,disabled,...rest}:
  PressableProps&{style?:StyleProp<ViewStyle>;children:React.ReactNode;haptic?:boolean;scaleTo?:number;rippleColor?:string}){
  const reduce=useReducedMotion();
  const scale=useSharedValue(1);
  const animated=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));
  return <Animated.View style={[animated,styles.pressWrap]}>
    <Pressable {...rest} disabled={disabled} style={style}
      onPressIn={e=>{if(!reduce)scale.value=withSpring(scaleTo,SPRING);onPressIn?.(e)}}
      onPressOut={e=>{scale.value=withSpring(1,SPRING);onPressOut?.(e)}}
      onPress={e=>{if(haptic&&Platform.OS!=='web')void Haptics.selectionAsync().catch(()=>{});onPress?.(e)}}>
      {children}
    </Pressable>
  </Animated.View>;
}

/** Fades and rises into place; `index` staggers siblings. Skipped automatically under Reduce motion. */
export function Entrance({index=0,children,style}:{index?:number;children:React.ReactNode;style?:StyleProp<ViewStyle>}){
  return <Animated.View style={style} entering={FadeInDown.delay(80+index*70).springify().damping(18).mass(0.8).reduceMotion(ReduceMotion.System)}>{children}</Animated.View>;
}

/**
 * Display text filled with a gold gradient. Screen readers get the plain text once.
 * Web builds (no native masking) fall back to the deepest gold.
 */
export function GoldText({lang,children,style,colors=lux.goldText}:{lang:Lang;children:string;style?:object;colors?:readonly [string,string,...string[]]}){
  if(Platform.OS==='web')return <Txt lang={lang} bold style={{...style,color:colors[0]}}>{children}</Txt>;
  return <View accessible accessibilityRole="header" accessibilityLabel={children}>
    <Masked importantForAccessibility="no-hide-descendants" accessibilityElementsHidden maskElement={<Txt lang={lang} bold style={style}>{children}</Txt>}>
      <LinearGradient colors={colors} start={{x:0,y:0}} end={{x:1,y:1}}>
        <Txt lang={lang} bold style={{...style,opacity:0}}>{children}</Txt>
      </LinearGradient>
    </Masked>
  </View>;
}

/** Round gold-gradient badge with an espresso glyph (≥ 7:1 contrast). */
export function GoldBadge({icon,size=44,dark=false}:{icon:IconName;size?:number;dark?:boolean}){
  return <LinearGradient colors={dark?lux.goldBright:lux.goldBadge} start={{x:0,y:0}} end={{x:1,y:1}}
    style={[styles.badge,{width:size,height:size,borderRadius:size/2}]}>
    <Icon name={icon} size={Math.round(size*0.46)} color={lux.espresso}/>
  </LinearGradient>;
}

/**
 * Glass card with a gold-to-white gradient hairline and a soft warm shadow.
 * Layers: shadow (outer) → gradient border → blur → white sheen → content. Opaque when Reduce transparency is on.
 */
export function LuxCard({children,reduce,style,contentStyle,radius:r=radius.card+10}:{children:React.ReactNode;reduce:boolean;style?:StyleProp<ViewStyle>;contentStyle?:StyleProp<ViewStyle>;radius?:number}){
  return <View style={[styles.shadow,{borderRadius:r},style]}>
    <LinearGradient colors={lux.goldBorder} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.border,{borderRadius:r}]}>
      <View style={[styles.inner,{borderRadius:r-1}]}>
        {!reduce&&<BlurView pointerEvents="none" tint="light" intensity={55} experimentalBlurMethod={Platform.OS==='android'?'dimezisBlurView':undefined} style={StyleSheet.absoluteFill}/>}
        <LinearGradient pointerEvents="none" colors={reduce?[lux.ivory,lux.ivory]:lux.sheen} start={{x:0,y:0}} end={{x:0,y:1}} style={StyleSheet.absoluteFill}/>
        <View style={contentStyle}>{children}</View>
      </View>
    </LinearGradient>
  </View>;
}

const styles=StyleSheet.create({
  pressWrap:{},
  badge:{alignItems:'center',justifyContent:'center'},
  shadow:Platform.select({
    ios:{shadowColor:lux.shadow,shadowOffset:{width:0,height:14},shadowOpacity:0.14,shadowRadius:28},
    android:{elevation:6,backgroundColor:'rgba(255,250,242,0.6)'},
    default:{shadowColor:lux.shadow,shadowOffset:{width:0,height:14},shadowOpacity:0.14,shadowRadius:28},
  }) as ViewStyle,
  border:{padding:1},
  inner:{overflow:'hidden'},
});
