import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { useSettings } from '@/features/settings/settings';

export default function TabsLayout() {
  const { loaded, onboardingDone } = useSettings();
  // Premier lancement : présentation, puis choix compte / foyer.
  if (loaded && !onboardingDone) return <Redirect href="/bienvenue" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="inventaire" />
      <Tabs.Screen name="courses" />
      <Tabs.Screen name="recettes" />
    </Tabs>
  );
}
