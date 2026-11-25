import { normalizeText } from './inventory';

/** Article d'une liste de courses enregistrée. */
export interface SavedListItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  ingredientId: string | null;
}

export const SAVED_LIST_MAX_ITEMS = 150;

/** Articles à enregistrer : sans doublon (même ingrédient ou même nom), dans l'ordre. */
export function toSavedItems(rows: { name: string; quantity: number | null; unit: string | null; ingredientId: string | null }[]): SavedListItem[] {
  const seen = new Set<string>();
  const out: SavedListItem[] = [];
  for (const r of rows) {
    const name = r.name.trim();
    if (!name) continue;
    const key = r.ingredientId ?? normalizeText(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, quantity: r.quantity, unit: r.unit, ingredientId: r.ingredientId });
    if (out.length >= SAVED_LIST_MAX_ITEMS) break;
  }
  return out;
}

/** Relecture tolérante (données venant d'un autre téléphone ou d'une sauvegarde). */
export function parseSavedItems(json: string): SavedListItem[] {
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof (x as { name?: unknown }).name === 'string')
      .map((x) => ({
        name: String(x.name),
        quantity: typeof x.quantity === 'number' && Number.isFinite(x.quantity) ? x.quantity : null,
        unit: typeof x.unit === 'string' ? x.unit : null,
        ingredientId: typeof x.ingredientId === 'string' ? x.ingredientId : null,
      }));
  } catch {
    return [];
  }
}

/** « Pain, lait, œufs et 4 autres » */
export function savedListPreview(items: SavedListItem[], max = 3): string {
  if (!items.length) return 'Vide';
  const names = items.slice(0, max).map((i) => i.name);
  const more = items.length - names.length;
  return more > 0 ? `${names.join(', ')} et ${more} autre${more > 1 ? 's' : ''}` : names.join(', ');
}
