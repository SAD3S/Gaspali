import { computeBadges, startOfWeek, wasteFreeStreak, weeklyChallenge, type AchievementEvent } from '@/domain/achievements';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
const ev = (type: string, date: Date, value: number | null = 2): AchievementEvent => ({ type, category: 'laitier', value, createdAt: date });

describe('série sans gaspillage', () => {
  it('compte depuis le premier jour d’utilisation, et repart après un produit jeté', () => {
    const events = [ev('ajout', at(2026, 11, 1)), ev('jete', at(2026, 11, 10)), ev('consomme', at(2026, 11, 20))];
    const s = wasteFreeStreak(events, at(2026, 11, 25));
    expect(s.current).toBe(15); // du 11 au 25 inclus
    expect(s.best).toBe(15);
    expect(wasteFreeStreak(events, at(2026, 11, 12)).current).toBe(2);
    // Avant : 1er → 9 novembre = 9 jours.
    expect(wasteFreeStreak(events.slice(0, 2), at(2026, 11, 10)).best).toBe(9);
    expect(wasteFreeStreak(events.slice(0, 2), at(2026, 11, 10)).current).toBe(0);
  });
  it('ignore les événements annulés et les données de démo', () => {
    expect(wasteFreeStreak([{ ...ev('jete', at(2026, 11, 1)), deletedAt: at(2026, 11, 1) }], at(2026, 11, 3)).started).toBe(false);
    expect(wasteFreeStreak([{ ...ev('jete', at(2026, 11, 1)), detail: 'demo' }], at(2026, 11, 3)).started).toBe(false);
  });
});

describe('défi de la semaine', () => {
  it('change chaque lundi et suit l’avancement', () => {
    const ids = new Set([0, 7, 14, 21].map((d) => weeklyChallenge({ events: [], meals: [], personalRecipes: 0, now: at(2026, 11, 23 + d) }).id));
    expect(ids.size).toBe(4);
    expect(startOfWeek(at(2026, 11, 25)).getDate()).toBe(23); // mercredi → lundi 23
  });
  it('zéro gâchis : raté dès qu’un produit est jeté', () => {
    // Trouve une semaine « zéro gâchis ».
    let now = at(2026, 11, 25);
    while (weeklyChallenge({ events: [], meals: [], personalRecipes: 0, now }).id !== 'zero-gachis') now = new Date(now.getTime() + 7 * 86400000);
    const ok = weeklyChallenge({ events: [], meals: [], personalRecipes: 0, now });
    expect(ok.current).toBe(3); // lundi → mercredi
    expect(ok.failed).toBe(false);
    const ko = weeklyChallenge({ events: [ev('jete', now)], meals: [], personalRecipes: 0, now });
    expect(ko.failed).toBe(true);
    expect(ko.current).toBe(0);
  });
});

describe('badges', () => {
  it('se débloquent avec l’historique du foyer', () => {
    const events: AchievementEvent[] = [ev('ajout', at(2026, 10, 1))];
    for (let i = 0; i < 12; i++) events.push(ev('consomme', at(2026, 10, 5 + (i % 5))));
    const meals = [1, 2, 3, 4, 5].map((d) => ({ date: `2026-11-0${d + 1}`, done: d < 3 }));
    const badges = computeBadges({ events, meals, personalRecipes: 1, now: at(2026, 11, 25) });
    const get = (id: string) => badges.find((b) => b.id === id)!;
    expect(get('premier-pas').unlocked).toBe(true);
    expect(get('sauveur-10').unlocked).toBe(true);
    expect(get('sauveur-50')).toMatchObject({ unlocked: false, current: 12, target: 50 });
    expect(get('semaine-parfaite').unlocked).toBe(true);
    expect(get('mois-exemplaire').unlocked).toBe(true); // 12 consommés, 0 jeté en octobre
    expect(get('organise').unlocked).toBe(true);
    expect(get('createur').unlocked).toBe(true);
    expect(get('chef')).toMatchObject({ unlocked: false, current: 2 });
  });
});
