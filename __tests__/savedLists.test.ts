import { parseSavedItems, savedListPreview, toSavedItems } from '@/domain/savedLists';

describe('listes enregistrées', () => {
  const rows = [
    { name: 'Chips', quantity: 2, unit: null, ingredientId: null },
    { name: 'chips ', quantity: 1, unit: null, ingredientId: null },
    { name: 'Tomates cerises', quantity: 250, unit: 'g', ingredientId: 'tomate' },
    { name: 'Tomate', quantity: 1, unit: null, ingredientId: 'tomate' },
    { name: '  ', quantity: null, unit: null, ingredientId: null },
  ];

  it('enregistre sans doublons ni lignes vides', () => {
    expect(toSavedItems(rows).map((r) => r.name)).toEqual(['Chips', 'Tomates cerises']);
  });

  it('relit des données abîmées sans planter', () => {
    expect(parseSavedItems('pas du json')).toEqual([]);
    expect(parseSavedItems('{"name":"x"}')).toEqual([]);
    expect(parseSavedItems('[{"name":"Pain","quantity":"2"},{"oups":1},{"name":"Lait","quantity":1,"unit":"L"}]')).toEqual([
      { name: 'Pain', quantity: null, unit: null, ingredientId: null },
      { name: 'Lait', quantity: 1, unit: 'L', ingredientId: null },
    ]);
  });

  it('résume une liste', () => {
    const items = parseSavedItems(JSON.stringify(['Pain', 'Lait', 'Œufs', 'Beurre', 'Café'].map((name) => ({ name }))));
    expect(savedListPreview(items)).toBe('Pain, Lait, Œufs et 2 autres');
    expect(savedListPreview([])).toBe('Vide');
  });
});
