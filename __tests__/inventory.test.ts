import { addDays } from '@/domain/dates';
import { defaultShelfDays } from '@/domain/categories';
import {
  consumePartially,
  countByLocation,
  defaultExpiry,
  formatDuration,
  freezerExtension,
  openItem,
  queryInventory,
  type Item,
} from '@/domain/inventory';
import { formatQuantity } from '@/domain/quantity';

const today = new Date(2026, 10, 13, 10);

function item(over: Partial<Item>): Item {
  return {
    id: Math.random().toString(36),
    name: 'Produit',
    category: 'autre',
    quantity: 1,
    unit: 'pièce',
    location: 'frigo',
    dateType: 'DLC',
    expiresAt: addDays(today, 7),
    addedAt: addDays(today, -1),
    openedAt: null,
    status: 'en_stock',
    ...over,
  };
}

describe('queryInventory', () => {
  const items = [
    item({ name: 'Comté', expiresAt: addDays(today, 12), addedAt: addDays(today, -5) }),
    item({ name: 'Épinards', expiresAt: addDays(today, 3), addedAt: addDays(today, -2) }),
    item({ name: 'Biscottes', dateType: 'DDM', location: 'placard', expiresAt: addDays(today, -20), addedAt: addDays(today, -40) }),
    item({ name: 'Crème fraîche', expiresAt: addDays(today, 1), addedAt: today }),
    item({ name: 'Jambon', status: 'consomme' }),
  ];

  it('trie par date limite par défaut et exclut les produits consommés', () => {
    expect(queryInventory(items, { today }).map((r) => r.item.name)).toEqual(['Biscottes', 'Crème fraîche', 'Épinards', 'Comté']);
  });
  it('trie par nom (ordre français, accents ignorés)', () => {
    expect(queryInventory(items, { today, sort: 'nom' }).map((r) => r.item.name)).toEqual(['Biscottes', 'Comté', 'Crème fraîche', 'Épinards']);
  });
  it('trie par date d’ajout (plus récent d’abord)', () => {
    expect(queryInventory(items, { today, sort: 'ajout' })[0]?.item.name).toBe('Crème fraîche');
  });
  it('filtre par emplacement et recherche sans accents', () => {
    expect(queryInventory(items, { today, location: 'placard' })).toHaveLength(1);
    expect(queryInventory(items, { today, search: 'epin' }).map((r) => r.item.name)).toEqual(['Épinards']);
    expect(queryInventory(items, { today, search: 'CREME' })).toHaveLength(1);
  });
  it('compte par emplacement', () => {
    expect(countByLocation(items)).toEqual({ frigo: 3, congelo: 0, placard: 1 });
  });
});

describe('durées par défaut', () => {
  it('dépendent de la catégorie et de l’emplacement', () => {
    expect(defaultShelfDays('viande', 'frigo')).toBe(3);
    expect(defaultShelfDays('viande', 'congelo')).toBe(120);
    expect(defaultExpiry('poisson', 'frigo', today)).toEqual(addDays(today, 2));
    expect(defaultShelfDays('inconnue', 'frigo')).toBe(7);
  });
});

describe('produit entamé', () => {
  it('raccourcit la date (crème fraîche ouverte : 3 jours)', () => {
    const r = openItem(item({ category: 'laitier', expiresAt: addDays(today, 10) }), today);
    expect(r.expiresAt).toEqual(addDays(today, 3));
    expect(r.openedAt).not.toBeNull();
  });
  it('ne rallonge jamais la date', () => {
    const r = openItem(item({ category: 'laitier', expiresAt: addDays(today, 1) }), today);
    expect(r.expiresAt).toEqual(addDays(today, 1));
  });
  it('ne change rien si déjà entamé', () => {
    const opened = addDays(today, -2);
    const i = item({ category: 'laitier', openedAt: opened });
    expect(openItem(i, today)).toEqual({ openedAt: opened, expiresAt: i.expiresAt });
  });
});

describe('congélation', () => {
  it('propose une prolongation selon la catégorie', () => {
    const r = freezerExtension(item({ category: 'viande', expiresAt: addDays(today, 1) }), today);
    expect(r?.days).toBe(120);
    expect(formatDuration(r!.days)).toBe('4 mois');
  });
  it('rien pour les catégories qui ne se congèlent pas, ou déjà au congélo', () => {
    expect(freezerExtension(item({ category: 'oeufs' }), today)).toBeNull();
    expect(freezerExtension(item({ category: 'viande', location: 'congelo' }), today)).toBeNull();
  });
});

describe('consommation partielle', () => {
  it('calcule ce qui est consommé', () => {
    expect(consumePartially({ quantity: 4 }, 3)).toEqual({ remaining: 3, consumed: 1, finished: false });
    expect(consumePartially({ quantity: 1 }, 0.5)).toEqual({ remaining: 0.5, consumed: 0.5, finished: false });
    expect(consumePartially({ quantity: 1 }, 0).finished).toBe(true);
    expect(consumePartially({ quantity: 2 }, 5).remaining).toBe(2);
  });
});

describe('formatQuantity', () => {
  it.each([
    [2, 'filet', '2 filets'],
    [300, 'g', '300 g'],
    [0.5, 'pot', '½ pot'],
    [1.5, 'L', '1½ L'],
    [1, 'pièce', '1'],
    [3, 'pièce', '3 pièces'],
    [20, 'cl', '20 cl'],
  ])('%p %s → %s', (q, u, expected) => {
    expect(formatQuantity(q, u)).toBe(expected);
  });
});

describe('formatDuration', () => {
  it.each([[3, '3 j'], [14, '2 sem.'], [60, '2 mois']])('%i → %s', (d, s) => expect(formatDuration(d)).toBe(s));
});

describe('Congèle-le !', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { freezeCandidates } = require('@/domain/inventory');
  const today = new Date(2026, 10, 26, 10);
  const mk = (name: string, category: string, days: number, location = 'frigo', status = 'en_stock') => ({
    id: name, name, category, quantity: 1, unit: 'pièce', location, dateType: 'DLC', status,
    expiresAt: new Date(2026, 10, 26 + days, 12), addedAt: today, openedAt: null,
  });
  it('propose les produits congelables qui arrivent à date, le plus pressé d’abord', () => {
    const list = freezeCandidates([
      mk('Steak haché', 'viande', 1),
      mk('Poulet', 'viande', 0),
      mk('Yaourts', 'laitier', 0),
      mk('Pain', 'boulangerie', 5),
      mk('Saucisses', 'viande', 1, 'congelo'),
      mk('Jambon', 'viande', -1),
      mk('Lardons', 'viande', 1, 'frigo', 'consomme'),
    ], today);
    expect(list.map((c: { item: { name: string } }) => c.item.name)).toEqual(['Poulet', 'Yaourts', 'Steak haché']);
    expect(list[2].days).toBeGreaterThan(60);
  });
});
