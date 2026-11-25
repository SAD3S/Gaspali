import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { ChefHat, House, List, ScanBarcode, ShoppingCart, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { Text } from './ui/Text';

const TABS: Record<string, { label: string; Icon: LucideIcon }> = {
  index: { label: 'Accueil', Icon: House },
  inventaire: { label: 'Inventaire', Icon: List },
  courses: { label: 'Courses', Icon: ShoppingCart },
  recettes: { label: 'Recettes', Icon: ChefHat },
};

/** Barre du bas : Accueil · Inventaire · [Scan] · Courses · Recettes (paramètres : engrenage de l'accueil). */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const renderTab = (index: number) => {
    const route = state.routes[index];
    if (!route) return null;
    const tab = TABS[route.name];
    if (!tab) return null;
    const focused = state.index === index;
    const color = focused ? colors.primaryText : colors.textSecondary;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.label}
        onPress={() => {
          const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigateToTab(route.key);
        }}
        style={styles.tab}
      >
        <tab.Icon size={24} color={color} strokeWidth={focused ? 2.2 : 1.8} />
        <Text variant="label" color={color} style={[styles.tabLabel, focused && { fontFamily: 'DMSans_700Bold' }]} maxFontSizeMultiplier={1.2}>
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { backgroundColor: colors.navBar, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {renderTab(0)}
      {renderTab(1)}
      <View style={styles.scanSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scanner un produit"
          onPress={() => router.push('/scan')}
          style={({ pressed }) => [styles.scan, { backgroundColor: colors.primary, shadowColor: colors.primary, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
        >
          <ScanBarcode size={28} color={colors.onPrimary} />
        </Pressable>
      </View>
      {renderTab(2)}
      {renderTab(3)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 48 },
  tabLabel: { fontSize: 12 },
  scanSlot: { flex: 1, alignItems: 'center' },
  scan: {
    width: 62,
    height: 62,
    borderRadius: radius.scanButton,
    marginTop: -26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
