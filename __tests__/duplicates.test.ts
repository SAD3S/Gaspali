import { alreadyInStock, alreadyMessage } from '@/domain/duplicates';

const today = new Date(2026, 10, 27, 10);
const item = (name: string, days: number, over: Record<string, unknown> = {}) => ({
  id: name + days, name, category: 'laitier', quantity: 1, unit: 'pièce', location: 'frigo' as const, dateType: 'DLC' as const,
  expiresAt: new Date(2026, 10, 27 + days, 12), addedAt: today, openedAt: null, status: 'en_stock' as const, row: { productId: null as string | null }, ...over,
});

describe('Déjà au frigo !', () => {
  const stock = [item('Crème fraîche épaisse', 5), item('Crème fraîche', 1), item('Lait demi-écrémé', 3), item('Beurre', 2, { status: 'consomme' })];
  it('retrouve le même produit, même sous un autre nom', () => {
    expect(alreadyInStock(stock, { name: 'crème fraiche' }).map((i) => i.name)).toEqual(['Crème fraîche', 'Crème fraîche épaisse']);
    expect(alreadyInStock(stock, { name: 'Lait', ingredientId: 'lait' }).map((i) => i.name)).toEqual(['Lait demi-écrémé']);
    expect(alreadyInStock(stock, { name: 'Beurre' })).toEqual([]);
    expect(alreadyInStock(stock, { name: 'Tomates' })).toEqual([]);
    expect(alreadyInStock([item('Yop fraise', 4, { row: { productId: 'p1' } })], { name: 'Autre nom', productId: 'p1' })).toHaveLength(1);
  });
  it('rédige le message', () => {
    expect(alreadyMessage([item('Crème fraîche', 1)], today)).toBe('Tu as déjà : Crème fraîche (périme demain), à finir d’abord');
    expect(alreadyMessage([item('Lait', 8)], today)).toBe('Tu as déjà : Lait (périme dans 8 j)');
    expect(alreadyMessage(alreadyInStock(stock, { name: 'crème fraiche' }), today)).toBe('Tu en as déjà 2, dont Crème fraîche qui périme demain');
    expect(alreadyMessage([], today)).toBeNull();
  });
});
