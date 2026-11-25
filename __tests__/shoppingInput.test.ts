import { parseShoppingInput } from '@/domain/shoppingInput';
import { categoryFromKeywords } from '@/domain/receiptMatch';

describe('saisie d’un article de courses', () => {
  it.each([
    ['5 jus de pomme', 'Jus de pomme', 5, null],
    ['500 g de farine', 'Farine', 500, 'g'],
    ['2kg pommes de terre', 'Pommes de terre', 2, 'kg'],
    ['1,5 L lait', 'Lait', 1.5, 'L'],
    ['x3 yaourts', 'Yaourts', 3, null],
    ['3x yaourts', 'Yaourts', 3, null],
    ['yaourts x4', 'Yaourts', 4, null],
    ['lait 2 L', 'Lait', 2, 'L'],
    ['tomates', 'Tomates', null, null],
    ['eau', 'Eau', null, null],
    ['7up', '7up', null, null],
  ])('« %s »', (text, name, quantity, unit) => {
    expect(parseShoppingInput(text)).toEqual({ name, quantity, unit });
  });

  it('devine la catégorie par mots-clés', () => {
    expect(categoryFromKeywords('Jus de pomme')).toBe('boissons');
    expect(categoryFromKeywords('Pommes de terre')).toBe('legumes');
    expect(categoryFromKeywords('Lessive')).toBeNull();
  });
});
