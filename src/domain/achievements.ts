import { addDays, daysBetween, startOfDay } from './dates';
import { eventValue } from './stats';

/**
 * Défis, série et badges : tout est déduit de l'historique du foyer (événements, planning,
 * recettes), donc partagé entre les téléphones sans rien stocker de plus.
 */
export interface AchievementEvent {
  type: string;
  category: string;
  value: number | null;
  createdAt: Date;
  deletedAt?: Date | null;
  detail?: string | null;
}

export interface AchievementInput {
  events: AchievementEvent[];
  /** Repas du planning : date « 2026-11-24 » et fait ou non. */
  meals: { date: string; done: boolean }[];
  personalRecipes: number;
  now?: Date;
}

/** Produit utilisé (en entier ou en partie) : un geste anti-gaspi. */
const isUse = (e: AchievementEvent) => e.type === 'consomme' || e.type === 'partiel';
const live = (events: AchievementEvent[]) => events.filter((e) => !e.deletedAt && e.detail !== 'demo');

/** Lundi 0 h de la semaine de `d`. */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() + 6) % 7));
}

const parseDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};

// ─── Série ───────────────────────────────────────────────────────────────────

export interface Streak {
  /** Jours d'affilée sans rien jeter, jusqu'à aujourd'hui (0 si jeté aujourd'hui). */
  current: number;
  best: number;
  /** Aucune activité encore : pas de série à afficher. */
  started: boolean;
}

/** Série de jours sans gaspillage, comptée depuis le premier jour d'utilisation. */
export function wasteFreeStreak(events: AchievementEvent[], now: Date = new Date()): Streak {
  const list = live(events);
  if (!list.length) return { current: 0, best: 0, started: false };
  const first = startOfDay(new Date(Math.min(...list.map((e) => e.createdAt.getTime()))));
  const wasteDays = [...new Set(list.filter((e) => e.type === 'jete').map((e) => startOfDay(e.createdAt).getTime()))].sort((a, b) => a - b);
  const today = startOfDay(now);
  // Chaque intervalle entre deux jours de gâchis est une série ; la dernière court jusqu'à aujourd'hui.
  let best = 0;
  let from = first;
  for (const w of wasteDays) {
    best = Math.max(best, daysBetween(from, new Date(w)));
    from = addDays(new Date(w), 1);
  }
  const current = Math.max(0, daysBetween(from, today) + 1);
  return { current, best: Math.max(best, current), started: true };
}

// ─── Défi de la semaine ──────────────────────────────────────────────────────

export type ChallengeId = 'zero-gachis' | 'utilise-10' | 'cuisine-3' | 'economise-15';

export interface Challenge {
  id: ChallengeId;
  title: string;
  description: string;
  /** Avancement : current / target (pour « zéro gâchis », jours passés sans jeter / 7). */
  current: number;
  target: number;
  done: boolean;
  /** Raté pour cette semaine (zéro gâchis après un produit jeté). */
  failed: boolean;
  daysLeft: number;
  /** « 6 / 10 produits », « 4 jours sur 7 » */
  progressLabel: string;
}

const ROTATION: ChallengeId[] = ['zero-gachis', 'utilise-10', 'cuisine-3', 'economise-15'];

/** Numéro de semaine depuis une date fixe : le défi change chaque lundi, le même sur tous les téléphones. */
function weekIndex(monday: Date): number {
  return Math.round((monday.getTime() - new Date(2024, 0, 1).getTime()) / (7 * 86400000));
}

export function weeklyChallenge(input: AchievementInput): Challenge {
  const now = input.now ?? new Date();
  const monday = startOfWeek(now);
  const next = addDays(monday, 7);
  const daysLeft = daysBetween(startOfDay(now), next);
  const week = live(input.events).filter((e) => e.createdAt >= monday && e.createdAt < next);
  const id = ROTATION[((weekIndex(monday) % ROTATION.length) + ROTATION.length) % ROTATION.length]!;
  const base = { id, daysLeft, failed: false };

  if (id === 'zero-gachis') {
    const wasted = week.some((e) => e.type === 'jete');
    const elapsed = Math.min(7, daysBetween(monday, startOfDay(now)) + 1);
    const daysOk = wasted ? 0 : elapsed;
    return {
      ...base,
      title: 'Semaine zéro gâchis',
      description: 'Ne jette aucun produit de toute la semaine.',
      current: daysOk,
      target: 7,
      done: !wasted && elapsed === 7,
      failed: wasted,
      progressLabel: wasted ? 'Un produit a été jeté : retente la semaine prochaine' : `${daysOk} jour${daysOk > 1 ? 's' : ''} sur 7`,
    };
  }
  if (id === 'utilise-10') {
    const n = week.filter(isUse).length;
    return { ...base, title: 'Finis 10 produits', description: 'Consomme 10 produits de ton inventaire cette semaine.', current: Math.min(n, 10), target: 10, done: n >= 10, progressLabel: `${Math.min(n, 10)} / 10 produits` };
  }
  if (id === 'cuisine-3') {
    const n = input.meals.filter((m) => m.done && parseDay(m.date) >= monday && parseDay(m.date) < next).length;
    return { ...base, title: 'Cuisine 3 repas prévus', description: 'Planifie tes repas et cuisine-en 3 cette semaine.', current: Math.min(n, 3), target: 3, done: n >= 3, progressLabel: `${Math.min(n, 3)} / 3 repas` };
  }
  const saved = Math.round(week.filter(isUse).reduce((s, e) => s + eventValue(e), 0));
  return { ...base, title: 'Sauve 15 € de courses', description: 'Utilise pour 15 € de produits avant qu’ils ne se perdent.', current: Math.min(saved, 15), target: 15, done: saved >= 15, progressLabel: `${Math.min(saved, 15)} € / 15 €` };
}

