import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { color } from '@/theme/tokens';

type Props = { tone?: 'gold' | 'blue' };

/**
 * أرضية ليلية بثلاثة أضواء محيطية (Spatial Glass): أزرق ناعم من أعلى اليمين، وذهبي دافئ من اليسار،
 * وأخضر خفيف من الأسفل. ثابتة بلا حركة. tone='blue' يبدّل الذهبي بأزرق لشاشات هادئة.
 */
export function Backdrop({ tone = 'gold' }: Props) {
  const id = useId().replace(/:/g, '');
  const warm = tone === 'gold' ? color.gold : color.periwinkle;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`${id}b`} x1="0" y1="0" x2="0.35" y2="1"><Stop offset="0" stopColor="#060913" /><Stop offset="0.5" stopColor="#0D1528" /><Stop offset="1" stopColor="#151024" /></LinearGradient>
          <LinearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.07" /><Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></LinearGradient>
          <RadialGradient id={`${id}1`} cx="0.82" cy="0.1" rx="0.7" ry="0.32"><Stop offset="0" stopColor={color.periwinkle} stopOpacity="0.30" /><Stop offset="1" stopColor={color.periwinkle} stopOpacity="0" /></RadialGradient>
          <RadialGradient id={`${id}2`} cx="0.16" cy="0.36" rx="0.7" ry="0.3"><Stop offset="0" stopColor={warm} stopOpacity="0.22" /><Stop offset="1" stopColor={warm} stopOpacity="0" /></RadialGradient>
          <RadialGradient id={`${id}3`} cx="0.5" cy="0.95" rx="0.8" ry="0.3"><Stop offset="0" stopColor={color.green} stopOpacity="0.17" /><Stop offset="1" stopColor={color.green} stopOpacity="0" /></RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id}b)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}1)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}2)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}3)`} />
        {/* أشعة ضوء معمارية رأسية خافتة */}
        <Rect x="14%" width="3%" height="70%" fill={`url(#${id}v)`} />
        <Rect x="49%" width="2%" height="55%" fill={`url(#${id}v)`} />
        <Rect x="82%" width="3%" height="65%" fill={`url(#${id}v)`} />
      </Svg>
    </View>
  );
}
