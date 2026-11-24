import type { AllergenId } from './allergens';
import type { CategoryId } from '@/domain/categories';

/** Ce que l'ingrédient implique pour les régimes (du plus au moins restrictif). */
export type IngredientDiet = 'viande' | 'poisson' | 'animal' | 'vegetal';

export interface Ingredient {
  id: string;
  name: string;
  /** Autres noms possibles d'un produit de l'inventaire (« blanc de poulet » → poulet). */
  synonyms: string[];
  category: CategoryId;
  diet: IngredientDiet;
  allergens: AllergenId[];
  /** Mots qui empêchent la correspondance (« crème » ≠ « crème dessert »). */
  exclude: string[];
}

const i = (
  id: string,
  name: string,
  category: CategoryId,
  diet: IngredientDiet,
  allergens: AllergenId[] = [],
  synonyms: string[] = [],
  exclude: string[] = [],
): Ingredient => ({ id, name, category, diet, allergens, synonyms, exclude });

/** Table d'ingrédients normalisés : base des recettes et de la correspondance avec l'inventaire. */
export const INGREDIENTS: Ingredient[] = [
  // Viandes et charcuterie
  i('poulet', 'poulet', 'viande', 'viande', [], ['blanc de poulet', 'filet de poulet', 'escalope de poulet', 'cuisse de poulet', 'aiguillette de poulet', 'haut de cuisse', 'poulet roti'], ['bouillon', 'nugget']),
  i('dinde', 'dinde', 'viande', 'viande', [], ['escalope de dinde', 'filet de dinde', 'blanc de dinde'], ['jambon']),
  i('boeuf_hache', 'bœuf haché', 'viande', 'viande', [], ['viande hachee', 'steak hache', 'hache de boeuf', 'hache']),
  i('boeuf', 'bœuf', 'viande', 'viande', [], ['rumsteck', 'bavette', 'entrecote', 'faux filet', 'steak', 'pave de boeuf', 'boeuf bourguignon'], ['hache', 'bouillon']),
  i('porc', 'porc', 'viande', 'viande', [], ['cote de porc', 'filet mignon', 'echine', 'roti de porc', 'escalope de porc']),
  i('lardons', 'lardons', 'viande', 'viande', [], ['allumettes', 'poitrine fumee', 'lardon']),
  i('jambon', 'jambon blanc', 'viande', 'viande', [], ['jambon cuit', 'jambon de paris', 'jambon superieur', 'jambon'], ['cru', 'sec', 'serrano', 'parme', 'bayonne', 'dinde', 'poulet']),
  i('jambon_cru', 'jambon cru', 'viande', 'viande', [], ['jambon sec', 'jambon serrano', 'jambon de parme', 'jambon de bayonne', 'prosciutto']),
  i('saucisse', 'saucisse', 'viande', 'viande', [], ['saucisses', 'chipolata', 'saucisse de toulouse', 'merguez', 'saucisse de strasbourg', 'knack']),
  i('chorizo', 'chorizo', 'viande', 'viande'),
  // Poissons et fruits de mer
  i('saumon', 'saumon', 'poisson', 'poisson', ['poisson'], ['pave de saumon', 'filet de saumon', 'dos de saumon'], ['fume']),
  i('saumon_fume', 'saumon fumé', 'poisson', 'poisson', ['poisson'], ['saumon fume', 'truite fumee']),
  i('cabillaud', 'poisson blanc', 'poisson', 'poisson', ['poisson'], ['cabillaud', 'dos de cabillaud', 'colin', 'merlu', 'lieu', 'filet de poisson', 'poisson blanc', 'pane'], ['pane', 'fume']),
  i('thon', 'thon', 'conserves', 'poisson', ['poisson'], ['thon au naturel', 'miettes de thon', 'thon en boite', 'thon albacore']),
  i('sardines', 'sardines', 'conserves', 'poisson', ['poisson'], ['sardine']),
  i('crevettes', 'crevettes', 'poisson', 'poisson', ['crustaces'], ['crevette', 'gambas', 'crevettes roses']),
  i('moules', 'moules', 'poisson', 'poisson', ['mollusques'], ['moule', 'moules de bouchot']),
  // Crèmerie
  i('oeufs', 'œufs', 'oeufs', 'animal', ['oeufs'], ['oeuf', 'oeufs frais', 'oeufs plein air', 'oeufs bio'], ['chocolat', 'paques']),
  i('lait', 'lait', 'laitier', 'animal', ['lait'], ['lait demi ecreme', 'lait entier', 'lait ecreme'], ['coco', 'amande', 'avoine', 'soja', 'riz', 'chocolat', 'concentre']),
  i('beurre', 'beurre', 'laitier', 'animal', ['lait'], ['beurre doux', 'beurre demi sel', 'beurre sale'], ['cacahuete', 'arachide']),
  i('creme', 'crème fraîche', 'laitier', 'animal', ['lait'], ['creme fraiche', 'creme epaisse', 'creme liquide', 'creme entiere', 'creme legere', 'creme'], ['dessert', 'glacee', 'glace', 'chocolat', 'vanille', 'caramel', 'brulee', 'patissiere', 'marron', 'coco', 'soja', 'avoine']),
  i('yaourt', 'yaourt nature', 'laitier', 'animal', ['lait'], ['yaourt', 'yaourts', 'yogourt', 'yaourt grec', 'fromage blanc'], ['aromatise', 'fruits', 'vanille', 'chocolat', 'boire']),
  i('fromage_rape', 'fromage râpé', 'fromage', 'animal', ['lait'], ['emmental rape', 'gruyere rape', 'fromage rape', 'rape']),
  i('emmental', 'emmental', 'fromage', 'animal', ['lait'], ['gruyere', 'comte', 'beaufort']),
  i('parmesan', 'parmesan', 'fromage', 'animal', ['lait'], ['parmigiano', 'grana padano']),
  i('mozzarella', 'mozzarella', 'fromage', 'animal', ['lait'], ['burrata', 'mozzarella di bufala']),
  i('chevre', 'fromage de chèvre', 'fromage', 'animal', ['lait'], ['chevre', 'buche de chevre', 'crottin']),
  i('feta', 'feta', 'fromage', 'animal', ['lait']),
  i('mascarpone', 'mascarpone', 'fromage', 'animal', ['lait'], ['ricotta']),
  // Légumes
  i('tomate', 'tomates', 'legumes', 'vegetal', [], ['tomate', 'tomates cerises', 'tomates grappe', 'tomate coeur de boeuf'], ['concassee', 'coulis', 'puree', 'sauce', 'concentre', 'pelee', 'sechee', 'ketchup']),
  i('courgette', 'courgettes', 'legumes', 'vegetal', [], ['courgette']),
  i('aubergine', 'aubergines', 'legumes', 'vegetal', [], ['aubergine']),
  i('poivron', 'poivrons', 'legumes', 'vegetal', [], ['poivron rouge', 'poivron vert', 'poivron jaune']),
  i('carotte', 'carottes', 'legumes', 'vegetal', [], ['carotte', 'carottes rapees'], ['gateau', 'cake']),
  i('oignon', 'oignons', 'legumes', 'vegetal', [], ['oignon', 'oignon jaune', 'oignon rouge', 'oignon blanc', 'oignons nouveaux'], ['frit', 'soupe']),
  i('echalote', 'échalotes', 'legumes', 'vegetal', [], ['echalote']),
  i('ail', 'ail', 'legumes', 'vegetal', [], ['gousse d ail', 'tete d ail', 'ail rose'], ['ours', 'semoule']),
  i('pomme_de_terre', 'pommes de terre', 'legumes', 'vegetal', [], ['pomme de terre', 'patate', 'patates', 'grenaille', 'charlotte'], ['douce', 'chips', 'puree', 'frite']),
  i('patate_douce', 'patate douce', 'legumes', 'vegetal', [], ['patates douces']),
  i('epinards', 'épinards', 'legumes', 'vegetal', [], ['epinard', 'pousses d epinards', 'epinards frais', 'epinards en branches']),
  i('salade', 'salade', 'legumes', 'vegetal', [], ['laitue', 'batavia', 'mache', 'roquette', 'mesclun', 'feuille de chene', 'romaine', 'iceberg'], ['composee', 'fruits', 'taboule', 'cesar']),
  i('concombre', 'concombre', 'legumes', 'vegetal'),
  i('champignons', 'champignons', 'legumes', 'vegetal', [], ['champignon', 'champignons de paris', 'pleurotes', 'girolles', 'cepes']),
  i('brocoli', 'brocoli', 'legumes', 'vegetal', [], ['brocolis']),
  i('chou_fleur', 'chou-fleur', 'legumes', 'vegetal', [], ['chou fleur']),
  i('poireau', 'poireaux', 'legumes', 'vegetal', [], ['poireau']),
  i('haricots_verts', 'haricots verts', 'legumes', 'vegetal', [], ['haricot vert', 'haricots beurre']),
  i('petits_pois', 'petits pois', 'legumes', 'vegetal', [], ['petit pois', 'petits pois carottes']),
  i('mais', 'maïs', 'conserves', 'vegetal', [], ['mais doux', 'grains de mais']),
  i('avocat', 'avocat', 'legumes', 'vegetal', [], ['avocats']),
  i('potiron', 'potiron', 'legumes', 'vegetal', [], ['courge', 'butternut', 'potimarron', 'citrouille']),
  i('celeri', 'céleri', 'legumes', 'vegetal', ['celeri'], ['celeri branche', 'celeri rave']),
  i('gingembre', 'gingembre', 'legumes', 'vegetal', [], ['gingembre frais']),
  i('persil', 'persil', 'legumes', 'vegetal', [], ['persil plat', 'persil frise']),
  i('basilic', 'basilic', 'legumes', 'vegetal'),
  i('coriandre', 'coriandre', 'legumes', 'vegetal'),
  i('ciboulette', 'ciboulette', 'legumes', 'vegetal'),
  i('menthe', 'menthe', 'legumes', 'vegetal', [], ['menthe fraiche']),
  i('herbes', 'herbes fraîches', 'legumes', 'vegetal', [], ['herbes fraiches', 'aneth', 'estragon', 'cerfeuil']),
  // Fruits
  i('pomme', 'pommes', 'fruits', 'vegetal', [], ['pomme', 'golden', 'gala', 'granny', 'pink lady'], ['terre', 'compote', 'jus', 'chips']),
  i('banane', 'bananes', 'fruits', 'vegetal', [], ['banane']),
  i('poire', 'poires', 'fruits', 'vegetal', [], ['poire']),
  i('fruits_rouges', 'fruits rouges', 'fruits', 'vegetal', [], ['fraises', 'fraise', 'framboises', 'framboise', 'myrtilles', 'myrtille', 'cerises', 'cerise', 'mures'], ['confiture', 'yaourt', 'jus', 'sirop']),
  i('orange', 'oranges', 'fruits', 'vegetal', [], ['orange', 'clementines', 'clementine', 'mandarine'], ['jus']),
  i('citron', 'citron', 'fruits', 'vegetal', [], ['citrons', 'citron vert', 'citron jaune'], ['jus', 'tarte']),
  i('kiwi', 'kiwis', 'fruits', 'vegetal', [], ['kiwi']),
  // Épicerie salée
  i('pates', 'pâtes', 'epicerie_salee', 'vegetal', ['gluten'], ['pates', 'spaghetti', 'penne', 'tagliatelles', 'coquillettes', 'fusilli', 'macaroni', 'farfalle', 'linguine', 'rigatoni', 'lasagnes'], ['feuilletee', 'brisee', 'sablee', 'pizza', 'tartiner']),
  i('riz', 'riz', 'epicerie_salee', 'vegetal', [], ['riz basmati', 'riz thai', 'riz long', 'riz rond', 'riz arborio', 'riz complet'], ['galette', 'lait', 'gateau']),
  i('semoule', 'semoule', 'epicerie_salee', 'vegetal', ['gluten'], ['couscous', 'semoule fine', 'semoule moyenne', 'boulgour']),
  i('lentilles', 'lentilles', 'epicerie_salee', 'vegetal', [], ['lentilles vertes', 'lentilles corail', 'lentilles blondes', 'lentille']),
  i('pois_chiches', 'pois chiches', 'conserves', 'vegetal', [], ['pois chiche', 'pois-chiches'], ['houmous']),
  i('haricots_rouges', 'haricots rouges', 'conserves', 'vegetal', [], ['haricots blancs', 'haricots secs', 'flageolets']),
  i('quinoa', 'quinoa', 'epicerie_salee', 'vegetal'),
  i('pain', 'pain', 'boulangerie', 'vegetal', ['gluten'], ['baguette', 'pain de campagne', 'pain complet', 'pain rassis', 'tradition', 'pain aux cereales'], ['mie', 'epices', 'chocolat', 'raisins']),
  i('pain_mie', 'pain de mie', 'boulangerie', 'animal', ['gluten', 'lait'], ['pain de mie', 'pain burger', 'pain hamburger']),
  i('tortillas', 'tortillas', 'boulangerie', 'vegetal', ['gluten'], ['wraps', 'wrap', 'galettes de ble', 'fajitas']),
  i('pate_brisee', 'pâte brisée', 'traiteur', 'animal', ['gluten', 'lait'], ['pate brisee', 'pate sablee', 'pate a tarte']),
  i('pate_feuilletee', 'pâte feuilletée', 'traiteur', 'animal', ['gluten', 'lait'], ['pate feuilletee']),
  i('pate_pizza', 'pâte à pizza', 'traiteur', 'vegetal', ['gluten'], ['pate a pizza']),
  i('chapelure', 'chapelure', 'epicerie_salee', 'vegetal', ['gluten']),
  i('tomates_concassees', 'tomates concassées', 'conserves', 'vegetal', [], ['coulis de tomate', 'puree de tomate', 'tomates pelees', 'sauce tomate', 'passata', 'tomates concassees'], ['ketchup']),
  i('concentre_tomate', 'concentré de tomate', 'conserves', 'vegetal', [], ['double concentre']),
  i('lait_coco', 'lait de coco', 'conserves', 'vegetal', [], ['creme de coco', 'lait coco']),
  i('bouillon', 'bouillon', 'condiments', 'vegetal', ['celeri'], ['bouillon cube', 'bouillon de volaille', 'bouillon de legumes', 'bouillon de boeuf', 'fond de veau', 'cube']),
  i('sauce_soja', 'sauce soja', 'condiments', 'vegetal', ['soja', 'gluten'], ['soja sale', 'tamari']),
  i('moutarde', 'moutarde', 'condiments', 'vegetal', ['moutarde'], ['moutarde de dijon', 'moutarde a l ancienne']),
  i('pesto', 'pesto', 'condiments', 'animal', ['lait', 'fruits_coque'], ['pesto alla genovese', 'pesto vert']),
  i('olives', 'olives', 'conserves', 'vegetal', [], ['olive', 'olives noires', 'olives vertes']),
  i('curry', 'curry', 'condiments', 'vegetal', [], ['curry en poudre', 'pate de curry', 'garam masala']),
  i('cumin', 'cumin', 'condiments', 'vegetal', [], ['ras el hanout', 'paprika', 'piment', 'epices']),
  i('vin_blanc', 'vin blanc', 'boissons', 'vegetal', ['sulfites'], ['vin blanc sec']),
  i('noix', 'noix', 'epicerie_sucree', 'vegetal', ['fruits_coque'], ['noisettes', 'amandes', 'noix de cajou', 'cerneaux']),
  i('sesame', 'graines de sésame', 'epicerie_salee', 'vegetal', ['sesame'], ['sesame']),
  // Épicerie sucrée
  i('chocolat', 'chocolat', 'epicerie_sucree', 'animal', ['lait', 'soja'], ['chocolat noir', 'chocolat au lait', 'pepites de chocolat', 'chocolat patissier'], ['pate a tartiner', 'lait chocolate', 'creme']),
  i('levure', 'levure chimique', 'epicerie_sucree', 'vegetal', [], ['levure', 'poudre a lever']),
  i('flocons_avoine', 'flocons d’avoine', 'epicerie_sucree', 'vegetal', ['gluten'], ['flocons d avoine', 'avoine', 'porridge']),
  i('miel', 'miel', 'epicerie_sucree', 'animal'),
  i('cannelle', 'cannelle', 'epicerie_sucree', 'vegetal'),
  i('sucre_vanille', 'sucre vanillé', 'epicerie_sucree', 'vegetal', [], ['vanille', 'sucre vanille', 'extrait de vanille']),
  // Ingrédients de base (considérés disponibles, configurables)
  i('sel', 'sel', 'condiments', 'vegetal', [], ['fleur de sel', 'gros sel']),
  i('poivre', 'poivre', 'condiments', 'vegetal'),
  i('huile', 'huile', 'condiments', 'vegetal', [], ['huile de tournesol', 'huile neutre', 'huile de colza']),
  i('huile_olive', 'huile d’olive', 'condiments', 'vegetal', [], ['huile d olive']),
  i('farine', 'farine', 'epicerie_sucree', 'vegetal', ['gluten'], ['farine de ble', 'farine t45', 'farine t55']),
  i('sucre', 'sucre', 'epicerie_sucree', 'vegetal', [], ['sucre en poudre', 'sucre roux', 'cassonade'], ['vanille', 'glace']),
  i('eau', 'eau', 'boissons', 'vegetal'),
  i('vinaigre', 'vinaigre', 'condiments', 'vegetal', ['sulfites'], ['vinaigre de vin', 'vinaigre balsamique', 'vinaigre de cidre']),
  i('herbes_provence', 'herbes de Provence', 'condiments', 'vegetal', [], ['thym', 'laurier', 'romarin', 'origan']),
];

export const INGREDIENTS_BY_ID: Record<string, Ingredient> = Object.fromEntries(INGREDIENTS.map((x) => [x.id, x]));

/** Ingrédients de base considérés comme toujours disponibles (modifiable dans les réglages). */
export const DEFAULT_BASICS = ['sel', 'poivre', 'huile', 'huile_olive', 'farine', 'sucre', 'eau', 'vinaigre', 'herbes_provence'];
