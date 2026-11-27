import type { AgentId } from '@/data/agents';
import { RecipeCard, CARD_MIN_H } from './RecipeCard';

export const CARD_H = CARD_MIN_H;

/** بطاقة الوكيل: كل الوكلاء الخمسة عشر على تصميم «الوصفة» (انظر RecipeCard)، ولكل وكيل صورته ولونه بمعرّفه. */
export function ExpertCard(p: { id: AgentId; width: number; selected: boolean; onSelect: () => void }) {
  return <RecipeCard {...p} />;
}
