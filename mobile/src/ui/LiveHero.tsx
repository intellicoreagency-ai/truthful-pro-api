/**
 * Live Dubai hero: the approved Dubai Marina photo with a slow, silent "Ken Burns" drift
 * (gentle zoom and pan over ~24 s, back and forth). Respects Reduce Motion: the photo then stays still.
 * A photo is used instead of a video loop: no licensed Dubai video clip has been supplied yet; swapping in
 * an expo-video loop later only means replacing this component's content.
 */
import React,{useEffect} from 'react';
import {Image,StyleSheet,View} from 'react-native';
import Animated,{Easing,cancelAnimation,useAnimatedStyle,useReducedMotion,useSharedValue,withRepeat,withTiming} from 'react-native-reanimated';

const photo=require('../../assets/brand/home-hero-marina.jpg');
const CYCLE=24000;

export function LiveHero(){
  const reduceMotion=useReducedMotion();
  const p=useSharedValue(0);
  useEffect(()=>{
    if(reduceMotion){p.value=0;return}
    p.value=withRepeat(withTiming(1,{duration:CYCLE,easing:Easing.inOut(Easing.sin)}),-1,true);
    return()=>cancelAnimation(p);
  },[reduceMotion,p]);
  const drift=useAnimatedStyle(()=>({transform:[
    {scale:1.04+p.value*0.1},
    {translateX:-10+p.value*22},
    {translateY:p.value*-8},
  ]}));
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Animated.View style={[StyleSheet.absoluteFill,drift]}>
      <Image source={photo} resizeMode="cover" style={s.photo} accessible={false}/>
    </Animated.View>
  </View>;
}

const s=StyleSheet.create({photo:{width:'100%',height:'100%'}});
