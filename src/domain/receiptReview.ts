import { daysBetween, startOfDay } from './dates';
import { getCategory, type CategoryId, type Location } from './categories';
import type { DateType } from './freshness';
import { defaultExpiry } from './inventory';
import type { ParsedReceipt } from './receipt';
import { aliasKey, matchReceiptLabel, proposeQuantity, type KnownProduct, type MatchSource, type ReceiptAlias } from './receiptMatch';

/** Une ligne de l'écran de revue : ce qui sera ajouté à l'inventaire, modifiable. */
export interface ReviewLine {
  /** Clé stable (ordre dans le ticket, plus la partie du ticket). */
  id: string;
  raw: string;
  /** Clé d'apprentissage du libellé (cf. `aliasKey`). */
  key: string;
  name: string;
  category: CategoryId;
  ingredientId: string | null;
  source: MatchSource;
  quantity: number;
  unit: string;
  location: Location;
  dateType: DateType;
  expiresAt: Date;
  /** La date a été saisie ou confirmée : elle n'est plus « estimée ». */
  dateConfirmed: boolean;
  price: number | null;
  include: boolean;
  nonFood: boolean;
}

/** Un ticket de moins de 2 semaines sert de date d'achat pour estimer les dates limites. */
export function purchaseDate(parsed: Pick<ParsedReceipt, 'date'>, now: Date = new Date()): Date {
  if (!parsed.date) return now;
  const age = daysBetween(parsed.date, now);
  return age >= 0 && age <= 14 ? parsed.date : now;
}

/** Date limite estimée, jamais avant aujourd'hui (un ticket ancien ne rend pas un produit périmé). */
export function estimateExpiry(category: CategoryId, location: Location, purchased: Date, now: Date = new Date()): Date {
  const d = defaultExpiry(category, location, startOfDay(purchased));
  return d < startOfDay(now) ? startOfDay(now) : d;
}

/** Transforme un ticket analysé en lignes à revoir, avec emplacement, date et quantité proposés. */
export function buildReview(
  parsed: ParsedReceipt,
  ctx: { aliases: Map<string, ReceiptAlias>; products: KnownProduct[] },
  part = 0,
  now: Date = new Date(),
): ReviewLine[] {
  const purchased = purchaseDate(parsed, now);
  return parsed.items.map((item) => {
    const m = matchReceiptLabel(item.label, ctx);
    const c = getCategory(m.category);
    const location = m.location ?? c.location;
    const q = proposeQuantity(item, m);
    return {
      id: `${part}-${item.index}`,
      raw: item.raw,
      key: aliasKey(item.label),
      name: m.name,
      category: c.id,
      ingredientId: m.ingredientId,
      source: m.source,
      quantity: q.quantity,
      unit: q.unit,
      location,
      dateType: c.dateType,
      expiresAt: estimateExpiry(c.id, location, purchased, now),
      dateConfirmed: false,
      price: item.price,
      include: !item.nonFood && item.price !== 0,
      nonFood: item.nonFood,
    };
  });
}

/** Résumé pour l'en-tête : nombre de produits retenus et montant. */
export function reviewSummary(lines: ReviewLine[]): { count: number; amount: number } {
  const kept = lines.filter((l) => l.include);
  return { count: kept.length, amount: Math.round(kept.reduce((s, l) => s + (l.price ?? 0), 0) * 100) / 100 };
}

/** « 4 déc. » : date courte pour la liste de revue. */
export function shortDate(d: Date): string {
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

