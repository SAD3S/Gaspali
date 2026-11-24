import { FRESH_PRESETS } from '@/data/freshProducts';
import { INGREDIENTS_BY_ID } from '@/data/ingredients';
import { getCategory, type CategoryId, type Location } from './categories';
import { resolveIngredient, tokens } from './ingredientMatch';
import { upperAscii, type ReceiptItem } from './receipt';

/**
 * Abréviations courantes des tickets français (libellés tronqués par les caisses).
 * Clé : jeton en majuscules sans accents ; valeur : texte développé.
 */
const ABBREVIATIONS: Record<string, string> = {
  BLC: 'blanc', BL: 'blanc', POUL: 'poulet', PLT: 'poulet', ESC: 'escalope', ESCAL: 'escalope', FIL: 'filet', FLT: 'filet',
  CUIS: 'cuisse', DIND: 'dinde', BF: 'bœuf', BOEUF: 'bœuf', HACH: 'haché', HACHE: 'haché', STK: 'steak', STEAK: 'steak', VDE: 'viande',
  JB: 'jambon', JBN: 'jambon', JAMB: 'jambon', SUP: 'supérieur', LARD: 'lardons', LARDON: 'lardons', LARDONS: 'lardons', SAUC: 'saucisses',
  SAUCIS: 'saucisses', MERG: 'merguez', CHIPO: 'chipolatas', SAUM: 'saumon', FUM: 'fumé', FUME: 'fumé', CREV: 'crevettes', CREVET: 'crevettes',
  CABILL: 'cabillaud', CAB: 'cabillaud', SURIM: 'surimi',
  YAOURT: 'yaourt', YAOURTS: 'yaourts', YAOU: 'yaourt', YAO: 'yaourt', YT: 'yaourt', YTS: 'yaourts', NAT: 'nature', LT: 'lait', LAIT: 'lait',
  ECR: 'écrémé', ECREM: 'écrémé', ECREME: 'écrémé', ENT: 'entier', CRM: 'crème', CREME: 'crème', CR: 'crème', FRAICH: 'fraîche', FRAICHE: 'fraîche',
  FRS: 'frais', EPAIS: 'épaisse', EPAISSE: 'épaisse', LIQ: 'liquide', BEUR: 'beurre', BEURRE: 'beurre', DX: 'doux', FROM: 'fromage',
  FROMAG: 'fromage', RAP: 'râpé', RAPE: 'râpé', EMMENT: 'emmental', EMMEN: 'emmental', EMMENTAL: 'emmental', MOZZA: 'mozzarella', MOZZ: 'mozzarella',
  PARMES: 'parmesan', PARM: 'parmesan', COMTE: 'comté', CAMEMB: 'camembert', CAMEM: 'camembert', CHEV: 'chèvre', CHEVRE: 'chèvre',
  OEUF: 'œufs', OEUFS: 'œufs', DESS: 'dessert', COMPOT: 'compote', COMP: 'compote',
  BAG: 'baguette', BAGUET: 'baguette', CAMP: 'campagne', CAMPAG: 'campagne', BRIOCH: 'brioche', CROISS: 'croissants', VIENN: 'viennoiseries',
  PDT: 'pommes de terre', PDTERRE: 'pommes de terre', TOM: 'tomates', TOMAT: 'tomates', TOMATE: 'tomates', TOMATES: 'tomates', CER: 'cerise',
  CAROT: 'carottes', CAROTTE: 'carottes', CAROTTES: 'carottes', COURG: 'courgettes', COURGET: 'courgettes', AUBERG: 'aubergines',
  POIVR: 'poivrons', CONC: 'concombre', CONCOMB: 'concombre', OIGN: 'oignons', OIGNON: 'oignons', ECHAL: 'échalotes', SALAD: 'salade',
  EPIN: 'épinards', EPINARD: 'épinards', EPINARDS: 'épinards', CHAMP: 'champignons', CHAMPI: 'champignons', CHAMPIG: 'champignons',
  BROC: 'brocoli', HARIC: 'haricots', HAR: 'haricots', VTS: 'verts', POIREAU: 'poireaux', POIREAUX: 'poireaux',
  BANAN: 'bananes', BANANE: 'bananes', BANANES: 'bananes', POMM: 'pommes', ORANG: 'oranges', CITR: 'citrons', CLEM: 'clémentines',
  CLEMENT: 'clémentines', FRAISES: 'fraises', FRAMB: 'framboises', ANAN: 'ananas', AVOC: 'avocat',
  PAT: 'pâtes', PATES: 'pâtes', PATE: 'pâte', SPAG: 'spaghetti', SPAGH: 'spaghetti', TAGL: 'tagliatelles', COQUIL: 'coquillettes',
  BASM: 'basmati', FARIN: 'farine', SUCR: 'sucre', HUIL: 'huile', OLIV: 'olive', TOURNES: 'tournesol', VINAIG: 'vinaigre',
  MOUT: 'moutarde', MAYO: 'mayonnaise', KETCH: 'ketchup', CHOCO: 'chocolat', CHOC: 'chocolat', BISC: 'biscuits', CEREAL: 'céréales',
  CONFIT: 'confiture', CONF: 'confiture', SURG: 'surgelé', SURGEL: 'surgelé', PIZZ: 'pizza', QUICH: 'quiche', LASAG: 'lasagnes',
  VELOUT: 'velouté', GAZ: 'gazeuse', MIN: 'minérale', BTE: 'boîte', BT: 'boîte', BTL: 'bouteille', PQT: 'paquet', BARQ: 'barquette',
};

