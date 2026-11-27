import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { quote, toFils, type Quote } from './pricing';

/**
 * مخزن تجريبي في الذاكرة يعكس مخطط قاعدة البيانات (request_dispatches، offers، jobs، job_payments،
 * commissions). يُستبدل بنداءات الخلفية لاحقاً دون تغيير الشاشات: هي تقرأ هذه الأشكال فقط.
 * القواعد المنسوخة من القاعدة: السعر النهائي = سعر المزود + 20%، العمولة على كل دفعة محصَّلة بالتراكم،
 * الاستحقاق بعد 3 أيام عمل (السبت والأحد عطلة).
 */
export type AccountStatus = 'approved' | 'suspended' | 'incomplete';
export type DocState = 'missing' | 'uploaded' | 'accepted' | 'rejected';
export type JobStatus = 'accepted' | 'in_progress' | 'completed';
export type CommissionStatus = 'due' | 'proof_uploaded' | 'paid' | 'overdue' | 'needs_review';

export type Incoming = {
  id: string;
  title: { ar: string; en: string };
  detail: { ar: string; en: string };
  area: { ar: string; en: string };
  distanceKm: number;
  deadlineAt: number;
  urgent: boolean;
  askedProviders: number;
};

export type MyOffer = { id: string; requestId: string; title: Incoming['title']; quote: Quote; etaMin: number };

export type Job = {
  id: string;
  title: Incoming['title'];
  area: Incoming['area'];
  status: JobStatus;
  onTheWay: boolean; // مرحلة واجهة فقط (تُرسل إشعاراً للعميل)، لا تُخزَّن كحالة
  customer: { name: string; phone: string; whatsapp: string };
  quote: Quote;
  paymentMethod: 'cash' | 'card';
  collectedFils: number;
  commissionAccruedFils: number;
};

export type Commission = { id: string; jobId: string; title: Incoming['title']; amountFils: number; dueOn: number; status: CommissionStatus };

export type ReadinessItem = { key: 'docTradeLicense' | 'docTenancy' | 'docMaps' | 'docPhone' | 'docWhatsapp' | 'docCategories' | 'docCoverage'; state: DocState; note?: string };

const DAY = 86_400_000;

/** عطلة نهاية الأسبوع في الإمارات: السبت والأحد (JS: الأحد=0، السبت=6) */
function isWeekend(d: Date) {
  return d.getDay() === 0 || d.getDay() === 6;
}

/** يضيف n يوم عمل — مطابق لـ add_business_days في القاعدة (عطل الدولة تُضاف لاحقاً) */
export function addBusinessDays(from: number, n: number): number {
  let d = new Date(from);
  let left = n;
  while (left > 0) {
    d = new Date(d.getTime() + DAY);
    if (!isWeekend(d)) left--;
  }
  return d.getTime();
}
export function businessDaysBetween(from: number, to: number): number {
  // عدد أيام العمل المتبقية من اليوم حتى الموعد (0 = اليوم، سالب = متأخر)
  const sign = to >= from ? 1 : -1;
  let a = new Date(from).setHours(0, 0, 0, 0);
  const b = new Date(to).setHours(0, 0, 0, 0);
  let n = 0;
  while (a !== b) {
    a += sign * DAY;
    if (!isWeekend(new Date(a))) n += sign;
  }
  return n;
}

type Store = {
  status: AccountStatus;
  setStatus: (s: AccountStatus) => void;
  available: boolean;
  setAvailable: (v: boolean) => void;
  name: string;
  incoming: Incoming[];
  offers: MyOffer[];
  jobs: Job[];
  commissions: Commission[];
  readiness: ReadinessItem[];
  stats: { rating: number; responseRate: number; completed: number; missedThisWeek: number };
  submitOffer: (requestId: string, priceFils: number, etaMin: number) => void;
  declineRequest: (requestId: string) => void;
  advanceJob: (jobId: string) => void;
  recordPayment: (jobId: string, amountFils: number) => { error?: 'exceeds'; commission?: Commission };
  submitProof: (commissionIds: string[]) => void;
};

const Ctx = createContext<Store | null>(null);

