/**
 * Durées dans le texte d'une étape (« cuire 25 min », « 1 h 30 », « 10 à 15 minutes ») :
 * chaque durée devient un bouton qui lance un minuteur.
 */
export interface TimerSpan {
  /** Position dans le texte (pour l'afficher comme un bouton). */
  start: number;
  end: number;
  seconds: number;
  /** « 25 min », « 1 h 30 » */
  label: string;
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const RANGE = String.raw`(?:\s*(?:à|a|-|–)\s*${NUM})?`;
const PATTERN = new RegExp(
  String.raw`${NUM}${RANGE}\s*(h|heures?)\s*(\d{1,2})?(?:\s*(?:min|minutes?|mn))?(?![a-zà-ÿ])|${NUM}${RANGE}\s*(min|minutes?|mn|s|sec|secondes?)(?![a-zà-ÿ])`,
  'gi',
);

const toNumber = (s: string) => Number(s.replace(',', '.'));

export function formatTimerLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`;
}

/** Durées trouvées dans une étape. Pour une fourchette (« 10 à 15 min »), on prend le bas : on vérifie, puis on prolonge. */
export function findTimers(text: string): TimerSpan[] {
  const out: TimerSpan[] = [];
  for (const m of text.matchAll(PATTERN)) {
    let seconds: number;
    if (m[3]) {
      seconds = toNumber(m[1]!) * 3600 + (m[4] ? Number(m[4]) * 60 : 0);
    } else {
      const v = toNumber(m[5]!);
      seconds = /^s/i.test(m[7]!) ? v : v * 60;
    }
    seconds = Math.round(seconds);
    // Bornes raisonnables pour un minuteur de cuisine (pas « 180 °C » ni « 48 h de repos » ignorés : 24 h max).
    if (seconds < 5 || seconds > 24 * 3600) continue;
    out.push({ start: m.index!, end: m.index! + m[0].length, seconds, label: formatTimerLabel(seconds) });
  }
  return out;
}

/** « 12:05 » ou « 1:02:05 » */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`;
}
