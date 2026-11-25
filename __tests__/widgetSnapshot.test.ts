import { buildSnapshot, parseSnapshot, urgentRows } from '@/widgets/snapshot';

const day = (d: number) => new Date(2026, 10, 25 + d, 12);

describe('widgets', () => {
  const snap = buildSnapshot(
    [
      { name: 'Riz', expiresAt: day(200), dateType: 'DDM' },
      { name: 'Yaourts', expiresAt: day(1), dateType: 'DLC' },
      { name: 'Jambon', expiresAt: day(-1), dateType: 'DLC' },
      { name: 'Poulet', expiresAt: day(4), dateType: 'DLC' },
    ],
    [
      { name: 'Pain', quantity: null, unit: null, aisle: 'Boulangerie', checked: false },
      { name: 'Lait', quantity: 2, unit: 'L', aisle: 'Crèmerie', checked: false },
      { name: 'Café', quantity: 1, unit: null, aisle: 'Épicerie', checked: true },
    ],
  );

  it('garde les articles non cochés, rangés par rayon', () => {
    expect(snap.shopping).toEqual([
      { name: 'Pain', detail: null },
      { name: 'Lait', detail: '2 L' },
    ]);
    expect(snap.shoppingTotal).toBe(2);
  });

  it('recalcule les jours restants au moment de l’affichage', () => {
    const rows = urgentRows(parseSnapshot(JSON.stringify(snap)), new Date(2026, 10, 25, 9));
    expect(rows.map((r) => r.name)).toEqual(['Jambon', 'Yaourts', 'Poulet']);
    expect(rows[0]?.state).toBe('perime');
    // Deux jours plus tard, le poulet devient urgent.
    expect(urgentRows(snap, new Date(2026, 10, 27, 9)).find((r) => r.name === 'Poulet')?.state).toBe('urgent');
  });

  it('résiste à des données absentes ou abîmées', () => {
    expect(parseSnapshot(null).items).toEqual([]);
    expect(parseSnapshot('{oups').shopping).toEqual([]);
  });
});

describe('rendu des widgets', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildWidgetTree } = require('react-native-android-widget/lib/commonjs/api/build-widget-tree');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { renderGaspalliWidget, SHOPPING_WIDGET, URGENT_WIDGET } = require('@/widgets/GaspalliWidgets');
  const snap = buildSnapshot([{ name: 'Yaourts', expiresAt: day(1), dateType: 'DLC' }], [
    { name: 'Lait', quantity: 2, unit: 'L', aisle: 'Crèmerie', checked: false },
  ]);
  const text = (tree: unknown) => JSON.stringify(tree);

  it('dessine « à consommer vite » et la liste de courses, en clair et en sombre', () => {
    const urgent = renderGaspalliWidget(URGENT_WIDGET, snap, new Date(2026, 10, 25, 9));
    expect(text(buildWidgetTree(urgent.light))).toContain('Yaourts');
    expect(text(buildWidgetTree(urgent.dark))).toContain('gaspalli://inventaire');
    const shopping = renderGaspalliWidget(SHOPPING_WIDGET, snap);
    expect(text(buildWidgetTree(shopping.light))).toContain('2 L');
    expect(text(buildWidgetTree(renderGaspalliWidget(SHOPPING_WIDGET, buildSnapshot([], [])).light))).toContain('La liste est vide.');
  });
});
