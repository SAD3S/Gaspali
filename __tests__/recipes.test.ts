import { INGREDIENTS, INGREDIENTS_BY_ID } from '@/data/ingredients';
import { BUILTIN_RECIPES } from '@/data/recipes';
import { addDays } from '@/domain/dates';
import { ingredientsForProduct, resolveIngredient, tokens } from '@/domain/ingredientMatch';
import type { Item } from '@/domain/inventory';
import {
  cookProposals,
  dietAccepts,
  evaluateRecipe,
  missingIngredients,
  recipeAllergens,
  recipeDiet,
  recipeTags,
  suggestRecipes,
  suggestionSummary,
  type MemberPrefs,
  type Recipe,
} from '@/domain/recipeEngine';
import { convert } from '@/domain/units';

const today = new Date(2026, 10, 13, 10);
const recipes: Recipe[] = BUILTIN_RECIPES.map((r) => ({ ...r, source: 'base' }));
const byId = (id: string) => recipes.find((r) => r.id === id)!;

function item(name: string, days: number, over: Partial<Item> = {}): Item {
  return {
    id: name, name, category: 'autre', quantity: 1, unit: 'pièce', location: 'frigo', dateType: 'DLC',
    expiresAt: addDays(today, days), addedAt: today, openedAt: null, status: 'en_stock', ...over,
  };
}
const me: MemberPrefs = { name: 'Moi', diet: 'omnivore', allergens: [], dislikes: [] };
const basics = new Set(['sel', 'poivre', 'huile', 'huile_olive', 'farine', 'sucre', 'eau', 'vinaigre', 'herbes_provence']);

describe('base de recettes', () => {
  it('contient une cinquantaine de recettes complètes', () => {
    expect(recipes.length).toBeGreaterThanOrEqual(50);
    for (const r of recipes) {
      expect(r.steps.length).toBeGreaterThan(0);
      expect(r.servings).toBeGreaterThan(0);
    }
    expect(new Set(recipes.map((r) => r.id)).size).toBe(recipes.length);
  });
  it('n’utilise que des ingrédients de la table normalisée', () => {
    const unknown = recipes.flatMap((r) => r.ingredients.filter((i) => !INGREDIENTS_BY_ID[i.ingredientId!]).map((i) => `${r.id}:${i.ingredientId}`));
    expect(unknown).toEqual([]);
    expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length);
  });
});

describe('correspondance ingrédients ↔ produits', () => {
  it.each([
    ['Blanc de poulet', 'poulet'],
    ['Crème fraîche épaisse', 'creme'],
    ['Épinards frais', 'epinards'],
    ['Œufs plein air x6', 'oeufs'],
    ['Pâtes penne', 'pates'],
    ['Tomates cerises', 'tomate'],
    ['Pommes de terre', 'pomme_de_terre'],
    ['Emmental râpé', 'fromage_rape'],
    ['Comté 18 mois', 'emmental'],
    ['Yaourts nature', 'yaourt'],
    ['Lardons fumés', 'lardons'],
    ['Petits pois', 'petits_pois'],
    ['Dos de cabillaud', 'cabillaud'],
  ])('« %s » → %s', (product, id) => {
    expect(ingredientsForProduct(product)).toContain(id);
  });

  it.each([
    ['Crème dessert chocolat', 'creme'],
    ['Lait de coco', 'lait'],
    ['Pommes de terre', 'pomme'],
    ['Tomates concassées', 'tomate'],
    ['Pâte feuilletée', 'pates'],
    ['Jambon cru', 'jambon'],
    ['Yaourt aux fruits', 'yaourt'],
    ['Petits pois', 'pois_chiches'],
    ['Saumon fumé', 'saumon'],
  ])('« %s » ≠ %s', (product, id) => {
    expect(ingredientsForProduct(product)).not.toContain(id);
  });

  it('normalise accents, pluriels et ligatures', () => {
    expect(tokens('Œufs frais BIO')).toEqual(['oeuf']);
    expect(tokens('Poireaux')).toEqual(['poireau']);
  });

  it('résout un libellé saisi', () => {
    expect(resolveIngredient('escalope de poulet')?.id).toBe('poulet');
    expect(resolveIngredient('gruyère râpé')?.id).toBe('fromage_rape');
    expect(resolveIngredient('xyzzy')).toBeNull();
  });
});

