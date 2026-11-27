import { quote, toFils, type Quote } from '@/lib/pricing';
import type { AgentId } from './agents';

export type RequestStatus = 'offers' | 'accepted' | 'inProgress' | 'done';

export type Offer = {
  id: string;
  provider: string;
  rating: number;
  etaMin: number;
  /** السعر محسوب من سعر المزود؛ العميل لا يرى إلا customerPrice */
  quote: Quote;
};

export type MohraRequest = {
  id: string;
  agent: AgentId;
  title: { ar: string; en: string };
  detail: { ar: string; en: string };
  status: RequestStatus;
  offers: Offer[];
};

/** بيانات تجريبية للمسار الأول (عطل سيارة ← سطحة). تُستبدل بالخلفية لاحقاً. */
export const DEMO_REQUESTS: MohraRequest[] = [
  {
    id: 'r1',
    agent: 'jalal',
    title: { ar: 'سطحة لسيارتي', en: 'Tow truck for my car' },
    detail: {
      ar: 'السيارة لا تشتغل. موقعك: الشيخ زايد، دبي.',
      en: 'The car will not start. Location: Sheikh Zayed Road, Dubai.',
    },
    status: 'offers',
    offers: [
      { id: 'o1', provider: 'سطحات النجمة', rating: 4.8, etaMin: 18, quote: quote(toFils(150)) },
      { id: 'o2', provider: 'الإنقاذ السريع', rating: 4.6, etaMin: 25, quote: quote(toFils(130)) },
      { id: 'o3', provider: 'دبي للسحب', rating: 4.9, etaMin: 12, quote: quote(toFils(180)) },
    ],
  },
  {
    id: 'r0',
    agent: 'talal',
    title: { ar: 'فحص التكييف', en: 'AC check' },
    detail: { ar: 'تمت الزيارة وأُغلق الطلب.', en: 'Visit completed and request closed.' },
    status: 'done',
    offers: [],
  },
];

export const requestById = (id: string) => DEMO_REQUESTS.find((r) => r.id === id);
