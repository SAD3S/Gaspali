import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { showDialog, useSnackbar } from '@/components/ui';
import { setPendingReceiptText } from '@/features/receipt/pendingText';
import { onShared, takeShared, type SharedPayload } from '@/services/androidBridge';
import { normalizeUrl } from '@/services/recipeImport';

/** Au moins deux prix (« 1,98 € ») : un e-mail ou un texte de commande, pas un simple lien. */
const looksLikeReceipt = (text: string) => (text.match(/\d+[.,]\d{2}\s*(?:€|eur)?/gi) ?? []).length >= 2;

/**
 * « Partager vers Gaspalli » : lien → import de recette ; texte de commande → ticket ;
 * image(s) → au choix, ticket (ou capture de commande drive) ou recette.
 */
export function ShareReceiver() {
  const snackbar = useSnackbar();

  useEffect(() => {
    const handle = (shared: SharedPayload | null) => {
      if (!shared) return;
      if (shared.uris.length) {
        const photos = JSON.stringify(shared.uris);
        const n = shared.uris.length;
        showDialog(n > 1 ? `${n} images reçues` : 'Image reçue', 'Que veux-tu en faire ?', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Recette', onPress: () => router.push({ pathname: '/recettes/importer', params: { photos } }) },
          { text: 'Ticket ou commande', onPress: () => router.push({ pathname: '/ticket', params: { photos } }) },
        ]);
        return;
      }
      const text = shared.text ?? '';
      if (looksLikeReceipt(text)) {
        setPendingReceiptText(text);
        router.push({ pathname: '/ticket', params: { mode: 'partage' } });
        return;
      }
      const url = normalizeUrl(text);
      if (url) router.push({ pathname: '/recettes/importer', params: { url } });
      else snackbar.show('Ce partage ne contient ni lien de recette ni commande.');
    };
    // Lancement par un partage : on laisse la navigation se monter.
    const t = setTimeout(() => handle(takeShared()), 400);
    const off = onShared(handle);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && handle(takeShared()));
    return () => {
      clearTimeout(t);
      off();
      sub.remove();
    };
  }, [snackbar]);

  return null;
}
