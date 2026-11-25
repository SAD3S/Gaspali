/** Utilitaires de dates en jours calendaires locaux (pas d'heures, pas de fuseau). */

const DAY_MS = 24 * 60 * 60 * 1000;

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Nombre de jours entre aujourd'hui et `target` (négatif si passé). */
export function daysBetween(today: Date, target: Date): number {
  return Math.round((startOfDay(target).getTime() - startOfDay(today).getTime()) / DAY_MS);
}

export function addDays(d: Date, n: number): Date {
  const r = startOfDay(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = startOfDay(d);
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, last));
  return r;
}

/** « vendredi 20 novembre » */
export function formatLongDate(d: Date): string {
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

/** « 12 nov. » */
export function formatShortDate(d: Date): string {
  const short = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${d.getDate()} ${short[d.getMonth()]}`;
}

/** « Vendredi 13 novembre » (en-tête de l'accueil) */
export function formatHeaderDate(d: Date): string {
  const s = formatLongDate(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Libellé relatif : « Aujourd'hui », « Demain », « Dans 3 j », « Hier », « Il y a 2 j ». */
export function relativeDayLabel(days: number): string {
  if (days === 0) return 'Aujourd’hui';
  if (days === 1) return 'Demain';
  if (days === -1) return 'Hier';
  if (days > 1) return `Dans ${days} j`;
  return `Il y a ${-days} j`;
}

export type DateShortcut = '+3j' | '+1sem' | '+2sem' | '+1mois';

export const DATE_SHORTCUTS: { key: DateShortcut; label: string }[] = [
  { key: '+3j', label: '+3 j' },
  { key: '+1sem', label: '+1 sem.' },
  { key: '+2sem', label: '+2 sem.' },
  { key: '+1mois', label: '+1 mois' },
];

export function applyShortcut(today: Date, s: DateShortcut): Date {
  switch (s) {
    case '+3j': return addDays(today, 3);
    case '+1sem': return addDays(today, 7);
    case '+2sem': return addDays(today, 14);
    case '+1mois': return addMonths(today, 1);
  }
}

/** Grille du mois (semaines commençant le lundi), cases vides = null. */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}
