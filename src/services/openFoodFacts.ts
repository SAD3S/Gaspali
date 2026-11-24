import { OFF_FIELDS, parseOffResponse, type ScannedProduct } from '@/domain/offProduct';

export type OffResult =
  | { kind: 'found'; product: ScannedProduct }
  | { kind: 'not_found' }
  | { kind: 'offline' };

const BASE = 'https://world.openfoodfacts.org/api/v2/product';
/** Open Food Facts demande un User-Agent identifiant l'app (sans donnée personnelle). */
const USER_AGENT = 'Gaspalli/0.1 (application mobile anti-gaspillage)';

/** Interroge Open Food Facts. Ne lève pas : une erreur réseau donne `offline`. */
export async function fetchOffProduct(barcode: string, timeoutMs = 6000): Promise<OffResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 404) return { kind: 'not_found' };
    if (!res.ok) return { kind: 'offline' };
    const product = parseOffResponse(barcode, await res.json());
    return product ? { kind: 'found', product } : { kind: 'not_found' };
  } catch {
    return { kind: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
