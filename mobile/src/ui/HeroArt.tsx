/**
 * Home hero artwork — "Sapphire night over Dubai", drawn as vectors (crisp at any size, no photo licensing).
 * Deep navy-to-sapphire sky, faint stars and a mashrabiya lattice, a gold crescent, a warm gold glow on the horizon,
 * a gold-edged skyline (sail hotel, torus museum, needle tower, towers) and its reflection in the Creek.
 */
import React from 'react';
import Svg,{Circle,Defs,Ellipse,G,LinearGradient,Path,RadialGradient,Rect,Stop} from 'react-native-svg';

const STARS:[number,number,number][]=[[34,38,1.1],[78,22,0.8],[122,58,1],[168,30,0.7],[214,48,1.2],[262,18,0.8],[300,64,0.9],[352,36,0.7],[386,84,1],[58,92,0.7],[146,96,0.8],[236,90,0.7],[20,130,0.8],[372,130,0.7]];

function Lattice(){
  const cells=[];
  for(let r=0;r<5;r++)for(let c=0;c<10;c++){
    const x=20+c*40+(r%2)*20,y=24+r*36;
    cells.push(<Path key={`${r}-${c}`} d={`M${x} ${y-12}L${x+5} ${y-5}L${x+12} ${y}L${x+5} ${y+5}L${x} ${y+12}L${x-5} ${y+5}L${x-12} ${y}L${x-5} ${y-5}Z`}/>);
  }
  return <G opacity={0.06} fill="none" stroke="#F1DDAA" strokeWidth={0.7}>{cells}</G>;
}

// Skyline drawn once and reflected; baseline y=258.
const SKYLINE=[
  // sail hotel (left)
  'M18 258V176C30 196 44 222 52 258Z',
  'M14 258V168h3v90Z',
  // low towers
  'M60 258V214h14v44ZM78 258V200h12v58ZM94 258V222h10v36Z',
  // torus museum
  'M112 258V246h4c-4-10-4-28 8-40 12-12 32-12 44 0 12 12 12 30 8 40h4v12Z',
  // mid towers
  'M186 258V188h16v70ZM206 258V170l8-8 8 8v88ZM226 258V204h12v54Z',
  // needle tower (stepped)
  'M250 258V200h10v-26h6v-30h5v-34h3v-42l2-14 2 14v42h3v34h5v30h6v26h10v58Z',
  // right towers
  'M300 258V196h14v62ZM318 258V176l10-12 10 12v82ZM342 258V212h12v46ZM358 258V190h16v68ZM378 258V222h20v36Z',
];

export function HeroArt(){
  return <Svg width="100%" height="100%" viewBox="0 0 400 340" preserveAspectRatio="xMidYMax slice" accessible={false}>
    <Defs>
      <LinearGradient id="hsky" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#070F24"/><Stop offset="0.45" stopColor="#0F1B45"/><Stop offset="0.78" stopColor="#1A2C66"/><Stop offset="1" stopColor="#1D3A9E"/>
      </LinearGradient>
      <RadialGradient id="hglow" cx="0.62" cy="0.78" rx="0.6" ry="0.32">
        <Stop offset="0" stopColor="#E7C985" stopOpacity="0.62"/><Stop offset="1" stopColor="#E7C985" stopOpacity="0"/>
      </RadialGradient>
      <LinearGradient id="hcity" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#14214A"/><Stop offset="1" stopColor="#070F24"/>
      </LinearGradient>
      <LinearGradient id="hgold" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#B8893F"/><Stop offset="0.5" stopColor="#FFF1C9"/><Stop offset="1" stopColor="#B8893F"/>
      </LinearGradient>
      <LinearGradient id="hwater" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#14214A"/><Stop offset="1" stopColor="#0A1430"/>
      </LinearGradient>
    </Defs>
    <Rect x={0} y={0} width={400} height={340} fill="url(#hsky)"/>
    <Lattice/>
    {STARS.map(([x,y,r])=><Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#FFF6DE" opacity={0.85}/>)}
    {/* crescent */}
    <G>
      <Circle cx={96} cy={128} r={30} fill="#E7C985" opacity={0.10}/>
      <Circle cx={96} cy={128} r={44} fill="#E7C985" opacity={0.05}/>
      <Path d="M104 106a22 22 0 1 0 0 44a17 17 0 1 1 0-44Z" fill="url(#hgold)"/>
    </G>
    <Rect x={0} y={150} width={400} height={190} fill="url(#hglow)"/>
    {/* skyline */}
    <G fill="url(#hcity)" stroke="#E7C985" strokeOpacity={0.75} strokeWidth={0.9} strokeLinejoin="round">
      {SKYLINE.map(d=><Path key={d} d={d}/>)}
    </G>
    <Ellipse cx={144} cy={226} rx={14} ry={14} fill="#0A1430" stroke="#E7C985" strokeOpacity={0.6} strokeWidth={0.8}/>
    {/* window lights */}
    <G fill="#F1DDAA" opacity={0.55}>
      {[[262,214],[266,190],[268,160],[192,200],[192,216],[322,190],[322,210],[362,204],[214,190],[214,214]].map(([x,y])=><Rect key={`${x}-${y}`} x={x} y={y} width={2.2} height={3} rx={0.5}/>)}
    </G>
    {/* water and reflection */}
    <Rect x={0} y={258} width={400} height={82} fill="url(#hwater)"/>
    <G opacity={0.16} transform="translate(0 516) scale(1 -1)" fill="#E7C985">
      {SKYLINE.map(d=><Path key={d} d={d}/>)}
    </G>
    <Path d="M0 258H400" stroke="url(#hgold)" strokeWidth={1.4}/>
    <G stroke="#F1DDAA" strokeLinecap="round" opacity={0.35}>
      <Path d="M210 272h60M232 284h34M250 296h20M60 278h30M330 282h26" strokeWidth={1}/>
    </G>
  </Svg>;
}
