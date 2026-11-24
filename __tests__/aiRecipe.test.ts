import {
  allergensInText,
  buildUserPrompt,
  cacheMaterial,
  findAllergenConflicts,
  generatedRecipeSchema,
  mergeConstraints,
  OUTPUT_JSON_SCHEMA,
  RequestSchema,
  strictestDiet,
  SYSTEM_PROMPT,
  toAppRecipe,
  type GeneratedRecipe,
} from '../supabase/functions/generate-recipe/recipe';
import { INGREDIENTS } from '@/data/ingredients';

const req = RequestSchema.parse({
  household_id: '52f19460-5df1-4dd5-82bc-c46e96a7ad1f',
  minutes: 30,
  servings: 2,
  products: [
    { name: 'Blanc de poulet', days_left: 0, quantity: '2 filets' },
    { name: 'Crème fraîche', days_left: 1 },
    { name: 'Comté', days_left: 12 },
  ],
  basics: ['sel', 'poivre', 'huile'],
  members: [{ diet: 'omnivore', allergens: [], dislikes: ['champignons'] }],
});

const good: GeneratedRecipe = {
  title: 'Poulet à la crème express',
  minutes: 25,
  servings: 2,
  kind: 'plat',
  tags: ['rapide', 'anti-gaspi'],
  ingredients: [
    { ingredient_id: 'poulet', name: 'poulet', quantity: 2, unit: 'pièce', optional: false },
    { ingredient_id: 'creme', name: 'crème fraîche', quantity: 20, unit: 'cl', optional: false },
    { ingredient_id: 'autre', name: 'ciboulette', quantity: null, unit: null, optional: true },
  ],
  steps: ['Coupe le poulet en lanières.', 'Fais-le dorer 8 min puis ajoute la crème et laisse réduire 5 min.'],
  allergens: ['lait'],
  uses_urgent: ['Blanc de poulet', 'Crème fraîche'],
};

describe('requête', () => {
  it('applique les valeurs par défaut et refuse les valeurs hors bornes', () => {
    expect(req.kind).toBe('peu-importe');
    expect(req.variation).toBe(0);
    expect(RequestSchema.safeParse({ ...req, minutes: 2 }).success).toBe(false);
    expect(RequestSchema.safeParse({ ...req, household_id: 'pas-un-uuid' }).success).toBe(false);
    expect(RequestSchema.safeParse({ ...req, members: [{ diet: 'omnivore', allergens: ['inconnu'], dislikes: [] }] }).success).toBe(false);
  });

  it('réunit les contraintes de l’app et du serveur (union, le plus prudent)', () => {
    const c = mergeConstraints(req, [{ diet: 'vegetarien', allergens: ['lait'], dislikes: [] }]);
    expect(c).toEqual({ allergens: ['lait'], diets: ['omnivore', 'vegetarien'], dislikes: ['champignons'] });
    expect(strictestDiet(c.diets)).toBe('vegetarien');
  });
});

describe('schéma imposé au modèle', () => {
  it('n’utilise que des contraintes compatibles avec les structured outputs', () => {
    const json = JSON.stringify(OUTPUT_JSON_SCHEMA);
    for (const forbidden of ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems']) expect(json).not.toContain(forbidden);
  });
  it('propose tous les ingrédients du référentiel', () => {
    const ids = OUTPUT_JSON_SCHEMA.properties.ingredients.items.properties.ingredient_id.enum;
    expect(ids).toHaveLength(INGREDIENTS.length + 1);
    expect(ids).toContain('autre');
    expect(SYSTEM_PROMPT).toContain('poulet : poulet');
  });
});

describe('validation côté serveur', () => {
  const schema = generatedRecipeSchema(req);
  it('accepte une recette correcte', () => {
    expect(schema.safeParse(good).success).toBe(true);
  });
  it.each([
    ['trop longue', { minutes: 90 }],
    ['mauvais nombre de portions', { servings: 4 }],
    ['une seule étape', { steps: ['Mélange tout.'] }],
    ['titre vide', { title: '  ' }],
    ['quantité négative', { ingredients: [{ ...good.ingredients[0]!, quantity: -1 }, good.ingredients[1]!] }],
  ])('refuse : %s', (_, patch) => {
    expect(schema.safeParse({ ...good, ...patch }).success).toBe(false);
  });
});

describe('revérification des allergènes', () => {
  it('détecte les allergènes dans les libellés et les étapes', () => {
    expect([...allergensInText('Parsème de parmesan râpé')]).toContain('lait');
    expect([...allergensInText('poignée de noix')]).toContain('fruits_coque');
    expect([...allergensInText('pâte brisée')].sort()).toEqual(['gluten', 'lait']);
    expect([...allergensInText('quelques crevettes roses')]).toContain('crustaces');
    expect([...allergensInText('carottes et courgettes')]).toEqual([]);
  });

  it('refuse une recette contenant un allergène interdit, où qu’il soit', () => {
    expect(findAllergenConflicts(good, ['lait']).map((c) => c.where)).toEqual(expect.arrayContaining(['déclaré par la recette', 'crème fraîche']));
    // Allergène caché dans une étape, ingrédient « autre » et non déclaré par le modèle.
    const sneaky: GeneratedRecipe = { ...good, allergens: [], ingredients: [good.ingredients[0]!, good.ingredients[2]!], steps: ['Fais dorer le poulet.', 'Sers avec quelques noisettes concassées.'] };
    expect(findAllergenConflicts(sneaky, ['fruits_coque'])).toEqual([{ allergen: 'fruits_coque', where: 'étape 2' }]);
    // Ingrédient facultatif : interdit aussi.
    const optional: GeneratedRecipe = { ...good, allergens: [], ingredients: [good.ingredients[0]!, { ingredient_id: 'autre', name: 'graines de sésame', quantity: null, unit: null, optional: true }] };
    expect(findAllergenConflicts(optional, ['sesame'])).toHaveLength(1);
  });

  it('ne signale rien sans allergie déclarée ou sans allergène', () => {
    expect(findAllergenConflicts(good, [])).toEqual([]);
    expect(findAllergenConflicts(good, ['arachides'])).toEqual([]);
  });
});

describe('prompt', () => {
  it('trie les produits par urgence et décrit les contraintes', () => {
    const p = buildUserPrompt(req, mergeConstraints(req, []), ['contient du lait']);
    expect(p.indexOf('Blanc de poulet')).toBeLessThan(p.indexOf('Comté'));
    expect(p).toContain('Blanc de poulet (2 filets) : urgent, aujourd’hui');
    expect(p).toContain('Allergènes interdits : aucun');
    expect(p).toContain('Aliments pas aimés : champignons');
    expect(p).toContain('- contient du lait');
  });
});

describe('conversion et cache', () => {
  it('convertit vers le format des recettes de l’app', () => {
    const app = toAppRecipe(good);
    expect(app.ingredients[0]).toEqual({ ingredientId: 'poulet', quantity: 2, unit: 'pièce' });
    expect(app.ingredients[2]).toEqual({ ingredientId: null, name: 'ciboulette', quantity: null, unit: null, optional: true });
    expect(app.tags).toContain('ia');
  });
  it('produit la même clé quel que soit l’ordre des produits', () => {
    const c = mergeConstraints(req, []);
    const shuffled = { ...req, products: [...req.products].reverse() };
    expect(cacheMaterial(shuffled, c)).toBe(cacheMaterial(req, c));
    expect(cacheMaterial({ ...req, variation: 1 }, c)).not.toBe(cacheMaterial(req, c));
  });
});
