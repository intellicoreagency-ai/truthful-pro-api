import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { TabBar } from '@/components/TabBar';
import { AccentProvider } from '@/lib/accent';

/**
 * التبويبات الأربعة تُعرَّف هنا في TabList مخفي؛ الشريط المرئي (TabBar) يستدعيها بالاسم.
 * زر الميكروفون ليس تبويباً: هو إجراء يبدأ الاستماع من أي مكان.
 */
export default function TabsLayout() {
  return (
    <AccentProvider>
    <Tabs>
      <TabSlot />
      <TabBar />
      <TabList style={{ display: 'none' }}>
        <TabTrigger name="home" href="/" />
        <TabTrigger name="requests" href="/requests" />
        <TabTrigger name="specialists" href="/specialists" />
        <TabTrigger name="profile" href="/profile" />
        <TabTrigger name="history" href="/history" />
      </TabList>
    </Tabs>
    </AccentProvider>
  );
}
