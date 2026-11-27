import { Platform, View, type ViewProps, type ViewStyle } from 'react-native';
import { color, radius } from '@/theme/tokens';

type Props = ViewProps & { strong?: boolean; r?: number };

/**
 * سطح زجاجي. التعتيم كافٍ لقراءة النص فوقه دون الاعتماد على الضبابية.
 * الضبابية (backdrop blur) تُضاف على الويب فقط الآن؛ على الجوال تُضاف لاحقاً بعد اختبار الأداء.
 */
export function Glass({ strong, r = radius.lg, style, ...rest }: Props) {
  const web = Platform.select<ViewStyle>({
    web: { backdropFilter: 'blur(18px)' } as ViewStyle,
    default: {},
  });
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: strong ? color.glassStrong : color.glass,
          borderColor: color.hairline,
          borderWidth: 1,
          borderRadius: r,
        },
        web,
        style,
      ]}
    />
  );
}
