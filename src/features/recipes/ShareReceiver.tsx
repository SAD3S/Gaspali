import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSnackbar } from '@/components/ui';
import { onSharedText, takeSharedText } from '@/services/androidBridge';
import { normalizeUrl } from '@/services/recipeImport';

/** « Partager vers Gaspalli » : un lien reçu ouvre l'import de la recette. */
export function ShareReceiver() {
  const snackbar = useSnackbar();

  useEffect(() => {
    const handle = (text: string | null) => {
      if (!text) return;
      const url = normalizeUrl(text);
      if (!url) {
        snackbar.show('Le partage ne contient pas de lien de recette.');
        return;
      }
      router.push({ pathname: '/recettes/importer', params: { url } });
    };
    // Lancement par un partage : on laisse la navigation se monter.
    const t = setTimeout(() => handle(takeSharedText()), 400);
    const off = onSharedText(handle);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && handle(takeSharedText()));
    return () => {
      clearTimeout(t);
      off();
      sub.remove();
    };
  }, [snackbar]);

  return null;
}
