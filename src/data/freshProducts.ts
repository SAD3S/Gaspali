import type { CategoryId, Location } from '@/domain/categories';

/** Produits sans code-barres (fruits, légumes, vrac, restes) avec durées par défaut. */
export interface FreshPreset {
  name: string;
  category: CategoryId;
  unit: string;
  quantity: number;
  days: number;
  location: Location;
}

const p = (name: string, category: CategoryId, location: Location, days: number, quantity = 1, unit = 'pièce'): FreshPreset => ({
  name, category, location, days, quantity, unit,
});

export const FRESH_PRESETS: FreshPreset[] = [
  // Légumes
  p('Tomates', 'legumes', 'placard', 5, 4),
  p('Salade', 'legumes', 'frigo', 4),
  p('Carottes', 'legumes', 'frigo', 14, 500, 'g'),
  p('Courgettes', 'legumes', 'frigo', 6, 2),
  p('Poivrons', 'legumes', 'frigo', 7, 2),
  p('Concombre', 'legumes', 'frigo', 6),
  p('Champignons', 'legumes', 'frigo', 4, 250, 'g'),
  p('Épinards frais', 'legumes', 'frigo', 3, 300, 'g'),
  p('Brocoli', 'legumes', 'frigo', 5),
  p('Poireaux', 'legumes', 'frigo', 10, 2),
  p('Pommes de terre', 'legumes', 'placard', 30, 1, 'kg'),
  p('Oignons', 'legumes', 'placard', 30, 3),
  p('Ail', 'legumes', 'placard', 45),
  p('Avocat', 'legumes', 'placard', 4),
  p('Haricots verts', 'legumes', 'frigo', 4, 500, 'g'),
  p('Herbes fraîches', 'legumes', 'frigo', 5, 1, 'bouquet'),
  // Fruits
  p('Bananes', 'fruits', 'placard', 5, 5),
  p('Pommes', 'fruits', 'placard', 21, 6),
  p('Poires', 'fruits', 'placard', 6, 4),
  p('Oranges', 'fruits', 'placard', 14, 6),
  p('Citrons', 'fruits', 'placard', 14, 3),
  p('Fraises', 'fruits', 'frigo', 3, 250, 'g'),
  p('Raisin', 'fruits', 'frigo', 7, 500, 'g'),
  p('Kiwis', 'fruits', 'placard', 10, 4),
  p('Clémentines', 'fruits', 'placard', 10, 1, 'kg'),
  // Boulangerie / vrac
  p('Baguette', 'boulangerie', 'placard', 1),
  p('Pain de campagne', 'boulangerie', 'placard', 4),
  p('Viennoiseries', 'boulangerie', 'placard', 2, 4),
  p('Riz (vrac)', 'epicerie_salee', 'placard', 365, 500, 'g'),
  p('Pâtes (vrac)', 'epicerie_salee', 'placard', 365, 500, 'g'),
  p('Lentilles (vrac)', 'epicerie_salee', 'placard', 365, 500, 'g'),
  // Boucherie / poissonnerie à la coupe
  p('Viande hachée', 'viande', 'frigo', 1, 500, 'g'),
  p('Poulet (à la coupe)', 'viande', 'frigo', 2, 2, 'filet'),
  p('Poisson frais', 'poisson', 'frigo', 1, 2, 'filet'),
  p('Fromage à la coupe', 'fromage', 'frigo', 14, 250, 'g'),
  // Restes maison
  p('Reste de plat', 'restes', 'frigo', 3, 1, 'portion'),
  p('Soupe maison', 'restes', 'frigo', 3, 1, 'L'),
  p('Gâteau maison', 'restes', 'placard', 3),
];

export const UNITS = ['pièce', 'g', 'kg', 'cl', 'L', 'pot', 'tranche', 'filet', 'sachet', 'paquet', 'boîte', 'bouteille', 'portion', 'bouquet'];
