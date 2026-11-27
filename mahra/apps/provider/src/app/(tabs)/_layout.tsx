import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot />
      <TabBar />
      <TabList style={{ display: 'none' }}>
        <TabTrigger name="opportunities" href="/" />
        <TabTrigger name="jobs" href="/jobs" />
        <TabTrigger name="wallet" href="/wallet" />
        <TabTrigger name="profile" href="/profile" />
      </TabList>
    </Tabs>
  );
}
