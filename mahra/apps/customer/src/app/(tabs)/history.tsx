import { RequestCard, chatWith, type RequestItem } from '@/components/RequestCard';
import { router } from 'expo-router';
import { PageHeader } from '@/components/PageHeader';
import { Screen } from '@/components/Screen';
import { useTx } from '@/i18n';

/** سجل المعاملات: الطلبات المكتملة والسجل في صفحة خاصة بها. */
export default function History() {
  const tx = useTx();
  const done: RequestItem[] = [
    { id: 'clean', agent: 'sara', title: ['تنظيف ودراي كلين الغرف والمكاتب', 'Room and office cleaning, dry cleaning'], line: ['ترتيب، تنظيف، وخدمة دراي كلين. سارة', 'Tidying, cleaning and dry cleaning. Sara'], pill: ['تكرار الطلب', 'Repeat order'], go: chatWith('sara') },
    { id: 'hist', agent: 'jalal', title: ['سجل المحادثات والملفات', 'Chats and files history'], line: ['آخر 5 محادثات و3 ملفات. جلال، فيصل، ميرا', 'Last 5 chats and 3 files. Jalal, Faisal, Meera'], pill: ['فتح السجل', 'Open history'], go: chatWith('mansour') },
  ];
  return (
    <Screen tabs>
      <PageHeader title={tx('سجل المعاملات', 'Transaction history')} back={() => router.navigate('/requests')} />
      {done.map((c) => <RequestCard key={c.id} c={c} />)}
    </Screen>
  );
}
