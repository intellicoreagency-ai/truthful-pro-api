/**
 * Service banner — Sapphire & gold (owner decision, final).
 * Composition, mirrored for Arabic: a navy-sapphire text panel with a gold medallion, real-text title, subtitle and
 * options count; a sweeping gold wave; the service photo on the far side, shaded into the wave so the seam disappears.
 */
import React from 'react';
import {Image,StyleSheet,View,type ImageSourcePropType} from 'react-native';
import Svg,{Defs,G,LinearGradient as SvgGradient,Path,Rect,Stop} from 'react-native-svg';
import {Txt,type Lang} from '../ui/Txt';
import {rowFor} from '../ui/Glass';
import {lux,radius,space,type} from '../theme';
import {CategoryMedallion} from './CategoryArt';
import {BANNER_PHOTOS} from './bannerPhotos';
import type {CategoryId} from './categories';

/** "3 transactions" with Arabic number agreement. */
export function countLabel(n:number,lang:Lang){
  if(lang==='en')return `${n} ${n===1?'option':'options'}`;
  const d=n.toLocaleString('ar-EG');
  return n===1?'معاملة واحدة':n===2?'معاملتان':n<=10?`${d} معاملات`:`${d} معاملة`;
}

// Geometry in a 400 × 150 box: the wave runs from (254,0) to (224,150) with an S-curve.
const WAVE='M254 0C230 38 274 98 224 150';
const PANEL='M0 0H254C230 38 274 98 224 150H0Z';
const WAVE_2='M264 0C240 38 284 98 234 150';

function Art({flip}:{flip:boolean}){
  return <Svg width="100%" height="100%" viewBox="0 0 400 150" preserveAspectRatio="none" accessible={false}>
    <Defs>
      <SvgGradient id="bpanel" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#1A2C66"/><Stop offset="0.55" stopColor="#0F1B45"/><Stop offset="1" stopColor="#0A1430"/>
      </SvgGradient>
      <SvgGradient id="bshade" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#0A1430" stopOpacity="0.85"/><Stop offset="1" stopColor="#0A1430" stopOpacity="0"/>
      </SvgGradient>
      <SvgGradient id="bgold" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFF1C9"/><Stop offset="0.45" stopColor="#E7C985"/><Stop offset="1" stopColor="#B8893F"/>
      </SvgGradient>
      <SvgGradient id="bsheen" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.10"/><Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0"/>
      </SvgGradient>
    </Defs>
    <G transform={flip?'translate(400 0) scale(-1 1)':undefined}>
      <Rect x={214} y={0} width={90} height={150} fill="url(#bshade)"/>
      <Path d={PANEL} fill="url(#bpanel)"/>
      <Path d={PANEL} fill="url(#bsheen)"/>
      <G opacity={0.08} fill="none" stroke="#F1DDAA" strokeWidth={0.7}>
        {[[18,16],[44,16],[31,36],[18,56]].map(([x,y])=><Path key={`${x}-${y}`} d={`M${x} ${y!-9}L${x!+3.5} ${y!-3.5}L${x!+9} ${y}L${x!+3.5} ${y!+3.5}L${x} ${y!+9}L${x!-3.5} ${y!+3.5}L${x!-9} ${y}L${x!-3.5} ${y!-3.5}Z`}/>)}
      </G>
      <Path d={WAVE} fill="none" stroke="#E7C985" strokeOpacity={0.22} strokeWidth={9}/>
      <Path d={WAVE_2} fill="none" stroke="url(#bgold)" strokeOpacity={0.55} strokeWidth={0.9}/>
      <Path d={WAVE} fill="none" stroke="url(#bgold)" strokeWidth={2.6} strokeLinecap="round"/>
    </G>
  </Svg>;
}

export function CategoryBanner({lang,id,photoId,title,subtitle,eyebrow,count,tall=false}:{
  lang:Lang;id:CategoryId;photoId?:string;title:string;subtitle:string;eyebrow?:string;count?:number;tall?:boolean;
}){
  const ar=lang==='ar',row=rowFor(lang);
  const photo:ImageSourcePropType|undefined=photoId?BANNER_PHOTOS[photoId]:undefined;
  const align=ar?'right':'left';
  return <View style={[s.frame,tall?s.tall:s.regular]}>
    {photo?<Image source={photo} resizeMode="cover" accessible={false} style={[s.photo,ar?{left:0}:{right:0}]}/>:null}
    <View pointerEvents="none" style={StyleSheet.absoluteFill}><Art flip={ar}/></View>
    <View style={[s.content,{flexDirection:row,alignSelf:ar?'flex-end':'flex-start'}]}>
      <CategoryMedallion id={id} size={tall?52:44} lang={lang}/>
      <View style={s.text}>
        {eyebrow?<Txt lang={lang} bold numberOfLines={1} style={{...s.eyebrow,textAlign:align}}>{eyebrow}</Txt>:null}
        <Txt lang={lang} bold numberOfLines={2} style={{...s.title,textAlign:align}}>{title}</Txt>
        <Txt lang={lang} numberOfLines={2} style={{...s.subtitle,textAlign:align}}>{subtitle}</Txt>
        {count!==undefined?<View style={[s.chip,{alignSelf:ar?'flex-end':'flex-start'}]}><Txt lang={lang} bold style={s.chipText}>{countLabel(count,lang)}</Txt></View>:null}
      </View>
    </View>
    <View pointerEvents="none" style={s.rim}/>
  </View>;
}

const s=StyleSheet.create({
  frame:{borderRadius:radius.card,overflow:'hidden',backgroundColor:lux.espresso,justifyContent:'center'},
  regular:{aspectRatio:400/150,minHeight:128},
  tall:{aspectRatio:400/160,minHeight:140},
  photo:{position:'absolute',top:0,bottom:0,width:'47%',height:'100%'},
  content:{width:'63%',alignItems:'center',gap:space.sm,paddingVertical:space.md,paddingHorizontal:space.md},
  text:{flex:1,gap:2},
  eyebrow:{fontSize:type.caption,lineHeight:16,color:lux.goldBright[0]},
  title:{fontSize:type.callout,lineHeight:21,color:lux.onDark},
  subtitle:{fontSize:type.caption+0.5,lineHeight:17,color:lux.onDarkSoft},
  chip:{marginTop:4,paddingHorizontal:space.sm,paddingVertical:1,borderRadius:radius.pill,borderWidth:1,borderColor:'rgba(217,188,126,0.65)',backgroundColor:'rgba(217,188,126,0.14)'},
  chipText:{fontSize:type.caption-0.5,lineHeight:16,color:lux.goldBright[0]},
  rim:{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:radius.card,borderWidth:1,borderColor:'rgba(241,221,170,0.45)'},
});
