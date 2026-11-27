import type { Agent } from '@/data/agents';
import { AgentTile } from './AgentTile';

/** مكان قديم: يُبقي الاسم لتوافق الشاشات، ويعرض البلاطة الجديدة. */
export function AgentBadge({ agent, size = 48 }: { agent: Agent; size?: number }) {
  return <AgentTile agent={agent} size={size} />;
}
