/**
 * Main-service banner in Royal navy & gold: navy depth, gold lattice and skyline, a gold medallion, and the title as
 * real text (Arabic and English), so every banner shares one look and reads clearly at any size.
 */
import React from 'react';
import {StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Icon} from '../Icons';
import {Txt,type Lang} from '../ui/Txt';
import {rowFor} from '../ui/Glass';
import {lux,radius,space,type} from '../theme';
import {BannerBackdrop,CategoryMedallion} from './CategoryArt';
import type {CategoryId} from './categories';

/** "3 transactions" with Arabic number agreement. */
export function countLabel(n:number,lang:Lang){
  if(lang==='en')return `${n} ${n===1?'option':'options'}`;
  const d=n.toLocaleString('ar-EG');
  return n===1?'معاملة واحدة':n===2?'معاملتان':n<=10?`${d} معاملات`:`${d} معاملة`;
}

export function CategoryBanner({lang,id,title,subtitle,eyebrow,count,chevron=true,tall=false}:{
  lang:Lang;id:CategoryId;title:string;subtitle:string;eyebrow?:string;count?:number;chevron?:boolean;tall?:boolean;
}){
  const ar=lang==='ar',row=rowFor(lang);
  return <View style={[s.frame,tall&&s.tall]}>
    <LinearGradient colors={['#16305A','#0B1F3A','#08182E']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}><BannerBackdrop flip={ar}/></View>
    <LinearGradient pointerEvents="none" colors={['rgba(233,213,166,0)','rgba(233,213,166,0.9)','rgba(233,213,166,0)']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.topLine}/>
    <View style={[s.content,{flexDirection:row}]}>
      <CategoryMedallion id={id} size={tall?72:62} lang={lang}/>
      <View style={s.text}>
        {eyebrow?<Txt lang={lang} bold style={{...s.eyebrow,textAlign:ar?'right':'left'}}>{eyebrow}</Txt>:null}
        <Txt lang={lang} bold numberOfLines={2} style={{...s.title,textAlign:ar?'right':'left'}}>{title}</Txt>
        <Txt lang={lang} numberOfLines={2} style={{...s.subtitle,textAlign:ar?'right':'left'}}>{subtitle}</Txt>
        {count!==undefined?<View style={[s.chip,{alignSelf:ar?'flex-end':'flex-start'}]}><Txt lang={lang} bold style={s.chipText}>{countLabel(count,lang)}</Txt></View>:null}
      </View>
      {chevron?<View style={s.chevron}><Icon name={ar?'back':'next'} size={18} color={lux.goldBright[0]}/></View>:null}
    </View>
  </View>;
}

const s=StyleSheet.create({
  frame:{minHeight:132,borderRadius:radius.card,overflow:'hidden',backgroundColor:lux.espresso,justifyContent:'center'},
  tall:{minHeight:156},
  topLine:{position:'absolute',top:0,left:0,right:0,height:1.2},
  content:{alignItems:'center',gap:space.md,paddingVertical:space.lg,paddingHorizontal:space.lg},
  text:{flex:1,gap:3},
  eyebrow:{fontSize:type.caption,lineHeight:16,color:lux.goldBright[0],letterSpacing:0.3},
  title:{fontSize:type.headline+1,lineHeight:26,color:lux.onDark},
  subtitle:{fontSize:type.footnote,lineHeight:19,color:lux.onDarkSoft},
  chip:{marginTop:space.xs,paddingHorizontal:space.sm+2,paddingVertical:2,borderRadius:radius.pill,borderWidth:1,borderColor:'rgba(201,164,92,0.6)',backgroundColor:'rgba(201,164,92,0.12)'},
  chipText:{fontSize:type.caption,lineHeight:17,color:lux.goldBright[0]},
  chevron:{width:32,height:32,borderRadius:16,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(201,164,92,0.55)'},
});
