/** Les 14 allergènes à déclaration obligatoire dans l'UE (règlement INCO 1169/2011, annexe II). */
export type AllergenId =
  | 'gluten' | 'crustaces' | 'oeufs' | 'poisson' | 'arachides' | 'soja' | 'lait'
  | 'fruits_coque' | 'celeri' | 'moutarde' | 'sesame' | 'sulfites' | 'lupin' | 'mollusques';

export const ALLERGENS: { id: AllergenId; label: string; hint: string }[] = [
  { id: 'gluten', label: 'Gluten', hint: 'blé, seigle, orge, avoine, épeautre' },
  { id: 'crustaces', label: 'Crustacés', hint: 'crevettes, crabe, langoustines' },
  { id: 'oeufs', label: 'Œufs', hint: '' },
  { id: 'poisson', label: 'Poisson', hint: '' },
  { id: 'arachides', label: 'Arachides', hint: 'cacahuètes' },
  { id: 'soja', label: 'Soja', hint: '' },
  { id: 'lait', label: 'Lait', hint: 'y compris lactose' },
  { id: 'fruits_coque', label: 'Fruits à coque', hint: 'amandes, noisettes, noix, cajou, pistaches' },
  { id: 'celeri', label: 'Céleri', hint: '' },
  { id: 'moutarde', label: 'Moutarde', hint: '' },
  { id: 'sesame', label: 'Sésame', hint: '' },
  { id: 'sulfites', label: 'Sulfites', hint: 'vin, fruits secs' },
  { id: 'lupin', label: 'Lupin', hint: '' },
  { id: 'mollusques', label: 'Mollusques', hint: 'moules, calamars' },
];

export const ALLERGEN_LABELS = Object.fromEntries(ALLERGENS.map((a) => [a.id, a.label])) as Record<AllergenId, string>;

/** Étiquettes Open Food Facts (« en:milk ») → allergène réglementaire. */
export const OFF_ALLERGEN_MAP: Record<string, AllergenId> = {
  gluten: 'gluten',
  crustaceans: 'crustaces',
  eggs: 'oeufs',
  fish: 'poisson',
  peanuts: 'arachides',
  soybeans: 'soja',
  milk: 'lait',
  nuts: 'fruits_coque',
  celery: 'celeri',
  mustard: 'moutarde',
  'sesame-seeds': 'sesame',
  'sulphur-dioxide-and-sulphites': 'sulfites',
  lupin: 'lupin',
  molluscs: 'mollusques',
};

export function allergensFromOff(tags: string[]): AllergenId[] {
  const out = new Set<AllergenId>();
  for (const t of tags) {
    const id = OFF_ALLERGEN_MAP[t.replace(/^[a-z]{2}:/, '')];
    if (id) out.add(id);
  }
  return [...out];
}
