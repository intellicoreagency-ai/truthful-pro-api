import React from 'react';
import Svg, {Path} from 'react-native-svg';

const paths = {
  mail: 'M3 5h18v14H3z M3 6l9 7 9-7',
  lock: 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3 M12 14v3',
  eye: 'M2 12c2.5-4 6-6 10-6s7.5 2 10 6c-2.5 4-6 6-10 6s-7.5-2-10-6Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  eyeOff: 'M3 3l18 18 M10 6c5-1 9 3 12 6-1 2-3 4-5 5 M13 18c-5 1-9-3-11-6a16 16 0 0 1 4-4',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
  folder: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9H3z',
  shield: 'M12 3 20 6v6c0 5-4 8-8 10-4-2-8-5-8-10V6z M8.5 12l2.5 2.5 4.5-5',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M3 12h18 M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  settings: 'M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  power: 'M12 3v8 M7 6a8 8 0 1 0 10 0',
  home: 'M3 10.5 12 3l9 7.5V21H3z M9 21v-7h6v7',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  file: 'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
  places: 'M3 21h18 M5 21V6l8-3v18 M13 9h6v12 M8 8v1 M8 12v1 M8 16v1 M16 12v1 M16 16v1',
  plane: 'M3 13l7 2L19 6c1.5-1.5 3.5.5 2 2l-9 9-1 4-2-3-4-1z M11 12 7 6l2-1 6 4',
  card: 'M3 5h18v14H3z M11 9h7 M11 13h7 M5 15c0-2 4-2 4 0 M8.2 10a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Z',
  scale: 'M12 3v17 M7 21h10 M4 7h16 M5 7l-3 6h6L5 7z M19 7l-3 6h6l-3-6z',
  bank: 'M3 9h18L12 3z M5 12v6 M10 12v6 M14 12v6 M19 12v6 M3 21h18',
  car: 'M4 17v3 M20 17v3 M3 16v-4l3-6h12l3 6v4z M3 12h18 M6 14h1 M17 14h1',
  search: 'M16 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z M15 16l5 5',
  next: 'm9 6 6 6-6 6',
  back: 'm15 6-6 6 6 6',
  plus: 'M12 5v14 M5 12h14',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12 M18 6 6 18',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7v5l3 2',
  renew: 'M20 11a8 8 0 1 0-2 6 M20 4v7h-7',
  edit: 'm13 6 5 5 M4 20l4-1 12-12-4-4L4 15z',
  arrows: 'M3 8h17m-4-4 4 4-4 4 M21 16H4m4-4-4 4 4 4',
  upload: 'M12 16V3m-4 4 4-4 4 4 M4 15v6h16v-6',
  download: 'M12 3v13m-4-4 4 4 4-4 M4 15v6h16v-6',
  headset: 'M4 15v-3a8 8 0 0 1 16 0v3 M4 14h3v6H5.5A1.5 1.5 0 0 1 4 18.5z M20 14h-3v6h1.5a1.5 1.5 0 0 0 1.5-1.5z M18.5 20c-.5 1.5-2.5 2-5.5 2',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 11v5 M12 8h.01',
} as const;

export type IconName = keyof typeof paths;

export function Icon({name, size=22, color='#1D3A9E', filled=false}:{name:IconName;size?:number;color?:string;filled?:boolean}) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
    <Path d={paths[name]} fill={filled?color:"none"} stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>;
}

export function serviceIcon(id:string):IconName {
  if (/immigration|residency|sponsorship/.test(id)) return 'plane';
  if (/ejari/.test(id)) return 'home';
  if (/emirates-id|permit/.test(id)) return 'card';
  if (/court|notary/.test(id)) return 'scale';
  if (/bank|tax|wage/.test(id)) return 'bank';
  if (/rta/.test(id)) return 'car';
  if (/company|business/.test(id)) return 'places';
  return 'file';
}

export function transactionIcon(icon:string):IconName {
  switch(icon) {
    case '＋': return 'plus';
    case '↻': return 'renew';
    case '✎': return 'edit';
    case '⇄': return 'arrows';
    case '×': return 'close';
    case '?': return 'info';
    default: return 'file';
  }
}

