import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { newId } from '@/db/ids';

/**
 * Photo de recette : galerie ou appareil photo, recadrée en 4:3, copiée dans les documents de l'app
 * (le fichier temporaire du sélecteur peut disparaître). Envoi vers Supabase Storage : plus tard.
 */
export async function pickRecipePhoto(source: 'galerie' | 'camera', aspect: [number, number] = [4, 3]): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.7 };
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

/** Photo d'un produit (fruits, légumes, restes…) : carrée, gardée sur ce téléphone. */
export function pickProductPhoto(source: 'galerie' | 'camera'): Promise<string | null> {
  return pickRecipePhoto(source, [1, 1]);
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

/** Pages d'une recette (livre, fiche) : une photo, ou jusqu'à 4 pages choisies dans la galerie. */
export async function pickRecipePages(source: 'galerie' | 'camera'): Promise<string[]> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return [];
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    return res.canceled ? [] : res.assets.map((a) => a.uri);
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: true, selectionLimit: 4, orderedSelection: true });
  return res.canceled ? [] : res.assets.map((a) => a.uri);
}

/** Tickets ou captures d'un récapitulatif de commande drive : jusqu'à 5 images de la galerie. */
export async function pickReceiptPhotos(): Promise<string[]> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: true, selectionLimit: 5, orderedSelection: true });
  return res.canceled ? [] : res.assets.map((a) => a.uri);
}