describe('régimes et allergènes déduits', () => {
  it('déduit le régime le plus strict', () => {
    expect(recipeDiet(byId('pates-carbonara'))).toBe('omnivore');
    expect(recipeDiet(byId('saumon-papillote'))).toBe('pescetarien');
    expect(recipeDiet(byId('omelette-champignons'))).toBe('vegetarien');
    expect(recipeDiet(byId('poelee-legumes'))).toBe('vegan');
    // Le jambon facultatif ne rend pas la pizza non végétarienne… mais la mozzarella la rend non végane.
    expect(recipeDiet(byId('pizza-maison'))).toBe('vegetarien');
  });
  it('déduit les allergènes et les tags', () => {
    expect(recipeAllergens(byId('crepes')).sort()).toEqual(['gluten', 'lait', 'oeufs']);
    expect(recipeTags(byId('ratatouille'))).toEqual(expect.arrayContaining(['végétarien', 'végan', 'sans gluten', 'sans lactose']));
    expect(recipeTags(byId('pates-carbonara'))).not.toContain('sans gluten');
  });
  it('compare les régimes', () => {
    expect(dietAccepts('vegetarien', 'vegan')).toBe(true);
    expect(dietAccepts('vegetarien', 'pescetarien')).toBe(false);
    expect(dietAccepts('omnivore', 'omnivore')).toBe(true);
  });
});

describe('moteur de suggestion', () => {
  const stock = [
    item('Blanc de poulet', 0, { quantity: 2, unit: 'filet' }),
    item('Crème fraîche', 1, { quantity: 20, unit: 'cl' }),
    item('Épinards frais', 3, { quantity: 300, unit: 'g' }),
    item('Emmental râpé', 20, { quantity: 200, unit: 'g' }),
    item('Ail', 30),
  ];
  const ctx = { items: stock, basics, members: [me], today };

  it('met en tête la recette qui sauve les produits urgents', () => {
    const [first] = suggestRecipes(recipes, ctx);
    expect(first!.recipe.id).toBe('gratin-poulet-epinards');
    expect(first!.urgentUsed).toBe(2);
    expect(first!.allAvailable).toBe(true);
    expect(suggestionSummary(first!)).toBe('utilise 2 de tes produits urgents · tout est dispo');
  });

  it('marque le statut de chaque ingrédient', () => {
    const s = evaluateRecipe(byId('gratin-poulet-epinards'), ctx)!;
    const status = Object.fromEntries(s.checks.map((c) => [c.ri.ingredientId, c.status]));
    expect(status).toMatchObject({ poulet: 'urgent', creme: 'urgent', epinards: 'bientot', fromage_rape: 'dispo', sel: 'base' });
  });

  it('pénalise les manquants et récompense « tout est dispo »', () => {
    const gratin = evaluateRecipe(byId('gratin-poulet-epinards'), ctx)!;
    const chili = evaluateRecipe(byId('chili-con-carne'), ctx)!;
    expect(chili.missing).toBeGreaterThan(3);
    expect(gratin.score).toBeGreaterThan(chili.score);
  });

  it('n’utilise jamais un produit dont la DLC est dépassée', () => {
    const s = evaluateRecipe(byId('gratin-poulet-epinards'), { ...ctx, items: [item('Blanc de poulet', -1)] })!;
    expect(s.checks.find((c) => c.ri.ingredientId === 'poulet')!.status).toBe('manquant');
  });

  it('accepte un produit à DDM dépassée (à vérifier)', () => {
    const s = evaluateRecipe(byId('pates-carbonara'), { ...ctx, items: [item('Pâtes penne', -10, { dateType: 'DDM' })] })!;
    expect(s.checks.find((c) => c.ri.ingredientId === 'pates')!.status).toBe('a_verifier');
  });

  it('exclut strictement les recettes avec un allergène déclaré', () => {
    const allergic = { ...me, allergens: ['lait' as const] };
    const list = suggestRecipes(recipes, { ...ctx, members: [allergic] });
    expect(list.find((s) => s.recipe.id === 'gratin-poulet-epinards')).toBeUndefined();
    expect(list.every((s) => !recipeAllergens(s.recipe).includes('lait'))).toBe(true);
    // Allergène dans un ingrédient facultatif seulement : la recette reste proposée.
    expect(list.find((s) => s.recipe.id === 'soupe-legumes')).toBeDefined();
  });

  it('baisse le score pour un régime non respecté ou un aliment détesté', () => {
    const base = evaluateRecipe(byId('gratin-poulet-epinards'), ctx)!;
    const veg = evaluateRecipe(byId('gratin-poulet-epinards'), { ...ctx, members: [me, { ...me, name: 'Léa', diet: 'vegetarien' }] })!;
    expect(veg.dietConflicts).toEqual(['Léa']);
    expect(veg.score).toBeLessThan(base.score);
    const dislike = evaluateRecipe(byId('gratin-poulet-epinards'), { ...ctx, members: [{ ...me, dislikes: ['epinards'] }] })!;
    expect(dislike.dislikes).toEqual(['épinards']);
    expect(dislike.score).toBeLessThan(base.score);
  });
});

