import { Image } from 'react-native';
import { PIC } from './picArt';
import type { Agent } from '@/data/agents';

/** صورة الوكيل الملوّنة (واحدة لكل وكيل وبحجم موحّد)، من أصول المالك. */
export function AgentIcon({ agent, size = 56 }: { agent: Agent; size?: number }) {
  return <Image source={PIC[agent.id]} style={{ width: size, height: size, borderRadius: size * 0.24 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}
