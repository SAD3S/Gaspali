import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { newId } from '@/db/ids';

/**
 * Photo de recette : galerie ou appareil photo, recadrée en 4:3, copiée dans les documents de l'app
 * (le fichier temporaire du sélecteur peut disparaître). Envoi vers Supabase Storage : plus tard.
 */
export async function pickRecipePhoto(source: 'galerie' | 'camera'): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  if (Platform.OS === 'web') return asset.uri;
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${newId()}.jpg`);
  await new File(asset.uri).copy(dest);
  return dest.uri;
}

/** Photo de ticket de caisse : galerie ou appareil photo du téléphone, sans recadrage. */
export async function pickReceiptPhoto(source: 'galerie' | 'camera'): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}
