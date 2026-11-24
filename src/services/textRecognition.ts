import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * OCR on-device (ML Kit via Google Play Services sur Android, Vision sur iOS).
 * Le module natif n'existe que dans l'app compilée (pas dans Expo Go ni sur le web).
 */
const native = Platform.OS === 'web' ? null : requireOptionalNativeModule<{ isSupported: boolean }>('ExpoTextExtractor');
export const ocrAvailable = !!native?.isSupported;

export async function recognizeText(imageUri: string): Promise<string> {
  if (!ocrAvailable) throw new Error('OCR_UNAVAILABLE');
  // Import paresseux : `expo-text-extractor` exige le module natif dès son chargement.
  const { extractTextFromImage } = await import('expo-text-extractor');
  const lines = await extractTextFromImage(imageUri);
  return lines.join('\n');
}
