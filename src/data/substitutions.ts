import { INGREDIENTS_BY_ID } from './ingredients';

/** Un ingrédient qui peut en remplacer un autre, avec le conseil d'usage. */
export interface Substitute {
  id: string;
  /** « même quantité », « 2 fois moins »… */
  note: string;
}

/**
 * Remplacements courants en cuisine du quotidien, du meilleur au moins bon.
 * Seuls des remplacements qui ne changent pas la nature du plat (pas de viande ↔ poisson).
 */
export const SUBSTITUTIONS: Record<string, Substitute[]> = {
  // Crèmerie
  creme: [
    { id: 'mascarpone', note: 'même quantité, plus riche' },
    { id: 'yaourt', note: 'même quantité, hors du feu (il tranche s’il bout)' },
    { id: 'lait_coco', note: 'même quantité, goût coco' },
    { id: 'lait', note: 'avec un peu de beurre, plus liquide' },
  ],
  yaourt: [
    { id: 'creme', note: 'même quantité, plus gras' },
    { id: 'mascarpone', note: 'détendu avec un peu de lait' },
  ],
  mascarpone: [
    { id: 'creme', note: 'même quantité, plus liquide' },
    { id: 'yaourt', note: 'bien égoutté, plus acidulé' },
  ],
  lait: [
    { id: 'lait_coco', note: 'même quantité, goût coco' },
    { id: 'creme', note: 'allongée d’eau (moitié-moitié)' },
    { id: 'yaourt', note: 'allongé d’eau, pour les pâtes à gâteau' },
  ],
  beurre: [
    { id: 'huile', note: 'un peu moins (¾ de la quantité)' },
    { id: 'huile_olive', note: '¾ de la quantité, pour le salé' },
  ],
  // Fromages
  fromage_rape: [
    { id: 'emmental', note: 'à râper' },
    { id: 'parmesan', note: 'un peu moins, plus fort' },
    { id: 'mozzarella', note: 'en petits morceaux' },
  ],
  emmental: [
    { id: 'fromage_rape', note: 'même quantité' },
    { id: 'mozzarella', note: 'même quantité, plus doux' },
  ],
  parmesan: [
    { id: 'fromage_rape', note: 'un peu plus, goût plus doux' },
    { id: 'emmental', note: 'râpé fin, goût plus doux' },
  ],
  mozzarella: [
    { id: 'emmental', note: 'même quantité' },
    { id: 'fromage_rape', note: 'même quantité' },
  ],
  feta: [{ id: 'chevre', note: 'même quantité, émietté' }],
  chevre: [{ id: 'feta', note: 'même quantité' }],
  // Viandes et poissons proches
  lardons: [
    { id: 'jambon', note: 'en dés, sans le fumé' },
    { id: 'chorizo', note: 'un peu moins, plus relevé' },
  ],
  jambon: [
    { id: 'dinde', note: 'cuite, en dés' },
    { id: 'lardons', note: 'revenus à la poêle' },
  ],
  jambon_cru: [{ id: 'jambon', note: 'même quantité' }],
  dinde: [{ id: 'poulet', note: 'même quantité' }],
  poulet: [{ id: 'dinde', note: 'même quantité' }],
  boeuf_hache: [{ id: 'saucisse', note: 'chair sortie du boyau' }],
  thon: [
    { id: 'sardines', note: 'en boîte, émiettées' },
    { id: 'saumon', note: 'cuit et émietté' },
  ],
  saumon: [{ id: 'cabillaud', note: 'même quantité, cuisson plus courte' }],
  cabillaud: [{ id: 'saumon', note: 'même quantité' }],
  // Légumes et aromates
  echalote: [{ id: 'oignon', note: '½ oignon pour 1 échalote' }],
  oignon: [
    { id: 'echalote', note: '2 échalotes pour 1 oignon' },
    { id: 'poireau', note: 'le blanc, émincé' },
  ],
  poireau: [{ id: 'oignon', note: '1 oignon pour 1 poireau' }],
  courgette: [{ id: 'aubergine', note: 'même quantité' }],
  aubergine: [{ id: 'courgette', note: 'même quantité' }],
  epinards: [{ id: 'salade', note: 'à peine fondue, ou blettes' }],
  potiron: [
    { id: 'patate_douce', note: 'même quantité' },
    { id: 'carotte', note: 'même quantité, plus sucré' },
  ],
  patate_douce: [
    { id: 'potiron', note: 'même quantité' },
    { id: 'pomme_de_terre', note: 'même quantité, moins sucré' },
  ],
  brocoli: [{ id: 'chou_fleur', note: 'même quantité' }],
  chou_fleur: [{ id: 'brocoli', note: 'même quantité' }],
  haricots_verts: [{ id: 'petits_pois', note: 'même quantité' }],
  petits_pois: [{ id: 'haricots_verts', note: 'même quantité, coupés' }],
  tomate: [{ id: 'tomates_concassees', note: '1 boîte pour 4 tomates, en sauce' }],
  tomates_concassees: [{ id: 'tomate', note: '4 tomates pour 1 boîte' }],
  concentre_tomate: [{ id: 'tomates_concassees', note: 'à faire réduire' }],
  citron: [{ id: 'vinaigre', note: 'un filet, pour l’acidité' }],
  persil: [
    { id: 'coriandre', note: 'même quantité, goût différent' },
    { id: 'ciboulette', note: 'même quantité' },
    { id: 'herbes', note: 'même quantité' },
  ],
  coriandre: [{ id: 'persil', note: 'même quantité, plus doux' }],
  basilic: [
    { id: 'pesto', note: '1 c. à s. de pesto pour une poignée' },
    { id: 'persil', note: 'même quantité' },
  ],
  ciboulette: [{ id: 'persil', note: 'même quantité' }, { id: 'echalote', note: 'très finement ciselée' }],
  herbes: [{ id: 'persil', note: 'même quantité' }, { id: 'herbes_provence', note: 'séchées, 1 c. à c.' }],
  // Féculents, légumineuses
  pates: [{ id: 'riz', note: 'même quantité' }],
  riz: [
    { id: 'quinoa', note: 'même quantité' },
    { id: 'semoule', note: 'même quantité' },
    { id: 'pates', note: 'petites pâtes' },
  ],
  semoule: [{ id: 'quinoa', note: 'même quantité' }, { id: 'riz', note: 'même quantité' }],
  quinoa: [{ id: 'semoule', note: 'même quantité' }, { id: 'riz', note: 'même quantité' }],
  lentilles: [{ id: 'pois_chiches', note: 'en boîte, même quantité' }],
  pois_chiches: [{ id: 'haricots_rouges', note: 'même quantité' }, { id: 'lentilles', note: 'même quantité' }],
  haricots_rouges: [{ id: 'pois_chiches', note: 'même quantité' }, { id: 'lentilles', note: 'même quantité' }],
  // Boulangerie, pâtes à tarte
  pain: [{ id: 'pain_mie', note: 'grillé' }],
  pain_mie: [{ id: 'pain', note: 'en tranches fines' }],
  chapelure: [{ id: 'pain', note: 'rassis, mixé ou râpé' }, { id: 'flocons_avoine', note: 'mixés' }],
  pate_brisee: [{ id: 'pate_feuilletee', note: 'même usage' }],
  pate_feuilletee: [{ id: 'pate_brisee', note: 'même usage' }],
  tortillas: [{ id: 'pain', note: 'en tartines' }],
  // Épicerie
  vin_blanc: [{ id: 'bouillon', note: 'même quantité, avec un trait de vinaigre' }],
  lait_coco: [{ id: 'creme', note: 'même quantité' }],
  miel: [{ id: 'sucre', note: 'un peu moins' }],
  sucre_vanille: [{ id: 'sucre', note: 'même quantité' }],
  huile_olive: [{ id: 'huile', note: 'même quantité' }],
  huile: [{ id: 'huile_olive', note: 'même quantité' }],
  chocolat: [],
  noix: [{ id: 'sesame', note: 'pour le croquant' }],
  pesto: [{ id: 'basilic', note: 'mixé avec huile d’olive, ail et parmesan' }],
};

/** Remplacements connus pour un ingrédient (ceux dont l'identifiant existe). */
export function substitutesFor(ingredientId: string): Substitute[] {
  return (SUBSTITUTIONS[ingredientId] ?? []).filter((s) => INGREDIENTS_BY_ID[s.id]);
}
