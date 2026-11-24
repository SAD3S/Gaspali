import { randomUUID } from 'expo-crypto';

export const newId = (): string => randomUUID();

/**
 * UUID déterministe dérivé d'une chaîne (même entrée → même identifiant, sur tous les téléphones).
 * Sert aux lignes « une par personne et par foyer » (préférences alimentaires) pour éviter les doublons.
 */
export function stableUuid(input: string): string {
  const words: number[] = [];
  for (const seed of [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]) {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    words.push(h >>> 0);
  }
  const hex = words.map((w) => w.toString(16).padStart(8, '0')).join('');
  // Version 5 (dérivée d'un nom) et variante RFC 4122.
  const v = `${hex.slice(0, 12)}5${hex.slice(13, 16)}${((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 32)}`;
  return `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20, 32)}`;
}
