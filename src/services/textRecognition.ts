import { NativeModules, Platform } from 'react-native';

/**
 * OCR on-device (ML Kit). Le module natif n'existe que dans l'app compilée (EAS / release),
 * pas dans Expo Go ni sur le web.
 */
export const ocrAvailable = Platform.OS !== 'web' && !!NativeModules.TextRecognition;

export async function recognizeText(imageUri: string): Promise<string> {
  if (!ocrAvailable) throw new Error('OCR_UNAVAILABLE');
  // Import paresseux : le module lève une erreur à l'accès s'il n'est pas lié.
  const { default: TextRecognition } = await import('@react-native-ml-kit/text-recognition');
  const result = await TextRecognition.recognize(imageUri);
  return result.text;
}
