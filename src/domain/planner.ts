import { addDays, daysBetween, startOfDay } from './dates';
import { normalizeText, type Item } from './inventory';
import { cookProposals, evaluateRecipe, indexStock, missingIngredients, type EngineContext, type Recipe, type Suggestion } from './recipeEngine';

export type Slot = 'midi' | 'soir';
export const SLOTS: Slot[] = ['midi', 'soir'];
export const SLOT_LABELS: Record<Slot, string> = { midi: 'Midi', soir: 'Soir' };

export interface PlanEntry {
  id: string;
  /** « 2026-11-24 » (jour local) */
  date: string;
  slot: Slot;
  recipeId: string;
  servings: number;
  done: boolean;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** Lundi de la semaine contenant `d`. */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() + 6) % 7));
}

export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Heure de référence d'un créneau (pour savoir s'il est passé). */
export function slotTime(date: string, slot: Slot): Date {
  const d = parseDayKey(date);
  d.setHours(slot === 'midi' ? 12 : 19, 30, 0, 0);
  return d;
}

/**
 * Stock simulé : les quantités déjà promises à des repas sont retirées, et un produit
 * entièrement promis disparaît. Utilisé pour la planification et les réservations.
 */
function withoutUsage(items: Item[], used: Map<string, number>): Item[] {
  return items
    .map((i) => (used.has(i.id) ? { ...i, quantity: Math.max(0, Math.round((i.quantity - used.get(i.id)!) * 100) / 100) } : i))
    .filter((i) => i.quantity > 0.0001);
}

function consume(s: Suggestion, servings: number, basics: Set<string>, used: Map<string, number>): void {
  for (const p of cookProposals(s, servings, basics)) {
    if (!p.exact && p.remaining === p.item.quantity) continue; // quantité inconnue : on ne réserve rien
    used.set(p.item.id, (used.get(p.item.id) ?? 0) + (p.item.quantity - p.remaining));
  }
}

export interface Reservation {
  /** Quantité réservée par des repas à venir. */
  quantity: number;
  /** « jeu. soir » */
  meals: string[];
}

const SHORT_DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/** « ce soir », « demain midi », « jeu. soir » (court, pour les listes). */
export function mealLabel(e: { date: string; slot: Slot }, now: Date = new Date()): string {
  const d = parseDayKey(e.date);
  const n = daysBetween(now, d);
  if (n === 0) return `ce ${e.slot}`;
  if (n === 1) return `demain ${e.slot}`;
  return `${SHORT_DAYS[d.getDay()]} ${e.slot}`;
}

/** « ce soir », « demain midi », « jeudi 26 au soir » (dans une phrase). */
export function mealPhrase(date: string, slot: Slot, now: Date = new Date()): string {
  const d = parseDayKey(date);
  const n = daysBetween(now, d);
  if (n === 0 || n === 1) return mealLabel({ date, slot }, now);
  return `${dayLabel(d, now).toLowerCase()} ${slot === 'soir' ? 'au soir' : 'midi'}`;
}

/**
 * Ingrédients réservés par les repas planifiés à venir (non cuisinés), dans l'ordre chronologique :
 * chaque repas pioche dans ce qui reste après les précédents.
 */
export function computeReservations(
  entries: PlanEntry[],
  recipes: Map<string, Recipe>,
  ctx: EngineContext,
  now: Date = new Date(),
): Map<string, Reservation> {
  const used = new Map<string, number>();
  const out = new Map<string, Reservation>();
  const upcoming = entries
    .filter((e) => !e.done && slotTime(e.date, e.slot) >= startOfDay(now))
    .sort((a, b) => slotTime(a.date, a.slot).getTime() - slotTime(b.date, b.slot).getTime());
  for (const e of upcoming) {
    const recipe = recipes.get(e.recipeId);
    if (!recipe) continue;
    const stock = withoutUsage(ctx.items, used);
    const s = evaluateRecipe(recipe, { ...ctx, items: stock, members: ctx.members.map((m) => ({ ...m, allergens: [] })), today: parseDayKey(e.date) });
    if (!s) continue;
    const before = new Map(used);
    consume(s, e.servings, ctx.basics, used);
    const label = mealLabel(e, now);
    for (const [id, q] of used) {
      const delta = q - (before.get(id) ?? 0);
      if (delta <= 0) continue;
      const r = out.get(id) ?? { quantity: 0, meals: [] };
      r.quantity = Math.round((r.quantity + delta) * 100) / 100;
      if (!r.meals.includes(label)) r.meals.push(label);
      out.set(id, r);
    }
  }
  return out;
}

