import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThreadBackground } from '@/components/brand/ThreadBackground';
import { useTheme } from '@/theme/ThemeProvider';

/** Conteneur d'écran à onglet : fond du thème avec le fil Gaspalli, zone sûre en haut, défilement. */
export function Screen({ children, scroll = true, thread = 1 }: { children: ReactNode; scroll?: boolean; /** Tracé du fil (0 : sans fil). */ thread?: number }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      {thread > 0 && <ThreadBackground variant={thread} />}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 120, gap: 14 },
});
