import { Image } from 'react-native';
import { AgentTile } from './AgentTile';
import type { Agent } from '@/data/agents';

const ART: Partial<Record<string, number>> = {
  meera: require('../../assets/ui/agent-meera.png'),
  mansour: require('../../assets/ui/agent-mansour.png'),
  sara: require('../../assets/ui/agent-sara.png'),
  jalal: require('../../assets/ui/agent-jalal.png'),
};

/** أيقونة الوكيل: رسم تصميم Gemini للأربعة الرئيسيين، وبلاطة موحّدة بلون الوكيل لبقية الوكلاء. أيقونة واحدة لكل وكيل. */
export function AgentIcon({ agent, size = 56 }: { agent: Agent; size?: number }) {
  const art = ART[agent.id];
  if (!art) return <AgentTile agent={agent} size={size} />;
  return <Image source={art} style={{ width: size, height: size, borderRadius: size * 0.24 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}
