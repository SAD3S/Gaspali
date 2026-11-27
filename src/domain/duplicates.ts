import { computeFreshness } from './freshness';
import { ingredientsForProduct } from './ingredientMatch';
import { normalizeText, type Item } from './inventory';

/**
 * « Déjà au frigo ! » : produits en stock qui correspondent à ce qu'on s'apprête à ajouter ou à
 * acheter (même fiche produit, même ingrédient normalisé, ou même nom), le plus pressé d'abord.
 */
export function alreadyInStock<T extends Item & { row?: { productId?: string | null } }>(
  items: T[],
  target: { name: string; productId?: string | null; ingredientId?: string | null },
): T[] {
  const key = normalizeText(target.name);
  const ingredients = target.ingredientId ? [target.ingredientId] : ingredientsForProduct(target.name);
  return items
    .filter((i) => i.status === 'en_stock')
    .filter((i) => {
      if (target.productId && i.row?.productId === target.productId) return true;
      if (normalizeText(i.name) === key) return true;
      const own = ingredientsForProduct(i.name);
      return ingredients.some((id) => own.includes(id));
    })
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
}

/** « Tu as déjà : Crème fraîche (périme demain) », « Tu en as déjà 2, dont Crème fraîche qui périme demain » */
export function alreadyMessage(matches: Item[], today: Date = new Date()): string | null {
  if (!matches.length) return null;
  const first = matches[0]!;
  const f = computeFreshness(first.expiresAt, first.dateType, today);
  const when =
    f.daysLeft < 0 ? 'est déjà à la date' : f.daysLeft === 0 ? 'périme aujourd’hui' : f.daysLeft === 1 ? 'périme demain' : `périme dans ${f.daysLeft} j`;
  const soon = f.daysLeft <= 2;
  if (matches.length === 1) return `Tu as déjà : ${first.name} (${when.replace('est déjà', 'déjà')})${soon ? ', à finir d’abord' : ''}`;
  return `Tu en as déjà ${matches.length}, dont ${first.name} qui ${when}`;
}
