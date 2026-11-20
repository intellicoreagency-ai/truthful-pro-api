import React from 'react';
import {Platform,StyleSheet,Text,View,type TextStyle} from 'react-native';
import {BlurView} from 'expo-blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Pressable} from '../Touch';
import {Icon} from '../Icons';
import {colors,layout,radius,type} from '../theme';
import {TABS,type TabKey} from './tabs';
import {useSetTabBarHeight} from './TabBarLayout';

type Props={
  active:TabKey|null;
  labels:Record<TabKey,string>;
  onSelect:(key:TabKey)=>void;
  /** Android only: the BlurTargetView ref that wraps the content behind the bar (needed for a real blur). */
  blurTarget?:React.RefObject<React.ComponentRef<typeof View>|null>;
  /** Optional strip above the tabs, inside the same blur (e.g. the "Start request" call to action). */
  accessory?:React.ReactNode;
  /** Brand font styles per label state (family differs for Arabic/Latin). */
  labelFont:(selected:boolean)=>TextStyle;
};

/**
 * Apple-style translucent tab bar: system-chrome blur with a warm brand tint, hairline top separator, 49 pt of content
 * plus the home-indicator inset, SF-like 11 pt labels, a raised primary action. On Android the same bar uses the
 * Material ripple and the native blur (falls back to the tint alone on old devices).
 */
export function TabBar({active,labels,onSelect,blurTarget,accessory,labelFont}:Props){
  const insets=useSafeAreaInsets();
  const setHeight=useSetTabBarHeight();
  React.useEffect(()=>()=>setHeight(0),[setHeight]); // content gets the full screen back when the bar is hidden
  return <View style={[s.root,{paddingBottom:insets.bottom}]} onLayout={e=>setHeight(e.nativeEvent.layout.height)} pointerEvents="box-none">
    <View style={[StyleSheet.absoluteFill,s.clip]} pointerEvents="none">
    <BlurView
      style={StyleSheet.absoluteFill}
      tint={Platform.OS==='ios'?'systemChromeMaterialLight':'light'}
      intensity={Platform.OS==='ios'?90:70}
      blurTarget={Platform.OS==='android'?blurTarget:undefined}
      blurMethod="dimezisBlurViewSdk31Plus"/>
    <View style={[StyleSheet.absoluteFill,s.tint]}/>
    <View style={s.hairline}/>
    </View>
    {accessory}
    <View style={s.row} accessibilityRole="tablist">
      {TABS.map(tab=>{
        const selected=active===tab.key;
        return <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={labels[tab.key]} accessibilityState={{selected}}
          onPress={()=>onSelect(tab.key)} style={s.item}
          android_ripple={{color:'rgba(152,80,12,0.16)',borderless:true,radius:36}}>
          <View style={tab.primary?s.plus:s.iconBox}>
            <Icon name={tab.icon} filled={selected&&tab.icon==='home'} size={tab.primary?30:26} color={tab.primary?'white':selected?colors.brand:colors.ink}/>
          </View>
          <Text maxFontSizeMultiplier={layout.maxFontScale} numberOfLines={1} style={[s.label,selected&&s.labelOn,labelFont(selected)]}>{labels[tab.key]}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

const s=StyleSheet.create({
  root:{position:'absolute',left:0,right:0,bottom:0}, // not clipped: the raised primary action rises above the bar
  clip:{overflow:'hidden'},
  tint:{backgroundColor:colors.chrome},
  hairline:{position:'absolute',top:0,left:0,right:0,height:layout.hairline,backgroundColor:colors.line},
  row:{flexDirection:'row',height:layout.tabBar+8,alignItems:'center',justifyContent:'space-around',paddingHorizontal:4},
  item:{flex:1,minHeight:layout.minTouch,alignItems:'center',justifyContent:'center',gap:2},
  iconBox:{height:28,minWidth:32,alignItems:'center',justifyContent:'center'},
  plus:{width:48,height:48,borderRadius:radius.pill,backgroundColor:colors.orange,alignItems:'center',justifyContent:'center',marginTop:-14,boxShadow:'0 4px 12px rgba(255,138,0,0.3)'},
  label:{fontSize:type.tabLabel,color:colors.muted},
  labelOn:{color:colors.brand,fontWeight:'700'},
});
