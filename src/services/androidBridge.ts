import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/** Module local `modules/gaspalli-android` (absent sur iOS, le web et dans Expo Go). */
/** Contenu partagé vers Gaspalli par une autre app. */
export interface SharedPayload {
  text: string | null;
  /** Images (content://…) : tickets, captures de commande, photos de recettes. */
  uris: string[];
}

interface GaspalliAndroid {
  takeShared(): SharedPayload | null;
  startTimer(seconds: number, message: string): boolean;
  addListener(event: 'onShare', listener: (e: SharedPayload) => void): { remove(): void };
}

const native = Platform.OS === 'android' ? requireOptionalNativeModule<GaspalliAndroid>('GaspalliAndroid') : null;

/** Partage qui a ouvert l'app (une seule fois). */
export function takeShared(): SharedPayload | null {
  try {
    return native?.takeShared() ?? null;
  } catch {
    return null;
  }
}

/** Partages reçus pendant que l'app est ouverte. */
export function onShared(listener: (shared: SharedPayload) => void): () => void {
  if (!native) return () => {};
  const sub = native.addListener('onShare', (e) => listener({ text: e.text ?? null, uris: e.uris ?? [] }));
  return () => sub.remove();
}

/** Minuteur dans l'horloge du téléphone. false : pas disponible (iOS, web, pas d'horloge compatible). */
export function startSystemTimer(seconds: number, message: string): boolean {
  try {
    return native?.startTimer(Math.round(seconds), message) ?? false;
  } catch {
    return false;
  }
}
