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

describe('résumé par jour', () => {
  it('donne les mêmes badges et le même défi qu’un événement par action', () => {
    const events: AchievementEvent[] = [ev('ajout', at(2026, 10, 1))];
    for (let i = 0; i < 12; i++) events.push(ev('consomme', at(2026, 10, 5 + (i % 5))));
    events.push(ev('jete', at(2026, 11, 3)));
    // Même historique résumé : une ligne par jour et par type, avec le nombre et la valeur totale.
    const byDay = new Map<string, AchievementEvent>();
    for (const e of events) {
      const k = `${e.createdAt.toDateString()}|${e.type}`;
      const cur = byDay.get(k);
      byDay.set(k, cur ? { ...cur, count: (cur.count ?? 1) + 1, value: (cur.value ?? 0) + (e.value ?? 0) } : { ...e, count: 1 });
    }
    const summary = [...byDay.values()];
    const now = at(2026, 11, 25);
    const a = computeBadges({ events, meals: [], personalRecipes: 0, now });
    const b = computeBadges({ events: summary, meals: [], personalRecipes: 0, now });
    expect(b).toEqual(a);
    expect(wasteFreeStreak(summary, now)).toEqual(wasteFreeStreak(events, now));
    expect(weeklyChallenge({ events: summary, meals: [], personalRecipes: 0, now })).toEqual(weeklyChallenge({ events, meals: [], personalRecipes: 0, now }));
  });
});