/** Groupes de mots à développer avant le découpage en jetons. */
const PHRASES: [RegExp, string][] = [
  [/\b1\/2\s?ECR(EME)?\b/g, 'demi-écrémé'],
  [/\b1\/2\s?SEL\b/g, 'demi-sel'],
  [/\bP\.?\s?D\.?\s?TERRE\b|\bP DE TERRE\b|\bPOM(ME)?S? DE TERRE\b/g, 'pommes de terre'],
  [/\bPL(EIN)?\.?\s?AIR\b/g, 'plein air'],
  [/\bH\.?\s?VERTS?\b/g, 'haricots verts'],
  [/\bJUS D.?ORANGE\b/g, "jus d'orange"],
];

/** Marques de distributeur et mentions sans intérêt pour reconnaître le produit. */
const NOISE = new Set(['CRF', 'CARREF', 'CARREFOUR', 'AUCHAN', 'LECLERC', 'MQE', 'MARQUE', 'REPERE', 'MONOPRIX', 'MONOP', 'LIDL', 'NETTO',
  'CASINO', 'PP', 'NO', 'NAME', 'ECO', 'PLUS', 'U', 'INTERMARCHE', 'ITM', 'FRANPRIX', 'CLASSIC', 'PROMO', 'LOT', 'X']);