describe('« J’ai cuisiné ça »', () => {
  it('décrémente en convertissant les unités, en commençant par le plus urgent', () => {
    const items = [
      item('Crème fraîche', 1, { quantity: 20, unit: 'cl' }),
      item('Épinards frais', 3, { quantity: 0.5, unit: 'kg' }),
      item('Blanc de poulet', 0, { quantity: 2, unit: 'filet' }),
      item('Emmental râpé', 20, { quantity: 200, unit: 'g' }),
    ];
    const s = evaluateRecipe(byId('gratin-poulet-epinards'), { items, basics, members: [me], today })!;
    const plan = Object.fromEntries(cookProposals(s, 4, basics).map((p) => [p.item.name, [p.remaining, p.exact]]));
    expect(plan['Crème fraîche']).toEqual([0, true]);
    expect(plan['Épinards frais']).toEqual([0.2, true]); // 500 g − 300 g = 0,2 kg
    expect(plan['Emmental râpé']).toEqual([120, true]);
    expect(plan['Blanc de poulet']).toEqual([0, false]); // 400 g vs 2 filets : proposé terminé, à ajuster
  });

  it('met les quantités à l’échelle des portions', () => {
    const s = evaluateRecipe(byId('gratin-poulet-epinards'), { items: [item('Emmental râpé', 20, { quantity: 200, unit: 'g' })], basics, members: [me], today })!;
    expect(cookProposals(s, 2, basics)[0]!.remaining).toBe(160);
    const missing = missingIngredients(s, 2);
    expect(missing.find((m) => m.ingredientId === 'poulet')).toEqual({ label: 'poulet', ingredientId: 'poulet', quantity: 200, unit: 'g' });
  });

  it('convertit les unités', () => {
    expect(convert(1.5, 'kg', 'g')).toBe(1500);
    expect(convert(50, 'cl', 'L')).toBe(0.5);
    expect(convert(2, 'pièce', 'filet')).toBe(2);
    expect(convert(300, 'g', 'pièce')).toBeNull();
  });
});

