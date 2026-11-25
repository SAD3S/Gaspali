import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, useSnackbar } from '@/components/ui';
import { useAuth } from '@/features/account/AuthProvider';
import { frenchError } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * gaspalli://auth/callback : retour du lien de connexion reçu par e-mail (paramètre `code`, flux PKCE),
 * ou de la connexion Google (déjà traitée par AuthProvider.signInWithGoogle).
 */
export default function AuthCallback() {
  const { colors } = useTheme();
  const auth = useAuth();
  const snackbar = useSnackbar();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(params.error_description ?? null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !auth.ready) return;
    started.current = true;
    if (!params.code) {
      if (!params.error_description) router.replace('/compte');
      return;
    }
    auth
      .completeEmailLink(params.code)
      .then(() => {
        snackbar.show('Tu es connecté');
        router.replace('/compte');
      })
      .catch((e: unknown) => setError(frenchError(e)));
  }, [auth, auth.ready, params.code, params.error_description, snackbar]);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        {error ? (
          <>
            <Text variant="title2" style={styles.text}>Le lien n’a pas fonctionné</Text>
            <Text variant="body" tone="secondary" style={styles.text}>
              {error} Les liens expirent au bout d’une heure et ne servent qu’une fois : demande-en un nouveau.
            </Text>
            <Button label="Recevoir un nouveau lien" onPress={() => router.replace('/compte/connexion')} />
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text variant="bodyStrong" accessibilityLiveRegion="polite">Connexion…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'stretch', justifyContent: 'center', gap: 14, padding: 28 },
  text: { textAlign: 'center' },
});