/** « BLC POULET » → « blanc poulet » ; « LAIT 1/2 ECR » → « lait demi-écrémé ». */
export function expandLabel(label: string): string {
  let s = upperAscii(label);
  const phrases: string[] = [];
  for (const [re, txt] of PHRASES) {
    s = s.replace(re, () => {
      phrases.push(txt);
      return ` PHRASE${phrases.length - 1} `;
    });
  }
  const kept: string[] = [];
  for (const raw of s.split(/[\s.,/'’-]+/)) {
    if (!raw) continue;
    const ph = /^PHRASE(\d+)$/.exec(raw);
    if (ph) kept.push(phrases[Number(ph[1])]!);
    else if (!NOISE.has(raw) && !/^\d+$/.test(raw)) kept.push(ABBREVIATIONS[raw] ?? raw.toLowerCase());
  }
  return kept.join(' ').replace(/\s+/g, ' ').trim();
}

/** Clé d'apprentissage d'un libellé : insensible à la casse, aux accents, aux marques et aux quantités. */
export function aliasKey(label: string): string {
  return upperAscii(label)
    .split(/[\s.,/'’-]+/)
    .filter((t) => t && !NOISE.has(t) && !/^\d+$/.test(t))
    .join(' ')
    .toLowerCase();
}

const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

export interface KnownProduct {
  name: string;
  category: string;
}

/** Correspondance apprise : libellé de ticket → produit (par foyer). */
export interface ReceiptAlias {
  key: string;
  name: string;
  category: string;
  location: Location | null;
  unit: string | null;
}

export type MatchSource = 'alias' | 'produit' | 'ingredient' | 'mot-cle' | 'aucun';

export interface ReceiptMatch {
  name: string;
  category: CategoryId;
  ingredientId: string | null;
  source: MatchSource;
  location: Location | null;
  unit: string | null;
}

const KEYWORDS: [RegExp, CategoryId][] = [
  [/\bpommes? de terre\b/, 'legumes'],
  [/\b(surgele|glace|congele|bac)\b/, 'surgeles'],
  [/\b(jus|eau|soda|cola|biere|vin|sirop|limonade|cafe|the|tisane|boisson|nectar)\b/, 'boissons'],
  [/\b(fromage|comte|emmental|camembert|brie|chevre|mozzarella|parmesan|raclette|roquefort|gruyere|coulommiers|reblochon|feta)\b/, 'fromage'],
  [/\b(yaourt|yaourts|lait|creme|beurre|skyr|petit suisse|dessert|fromage blanc|kefir)\b/, 'laitier'],
  [/\boeufs?\b/, 'oeufs'],
  [/\b(poulet|dinde|boeuf|porc|veau|agneau|steak|jambon|lardons|saucisses?|viande|hache|escalope|roti|merguez|chorizo|saucisson|chipolatas|rillettes|pate de campagne)\b/, 'viande'],
  [/\b(saumon|cabillaud|thon|colin|crevettes|poisson|truite|sardines|maquereau|moules|surimi|lieu)\b/, 'poisson'],
  [/\b(pizza|quiche|taboule|sandwich|wrap|traiteur|lasagnes|hachis|parmentier|plat|nems|sushi)\b/, 'traiteur'],
  [/\b(pain|baguette|brioche|croissants?|viennoiseries|campagne)\b/, 'boulangerie'],
  [/\b(tomates?|carottes?|courgettes?|salade|laitue|concombre|poivrons?|oignons?|ail|echalotes?|epinards|champignons|brocoli|chou|poireaux?|haricots|aubergines?|legumes?|radis|navets?|potiron|courge|betteraves?|avocats?|celeri|fenouil|endives?|mache|roquette)\b/, 'legumes'],
  [/\b(pommes?|poires?|bananes?|oranges?|citrons?|clementines?|fraises|framboises|raisins?|kiwis?|mangues?|ananas|peches?|abricots?|melon|cerises?|fruits?|nectarines?|myrtilles)\b/, 'fruits'],
  [/\b(chocolat|biscuits?|gateaux?|cereales|confiture|miel|sucre|bonbons?|compote|madeleines?|cookies?|tartiner|nutella)\b/, 'epicerie_sucree'],
  [/\b(pates|spaghetti|tagliatelles|coquillettes|riz|lentilles|farine|semoule|quinoa|couscous|chips|crackers|soupe|veloute|pate)\b/, 'epicerie_salee'],
  [/\b(conserve|boite|cassoulet|ravioli)\b/, 'conserves'],
  [/\b(moutarde|mayonnaise|ketchup|sauce|vinaigre|huile|epices?|sel|poivre|pesto|olive)\b/, 'condiments'],
];

function asciiLower(s: string): string {
  return upperAscii(s).toLowerCase();
}

/** Score de ressemblance entre jetons de ticket (souvent tronqués) et jetons d'un produit connu. */
function similarity(receiptTokens: string[], productTokens: string[]): number {
  // Les jetons avec chiffres (« 18m », « 4x125 ») ne disent rien du produit.
  const receipt = receiptTokens.filter((t) => !/\d/.test(t));
  const product = productTokens.filter((t) => !/\d/.test(t));
  if (!receipt.length || !product.length) return 0;
  let matched = 0;
  const used = new Set<number>();
  for (const r of receipt) {
    const j = product.findIndex((p, k) => !used.has(k) && (p === r || (r.length >= 3 && p.startsWith(r)) || (p.length >= 3 && r.startsWith(p))));
    if (j >= 0) {
      used.add(j);
      matched++;
    }
  }
  return (2 * matched) / (receipt.length + product.length);
}

/**
 * Retrouve le produit derrière un libellé de ticket : correspondance apprise du foyer, puis
 * produits déjà connus (correspondance floue), puis table d'ingrédients, puis mots-clés.
 */
export function matchReceiptLabel(label: string, ctx: { aliases: Map<string, ReceiptAlias>; products: KnownProduct[] }): ReceiptMatch {
  const alias = ctx.aliases.get(aliasKey(label));
  if (alias) {
    const ing = resolveIngredient(alias.name);
    return { name: alias.name, category: getCategory(alias.category).id, ingredientId: ing?.id ?? null, source: 'alias', location: alias.location, unit: alias.unit };
  }

  const expanded = expandLabel(label);
  const rt = tokens(expanded);
  let best: { p: KnownProduct; score: number } | null = null;
  for (const p of ctx.products) {
    const score = similarity(rt, tokens(p.name));
    if (score >= 0.8 && (!best || score > best.score)) best = { p, score };
  }
  if (best) {
    const ing = resolveIngredient(best.p.name);
    return { name: best.p.name, category: getCategory(best.p.category).id, ingredientId: ing?.id ?? null, source: 'produit', location: null, unit: null };
  }

  const preset = FRESH_PRESETS.find((p) => {
    const pt = tokens(p.name);
    return pt.length > 0 && pt.every((t) => rt.includes(t));
  });
  const ing = resolveIngredient(expanded);
  if (ing) {
    // Nom affiché : le libellé développé, ou le terme de la table qui correspond exactement (« blanc de poulet »),
    // seulement s'il ajoute les petits mots que la caisse a retirés.
    const key = rt.slice().sort().join(' ');
    const term = [ing.name, ...ing.synonyms].find((t) => tokens(t).slice().sort().join(' ') === key);
    const words = (x: string) => x.split(/[\s-]+/).length;
    const name = term && words(term) > words(expanded) ? term : expanded;
    // Emplacement des produits frais courants (pommes de terre au placard, pas au frigo).
    return { name: capitalize(name), category: ing.category, ingredientId: ing.id, source: 'ingredient', location: preset?.location ?? null, unit: null };
  }

  if (preset) return { name: capitalize(expanded), category: preset.category, ingredientId: null, source: 'mot-cle', location: preset.location, unit: preset.unit };

  const plain = asciiLower(expanded);
  const kw = KEYWORDS.find(([re]) => re.test(plain));
  return {
    name: capitalize(expanded || label.toLowerCase()),
    category: kw ? kw[1] : 'autre',
    ingredientId: null,
    source: kw ? 'mot-cle' : 'aucun',
    location: null,
    unit: null,
  };
}

const POT_INGREDIENTS = new Set(['yaourt', 'creme']);
/** « BLC POULET X2 » = 2 filets, « JB SUP X4 » = 4 tranches. */
const COUNT_UNITS: Record<string, string> = { poulet: 'filet', dinde: 'filet', saumon: 'filet', cabillaud: 'filet', jambon: 'tranche', jambon_cru: 'tranche' };

/** Unité « au compte » adaptée au produit (pots de yaourt, bouteilles…). */
function countUnit(m: Pick<ReceiptMatch, 'category' | 'ingredientId' | 'name'>): string {
  if (m.ingredientId && POT_INGREDIENTS.has(m.ingredientId)) return 'pot';
  if (m.ingredientId && COUNT_UNITS[m.ingredientId]) return COUNT_UNITS[m.ingredientId]!;
  if (/\b(yaourt|compote|dessert|creme|skyr)/.test(asciiLower(m.name))) return 'pot';
  if (m.category === 'boissons' || m.ingredientId === 'lait') return 'bouteille';
  return 'pièce';
}

/** Quantité et unité proposées pour une ligne : pesée, contenance × lots, ou nombre d'exemplaires. */
export function proposeQuantity(
  item: Pick<ReceiptItem, 'count' | 'pack' | 'weightKg'>,
  m: Pick<ReceiptMatch, 'category' | 'ingredientId' | 'name' | 'unit'>,
): { quantity: number; unit: string } {
  if (item.weightKg) {
    return item.weightKg < 1 ? { quantity: Math.round(item.weightKg * 1000), unit: 'g' } : { quantity: Math.round(item.weightKg * 100) / 100, unit: 'kg' };
  }
  const n = Math.max(1, item.count);
  if (item.pack && item.pack.count > 1) return { quantity: item.pack.count * n, unit: countUnit(m) };
  if (item.pack?.size) return { quantity: Math.round(item.pack.size.quantity * n * 100) / 100, unit: item.pack.size.unit };
  if (m.unit && m.unit !== 'g' && m.unit !== 'kg' && m.unit !== 'cl' && m.unit !== 'L') return { quantity: n, unit: m.unit };
  return { quantity: n, unit: countUnit(m) };
}

/** Ingrédient d'un nom de produit validé (pour cocher la liste de courses). */
export function ingredientOfName(name: string): string | null {
  const ing = resolveIngredient(name);
  return ing && INGREDIENTS_BY_ID[ing.id] ? ing.id : null;
}
