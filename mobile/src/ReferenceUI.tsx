/** Approved-artwork helpers: the official logo, crops of approved reference images, and the WhatsApp/phone glyph. */
import React from 'react';
import {View, Image} from 'react-native';
import Svg,{Path} from 'react-native-svg';
export const officialLogo=require('../assets/brand/truthful_official_logo.jpg');
export function RefSprite({source,sourceWidth,sourceHeight,bounds,style,label}:{source:number;sourceWidth:number;sourceHeight:number;bounds:[number,number,number,number];style?:any;label?:string}){const [x,y,w,h]=bounds;return <View style={[{overflow:'hidden',aspectRatio:w/h},style]} accessible={!!label} accessibilityLabel={label}><Image source={source} resizeMode="stretch" accessible={false} style={{position:'absolute',width:`${sourceWidth/w*100}%`,height:`${sourceHeight/h*100}%`,left:`${-x/w*100}%`,top:`${-y/h*100}%`}}/></View>}
export function ContactGlyph({whatsapp=false,size=30}:{whatsapp?:boolean;size?:number}){return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d={whatsapp?'M21 11.5a9 9 0 0 1-13.4 7.8L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z':'M6 3l4 4-2 3c1 3 3 5 6 6l3-2 4 4c-1 4-5 4-8 2C7 17 3 13 2 7c0-3 2-4 4-4Z'} fill={whatsapp?'none':'#9D6F1C'} stroke={whatsapp?'#2D9B38':'#9D6F1C'} strokeWidth={1.5}/>{whatsapp&&<Path d="M8 7l2 3-1 1c1 2 2 3 4 3l1-1 3 2c-1 2-3 2-5 1-3-1-5-4-5-6 0-2 0-2 1-3Z" fill="#2D9B38"/>}</Svg>}
