/**
 * Gold line-art for the main services and the banner backdrop (skyline + lattice), drawn as vectors so it stays crisp,
 * follows the palette and needs no raster artwork. Generic symbols only: no emblems, logos or authority marks.
 */
import React from 'react';
import Svg,{Circle,Defs,G,LinearGradient as SvgGradient,Path,Rect,Stop,Text as SvgText} from 'react-native-svg';
import type {CategoryId} from './categories';

const ICON:Record<CategoryId,React.ReactNode>={
  residency:<>
    <Rect x={13} y={7} width={22} height={34} rx={3}/>
    <Circle cx={24} cy={21} r={6.5}/>
    <Path d="M17.5 21h13M24 14.5c-2.8 3.4-2.8 9.6 0 13M24 14.5c2.8 3.4 2.8 9.6 0 13M18.5 34h11"/>
  </>,
  'emirates-id':<>
    <Rect x={6} y={11} width={36} height={26} rx={4}/>
    <Circle cx={16.5} cy={21.5} r={3.8}/>
    <Path d="M10.5 31.5c.9-3.7 3.2-5.4 6-5.4s5.1 1.7 6 5.4M27 19.5h10M27 24.5h10M27 29.5h6.5"/>
  </>,
  business:<>
    <Path d="M6 41h36M10 41V14l12-6v33M22 41V19l16 6v16"/>
    <Path d="M15 17.5h2.5M15 23.5h2.5M15 29.5h2.5M15 35.5h2.5M27 29h2.5M32.5 29H35M27 35h2.5M32.5 35H35"/>
  </>,
  labour:<>
    <Circle cx={24} cy={14.5} r={6.5}/>
    <Path d="M11 41c0-7.5 5.8-13 13-13s13 5.5 13 13M24 28l-2.2 4 2.2 7 2.2-7z"/>
  </>,
  ejari:<>
    <Path d="M7 22.5L24 8.5l17 14M11.5 19.5V40h25V19.5"/>
    <Circle cx={24} cy={27} r={3.8}/>
    <Path d="M24 30.8V37M24 34h3.2"/>
  </>,
  notary:<>
    <Path d="M18.5 26.5c-1-3.2-3.2-5.3-3.2-9.3a8.7 8.7 0 0117.4 0c0 4-2.2 6.1-3.2 9.3"/>
    <Rect x={11} y={26.5} width={26} height={6.5} rx={2}/>
    <Path d="M9 39h30"/>
  </>,
  courts:<>
    <Path d="M24 7.5v32M15 40h18M11 13.5h26M13.5 13.5L8.5 25M13.5 13.5l5 11.5M34.5 13.5L29.5 25M34.5 13.5l5 11.5"/>
    <Path d="M7.5 25a6 6 0 0012 0zM28.5 25a6 6 0 0012 0z"/>
  </>,
  translation:<>
    <Path d="M6 8h21v15H14l-5 4.5V23H6z"/>
    <Path d="M21 21.5h21v15h-3V41l-5-4.5H21z"/>
  </>,
  attestation:<>
    <Path d="M11 6h16l8 8v13M11 6v34h12M27 6v8h8M16 18h10M16 23.5h12"/>
    <Circle cx={31} cy={33} r={6}/>
    <Path d="M28 38.5L26.5 43l4.5-2 4.5 2-1.5-4.5"/>
  </>,
  rta:<>
    <Path d="M7 31v-6.5l4.2-9h25.6l4.2 9V31zM11 24.5h26"/>
    <Circle cx={15} cy={33} r={3.3}/><Circle cx={33} cy={33} r={3.3}/>
  </>,
  tax:<>
    <Path d="M11 6h26v36l-4.3-3-4.4 3-4.3-3-4.3 3-4.4-3L11 42z"/>
    <Path d="M19 29l10-10"/>
    <Circle cx={19.5} cy={19.5} r={2.2}/><Circle cx={28.5} cy={28.5} r={2.2}/>
  </>,
  bank:<>
    <Path d="M6 17.5L24 8l18 9.5zM10 17.5v17M18 17.5v17M30 17.5v17M38 17.5v17M6 35h36M6 40h36"/>
  </>,
  customs:<>
    <Path d="M7 16l17-8.5L41 16v17L24 41.5 7 33zM7 16l17 8.5L41 16M24 24.5v17"/>
    <Path d="M15.5 12l17 8.5"/>
  </>,
};

/** Category glyph inside a gold-ringed medallion. */
export function CategoryMedallion({id,size=64,lang}:{id:CategoryId;size?:number;lang:'ar'|'en'}){
  return <Svg width={size} height={size} viewBox="0 0 64 64" accessible={false}>
    <Defs>
      <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#E9D5A6"/><Stop offset="0.55" stopColor="#C9A45C"/><Stop offset="1" stopColor="#8F6E34"/>
      </SvgGradient>
    </Defs>
    <Circle cx={32} cy={32} r={30} fill="rgba(255,255,255,0.06)" stroke="url(#ring)" strokeWidth={1.6}/>
    <Circle cx={32} cy={32} r={25.5} fill="none" stroke="rgba(201,164,92,0.35)" strokeWidth={0.8}/>
    <G transform="translate(8 8)" fill="none" stroke="url(#ring)" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      {ICON[id]}
      {id==='translation'&&<>
        <SvgText x={16.5} y={19.5} fill="#E9D5A6" stroke="none" fontSize={10} fontWeight="700" textAnchor="middle">{lang==='ar'?'ع':'A'}</SvgText>
        <SvgText x={31.5} y={33} fill="#E9D5A6" stroke="none" fontSize={10} fontWeight="700" textAnchor="middle">{lang==='ar'?'A':'ع'}</SvgText>
      </>}
    </G>
  </Svg>;
}

/**
 * Banner backdrop: a soft eight-point lattice and a sweeping gold arc on one side, a Dubai-style skyline silhouette
 * along the bottom on the other. `flip` mirrors it for Arabic so the art always sits opposite the text start.
 */
export function BannerBackdrop({flip}:{flip:boolean}){
  return <Svg width="100%" height="100%" viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" accessible={false}>
    <G transform={flip?'translate(400 0) scale(-1 1)':undefined}>
      <G opacity={0.09} fill="none" stroke="#E9D5A6" strokeWidth={0.8}>
        {[0,1,2,3].flatMap(r=>[0,1,2,3,4].map(c=>{const x=250+c*34+(r%2)*17,y=8+r*34;
          return <Path key={`${r}-${c}`} d={`M${x} ${y-11}L${x+4} ${y-4}L${x+11} ${y}L${x+4} ${y+4}L${x} ${y+11}L${x-4} ${y+4}L${x-11} ${y}L${x-4} ${y-4}Z`}/>;}))}
      </G>
      <Path d="M210 160C250 90 320 40 420 30" fill="none" stroke="#C9A45C" strokeOpacity={0.55} strokeWidth={1.3}/>
      <Path d="M228 160C268 100 330 58 420 50" fill="none" stroke="#C9A45C" strokeOpacity={0.22} strokeWidth={0.9}/>
      <Path fill="rgba(255,255,255,0.07)" d="M262 150V118h8v-14h6v14h6V96h10v22h5V82l3-9 3 9v6l1.5-40 1.5 40v10h5v30h7v-24h9v24h6v-16h11v16h6V108h9v42z"/>
    </G>
  </Svg>;
}
