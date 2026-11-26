import { newsMessage, shoppingNews, type ShoppingState } from '@/domain/householdNews';

const row = (id: string, over: Partial<ShoppingState> = {}): ShoppingState => ({ id, name: id, checked: false, deleted: false, addedBy: 'lea', ...over });

describe('nouvelles du foyer (courses)', () => {
  it('signale les ajouts des autres, pas les miens', () => {
    const news = shoppingNews([row('pain')], [row('pain'), row('lait'), row('oeufs'), row('cafe', { addedBy: 'moi' })], 'moi');
    expect(news.added).toEqual([{ by: 'lea', names: ['lait', 'oeufs'] }]);
    expect(news.finished).toBe(false);
  });
  it('« courses faites » quand plus rien n’est à acheter', () => {
    const before = [row('pain'), row('lait', { checked: true })];
    expect(shoppingNews(before, [row('pain', { checked: true }), row('lait', { checked: true })], 'moi').finished).toBe(true);
    expect(shoppingNews(before, [row('pain', { deleted: true }), row('lait', { deleted: true })], 'moi').finished).toBe(true);
    expect(shoppingNews([row('pain', { checked: true })], [row('pain', { checked: true })], 'moi').finished).toBe(false);
  });
  it('rédige le message', () => {
    expect(newsMessage({ by: 'lea', names: ['Lait', 'Pain', 'Œufs', 'Café', 'Thé'] }, 'Léa')).toEqual({
      title: 'Léa a ajouté 5 articles aux courses',
      body: 'Lait, Pain, Œufs et 2 autres',
    });
    expect(newsMessage({ by: null, names: ['Lait'] }, null).title).toBe('Quelqu’un du foyer a ajouté un article aux courses');
  });
});
