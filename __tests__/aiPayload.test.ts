jest.mock('@/services/supabase', () => ({ supabase: null }));
jest.mock('@supabase/supabase-js', () => ({ FunctionsHttpError: class {}, FunctionsFetchError: class {} }));
// eslint-disable-next-line import/first
import { addDays } from '@/domain/dates';
// eslint-disable-next-line import/first
import type { Item } from '@/domain/inventory';
// eslint-disable-next-line import/first
import { buildAiPayload, generateAiRecipe } from '@/services/aiRecipes';
// eslint-disable-next-line import/first
import { RequestSchema } from '../supabase/functions/generate-recipe/recipe';

const today = new Date(2026, 10, 13, 10);
const item = (name: string, days: number, over: Partial<Item> = {}): Item => ({
  id: name, name, category: 'autre', quantity: 1, unit: 'pièce', location: 'frigo', dateType: 'DLC',
  expiresAt: addDays(today, days), addedAt: today, openedAt: null, status: 'en_stock', ...over,
});

describe('requête envoyée à la fonction generate-recipe', () => {
  const payload = buildAiPayload(
    { householdId: '52f19460-5df1-4dd5-82bc-c46e96a7ad1f', minutes: 30, servings: 2, kind: 'plat', wish: '  léger  ', variation: 0 },
    [
      item('Comté', 12, { quantity: 250, unit: 'g' }),
      item('Blanc de poulet', 0, { quantity: 2, unit: 'filet' }),
      item('Yaourt périmé', -2),
      item('Biscottes', -20, { dateType: 'DDM' }),
      item('Mangé', 1, { status: 'consomme' }),
    ],
    ['sel', 'huile_olive'],
    [{ name: 'Toi', diet: 'vegetarien', allergens: ['lait'], dislikes: ['epinards'] }],
    today,
  );

  it('est acceptée telle quelle par le schéma de la fonction', () => {
    expect(RequestSchema.safeParse(payload).success).toBe(true);
  });
  it('trie par urgence et exclut ce qui ne doit pas être cuisiné', () => {
    expect(payload.products.map((p) => p.name)).toEqual(['Biscottes', 'Blanc de poulet', 'Comté']);
    expect(payload.products[1]).toEqual({ name: 'Blanc de poulet', days_left: 0, quantity: '2 filets' });
  });
  it('envoie les noms des ingrédients de base et les préférences', () => {
    expect(payload.basics).toEqual(['sel', 'huile d’olive']);
    expect(payload.members).toEqual([{ diet: 'vegetarien', allergens: ['lait'], dislikes: ['epinards'] }]);
    expect(payload.wish).toBe('léger');
  });
  it('sans serveur configuré : erreur explicite', async () => {
    await expect(generateAiRecipe(payload)).rejects.toMatchObject({ code: 'unavailable' });
  });
});
