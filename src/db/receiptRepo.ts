import { desc, eq, isNull } from 'drizzle-orm';
import type { Location } from '@/domain/categories';
import type { KnownProduct, ReceiptAlias } from '@/domain/receiptMatch';
import { ownership, trackInsert, trackPatch } from '@/sync/outbox';
import { db } from './client';
import { stableUuid } from './ids';
import { inventoryItems, products, receiptAliases } from './schema';

/** Correspondances apprises du foyer, par libellé normalisé (la plus récente gagne). */
export function loadAliases(): Map<string, ReceiptAlias> {
  const rows = db.select().from(receiptAliases).where(isNull(receiptAliases.deletedAt)).orderBy(receiptAliases.updatedAt).all();
  const map = new Map<string, ReceiptAlias>();
  for (const r of rows) map.set(r.key, { key: r.key, name: r.name, category: r.category, location: r.location, unit: r.unit });
  return map;
}

/** Produits déjà connus du foyer : fiches scannées et noms déjà saisis dans l'inventaire. */
export function loadKnownProducts(limit = 400): KnownProduct[] {
  const seen = new Set<string>();
  const out: KnownProduct[] = [];
  const add = (name: string, category: string) => {
    const k = name.trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push({ name: name.trim(), category });
  };
  for (const p of db.select({ name: products.name, category: products.category }).from(products).where(isNull(products.deletedAt)).all()) add(p.name, p.category);
  const items = db
    .select({ name: inventoryItems.name, category: inventoryItems.category })
    .from(inventoryItems)
    .orderBy(desc(inventoryItems.createdAt))
    .limit(limit)
    .all();
  for (const i of items) add(i.name, i.category);
  return out;
}

/**
 * Retient « ce libellé de ticket = ce produit » pour le foyer. Identifiant déterministe
 * (foyer + libellé) : deux téléphones qui apprennent le même libellé mettent à jour la même ligne.
 */
export function learnAlias(key: string, value: { name: string; category: string; location: Location | null; unit: string | null }): void {
  if (!key) return;
  const { householdId } = ownership();
  const id = stableUuid(`receipt:${householdId ?? 'local'}:${key}`);
  const now = new Date();
  const existing = db.select().from(receiptAliases).where(eq(receiptAliases.id, id)).get();
  if (existing) {
    const patch: Record<string, unknown> = {};
    if (existing.name !== value.name) patch.name = value.name;
    if (existing.category !== value.category) patch.category = value.category;
    if (existing.location !== value.location) patch.location = value.location;
    if (existing.unit !== value.unit) patch.unit = value.unit;
    if (existing.deletedAt) patch.deletedAt = null;
    if (!Object.keys(patch).length) return;
    const full = { ...patch, updatedAt: now };
    db.update(receiptAliases).set(full).where(eq(receiptAliases.id, id)).run();
    trackPatch('receipt_aliases', id, full);
    return;
  }
  const row = { id, householdId, createdAt: now, updatedAt: now, deletedAt: null, key, ...value };
  db.insert(receiptAliases).values(row).run();
  trackInsert('receipt_aliases', row);
}