/** Inventaire diminué des réservations (pour les suggestions de recettes). */
export function availableAfterReservations(items: Item[], reservations: Map<string, Reservation>): Item[] {
  return withoutUsage(items, new Map([...reservations].map(([id, r]) => [id, r.quantity])));
}

const IN_STOCK = new Set(['urgent', 'bientot', 'a_verifier', 'dispo']);

/** Un repas proposé doit utiliser au moins un produit du stock et demander peu d'achats. */
function worthPlanning(s: Suggestion): boolean {
  return s.missing <= 2 && s.checks.some((c) => IN_STOCK.has(c.status));
}

export interface PlannedMeal {
  date: string;
  slot: Slot;
  recipe: Recipe;
  suggestion: Suggestion;
}

/**
 * « Planifier ma semaine anti-gaspi » : remplit les créneaux libres à venir, dans l'ordre
 * chronologique, avec la recette qui sauve le plus de produits à ce moment-là. Les produits
 * utilisés par un repas ne sont plus disponibles pour les suivants ; pas deux fois la même recette.
 */
export function planWeek(params: {
  freeSlots: { date: string; slot: Slot }[];
  existing: PlanEntry[];
  recipes: Recipe[];
  ctx: EngineContext;
  servings: number;
  now?: Date;
}): PlannedMeal[] {
  const now = params.now ?? new Date();
  const byId = new Map(params.recipes.map((r) => [r.id, r]));
  // Le stock de départ tient compte des repas déjà planifiés.
  const used = new Map<string, number>(
    [...computeReservations(params.existing, byId, params.ctx, now)].map(([id, r]) => [id, r.quantity]),
  );
  const alreadyPlanned = new Set(params.existing.map((e) => e.recipeId));
  const slots = [...params.freeSlots]
    .filter((s) => slotTime(s.date, s.slot) > now)
    .sort((a, b) => slotTime(a.date, a.slot).getTime() - slotTime(b.date, b.slot).getTime());
  const out: PlannedMeal[] = [];

  for (const slot of slots) {
    const day = parseDayKey(slot.date);
    const stock = withoutUsage(params.ctx.items, used);
    const ctx = { ...params.ctx, items: stock, today: day };
    const index = indexStock(stock, day);
    let best: Suggestion | null = null;
    for (const r of params.recipes) {
      if (alreadyPlanned.has(r.id)) continue;
      // Desserts et petits-déjeuners : pas pour remplir un repas principal.
      if (r.kind === 'dessert' || r.kind === 'petit-dejeuner' || r.kind === 'gouter') continue;
      const s = evaluateRecipe(r, ctx, index);
      if (!s || !worthPlanning(s)) continue;
      if (!best || s.score > best.score || (s.score === best.score && s.recipe.minutes < best.recipe.minutes)) best = s;
    }
    if (!best) continue;
    out.push({ date: slot.date, slot: slot.slot, recipe: best.recipe, suggestion: best });
    alreadyPlanned.add(best.recipe.id);
    consume(best, params.servings, params.ctx.basics, used);
  }
  return out;
}

/** Créneaux libres à venir d'une semaine. */
export function freeSlotsOfWeek(monday: Date, entries: PlanEntry[], now: Date = new Date()): { date: string; slot: Slot }[] {
  const taken = new Set(entries.map((e) => `${e.date}:${e.slot}`));
  return weekDays(monday)
    .flatMap((d) => SLOTS.map((slot) => ({ date: dayKey(d), slot })))
    .filter((s) => !taken.has(`${s.date}:${s.slot}`) && slotTime(s.date, s.slot) > now);
}

