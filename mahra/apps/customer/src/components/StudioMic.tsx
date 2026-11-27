import Svg, { Defs, G, LinearGradient, Line, Path, Rect, Stop } from 'react-native-svg';

/** ميكروفون استوديو مكثّف معدني: كبسولة شبكية، إطار قوسي، قاعدة. يتوسط الكرة الزجاجية. */
export function StudioMic({ size = 84 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="mc" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#8C93A3" /><Stop offset="0.35" stopColor="#F4F6FA" /><Stop offset="0.65" stopColor="#C4CAD6" /><Stop offset="1" stopColor="#6E7586" /></LinearGradient>
        <LinearGradient id="mb" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#E9ECF3" /><Stop offset="1" stopColor="#7A8194" /></LinearGradient>
      </Defs>
      {/* إطار قوسي */}
      <Path d="M25 44 V50 A25 25 0 0 0 75 50 V44" fill="none" stroke="url(#mb)" strokeWidth="4" strokeLinecap="round" />
      <Line x1="50" y1="75" x2="50" y2="88" stroke="url(#mb)" strokeWidth="4" strokeLinecap="round" />
      <Rect x="34" y="86" width="32" height="5" rx="2.5" fill="url(#mb)" />
      {/* كبسولة المايك */}
      <Rect x="36" y="10" width="28" height="52" rx="14" fill="url(#mc)" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.2" />
      <G stroke="#3A4152" strokeOpacity="0.55" strokeWidth="1">
        <Line x1="36" y1="24" x2="64" y2="24" /><Line x1="36" y1="32" x2="64" y2="32" /><Line x1="36" y1="40" x2="64" y2="40" /><Line x1="36" y1="48" x2="64" y2="48" />
        <Line x1="43" y1="14" x2="43" y2="58" /><Line x1="50" y1="11" x2="50" y2="61" /><Line x1="57" y1="14" x2="57" y2="58" />
      </G>
    </Svg>
  );
}
