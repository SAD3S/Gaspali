import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/** Module local `modules/gaspalli-android` (absent sur iOS, le web et dans Expo Go). */
interface GaspalliAndroid {
  takeSharedText(): string | null;
  startTimer(seconds: number, message: string): boolean;
  addListener(event: 'onShare', listener: (e: { text: string }) => void): { remove(): void };
}

const native = Platform.OS === 'android' ? requireOptionalNativeModule<GaspalliAndroid>('GaspalliAndroid') : null;

/** Texte partagé vers Gaspalli qui a ouvert l'app (une seule fois). */
export function takeSharedText(): string | null {
  try {
    return native?.takeSharedText() ?? null;
  } catch {
    return null;
  }
}

/** Partages reçus pendant que l'app est ouverte. */
export function onSharedText(listener: (text: string) => void): () => void {
  if (!native) return () => {};
  const sub = native.addListener('onShare', (e) => listener(e.text));
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
