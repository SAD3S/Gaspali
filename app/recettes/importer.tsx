import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text } from '@/components/ui';
import { setImportDraft } from '@/features/recipes/importDraft';
import { importFromUrl } from '@/services/recipeImport';
import { useTheme } from '@/theme/ThemeProvider';

/** Import d'un lien partagé vers Gaspalli : lecture de la page, puis relecture dans l'éditeur. */
export default function ImporterRecette() {
  const { colors } = useTheme();
  const { url } = useLocalSearchParams<{ url?: string }>();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    setError(null);
    importFromUrl(url)
      .then((recipe) => {
        if (!alive) return;
        setImportDraft(recipe, 'lien');
        router.replace({ pathname: '/recettes/editer', params: { brouillon: '1' } });
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Import impossible.'));
    return () => {
      alive = false;
    };
  }, [url, attempt]);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        {error ? (
          <>
            <Text variant="title2" style={styles.text}>Recette non importée</Text>
            <Text variant="body" tone="secondary" style={styles.text}>{error}</Text>
            <Button label="Réessayer" onPress={() => setAttempt((a) => a + 1)} />
            <Button label="Fermer" variant="outline" onPress={() => (router.canGoBack() ? router.back() : router.replace('/recettes'))} />
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text variant="bodyStrong" accessibilityLiveRegion="polite">Lecture de la recette…</Text>
            <Text variant="label" tone="secondary" style={styles.text} numberOfLines={2}>{url}</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'stretch', gap: 14, padding: 28 },
  text: { textAlign: 'center' },
});