describe('substitutions', () => {
  const quiche: Recipe = {
    id: 'test-sub', title: 'Gratin test', minutes: 30, servings: 2, kind: 'plat', tags: [], steps: ['Mélanger.'], source: 'perso',
    ingredients: [
      { ingredientId: 'courgette', quantity: 2, unit: 'pièce' },
      { ingredientId: 'creme', quantity: 20, unit: 'cl' },
    ],
  };

  it('remplace un ingrédient manquant par un produit en stock, le plus urgent d’abord', () => {
    const items = [item('Courgettes', 1), item('Lait de coco', 30), item('Yaourt nature', 1)];
    const s = evaluateRecipe(quiche, { items, basics, members: [me], today })!;
    const creme = s.checks.find((c) => c.ri.ingredientId === 'creme')!;
    expect(creme.substitute?.id).toBe('yaourt');
    expect(creme.status).toBe('urgent');
    expect(s.missing).toBe(0);
    expect(s.allAvailable).toBe(true);
    // Le remplaçant n'est pas ajouté aux courses, et sert au décompte « J'ai cuisiné ça ».
    expect(missingIngredients(s, 2)).toEqual([]);
    expect(cookProposals(s, 2, basics).map((p) => p.item.name)).toContain('Yaourt nature');
  });

  it('reste un peu derrière la même recette avec le vrai ingrédient', () => {
    const withSub = evaluateRecipe(quiche, { items: [item('Courgettes', 10), item('Mascarpone', 10)], basics, members: [me], today })!;
    const exact = evaluateRecipe(quiche, { items: [item('Courgettes', 10), item('Crème fraîche', 10)], basics, members: [me], today })!;
    expect(exact.score).toBeGreaterThan(withSub.score);
  });

  it('ne propose jamais un allergène du foyer ni un ingrédient non aimé', () => {
    const items = [item('Courgettes', 1), item('Yaourt nature', 1), item('Lait de coco', 5)];
    const lactose: MemberPrefs = { ...me, allergens: ['lait'] };
    // La crème elle-même contient du lait : la recette est exclue, pas « réparée ».
    expect(evaluateRecipe(quiche, { items, basics, members: [lactose], today })).toBeNull();
    const noYaourt: MemberPrefs = { ...me, dislikes: ['yaourt'] };
    const s = evaluateRecipe(quiche, { items, basics, members: [noYaourt], today })!;
    expect(s.checks.find((c) => c.ri.ingredientId === 'creme')?.substitute?.id).toBe('lait_coco');
  });

  it('rien à remplacer : l’ingrédient reste manquant', () => {
    const s = evaluateRecipe(quiche, { items: [item('Courgettes', 1)], basics, members: [me], today })!;
    expect(s.checks.find((c) => c.ri.ingredientId === 'creme')?.status).toBe('manquant');
    expect(s.missing).toBe(1);
  });
});

it('la table des substitutions ne cite que des ingrédients connus', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SUBSTITUTIONS } = require('@/data/substitutions');
  const bad = Object.entries(SUBSTITUTIONS as Record<string, { id: string }[]>).flatMap(([k, list]) =>
    [k, ...list.map((s) => s.id)].filter((id) => !INGREDIENTS_BY_ID[id]),
  );
  expect(bad).toEqual([]);
});

describe('équipement du foyer', () => {
  it('écarte les recettes de la base impossibles, jamais les recettes perso', () => {
    const perso: Recipe = { ...byId(recipes.find((r) => r.title === 'Gratin dauphinois')!.id), id: 'mon-gratin', source: 'perso' };
    const all = [...recipes, perso];
    const sansFour = suggestRecipes(all, { items: [], basics, members: [me], today, equipment: new Set(['plaques', 'micro_ondes', 'mixeur'] as const) });
    const titles = sansFour.map((s) => s.recipe.id);
    expect(titles).not.toContain(recipes.find((r) => r.title === 'Gratin dauphinois')!.id);
    expect(titles).toContain('mon-gratin');
    expect(titles).toContain(recipes.find((r) => r.title === 'Crêpes')!.id);
    // Sans réglage : tout est proposé.
    expect(suggestRecipes(recipes, { items: [], basics, members: [me], today }).length).toBe(recipes.length);
  });
});

describe('garniture et parfum dans le nom du produit', () => {
  it('le produit principal compte, pas sa garniture', () => {
    expect(ingredientsForProduct('Les Marinés 2 pavés de bœuf à l’échalote')).toEqual(['boeuf']);
    expect(ingredientsForProduct("Pavés de boeuf à l'échalote")).toEqual(['boeuf']);
    expect(ingredientsForProduct('Filet de poulet au curry')).toEqual(['poulet']);
    expect(ingredientsForProduct('Yaourt saveur citron')).not.toContain('citron');
    expect(ingredientsForProduct('Riz au lait')).not.toContain('lait');
    expect(ingredientsForProduct('Gâteau au chocolat')).toEqual([]);
  });
  it('garde les noms composés et les produits sans garniture', () => {
    expect(ingredientsForProduct('Pâte à pizza fine')).toContain('pate_pizza');
    expect(ingredientsForProduct('Échalotes')).toEqual(['echalote']);
    expect(ingredientsForProduct('Tomates et mozzarella')).toEqual(expect.arrayContaining(['tomate', 'mozzarella']));
  });
});
