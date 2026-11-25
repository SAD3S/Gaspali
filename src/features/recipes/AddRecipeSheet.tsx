import { router } from 'expo-router';
import { Camera, ChevronRight, FileText, Image as ImageIcon, Link2, PenLine, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Field, Text, useSnackbar } from '@/components/ui';
import { saveRecipe } from '@/db/recipesRepo';
import type { ImportedRecipe } from '@/domain/recipeImport';
import { importFromFile, importFromPhotos, importFromUrl, normalizeUrl } from '@/services/recipeImport';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';
import { setImportDraft, type ImportOrigin } from './importDraft';

function Option({ Icon, title, hint, onPress }: { Icon: LucideIcon; title: string; hint: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${hint}`} onPress={onPress} style={styles.option}>
      <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
        <Icon size={22} color={colors.primaryText} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="label" tone="secondary">{hint}</Text>
      </View>
      <ChevronRight size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

/** « Ajouter une recette » : l'écrire, ou l'importer d'un site, d'une photo ou d'un fichier, puis la relire. */
export function AddRecipeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const [step, setStep] = useState<'choix' | 'lien'>('choix');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setStep('choix');
    setUrl('');
    setError(null);
    setBusy(null);
    onClose();
  };

  /** Une recette → relecture dans l'éditeur ; plusieurs (fichier) → enregistrées directement. */
  const review = (recipes: ImportedRecipe[], origin: ImportOrigin) => {
    if (recipes.length === 1) {
      setImportDraft(recipes[0]!, origin);
      close();
      router.push({ pathname: '/recettes/editer', params: { brouillon: '1' } });
      return;
    }
    for (const r of recipes) {
      saveRecipe({ ...r, photoUri: r.imageUrl, sourceUrl: r.sourceUrl });
    }
    close();
    snackbar.show(`${recipes.length} recettes importées dans « Mes recettes »`);
  };

  const run = async (label: string, origin: ImportOrigin, task: () => Promise<ImportedRecipe[] | null>) => {
    setBusy(label);
    setError(null);
    try {
      const recipes = await task();
      if (recipes) review(recipes, origin);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import impossible.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={close}>
      <View style={{ gap: 12 }}>
        <Text variant="title2">Ajouter une recette</Text>
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.primary} />
            <Text variant="body" accessibilityLiveRegion="polite">{busy}</Text>
          </View>
        ) : step === 'lien' ? (
          <>
            <Text variant="body" tone="secondary">
              Colle le lien d’une recette (Marmiton, 750g, Cuisine AZ, un blog…). Tu pourras tout vérifier avant d’enregistrer.
            </Text>
            <Field
              label="Lien de la recette"
              value={url}
              onChangeText={setUrl}
              placeholder="https://www.marmiton.org/recettes/…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={() => normalizeUrl(url) && void run('Lecture de la page…', 'lien', async () => [await importFromUrl(url)])}
            />
            <Button
              label="Importer"
              disabled={!normalizeUrl(url)}
              onPress={() => void run('Lecture de la page…', 'lien', async () => [await importFromUrl(url)])}
            />
            <Button label="Retour" variant="outline" onPress={() => setStep('choix')} />
          </>
        ) : (
          <>
            <Option Icon={PenLine} title="L’écrire" hint="Titre, ingrédients, étapes" onPress={() => { close(); router.push('/recettes/editer'); }} />
            <Option Icon={Link2} title="Depuis un site" hint="Colle le lien d’une recette en ligne" onPress={() => setStep('lien')} />
            {Platform.OS !== 'web' && (
              <Option
                Icon={Camera}
                title="Photographier une recette"
                hint="Livre, magazine, fiche : le texte est lu sur le téléphone"
                onPress={() => void run('Lecture de la photo…', 'photo', async () => {
                  const r = await importFromPhotos('camera');
                  return r ? [r] : null;
                })}
              />
            )}
            <Option
              Icon={ImageIcon}
              title="Depuis une photo de la galerie"
              hint="Jusqu’à 4 pages, dans l’ordre"
              onPress={() => void run('Lecture des photos…', 'photo', async () => {
                const r = await importFromPhotos('galerie');
                return r ? [r] : null;
              })}
            />
            <Option Icon={FileText} title="Depuis un fichier" hint="Page web enregistrée, JSON schema.org ou texte" onPress={() => void run('Lecture du fichier…', 'fichier', importFromFile)} />
          </>
        )}
        {error && <Text variant="label" tone="urgent" accessibilityLiveRegion="polite">{error}</Text>}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  icon: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
});
