import { matchScore, searchList } from '@/domain/search';

describe('recherche globale', () => {
  it('trouve sans accents, mot par mot, y compris dans les détails', () => {
    expect(matchScore('creme ep', 'Crème fraîche épaisse')).toBeGreaterThan(0);
    expect(matchScore('epinards', 'Gratin poulet', 'poulet épinards crème')).toBe(1);
    expect(matchScore('xyz', 'Crème')).toBe(0);
    expect(matchScore('', 'Crème')).toBe(0);
  });
  it('classe le début du nom en premier', () => {
    const list = ['Gratin de courgettes', 'Courgettes', 'Soupe'];
    expect(searchList(list, 'courg', (t) => [t])).toEqual(['Courgettes', 'Gratin de courgettes']);
  });
});
