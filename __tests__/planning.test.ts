import { BUILTIN_RECIPES } from '@/data/recipes';
import { addDays } from '@/domain/dates';
import { isHabitual, productKey } from '@/domain/habits';
import type { Item } from '@/domain/inventory';
import {
  availableAfterReservations,
  computeReservations,
  dayKey,
  dayLabel,
  freeSlotsOfWeek,
  mealPhrase,
  missingForPlan,
  planWeek,
  startOfWeek,
  subtractShoppingList,
  weekRangeLabel,
  type PlanEntry,
} from '@/domain/planner';
import type { MemberPrefs, Recipe } from '@/domain/recipeEngine';
import { monthlyStats, niceTicks, topWastedCategories } from '@/domain/stats';
import { roundForShopping } from '@/domain/units';

const now = new Date(2026, 10, 24, 9, 0); // mardi 24 novembre 2026, 9 h
const recipes: Recipe[] = BUILTIN_RECIPES.map((r) => ({ ...r, source: 'base' }));
const byId = new Map(recipes.map((r) => [r.id, r]));
const me: MemberPrefs = { name: 'Moi', diet: 'omnivore', allergens: [], dislikes: [] };
const basics = new Set(['sel', 'poivre', 'huile', 'huile_olive', 'farine', 'sucre', 'eau', 'vinaigre', 'herbes_provence']);

function item(name: string, days: number, over: Partial<Item> = {}): Item {
  return {
    id: name, name, category: 'autre', quantity: 1, unit: 'pièce', location: 'frigo', dateType: 'DLC',
    expiresAt: addDays(now, days), addedAt: now, openedAt: null, status: 'en_stock', ...over,
  };
}

describe('produits habituels', () => {
  const purchases = [
    { type: 'ajout', productName: 'Lait demi-écrémé', createdAt: addDays(now, -40) },
    { type: 'ajout', productName: 'lait demi écrémé', createdAt: addDays(now, -5) },
    { type: 'ajout', productName: 'Crème fraîche', createdAt: addDays(now, -3) },
    { type: 'ajout', productName: 'Beurre', createdAt: addDays(now, -90) },
    { type: 'ajout', productName: 'Beurre', createdAt: addDays(now, -2) },
  ];
  it('acheté au moins 2 fois sur 60 jours', () => {
    expect(isHabitual('Lait demi-écrémé', purchases, now)).toBe(true);
    expect(isHabitual('Crème fraîche', purchases, now)).toBe(false);
    expect(isHabitual('Beurre', purchases, now)).toBe(false); // le premier achat est trop ancien
  });
  it('regroupe les variantes d’écriture', () => {
    expect(productKey('Lait  Demi-Écrémé')).toBe(productKey('lait demi ecreme'));
  });
});

describe('semaine et créneaux', () => {
  it('trouve le lundi et les créneaux libres à venir', () => {
    const monday = startOfWeek(now);
    expect(dayKey(monday)).toBe('2026-11-23');
    const taken: PlanEntry[] = [{ id: '1', date: '2026-11-24', slot: 'soir', recipeId: 'x', servings: 2, done: false }];
    const free = freeSlotsOfWeek(monday, taken, now);
    expect(free[0]).toEqual({ date: '2026-11-24', slot: 'midi' }); // lundi passé, mardi soir pris
    expect(free).toHaveLength(11);
    expect(dayLabel(addDays(now, 1), now)).toBe('Demain');
    expect(dayLabel(addDays(now, 2), now)).toBe('Jeudi 26');
    expect(mealPhrase('2026-11-24', 'soir', now)).toBe('ce soir');
    expect(mealPhrase('2026-11-25', 'midi', now)).toBe('demain midi');
    expect(mealPhrase('2026-11-26', 'soir', now)).toBe('jeudi 26 au soir');
  });
});

