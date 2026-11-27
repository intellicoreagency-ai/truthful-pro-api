import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '@/lib/useReducedMotion';

const WEB_TRANSITION = Platform.OS === 'web'
  ? ({ transitionProperty: 'transform, opacity', transitionDuration: '140ms', transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' } as object)
  : null;

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number };

/**
 * Pressable بتغذية راجعة موحّدة: يصغر قليلاً (0.97) ويخفت عند الضغط.
 * مع «تقليل الحركة» يبقى الخفوت فقط. استعمله بدل Pressable لكل عنصر قابل للضغط.
 */
export function Press({ style, scaleTo = 0.97, ...rest }: Props) {
  const reduced = useReducedMotion();
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, WEB_TRANSITION, pressed && { opacity: 0.86 }, pressed && !reduced && { transform: [{ scale: scaleTo }] }]}
    />
  );
}
