import { summarizeOpenPrices, type PriceHint } from '@/domain/prices';

const BASE = 'https://prices.openfoodfacts.org/api/v1/prices';
/** Même identification que pour Open Food Facts (sans donnée personnelle). */
const USER_AGENT = 'Gaspalli/0.1 (application mobile anti-gaspillage)';

/**
 * Prix relevés par la communauté Open Prices (projet Open Food Facts) pour un code-barres.
 * Ne lève jamais : pas de réseau, produit absent ou réponse inattendue → null.
 */
export async function fetchOpenPrice(barcode: string, timeoutMs = 5000): Promise<PriceHint | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}?product_code=${encodeURIComponent(barcode)}&order_by=-date&size=20`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return summarizeOpenPrices(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
