import { and, eq, isNull } from 'drizzle-orm';
import type { CategoryId } from '@/domain/categories';
import type { ScannedProduct } from '@/domain/offProduct';
import { fetchOffProduct } from '@/services/openFoodFacts';
import { ownership, trackInsert, trackPatch } from '@/sync/outbox';
import { db } from './client';
import { newId } from './ids';
import { products, type ProductRow } from './schema';

export type LookupResult =
  | { status: 'found'; product: ScannedProduct; productId: string; source: 'off' | 'manuel' }
  | { status: 'unknown'; barcode: string; offline: boolean };

export function rowToScanned(r: ProductRow): ScannedProduct {
  return {
    barcode: r.barcode ?? '',
    name: r.name,
    brand: r.brand,
    category: r.category as CategoryId,
    packQuantity: r.defaultQuantity ?? 1,
    packUnit: r.defaultUnit ?? 'pièce',
    imageUrl: r.imageUrl,
    nutriscore: r.nutriscore,
    allergens: r.allergens ? (JSON.parse(r.allergens) as string[]) : [],
  };
}

export function findByBarcode(barcode: string): ProductRow | undefined {
  return db.select().from(products).where(and(eq(products.barcode, barcode), isNull(products.deletedAt))).get();
}

function upsert(p: ScannedProduct, source: 'off' | 'manuel'): string {
  const now = new Date();
  const values = {
    barcode: p.barcode,
    name: p.name,
    brand: p.brand,
    category: p.category,
    imageUrl: p.imageUrl,
    defaultQuantity: p.packQuantity,
    defaultUnit: p.packUnit,
    nutriscore: p.nutriscore,
    allergens: JSON.stringify(p.allergens),
    source,
    updatedAt: now,
  };
  const existing = findByBarcode(p.barcode);
  if (existing) {
    db.update(products).set(values).where(eq(products.id, existing.id)).run();
    trackPatch('products', existing.id, values);
    return existing.id;
  }
  const row = { id: newId(), householdId: ownership().householdId, createdAt: now, deletedAt: null, ...values };
  db.insert(products).values(row).run();
  trackInsert('products', row);
  return row.id;
}

/** Produit inconnu saisi à la main : on mémorise le code-barres pour la prochaine fois. */
export function saveManualProduct(
  barcode: string,
  name: string,
  category: CategoryId,
  pack: { quantity: number; unit: string } = { quantity: 1, unit: 'pièce' },
): { id: string; product: ScannedProduct } {
  const product: ScannedProduct = {
    barcode, name: name.trim(), brand: null, category, packQuantity: pack.quantity, packUnit: pack.unit, imageUrl: null, nutriscore: null, allergens: [],
  };
  return { id: upsert(product, 'manuel'), product };
}

/** Cache local d'abord (hors ligne), puis Open Food Facts. */
export async function lookupBarcode(barcode: string): Promise<LookupResult> {
  const cached = findByBarcode(barcode);
  // Ancien classement « boissons » d'Open Food Facts (yaourts à boire…) : on relit la fiche pour
  // corriger la catégorie, sauf si l'utilisateur l'a déjà choisie lui-même (source « manuel »).
  if (cached && cached.source === 'off' && cached.category === 'boissons') {
    const off = await fetchOffProduct(barcode);
    if (off.kind === 'found' && off.product.category !== 'boissons') {
      updateProductDetails(cached.id, { category: off.product.category });
      return { status: 'found', product: { ...rowToScanned(cached), category: off.product.category }, productId: cached.id, source: 'off' };
    }
  }
  if (cached) return { status: 'found', product: rowToScanned(cached), productId: cached.id, source: cached.source };
  const off = await fetchOffProduct(barcode);
  if (off.kind === 'found') return { status: 'found', product: off.product, productId: upsert(off.product, 'off'), source: 'off' };
  return { status: 'unknown', barcode, offline: off.kind === 'offline' };
}

/** Corrections faites au scan (nom, catégorie, contenance) : retenues pour ce code-barres. */
export function updateProductDetails(id: string, patch: { name?: string; category?: CategoryId; packQuantity?: number; packUnit?: string }): void {
  const values = {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    ...(patch.packQuantity !== undefined ? { defaultQuantity: patch.packQuantity } : {}),
    ...(patch.packUnit !== undefined ? { defaultUnit: patch.packUnit } : {}),
    updatedAt: new Date(),
  };
  db.update(products).set(values).where(eq(products.id, id)).run();
  trackPatch('products', id, values);
}
