import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { findJsonLdRecipes, recipeFromJsonLd, recipeFromText, recipesFromJson, type ImportedRecipe } from '@/domain/recipeImport';
import { pickRecipePages } from './photos';
import { ocrAvailable, receiptOcrAvailable, recognizeLines, recognizeText } from './textRecognition';

/** Les sites refusent parfois les robots : on se présente comme le navigateur du téléphone. */
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

/** « marmiton.org/recettes/… » → « https://marmiton.org/recettes/… » ; null si ce n'est pas un lien web. */
export function normalizeUrl(input: string): string | null {
  const t = input.trim().match(/https?:\/\/\S+|[\w-]+(\.[\w-]+)+\/?\S*/)?.[0];
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//.test(t) ? t : `https://${t}`);
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Télécharge la page et lit sa recette structurée (schema.org/Recipe). */
export async function importFromUrl(input: string): Promise<ImportedRecipe> {
  const url = normalizeUrl(input);
  if (!url) throw new Error('Ce n’est pas un lien de page web.');
  if (Platform.OS === 'web') throw new Error('L’import depuis un lien fonctionne dans l’app sur téléphone.');
  let html: string;
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    if (!res.ok) throw new Error(`Le site a répondu ${res.status}.`);
    html = await res.text();
  } catch (e) {
    throw new Error(e instanceof Error && /répondu/.test(e.message) ? e.message : 'Page inaccessible : vérifie le lien et ta connexion.');
  }
  const [recipe] = findJsonLdRecipes(html);
  if (!recipe) throw new Error('Cette page ne publie pas sa recette dans un format lisible. Essaie la photo, ou un autre site.');
  return recipeFromJsonLd(recipe, url);
}

/** Photo(s) d'un livre ou d'une fiche → texte lu sur le téléphone → recette. `null` si annulé. */
export async function importFromPhotos(source: 'galerie' | 'camera'): Promise<ImportedRecipe | null> {
  if (!receiptOcrAvailable && !ocrAvailable) throw new Error('La lecture des photos fonctionne dans l’app installée.');
  const uris = await pickRecipePages(source);
  if (!uris.length) return null;
  const lines: string[] = [];
  for (const uri of uris) {
    // Ordre de lecture de la reconnaissance (colonnes respectées), pas regroupé par hauteur comme un ticket.
    if (receiptOcrAvailable) lines.push(...(await recognizeLines(uri)).map((l) => l.text));
    else lines.push(...(await recognizeText(uri)).split('\n'));
  }
  if (!lines.some((l) => l.trim())) throw new Error('Aucun texte lu : reprends la photo bien à plat, avec de la lumière.');
  return recipeFromText(lines);
}

/** Fichier : page web enregistrée (.html), recette(s) schema.org (.json) ou texte (.txt). `null` si annulé. */
export async function importFromFile(): Promise<ImportedRecipe[] | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['text/html', 'application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  const asset = res.canceled ? null : res.assets[0];
  if (!asset) return null;
  const text = Platform.OS === 'web' ? await (await fetch(asset.uri)).text() : await new File(asset.uri).text();
  const name = (asset.name ?? '').toLowerCase();
  if (/<html|<script/i.test(text) || name.endsWith('.html') || name.endsWith('.htm')) {
    const found = findJsonLdRecipes(text).map((r) => recipeFromJsonLd(r));
    if (!found.length) throw new Error('Pas de recette lisible dans cette page.');
    return found;
  }
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Fichier JSON illisible.');
    }
    if ((data as { app?: string }).app === 'gaspalli') throw new Error('C’est une sauvegarde Gaspalli : restaure-la depuis Plus › Confidentialité et données.');
    const found = recipesFromJson(data);
    if (!found.length) throw new Error('Pas de recette au format schema.org dans ce fichier.');
    return found;
  }
  return [recipeFromText(text.split(/\r?\n/))];
}
