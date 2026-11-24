import { addDays } from '@/domain/dates';
import type { Item } from '@/domain/inventory';
import { DEFAULT_NOTIFICATION_SETTINGS, formatTime, joinNames, planNotifications } from '@/domain/notifications';
import { eventValue, formatEuros, periodStats, startOfMonth } from '@/domain/stats';

const morning = new Date(2026, 10, 13, 9, 0); // vendredi 13 novembre, 9 h

function item(name: string, days: number, over: Partial<Item> = {}): Item {
  return {
    id: name, name, category: 'autre', quantity: 1, unit: 'pièce', location: 'frigo', dateType: 'DLC',
    expiresAt: addDays(morning, days), addedAt: morning, openedAt: null, status: 'en_stock', ...over,
  };
}

describe('planNotifications', () => {
  const items = [item('Blanc de poulet', 0), item('Crème fraîche', 1), item('Épinards frais', 3), item('Comté', 12)];

  it('une seule notification par jour, à l’heure réglée', () => {
    const plan = planNotifications(items, DEFAULT_NOTIFICATION_SETTINGS, morning);
    const days = plan.map((p) => p.id);
    expect(new Set(days).size).toBe(days.length);
    expect(plan[0]!.date).toEqual(new Date(2026, 10, 13, 18, 0));
  });

  it('résume les produits à consommer d’ici demain', () => {
    const [today] = planNotifications(items, DEFAULT_NOTIFICATION_SETTINGS, morning);
    expect(today).toMatchObject({
      id: 'digest-2026-11-13',
      title: '2 produits à consommer d’ici demain',
      body: 'Aujourd’hui : Blanc de poulet. Demain : Crème fraîche.',
      itemIds: ['Blanc de poulet', 'Crème fraîche'],
    });
  });

  it('prévoit les jours suivants d’après les dates', () => {
    const plan = planNotifications(items, DEFAULT_NOTIFICATION_SETTINGS, morning);
    // 14 nov : crème (J) ; 15 : épinards (demain) ; 16 : épinards (J) ; puis plus rien jusqu’au comté
    expect(plan.map((p) => p.id)).toEqual(['digest-2026-11-13', 'digest-2026-11-14', 'digest-2026-11-15', 'digest-2026-11-16']);
    expect(plan[2]!.title).toBe('1 produit à consommer d’ici demain');
  });

  it('pas de notification aujourd’hui si l’heure est passée', () => {
    const evening = new Date(2026, 10, 13, 19, 0);
    expect(planNotifications(items, DEFAULT_NOTIFICATION_SETTINGS, evening)[0]!.id).toBe('digest-2026-11-14');
  });

  it('ignore les produits périmés, consommés, ou loin de leur date', () => {
    const plan = planNotifications(
      [item('Vieux yaourt', -2), item('Mangé', 0, { status: 'consomme' }), item('Pâtes', 200)],
      DEFAULT_NOTIFICATION_SETTINGS,
      morning,
    );
    expect(plan).toEqual([]);
  });

  it('veille de DLC seule (rappel quotidien désactivé)', () => {
    const plan = planNotifications(
      [item('Crème fraîche', 1), item('Biscuits', 1, { dateType: 'DDM' }), item('Poulet', 0)],
      { ...DEFAULT_NOTIFICATION_SETTINGS, dailyEnabled: false },
      morning,
      1,
    );
    expect(plan).toEqual([expect.objectContaining({ title: 'DLC demain', body: 'Crème fraîche : à consommer au plus tard demain.' })]);
  });

  it('rien si tout est désactivé', () => {
    expect(planNotifications(items, { ...DEFAULT_NOTIFICATION_SETTINGS, dailyEnabled: false, dlcEveEnabled: false }, morning)).toEqual([]);
  });

  it('formate les listes et l’heure', () => {
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames(['A', 'B'])).toBe('A et B');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B et C');
    expect(joinNames(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C et 2 autres');
    expect(formatTime(8, 5)).toBe('08:05');
  });
});

describe('statistiques du mois', () => {
  const now = new Date(2026, 10, 24);
  const ev = (type: string, day: number, value: number | null = null, category = 'laitier') => ({
    type, category, value, createdAt: new Date(2026, 10, day),
  });

  it('calcule la part sauvée et le montant jeté', () => {
    const s = periodStats(
      [ev('consomme', 2), ev('consomme', 5), ev('consomme', 9), ev('jete', 10, 1.4), ev('ajout', 1), ev('partiel', 3)],
      startOfMonth(now),
    );
    expect(s).toEqual({ consumed: 3, discarded: 1, savedPct: 75, wastedValue: 1.4, wastedEstimated: false });
  });

  it('estime la valeur quand le prix est inconnu', () => {
    expect(eventValue({ value: null, category: 'viande' })).toBe(5);
    expect(eventValue({ value: null, category: 'inconnue' })).toBe(2.5);
    const s = periodStats([ev('jete', 4, null, 'viande')], startOfMonth(now));
    expect(s).toMatchObject({ wastedValue: 5, wastedEstimated: true, savedPct: 0 });
  });

  it('ignore le mois précédent et les événements annulés', () => {
    const s = periodStats(
      [{ ...ev('jete', 1), createdAt: new Date(2026, 9, 30) }, { ...ev('consomme', 3), deletedAt: new Date() }],
      startOfMonth(now),
    );
    expect(s.savedPct).toBeNull();
  });

  it('formate les euros', () => {
    expect(formatEuros(4.8)).toBe('4,80 €');
  });
});
