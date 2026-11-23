import { Tabs } from 'expo-router/js-tabs';

import { AppHeader } from '@/components/AppHeader';
import { TabBar } from '@/components/TabBar';
import { colors } from '@/theme/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        header: () => <AppHeader />,
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Start' }} />
      <Tabs.Screen name="search" options={{ title: 'Suche' }} />
      <Tabs.Screen name="radio" options={{ title: 'Radio' }} />
      <Tabs.Screen name="library" options={{ title: 'Bibliothek' }} />
    </Tabs>
  );
}
