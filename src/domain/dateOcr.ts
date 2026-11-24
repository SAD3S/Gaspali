import { daysBetween, startOfDay } from './dates';
import type { DateType } from './freshness';

/** Date candidate lue sur un emballage. */
export interface DateCandidate {
  date: Date;
  /** Texte d'origine (« 20/11/26 »). */
  raw: string;
  /** Type deviné d'après les mentions voisines, sinon null. */
  dateType: DateType | null;
  /** Plus le score est haut, plus la lecture est fiable. */
  score: number;
}

const MONTHS: Record<string, number> = {
  jan: 0, janv: 0, janvier: 0, fev: 1, fevr: 1, fevrier: 1, mar: 2, mars: 2, avr: 3, avril: 3,
  mai: 4, jun: 5, juin: 5, jui: 6, juil: 6, juillet: 6, aou: 7, aout: 7, sep: 8, sept: 8, septembre: 8,
  oct: 9, octobre: 9, nov: 10, novembre: 10, dec: 11, decembre: 11,
};

const DLC_HINTS = /(a\s*consommer\s*jusqu|dlc|use\s*by)/;
const DDM_HINTS = /(de\s*preference|ddm|dluo|best\s*before|bbe|a\s*consommer\s*de\s*pref)/;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Confusions fréquentes de l'OCR dans les zones de chiffres.
    .replace(/(?<=\d)o(?=[\d./-])|(?<=[\d./-])o(?=\d)/g, '0')
    .replace(/(?<=\d)[il|](?=[\d./-])|(?<=[\d./-])[il|](?=\d)/g, '1');
}

function fullYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

function validDate(y: number, m: number, d: number): Date | null {
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const date = new Date(y, m, d);
  return date.getMonth() === m && date.getDate() === d ? date : null;
}

/** Jour + mois sans année : prochaine occurrence (tolère 30 jours dans le passé). */
function inferYear(today: Date, m: number, d: number): Date | null {
  const y = today.getFullYear();
  for (const year of [y, y + 1]) {
    const date = validDate(year, m, d);
    if (date && daysBetween(today, date) >= -30) return date;
  }
  return null;
}

function lastDayOfMonth(y: number, m: number): Date {
  return new Date(y, m + 1, 0);
}

/**
 * Cherche les dates limites dans le texte OCR d'un emballage.
 * Formats : JJ/MM/AA, JJ/MM/AAAA, JJ.MM.AA, JJ-MM-AAAA, JJ MM AA, JJ MM, MM/AAAA, MM/AA,
 * « 20 NOV 2026 », « NOV 2026 ». Les candidats sont triés du plus probable au moins probable.
 * Le résultat doit toujours être confirmé par l'utilisateur.
 */
export function parsePackageDates(text: string, today: Date = new Date()): DateCandidate[] {
  const t = normalize(text);
  const now = startOfDay(today);
  const found = new Map<number, DateCandidate>();

  const add = (date: Date | null, raw: string, index: number, base: number) => {
    if (!date) return;
    const delta = daysBetween(now, date);
    // Plausible : de 1 an dans le passé à 6 ans dans le futur.
    if (delta < -365 || delta > 6 * 365) return;
    const before = t.slice(Math.max(0, index - 40), index);
    const dateType: DateType | null = DLC_HINTS.test(before) ? 'DLC' : DDM_HINTS.test(before) ? 'DDM' : null;
    let score = base + (dateType ? 3 : 0);
    if (delta < 0) score -= 2; // une date passée est moins probable sur un produit qu'on vient d'acheter
    const key = date.getTime();
    const prev = found.get(key);
    if (!prev || prev.score < score) found.set(key, { date, raw: raw.trim(), dateType: dateType ?? prev?.dateType ?? null, score });
  };

  const sep = '[./\\- ]';
  let m: RegExpExecArray | null;

  // JJ/MM/AAAA ou JJ/MM/AA (séparateurs . / - ou espace)
  const dmy = new RegExp(`(?<!\\d)(\\d{1,2})${sep}(\\d{1,2})${sep}(\\d{4}|\\d{2})(?!\\d)`, 'g');
  const consumed: [number, number][] = [];
  while ((m = dmy.exec(t))) {
    add(validDate(fullYear(Number(m[3])), Number(m[2]) - 1, Number(m[1])), m[0], m.index, m[3]!.length === 4 ? 6 : 5);
    consumed.push([m.index, m.index + m[0].length]);
  }
  const isConsumed = (i: number) => consumed.some(([a, b]) => i >= a && i < b);

  // JJ MOIS AAAA / JJ MOIS AA / JJ MOIS
  const dMonY = /(?<!\d)(\d{1,2})\s*([a-z]{3,9})\.?\s*(\d{4}|\d{2})?(?![\d])/g;
  while ((m = dMonY.exec(t))) {
    const month = MONTHS[m[2]!];
    if (month == null) continue;
    const date = m[3] ? validDate(fullYear(Number(m[3])), month, Number(m[1])) : inferYear(now, month, Number(m[1]));
    add(date, m[0], m.index, m[3] ? 6 : 4);
    consumed.push([m.index, m.index + m[0].length]);
  }

  // MOIS AAAA (fin de mois)
  const monY = /(?<![a-z\d])([a-z]{3,9})\.?\s*(\d{4})(?!\d)/g;
  while ((m = monY.exec(t))) {
    const month = MONTHS[m[1]!];
    if (month == null || isConsumed(m.index)) continue;
    add(lastDayOfMonth(Number(m[2]), month), m[0], m.index, 4);
  }

  // Deux nombres : MM/AAAA, MM/AA (fin de mois) ou JJ/MM (année déduite)
  const two = new RegExp(`(?<![\\d./-])(\\d{1,2})${sep}(\\d{4}|\\d{2})(?![\\d]|${sep}\\d)`, 'g');
  while ((m = two.exec(t))) {
    if (isConsumed(m.index)) continue;
    const a = Number(m[1]);
    const bRaw = m[2]!;
    const b = Number(bRaw);
    if (bRaw.length === 4) {
      if (a >= 1 && a <= 12) add(lastDayOfMonth(b, a - 1), m[0], m.index, 5);
    } else if (b > 12) {
      // 11/27 : mois 11, année 2027
      if (a >= 1 && a <= 12) add(lastDayOfMonth(fullYear(b), a - 1), m[0], m.index, 3);
    } else {
      // 20/11 : jour + mois
      add(inferYear(now, b - 1, a), m[0], m.index, 3);
    }
  }

  return [...found.values()].sort((x, y) => y.score - x.score || x.date.getTime() - y.date.getTime());
}
