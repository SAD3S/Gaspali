import { monthRecap } from '@/domain/recap';

const ev = (type: string, day: number, category = 'laitier', value: number | null = 2) => ({ type, category, value, createdAt: new Date(2026, 10, day, 12) });

describe('bilan du mois', () => {
  it('compte ce qui a été sauvé, jeté, l’argent et le CO₂', () => {
    const events = [
      ev('consomme', 2), ev('consomme', 3, 'viande', 6), ev('partiel', 5), ev('jete', 10, 'fruits', 1.5),
      ev('consomme', 31, 'laitier'), // 1er décembre : hors du mois (31 novembre n'existe pas)
      { ...ev('consomme', 4), deletedAt: new Date() },
      ev('consomme', 1, 'laitier', null), // prix estimé : 1,80 € pour un produit laitier
    ];
    const r = monthRecap(events, new Date(2026, 10, 1), new Date(2026, 10, 27, 18));
    expect(r.label).toBe('novembre 2026');
    expect(r.saved).toBe(4);
    expect(r.savedValue).toBe(11.8);
    expect(r.wasted).toBe(1);
    expect(r.savedPct).toBe(75); // 3 consommés sur 4 terminés
    expect(r.wasteFreeDays).toBe(26); // 27 jours écoulés, 1 jour avec du gâchis
    expect(r.co2Kg).toBe(6.8); // 0,6 × 3 + 5
    expect(r.carKm).toBe(34);
    expect(r.topSaved).toBe('Produits laitiers');
  });
  it('mois vide', () => {
    const r = monthRecap([], new Date(2026, 9, 1), new Date(2026, 10, 27));
    expect(r.savedPct).toBeNull();
    expect(r.daysCounted).toBe(31);
  });
});