function seed() {
  const now = Date.now();
  const incoming: Incoming[] = [
    {
      id: 'q1',
      title: { ar: 'سطحة لسيارة لا تشتغل', en: 'Tow for a car that won’t start' },
      detail: { ar: 'سيارة منخفضة (سيدان) تحتاج سطحة مناسبة، لا تُسحب على العجلات.', en: 'A low sedan that needs a flatbed; do not drag it on its wheels.' },
      area: { ar: 'الشيخ زايد، دبي', en: 'Sheikh Zayed Road, Dubai' },
      distanceKm: 3.2, deadlineAt: now + 4 * 60_000 + 20_000, urgent: true, askedProviders: 6,
    },
    {
      id: 'q2',
      title: { ar: 'بطارية سيارة فارغة', en: 'Flat car battery' },
      detail: { ar: 'تحتاج تشغيل بالكيابل أو تبديل بطارية.', en: 'Needs a jump start or a battery swap.' },
      area: { ar: 'مردف، دبي', en: 'Mirdif, Dubai' },
      distanceKm: 7.9, deadlineAt: now + 9 * 60_000, urgent: false, askedProviders: 5,
    },
    {
      id: 'q3',
      title: { ar: 'سحب سيارة إلى الورشة', en: 'Tow a car to the garage' },
      detail: { ar: 'تعطل بعد صدمة خفيفة، لا خطر على الطريق.', en: 'Broke down after a light bump; no danger on the road.' },
      area: { ar: 'القوز، دبي', en: 'Al Quoz, Dubai' },
      distanceKm: 11.4, deadlineAt: now + 14 * 60_000, urgent: false, askedProviders: 6,
    },
  ];

  const wonQuote = quote(toFils(150));
  const jobs: Job[] = [
    {
      id: 'j1',
      title: { ar: 'سطحة من الخوانيج', en: 'Tow from Al Khawaneej' },
      area: { ar: 'الخوانيج، دبي', en: 'Al Khawaneej, Dubai' },
      status: 'accepted', onTheWay: false,
      customer: { name: 'سالم', phone: '+971501234567', whatsapp: '+971501234567' },
      quote: wonQuote, paymentMethod: 'cash', collectedFils: 0, commissionAccruedFils: 0,
    },
    {
      id: 'j0',
      title: { ar: 'سطحة من البرشاء', en: 'Tow from Al Barsha' },
      area: { ar: 'البرشاء، دبي', en: 'Al Barsha, Dubai' },
      status: 'completed', onTheWay: false,
      customer: { name: 'ماجد', phone: '+971507654321', whatsapp: '+971507654321' },
      quote: quote(toFils(200)), paymentMethod: 'card', collectedFils: quote(toFils(200)).customerPrice, commissionAccruedFils: quote(toFils(200)).commission,
    },
  ];

  const commissions: Commission[] = [
    { id: 'c1', jobId: 'j0', title: { ar: 'سطحة من البرشاء', en: 'Tow from Al Barsha' }, amountFils: quote(toFils(200)).commission, dueOn: addBusinessDays(now, 2), status: 'due' },
    { id: 'c2', jobId: 'jx', title: { ar: 'سطحة من جميرا', en: 'Tow from Jumeirah' }, amountFils: 2400, dueOn: now - 6 * DAY, status: 'paid' },
  ];

  const readiness: ReadinessItem[] = [
    { key: 'docTradeLicense', state: 'accepted' },
    { key: 'docTenancy', state: 'uploaded' },
    { key: 'docMaps', state: 'accepted' },
    { key: 'docPhone', state: 'accepted' },
    { key: 'docWhatsapp', state: 'accepted' },
    { key: 'docCategories', state: 'accepted' },
    { key: 'docCoverage', state: 'accepted' },
  ];
  return { incoming, jobs, commissions, readiness };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(seed);
  const [status, setStatus] = useState<AccountStatus>('approved');
  const [available, setAvailable] = useState(true);
  const [incoming, setIncoming] = useState(initial.incoming);
  const [offers, setOffers] = useState<MyOffer[]>([]);
  const [jobs, setJobs] = useState(initial.jobs);
  const [commissions, setCommissions] = useState(initial.commissions);
  const [seq, setSeq] = useState(10);

  const readiness = useMemo<ReadinessItem[]>(() => {
    if (status !== 'incomplete') return initial.readiness;
    return initial.readiness.map((r) =>
      r.key === 'docTenancy' ? { ...r, state: 'rejected', note: 'الصورة غير واضحة، أعد رفعها' }
      : r.key === 'docMaps' ? { ...r, state: 'missing' } : r,
    );
  }, [status, initial.readiness]);

  const submitOffer = useCallback((requestId: string, priceFils: number, etaMin: number) => {
    setIncoming((list) => {
      const r = list.find((x) => x.id === requestId);
      if (r) setOffers((o) => [...o, { id: `o${requestId}`, requestId, title: r.title, quote: quote(priceFils), etaMin }]);
      return list.filter((x) => x.id !== requestId);
    });
  }, []);

  const declineRequest = useCallback((requestId: string) => setIncoming((l) => l.filter((x) => x.id !== requestId)), []);

  const advanceJob = useCallback((jobId: string) => {
    setJobs((list) => list.map((j) => {
      if (j.id !== jobId) return j;
      if (j.status === 'accepted' && !j.onTheWay) return { ...j, onTheWay: true };
      if (j.status === 'accepted') return { ...j, status: 'in_progress' };
      if (j.status === 'in_progress') return { ...j, status: 'completed' };
      return j;
    }));
  }, []);

  const recordPayment = useCallback<Store['recordPayment']>((jobId, amountFils) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return {};
    if (job.collectedFils + amountFils > job.quote.customerPrice) return { error: 'exceeds' };
    // العمولة بالتراكم (كما في record_payment): لا انحراف تقريب، والمجموع = عمولة العرض بالضبط
    const collected = job.collectedFils + amountFils;
    const target = Math.round((collected * job.quote.commission) / job.quote.customerPrice);
    const amount = target - job.commissionAccruedFils;
    const c: Commission = { id: `c${seq}`, jobId, title: job.title, amountFils: amount, dueOn: addBusinessDays(Date.now(), 3), status: 'due' };
    setSeq((s) => s + 1);
    setCommissions((l) => [c, ...l]);
    setJobs((l) => l.map((j) => (j.id === jobId ? { ...j, collectedFils: collected, commissionAccruedFils: target } : j)));
    return { commission: c };
  }, [jobs, seq]);

  const submitProof = useCallback((ids: string[]) => {
    setCommissions((l) => l.map((c) => (ids.includes(c.id) ? { ...c, status: 'proof_uploaded' } : c)));
  }, []);

  const value = useMemo<Store>(() => ({
    status, setStatus, available, setAvailable, name: 'سطحات النجمة', incoming, offers, jobs, commissions, readiness,
    stats: { rating: 4.8, responseRate: 92, completed: 41, missedThisWeek: 3 },
    submitOffer, declineRequest, advanceJob, recordPayment, submitProof,
  }), [status, available, incoming, offers, jobs, commissions, readiness, submitOffer, declineRequest, advanceJob, recordPayment, submitProof]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside <StoreProvider>');
  return v;
}