describe('planifier ma semaine anti-gaspi', () => {
  const items = [
    item('Blanc de poulet', 0, { quantity: 2, unit: 'filet' }),
    item('Crème fraîche', 1, { quantity: 20, unit: 'cl' }),
    item('Épinards frais', 2, { quantity: 300, unit: 'g' }),
    item('Emmental râpé', 20, { quantity: 200, unit: 'g' }),
    item('Courgettes', 3, { quantity: 2 }),
    item('Poivrons', 4, { quantity: 2 }),
    item('Pâtes penne', 300, { quantity: 500, unit: 'g', dateType: 'DDM' }),
  ];
  const ctx = { items, basics, members: [me] };
  const slots = [
    { date: '2026-11-24', slot: 'soir' as const },
    { date: '2026-11-25', slot: 'midi' as const },
    { date: '2026-11-25', slot: 'soir' as const },
  ];

  it('place d’abord la recette qui sauve les produits les plus urgents', () => {
    const plan = planWeek({ freeSlots: slots, existing: [], recipes, ctx, servings: 2, now });
    expect(plan[0]).toMatchObject({ date: '2026-11-24', slot: 'soir' });
    expect(plan[0]!.recipe.id).toBe('gratin-poulet-epinards');
  });

  it('ne réutilise pas un produit déjà promis ni la même recette', () => {
    const plan = planWeek({ freeSlots: slots, existing: [], recipes, ctx, servings: 2, now });
    const ids = plan.map((p) => p.recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Le poulet (2 filets) est entièrement pris par le gratin : aucun repas suivant ne compte dessus.
    for (const p of plan.slice(1)) {
      const poulet = p.suggestion.checks.find((c) => c.ri.ingredientId === 'poulet');
      if (poulet) expect(poulet.status).toBe('manquant');
    }
  });

  it('ignore les créneaux passés et ne propose pas de dessert comme repas', () => {
    const plan = planWeek({ freeSlots: [{ date: '2026-11-23', slot: 'soir' }, ...slots], existing: [], recipes, ctx, servings: 2, now });
    expect(plan.find((p) => p.date === '2026-11-23')).toBeUndefined();
    expect(plan.every((p) => !['dessert', 'gouter', 'petit-dejeuner'].includes(p.recipe.kind))).toBe(true);
  });

  it('ne remplit un créneau que si la recette utilise le stock et demande peu d’achats', () => {
    const plan = planWeek({ freeSlots: slots, existing: [], recipes, ctx, servings: 2, now });
    for (const p of plan) {
      expect(p.suggestion.missing).toBeLessThanOrEqual(2);
      expect(p.suggestion.checks.some((c) => c.status !== 'manquant' && c.status !== 'base')).toBe(true);
    }
    expect(planWeek({ freeSlots: slots, existing: [], recipes, ctx: { ...ctx, items: [] }, servings: 2, now })).toEqual([]);
  });

  it('tient compte des repas déjà planifiés', () => {
    const existing: PlanEntry[] = [{ id: 'e', date: '2026-11-24', slot: 'midi', recipeId: 'gratin-poulet-epinards', servings: 4, done: false }];
    const plan = planWeek({ freeSlots: slots, existing, recipes, ctx, servings: 2, now });
    expect(plan.map((p) => p.recipe.id)).not.toContain('gratin-poulet-epinards');
  });
});

describe('réservations', () => {
  it('réserve les ingrédients des repas à venir, dans l’ordre', () => {
    const items = [item('Crème fraîche', 1, { quantity: 30, unit: 'cl' }), item('Pâtes penne', 300, { quantity: 500, unit: 'g', dateType: 'DDM' })];
    const entries: PlanEntry[] = [
      { id: '1', date: '2026-11-25', slot: 'soir', recipeId: 'gratin-pates', servings: 4, done: false },
      { id: '2', date: '2026-11-20', slot: 'soir', recipeId: 'pates-carbonara', servings: 4, done: false }, // passé
      { id: '3', date: '2026-11-26', slot: 'midi', recipeId: 'pates-saumon', servings: 4, done: true }, // déjà cuisiné
    ];
    const res = computeReservations(entries, byId, { items, basics, members: [me] }, now);
    expect(res.get('Crème fraîche')).toEqual({ quantity: 20, meals: ['demain soir'] });
    expect(res.get('Pâtes penne')).toEqual({ quantity: 300, meals: ['demain soir'] });
    const left = availableAfterReservations(items, res);
    expect(left.find((i) => i.name === 'Crème fraîche')!.quantity).toBe(10);
  });
});

describe('statistiques mensuelles', () => {
  const ev = (type: string, y: number, m: number, d: number, value: number | null, category = 'laitier') => ({
    type, category, value, createdAt: new Date(y, m, d),
  });
  const events = [
    ev('consomme', 2026, 10, 2, 2),
    ev('jete', 2026, 10, 5, 1.5),
    ev('jete', 2026, 10, 6, null, 'viande'),
    ev('consomme', 2026, 9, 10, 3),
    ev('jete', 2026, 5, 1, 1), // juin : hors des 6 derniers mois
  ];

  it('donne les 6 derniers mois, du plus ancien au plus récent', () => {
    const months = monthlyStats(events, 6, now);
    expect(months.map((m) => m.label)).toEqual(['juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.']);
    expect(months[5]).toMatchObject({ consumed: 1, discarded: 2, savedPct: 33, wastedValue: 6.5, savedValue: 2 });
    expect(months[4]).toMatchObject({ consumed: 1, discarded: 0, savedPct: 100 });
  });

  it('gradue l’axe avec des nombres ronds', () => {
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(13)).toEqual([0, 5, 10, 15]);
    expect(niceTicks(38)).toEqual([0, 10, 20, 30, 40]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });

  it('classe les catégories les plus jetées', () => {
    expect(topWastedCategories(events, new Date(2026, 10, 1))).toEqual([
      { category: 'viande', count: 1, value: 5 },
      { category: 'laitier', count: 1, value: 1.5 },
    ]);
  });
});

describe('manquants de la semaine', () => {
  it('additionne les quantités et compte un produit déjà promis comme manquant', () => {
    const items = [item('Crème fraîche', 3, { quantity: 20, unit: 'cl' })];
    const entries: PlanEntry[] = [
      { id: '1', date: '2026-11-25', slot: 'soir', recipeId: 'gratin-pates', servings: 4, done: false },
      { id: '2', date: '2026-11-26', slot: 'soir', recipeId: 'pates-saumon', servings: 4, done: false },
    ];
    const missing = missingForPlan(entries, byId, { items, basics, members: [me] }, now);
    // Pâtes : 300 g (gratin) + 400 g (saumon) = 700 g, pour les deux repas.
    expect(missing.find((m) => m.ingredientId === 'pates')).toEqual({ label: 'pâtes', ingredientId: 'pates', quantity: 700, unit: 'g', meals: ['demain soir', 'jeu. soir'] });
    // La crème (20 cl) part dans le gratin : il en manque 20 cl pour les pâtes au saumon.
    expect(missing.find((m) => m.ingredientId === 'creme')).toEqual({ label: 'crème fraîche', ingredientId: 'creme', quantity: 20, unit: 'cl', meals: ['jeu. soir'] });
    // Filtré sur jeudi : le gratin de mercredi compte toujours dans la simulation.
    const thursday = missingForPlan(entries, byId, { items, basics, members: [me] }, now, (e) => e.date === '2026-11-26');
    expect(thursday.find((m) => m.ingredientId === 'creme')?.quantity).toBe(20);
    expect(thursday.find((m) => m.ingredientId === 'pates')).toMatchObject({ quantity: 400, meals: ['jeu. soir'] });
  });
});

describe('liste de courses', () => {
  it('ne rajoute pas ce qui est déjà dans la liste', () => {
    const missing = [
      { label: 'pâtes', ingredientId: 'pates', quantity: 700, unit: 'g' },
      { label: 'crème fraîche', ingredientId: 'creme', quantity: 20, unit: 'cl' },
      { label: 'basilic', ingredientId: null, quantity: null, unit: null },
      { label: 'citron', ingredientId: 'citron', quantity: 1, unit: 'pièce' },
    ];
    const list = [
      { name: 'Pâtes', ingredientId: 'pates', quantity: 500, unit: 'g', checked: false },
      { name: 'Crème', ingredientId: 'creme', quantity: 20, unit: 'cl', checked: false },
      { name: 'Basilic', ingredientId: null, quantity: null, unit: null, checked: false },
      { name: 'Citron', ingredientId: 'citron', quantity: 1, unit: 'pièce', checked: true }, // déjà acheté
    ];
    expect(subtractShoppingList(missing, list)).toEqual([
      { label: 'pâtes', ingredientId: 'pates', quantity: 200, unit: 'g' },
      { label: 'citron', ingredientId: 'citron', quantity: 1, unit: 'pièce' },
    ]);
  });
  it('arrondit les quantités à acheter', () => {
    expect(roundForShopping(3.5, 'gousse')).toBe(4);
    expect(roundForShopping(0.25, 'pièce')).toBe(1);
    expect(roundForShopping(2, 'pot')).toBe(2);
    expect(roundForShopping(133, 'g')).toBe(130);
  });
  it('affiche la semaine', () => {
    expect(weekRangeLabel(new Date(2026, 10, 23))).toBe('23 – 29 nov.');
    expect(weekRangeLabel(new Date(2026, 10, 30))).toBe('30 nov. – 6 déc.');
  });
});
