import { normalizeText } from './inventory';

/**
 * Recherche tolérante : sans accents ni majuscules, chaque mot tapé doit se retrouver
 * (« creme ep » trouve « Crème fraîche épaisse »). Score : début de nom d'abord.
 */
export function matchScore(query: string, ...texts: (string | null | undefined)[]): number {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const hay = texts.filter(Boolean).map((t) => normalizeText(t!));
  const all = hay.join(' ');
  if (!words.every((w) => all.includes(w))) return 0;
  const title = hay[0] ?? '';
  if (title.startsWith(words.join(' '))) return 3;
  if (words.every((w) => title.includes(w))) return 2;
  return 1;
}

/** Trie et coupe une liste selon la recherche. */
export function searchList<T>(items: T[], query: string, texts: (t: T) => (string | null | undefined)[], limit = 6): T[] {
  return items
    .map((t) => ({ t, s: matchScore(query, ...texts(t)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.t);
}