// ─── Badges ──────────────────────────────────────────────────────────────────

export type BadgeTier = 'bronze' | 'argent' | 'or';
export type BadgeIcon = 'sprout' | 'leaf' | 'trophy' | 'flame' | 'calendar' | 'chef' | 'book' | 'piggy' | 'star' | 'snowflake';

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: BadgeIcon;
  tier: BadgeTier;
  current: number;
  target: number;
  unlocked: boolean;
}

/** Meilleure semaine passée : au moins 5 produits utilisés et aucun jeté. */
function perfectWeeks(events: AchievementEvent[], now: Date): number {
  const weeks = new Map<number, { use: number; waste: number }>();
  for (const e of events) {
    const k = startOfWeek(e.createdAt).getTime();
    const w = weeks.get(k) ?? { use: 0, waste: 0 };
    if (isUse(e)) w.use++;
    if (e.type === 'jete') w.waste++;
    weeks.set(k, w);
  }
  const thisWeek = startOfWeek(now).getTime();
  return [...weeks.entries()].filter(([k, w]) => k < thisWeek && w.use >= 5 && w.waste === 0).length;
}

/** Meilleur mois : part des produits sauvés (au moins 10 produits terminés). */
function bestMonthPct(events: AchievementEvent[]): number {
  const months = new Map<string, { use: number; waste: number }>();
  for (const e of events) {
    const k = `${e.createdAt.getFullYear()}-${e.createdAt.getMonth()}`;
    const m = months.get(k) ?? { use: 0, waste: 0 };
    if (e.type === 'consomme') m.use++;
    if (e.type === 'jete') m.waste++;
    months.set(k, m);
  }
  let best = 0;
  for (const m of months.values()) if (m.use + m.waste >= 10) best = Math.max(best, Math.round((m.use / (m.use + m.waste)) * 100));
  return best;
}

export function computeBadges(input: AchievementInput): Badge[] {
  const now = input.now ?? new Date();
  const events = live(input.events);
  const added = events.filter((e) => e.type === 'ajout').length;
  const used = events.filter(isUse).length;
  const savedValue = Math.round(events.filter(isUse).reduce((s, e) => s + eventValue(e), 0));
  const cooked = input.meals.filter((m) => m.done).length;
  const streak = wasteFreeStreak(input.events, now);
  const plannedWeeks = new Map<number, number>();
  for (const m of input.meals) {
    const k = startOfWeek(parseDay(m.date)).getTime();
    plannedWeeks.set(k, (plannedWeeks.get(k) ?? 0) + 1);
  }
  const bestPlannedWeek = Math.max(0, ...plannedWeeks.values());

  const b = (id: string, title: string, description: string, icon: BadgeIcon, tier: BadgeTier, current: number, target: number): Badge => ({
    id, title, description, icon, tier, current: Math.min(current, target), target, unlocked: current >= target,
  });
  return [
    b('premier-pas', 'Premier pas', 'Ajoute ton premier produit.', 'sprout', 'bronze', added, 1),
    b('sauveur-10', 'Sauveur', 'Finis 10 produits au lieu de les jeter.', 'leaf', 'bronze', used, 10),
    b('sauveur-50', 'Super-sauveur', 'Finis 50 produits.', 'leaf', 'argent', used, 50),
    b('sauveur-200', 'Héros anti-gaspi', 'Finis 200 produits.', 'trophy', 'or', used, 200),
    b('serie-7', 'Une semaine nette', '7 jours d’affilée sans rien jeter.', 'flame', 'bronze', streak.best, 7),
    b('serie-30', 'Un mois net', '30 jours d’affilée sans rien jeter.', 'flame', 'or', streak.best, 30),
    b('semaine-parfaite', 'Semaine parfaite', 'Une semaine avec 5 produits finis et zéro jeté.', 'star', 'argent', perfectWeeks(events, now), 1),
    b('mois-exemplaire', 'Mois exemplaire', 'Un mois avec 90 % des produits sauvés (10 produits au moins).', 'trophy', 'or', bestMonthPct(events), 90),
    b('economie-50', 'Petit cochon', 'Sauve 50 € de courses.', 'piggy', 'argent', savedValue, 50),
    b('organise', 'Organisé', 'Planifie 5 repas dans la même semaine.', 'calendar', 'bronze', bestPlannedWeek, 5),
    b('chef', 'Chef du frigo', 'Cuisine 10 repas de ton planning.', 'chef', 'argent', cooked, 10),
    b('createur', 'Créateur', 'Ajoute ta première recette perso.', 'book', 'bronze', input.personalRecipes, 1),
  ];
}