/** « Aujourd'hui », « Demain », « Jeudi 26 » */
export function dayLabel(d: Date, today: Date = new Date()): string {
  const n = daysBetween(today, d);
  if (n === 0) return 'Aujourd’hui';
  if (n === 1) return 'Demain';
  const names = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return `${names[d.getDay()]} ${d.getDate()}`;
}

export interface MissingForPlan {
  label: string;
  ingredientId: string | null;
  quantity: number | null;
  unit: string | null;
  /** Repas concernés (« jeu. soir ») */
  meals: string[];
}

/**
 * Ingrédients à acheter pour les repas planifiés à venir : chaque repas pioche dans ce qui reste
 * après les précédents, donc un produit déjà promis compte comme manquant pour le suivant.
 */
export function missingForPlan(
  entries: PlanEntry[],
  recipes: Map<string, Recipe>,
  ctx: EngineContext,
  now: Date = new Date(),
  /** Ne garder que les manquants de certains repas (les autres comptent quand même dans la simulation). */
  only?: (e: PlanEntry) => boolean,
): MissingForPlan[] {
  const used = new Map<string, number>();
  const out = new Map<string, MissingForPlan>();
  const upcoming = entries
    .filter((e) => !e.done && slotTime(e.date, e.slot) >= startOfDay(now))
    .sort((a, b) => slotTime(a.date, a.slot).getTime() - slotTime(b.date, b.slot).getTime());
  for (const e of upcoming) {
    const recipe = recipes.get(e.recipeId);
    if (!recipe) continue;
    const s = evaluateRecipe(recipe, { ...ctx, items: withoutUsage(ctx.items, used), members: ctx.members.map((m) => ({ ...m, allergens: [] })), today: parseDayKey(e.date) });
    if (!s) continue;
    consume(s, e.servings, ctx.basics, used);
    if (only && !only(e)) continue;
    const meal = mealLabel(e, now);
    for (const m of missingIngredients(s, e.servings)) {
      const key = `${m.ingredientId ?? m.label}|${m.unit ?? ''}`;
      const cur = out.get(key);
      if (cur) {
        cur.quantity = cur.quantity != null && m.quantity != null ? Math.round((cur.quantity + m.quantity) * 100) / 100 : cur.quantity ?? m.quantity;
        if (!cur.meals.includes(meal)) cur.meals.push(meal);
      } else {
        out.set(key, { ...m, meals: [meal] });
      }
    }
  }
  return [...out.values()];
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 23 – 29 nov. », « 30 nov. – 6 déc. » */
export function weekRangeLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const start = monday.getMonth() === sunday.getMonth() ? `${monday.getDate()}` : `${monday.getDate()} ${MONTHS[monday.getMonth()]}`;
  return `${start} – ${sunday.getDate()} ${MONTHS[sunday.getMonth()]}`;
}

/**
 * Retire des manquants ce qui est déjà dans la liste de courses (articles non cochés), pour
 * qu'ajouter deux fois les manquants ne double pas les quantités.
 */
export function subtractShoppingList<T extends { label: string; ingredientId: string | null; quantity: number | null; unit: string | null }>(
  missing: T[],
  list: { name: string; ingredientId: string | null; quantity: number | null; unit: string | null; checked: boolean }[],
): T[] {
  const open = list.filter((r) => !r.checked);
  const out: T[] = [];
  for (const m of missing) {
    const same = open.find((o) => (m.ingredientId ? o.ingredientId === m.ingredientId : normalizeText(o.name) === normalizeText(m.label)));
    if (!same) {
      out.push(m);
      continue;
    }
    // Déjà dans la liste sans quantité comparable : on considère que c'est couvert.
    if (m.quantity == null || same.quantity == null || same.unit !== m.unit) continue;
    const rest = Math.round((m.quantity - same.quantity) * 100) / 100;
    if (rest > 0) out.push({ ...m, quantity: rest });
  }
  return out;
}
