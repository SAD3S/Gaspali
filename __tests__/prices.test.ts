import { finishMessage, itemWorth, moneyPhrase, parsePrice, priceInput, summarizeOpenPrices } from '@/domain/prices';

describe('prix', () => {
  it('lit un prix saisi', () => {
    expect(parsePrice('3,49')).toBe(3.49);
    expect(parsePrice(' 3.5 € ')).toBe(3.5);
    expect(parsePrice('12')).toBe(12);
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('0')).toBeNull();
    expect(priceInput(3.5)).toBe('3,50');
  });

  it('résume les relevés Open Prices (médiane, hors promo, magasin le plus récent)', () => {
    const json = {
      items: [
        { price: 3.29, currency: 'EUR', date: '2026-10-01', location: { osm_name: 'Lidl' } },
        { price: 3.49, currency: 'EUR', date: '2026-11-12', location: { osm_name: 'Carrefour' } },
        { price: 2.1, currency: 'EUR', date: '2026-11-01', price_is_discounted: true },
        { price: 3.99, currency: 'EUR', date: '2026-09-20' },
        { price: 5, currency: 'CHF', date: '2026-11-20' },
        { price: 'oups' },
      ],
      total: 6,
    };
    expect(summarizeOpenPrices(json)).toEqual({ amount: 3.49, label: 'Prix relevés par la communauté · Carrefour' });
    expect(summarizeOpenPrices({ items: [] })).toBeNull();
    expect(summarizeOpenPrices(null)).toBeNull();
  });

  it('phrase les montants', () => {
    expect(moneyPhrase(4.2, false, 'sauve')).toBe('4,20 € sauvés');
    expect(moneyPhrase(5, true, 'perdu')).toBe('≈ 5,00 € perdus');
  });
});

it('valeur d’un produit et message de fin', () => {
  expect(itemWorth({ price: 3.2, category: 'viande' })).toEqual({ value: 3.2, estimated: false });
  expect(itemWorth({ price: null, category: 'viande' })).toEqual({ value: 5, estimated: true });
  expect(finishMessage('Steak haché', 'consomme', { price: 4.2, category: 'viande' })).toBe('Steak haché : consommé · 4,20 € sauvés');
  expect(finishMessage('Yaourts', 'jete', { price: null, category: 'laitier' })).toBe('Yaourts : jeté · ≈ 1,80 € perdus');
});

it('prix au kilo, au litre ou à l’unité', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { unitPriceLabel } = require('@/domain/prices');
  expect(unitPriceLabel(3.1, 2, 250, 'g')).toBe('6,20 €/kg');
  expect(unitPriceLabel(1.5, 1, 1.5, 'L')).toBe('1,00 €/L');
  expect(unitPriceLabel(2.4, 1, 20, 'cl')).toBe('12,00 €/L');
  expect(unitPriceLabel(3, 6, 1, 'pièce')).toBe('0,50 € l’unité');
  expect(unitPriceLabel(3, 1, 1, 'pièce')).toBeNull();
  expect(unitPriceLabel(null, 1, 250, 'g')).toBeNull();
});
