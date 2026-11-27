import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import type { Agent } from '@/data/agents';
import { color } from '@/theme/tokens';

/** أيقونة الوكيل: حرف لون الوكيل على زجاج. اللون زخرفة؛ الاسم دائماً بجانبها. */
export function AgentBadge({ agent, size = 48 }: { agent: Agent; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color.glassStrong,
        borderWidth: 1,
        borderColor: agent.accent + '88',
      }}
    >
      <Ionicons name={agent.icon} size={size * 0.5} color={agent.accent} />
    </View>
  );
}
