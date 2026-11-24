import { computeFreshness, urgencyRank } from '@/domain/freshness';
import { addDays, applyShortcut, formatLongDate, relativeDayLabel } from '@/domain/dates';

const today = new Date(2026, 10, 13, 15, 30); // vendredi 13 novembre 2026, après-midi

describe('computeFreshness', () => {
  it.each([
    [0, 'urgent', 'Aujourd’hui'],
    [1, 'urgent', 'Demain'],
    [2, 'urgent', 'Dans 2 j'],
    [3, 'bientot', 'Dans 3 j'],
    [5, 'bientot', 'Dans 5 j'],
    [6, 'frais', 'Dans 6 j'],
    [12, 'frais', 'Dans 12 j'],
  ])('J+%i en DLC → %s (%s)', (d, state, label) => {
    const f = computeFreshness(addDays(today, d), 'DLC', today);
    expect(f.state).toBe(state);
    expect(f.label).toBe(label);
    expect(f.usableInRecipes).toBe(true);
  });

  it('DLC dépassée → périmé, jamais en recette', () => {
    const f = computeFreshness(addDays(today, -1), 'DLC', today);
    expect(f).toMatchObject({ state: 'perime', label: 'Hier', usableInRecipes: false });
    expect(computeFreshness(addDays(today, -2), 'DLC', today).label).toBe('Il y a 2 j');
  });

  it('DDM dépassée → à vérifier, utilisable en recette', () => {
    const f = computeFreshness(addDays(today, -10), 'DDM', today);
    expect(f).toMatchObject({ state: 'a_verifier', label: 'À vérifier', usableInRecipes: true });
  });

  it('DDM non dépassée suit la même échelle que la DLC', () => {
    expect(computeFreshness(addDays(today, 4), 'DDM', today).state).toBe('bientot');
  });

  it('ignore l’heure de la journée', () => {
    const tonight = new Date(2026, 10, 13, 23, 59);
    expect(computeFreshness(tonight, 'DLC', new Date(2026, 10, 13, 0, 1)).daysLeft).toBe(0);
  });

  it('trie le plus pressant en premier', () => {
    const items = [12, -3, 0, 4].map((d) => computeFreshness(addDays(today, d), d === -3 ? 'DDM' : 'DLC', today));
    const sorted = [...items].sort((a, b) => urgencyRank(a) - urgencyRank(b));
    expect(sorted.map((f) => f.state)).toEqual(['a_verifier', 'urgent', 'bientot', 'frais']);
  });
});

describe('dates', () => {
  it('formate en français', () => {
    expect(formatLongDate(addDays(today, 7))).toBe('vendredi 20 novembre');
  });
  it('raccourcis', () => {
    expect(formatLongDate(applyShortcut(today, '+1sem'))).toBe('vendredi 20 novembre');
    expect(applyShortcut(new Date(2026, 0, 31), '+1mois').getDate()).toBe(28);
  });
  it('libellés relatifs', () => {
    expect(relativeDayLabel(-5)).toBe('Il y a 5 j');
  });
});
