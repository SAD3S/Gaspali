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

describe('décongélation', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { thawPlan, freezerExtension, freezeCandidates } = require('@/domain/inventory');
  const today = new Date(2026, 10, 26, 10);
  const steak = { id: 's', name: 'Steak', category: 'viande', quantity: 1, unit: 'pièce', location: 'congelo', dateType: 'DDM', status: 'en_stock', expiresAt: new Date(2027, 2, 1), addedAt: today, openedAt: null };
  it('date courte en sortant du congélateur : 24 h pour la viande, 2 jours pour le pain', () => {
    expect(thawPlan(steak, today)).toEqual({ expiresAt: new Date(2026, 10, 27), days: 1 });
    expect(thawPlan({ ...steak, category: 'boulangerie' }, today)?.days).toBe(2);
    expect(thawPlan({ ...steak, location: 'frigo' }, today)).toBeNull();
    // Jamais plus loin que la date d'origine.
    expect(thawPlan({ ...steak, expiresAt: new Date(2026, 10, 26, 20) }, today)?.expiresAt).toEqual(new Date(2026, 10, 26, 20));
  });
  it('un produit décongelé ne se recongèle pas', () => {
    const thawed = { ...steak, location: 'frigo', dateType: 'DLC', expiresAt: new Date(2026, 10, 27), thawedAt: today };
    expect(freezerExtension(thawed, today)).toBeNull();
    expect(freezeCandidates([thawed], today)).toEqual([]);
    expect(freezerExtension({ ...thawed, thawedAt: null }, today)).not.toBeNull();
    // DLC dépassée : pas de nouvelle date au congélateur.
    expect(freezerExtension({ ...thawed, thawedAt: null, expiresAt: new Date(2026, 10, 24) }, today)).toBeNull();
  });
});

describe('frise des 7 jours', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { expiryForecast } = require('@/domain/inventory');
  const today = new Date(2026, 10, 27, 10); // vendredi
  const mk = (name: string, days: number, location = 'frigo') => ({
    id: name, name, category: 'laitier', quantity: 1, unit: 'pièce', location, dateType: 'DLC', status: 'en_stock',
    expiresAt: new Date(2026, 10, 27 + days, 12), addedAt: today, openedAt: null,
  });
  it('range chaque produit le jour de sa date ; les dates dépassées tombent aujourd’hui', () => {
    const f = expiryForecast([mk('Lait', 0), mk('Jambon', -2), mk('Yaourt', 1), mk('Comté', 6), mk('Riz', 30), mk('Poisson', 2, 'congelo')], today);
    expect(f.map((d: { short: string }) => d.short)).toEqual(['Auj.', 'Dem.', 'Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.']);
    expect(f[0].items.map((i: { name: string }) => i.name)).toEqual(['Lait', 'Jambon']);
    expect(f[1].items).toHaveLength(1);
    expect(f[2].items).toHaveLength(0); // le poisson est au congélateur
    expect(f[6].items[0].name).toBe('Comté');
    expect(f[0].key).toBe('2026-11-27');
  });
});
