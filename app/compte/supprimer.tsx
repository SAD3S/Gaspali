import { router } from 'expo-router';
import { ChevronLeft, Download } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Field, Screen, Text, useSnackbar } from '@/components/ui';
import { useAuth } from '@/features/account/AuthProvider';
import { exportData } from '@/services/dataExport';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

const CONFIRM_WORD = 'SUPPRIMER';

/** Suppression définitive du compte (serveur + téléphone). */
export default function SupprimerCompte() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const auth = useAuth();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shared = auth.households.length > 0;

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await auth.deleteAccount();
      snackbar.show('Ton compte a été supprimé');
      router.replace('/bienvenue');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La suppression a échoué.');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text variant="title2" accessibilityRole="header" style={styles.flex}>Supprimer mon compte</Text>
      </View>

      <Card style={{ gap: 10 }}>
        <Text variant="bodyStrong">Ce qui sera supprimé, définitivement</Text>
        <Text variant="body" tone="secondary">• Ton compte : adresse e-mail, prénom, connexion Google ou Apple.</Text>
        <Text variant="body" tone="secondary">• Tes préférences alimentaires (régime, allergies, aliments évités).</Text>
        <Text variant="body" tone="secondary">• Les foyers dont tu es le seul membre, avec tout leur contenu.</Text>
        <Text variant="body" tone="secondary">• Toutes les données Gaspalli de ce téléphone.</Text>
        {shared && (
          <Text variant="body" tone="secondary">
            Dans un foyer partagé, ce que tu as ajouté (produits, courses, recettes) reste aux autres membres, sans ton nom.
          </Text>
        )}
      </Card>

      <Button label="Exporter mes données d’abord" variant="soft" icon={<Download size={18} color={colors.primaryText} />} onPress={() => void exportData().catch((e: Error) => snackbar.show(e.message))} />

      <Field
        label={`Pour confirmer, tape ${CONFIRM_WORD}`}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={CONFIRM_WORD}
      />
      {error && <Text variant="label" tone="urgent" accessibilityLiveRegion="polite">{error}</Text>}
      <Button
        size="lg"
        variant="danger"
        label={busy ? 'Suppression…' : 'Supprimer définitivement'}
        disabled={busy || typed.trim().toUpperCase() !== CONFIRM_WORD}
        onPress={() => void remove()}
      />
      <Button label="Annuler" variant="outline" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
