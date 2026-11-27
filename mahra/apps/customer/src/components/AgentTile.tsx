import { Ionicons } from '@expo/vector-icons';
import { Platform, View, type ViewStyle } from 'react-native';
import type { Agent } from '@/data/agents';

/** أيقونة الوكيل: مربع مستدير بلون الوكيل (Apple system color) وتوهج ناعم. الاسم دائماً بجانبها. */
export function AgentTile({ agent, size = 52 }: { agent: Agent; size?: number }) {
  const glow: ViewStyle = Platform.select<ViewStyle>({
    web: { boxShadow: `0 8px 22px ${agent.accent}40` } as ViewStyle,
    default: { shadowColor: agent.accent, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  })!;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size, borderRadius: size * 0.34, alignItems: 'center', justifyContent: 'center', backgroundColor: agent.accent + '29', borderWidth: 1, borderColor: agent.accent + '99' }, glow]}
    >
      <Ionicons name={agent.icon} size={size * 0.5} color={agent.accent} />
    </View>
  );
}
