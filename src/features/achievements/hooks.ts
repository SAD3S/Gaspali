import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { dailyActivityQuery } from '@/db/inventoryRepo';
import { computeBadges, wasteFreeStreak, weeklyChallenge, type Badge, type Challenge, type Streak } from '@/domain/achievements';
import { useAllRecipes, usePlan } from '@/features/recipes/hooks';

/** « 2026-11-26 » → midi ce jour-là (heure locale), pour rester dans le bon jour. */
const noonOf = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12);
};

export interface Achievements {
  streak: Streak;
  challenge: Challenge;
  badges: Badge[];
  unlocked: number;
  /** L'historique est chargé (avant : tout vaut zéro). */
  ready: boolean;
}

/** Série, défi de la semaine et badges du foyer, à jour en direct. */
export function useAchievements(): Achievements {
  // Résumé par jour calculé par la base : léger même après des mois d'utilisation.
  const { data, updatedAt } = useLiveQuery(dailyActivityQuery());
  const plan = usePlan();
  const recipes = useAllRecipes();
  const personal = recipes.filter((r) => r.source !== 'base').length;
  // Change de jour : recalcul au moins une fois par heure via la clé.
  const hour = Math.floor(Date.now() / 3600000);
  return useMemo(() => {
    const events = (data ?? []).map((r) => ({ type: r.type, category: 'autre', value: Number(r.value), count: Number(r.count), createdAt: noonOf(r.day) }));
    const input = { events, meals: plan, personalRecipes: personal, now: new Date() };
    const badges = computeBadges(input);
    return { streak: wasteFreeStreak(input.events, input.now), challenge: weeklyChallenge(input), badges, unlocked: badges.filter((b) => b.unlocked).length, ready: updatedAt !== undefined };
  }, [data, plan, personal, hour, updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
}
