import { and, eq, isNull } from 'drizzle-orm';
import type { CategoryId } from '@/domain/categories';
import type { ScannedProduct } from '@/domain/offProduct';
import { fetchOffProduct } from '@/services/openFoodFacts';
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
    return existing.id;
  }
  const id = newId();
  db.insert(products).values({ id, createdAt: now, ...values }).run();
  return id;
}

/** Produit inconnu saisi à la main : on mémorise le code-barres pour la prochaine fois. */
export function saveManualProduct(barcode: string, name: string, category: CategoryId): { id: string; product: ScannedProduct } {
  const product: ScannedProduct = {
    barcode, name: name.trim(), brand: null, category, packQuantity: 1, packUnit: 'pièce', imageUrl: null, nutriscore: null, allergens: [],
  };
  return { id: upsert(product, 'manuel'), product };
}

/** Cache local d'abord (hors ligne), puis Open Food Facts. */
export async function lookupBarcode(barcode: string): Promise<LookupResult> {
  const cached = findByBarcode(barcode);
  if (cached) return { status: 'found', product: rowToScanned(cached), productId: cached.id, source: cached.source };
  const off = await fetchOffProduct(barcode);
  if (off.kind === 'found') return { status: 'found', product: off.product, productId: upsert(off.product, 'off'), source: 'off' };
  return { status: 'unknown', barcode, offline: off.kind === 'offline' };
}
