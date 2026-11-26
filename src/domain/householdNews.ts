/** État d'un article de courses, avant et après l'arrivée des modifications d'un autre téléphone. */
export interface ShoppingState {
  id: string;
  name: string;
  checked: boolean;
  deleted: boolean;
  addedBy: string | null;
}

export interface ShoppingNews {
  /** Articles ajoutés par quelqu'un d'autre, par auteur. */
  added: { by: string | null; names: string[] }[];
  /** La liste avait des articles à acheter et n'en a plus : les courses sont faites. */
  finished: boolean;
}

/**
 * Ce qui mérite une notification après une synchro : les ajouts des autres membres et la fin des
 * courses. Les changements faits sur ce téléphone sont déjà dans `before` : ils ne déclenchent rien.
 */
export function shoppingNews(before: ShoppingState[], after: ShoppingState[], me: string | null): ShoppingNews {
  const known = new Set(before.map((r) => r.id));
  const fresh = after.filter((r) => !known.has(r.id) && !r.deleted && !r.checked && r.addedBy !== me);
  const byAuthor = new Map<string | null, string[]>();
  for (const r of fresh) byAuthor.set(r.addedBy, [...(byAuthor.get(r.addedBy) ?? []), r.name]);
  const open = (list: ShoppingState[]) => list.filter((r) => !r.deleted && !r.checked).length;
  return {
    added: [...byAuthor].map(([by, names]) => ({ by, names })),
    finished: open(before) > 0 && open(after) === 0 && after.length > 0,
  };
}

/** « Léa a ajouté du lait, du pain et 2 autres » → titre et texte de la notification. */
export function newsMessage(news: { by: string | null; names: string[] }, author: string | null): { title: string; body: string } {
  const who = author || 'Quelqu’un du foyer';
  const shown = news.names.slice(0, 3);
  const more = news.names.length - shown.length;
  return {
    title: `${who} a ajouté ${news.names.length > 1 ? `${news.names.length} articles` : 'un article'} aux courses`,
    body: shown.join(', ') + (more > 0 ? ` et ${more} autre${more > 1 ? 's' : ''}` : ''),
  };
}
