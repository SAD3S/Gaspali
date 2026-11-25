import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { buildBackup, restoreBackup } from '@/db/backup';
import { parseBackup } from '@/sync/backupFormat';

function fileName(now: Date): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `gaspalli-donnees-${d}.json`;
}

/** Exporte toutes les données dans un fichier JSON : feuille de partage (téléphone) ou téléchargement (web). */
export async function exportData(): Promise<void> {
  const now = new Date();
  const json = JSON.stringify(buildBackup(now), null, 2);
  const name = fileName(now);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Le partage de fichiers n’est pas disponible sur ce téléphone.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Mes données Gaspalli', UTI: 'public.json' });
}

/** Choisit une sauvegarde et l'ajoute aux données. `null` si l'utilisateur annule. */
export async function importData(): Promise<{ imported: number; skipped: number } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  const asset = res.canceled ? null : res.assets[0];
  if (!asset) return null;
  const text = Platform.OS === 'web' ? await (await fetch(asset.uri)).text() : await new File(asset.uri).text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Ce fichier n’est pas une sauvegarde Gaspalli.');
  }
  return restoreBackup(parseBackup(raw));
}
