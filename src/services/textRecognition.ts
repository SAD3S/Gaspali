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

/** Ligne reconnue avec sa position (pixels de l'image redressée, origine en haut à gauche). */
export interface OcrLine {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Coins x0,y0 … x3,y3 (haut gauche, haut droit, bas droit, bas gauche) : donnent l'inclinaison. */
  corners?: number[];
}

/** Module local `modules/gaspalli-ocr` (ML Kit / Vision) : lignes + positions, pour les tickets. */
const linesNative =
  Platform.OS === 'web' ? null : requireOptionalNativeModule<{ recognizeLines(uri: string): Promise<OcrLine[]> }>('GaspalliOcr');
export const receiptOcrAvailable = !!linesNative;

export async function recognizeLines(imageUri: string): Promise<OcrLine[]> {
  if (!linesNative) throw new Error('OCR_UNAVAILABLE');
  return linesNative.recognizeLines(imageUri);
}
