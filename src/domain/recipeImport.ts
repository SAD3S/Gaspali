/**
 * Import de recettes : pages web (données structurées schema.org/Recipe, publiées par presque tous
 * les sites de recettes pour Google), fichiers, et texte lu sur une photo (livre, fiche).
 * Logique pure : le téléchargement et l'OCR sont dans `services/recipeImport.ts`.
 */
import type { RecipeIngredient, RecipeKind } from '@/data/recipes';
import { resolveIngredient } from './ingredientMatch';

export interface ImportedRecipe {
  title: string;
  minutes: number;
  servings: number;
  kind: RecipeKind;
  tags: string[];
  ingredients: RecipeIngredient[];
  steps: string[];
  imageUrl: string | null;
  sourceUrl: string | null;
}

const DEFAULT_MINUTES = 30;
const DEFAULT_SERVINGS = 4;

// ─── Outils texte ────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ocirc: 'ô', ecirc: 'ê', icirc: 'î', ucirc: 'û', oelig: 'œ', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', rsquo: '’', lsquo: '‘', hellip: '…' };

/** Texte lisible : entités HTML décodées, balises retirées, espaces simplifiés. */
export function cleanText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// ─── Quantités et unités ─────────────────────────────────────────────────────

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
const WORDS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12, demi: 0.5, demie: 0.5 };

/** Unités reconnues → unité de l'éditeur (avec facteur de conversion). */
const UNIT_PATTERNS: [RegExp, string, number][] = [
  [/^(kg|kgs|kilos?|kilogrammes?)\b/, 'kg', 1],
  [/^(g|gr|grs|grammes?)\b/, 'g', 1],
  [/^(l|litres?)\b/, 'L', 1],
  [/^(dl|decilitres?)\b/, 'cl', 10],
  [/^(cl|centilitres?)\b/, 'cl', 1],
  [/^(ml|millilitres?)\b/, 'cl', 0.1],
  [/^(c\.?\s?a\s?s\.?|c\.?\s?s\.?|cas|cs|cuil+(?:eres?|\.)?\s?a\s?soupe|cuiller(?:e|ee)s?\s?a\s?soupe|grosses? cuilleres?)(?=\s|$|,)/, 'c. à s.', 1],
  [/^(c\.?\s?a\s?c\.?|c\.?\s?c\.?|cac|cc|cuil+(?:eres?|\.)?\s?a\s?cafe|cuiller(?:e|ee)s?\s?a\s?cafe|petites? cuilleres?)(?=\s|$|,)/, 'c. à c.', 1],
  [/^pincees?\b/, 'pincée', 1],
  [/^gousses?\b/, 'gousse', 1],
  [/^tranches?\b/, 'tranche', 1],
  [/^pots?\b/, 'pot', 1],
  [/^boites?\b/, 'boîte', 1],
  [/^sachets?\b/, 'sachet', 1],
];
/** Mesures qui restent dans le nom (« 1 noix de beurre ») : l'ingrédient est ce qui suit. */
const MEASURE_WORDS = /^(verres?|bols?|tasses?|poignees?|bottes?|brins?|feuilles?|morceaux?|noix|noisettes?|filets?|zestes?|cubes?|carres?|barquettes?|paquets?|briques?|bouquets?|branches?|tiges?|petits? morceaux?)\s+(?:de\s+|d['’]\s*)/;

function parseNumber(token: string): number | null {
  const t = token.trim();
  if (FRACTIONS[t] !== undefined) return FRACTIONS[t]!;
  const mixed = /^(\d+)\s*([½¼¾⅓⅔⅛])$/.exec(t);
  if (mixed) return Number(mixed[1]) + FRACTIONS[mixed[2]!]!;
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
  const mixedFrac = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (mixedFrac) return Number(mixedFrac[1]) + Number(mixedFrac[2]) / Number(mixedFrac[3]);
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : WORDS[fold(t)] ?? null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Ingrédient normalisé derrière un libellé (sans les mesures ni les précisions entre parenthèses). */
function matchIngredient(name: string): string | null {
  const core = name.replace(/\([^)]*\)/g, ' ').replace(MEASURE_WORDS, '').split(/,| pour | ou /)[0]!.trim();
  return resolveIngredient(core)?.id ?? null;
}

/**
 * « 200 g de farine » → 200 g, farine ; « 2 c. à soupe d'huile d'olive » → 2 c. à s. ;
 * « 1 noix de beurre » → 1, « noix de beurre » (ingrédient : beurre) ; « Sel, poivre » → sans quantité.
 */
export function parseIngredientLine(raw: string): RecipeIngredient | null {
  let line = cleanText(raw)
    .replace(/^[-•*·▪●◦–—>]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!line || !/[a-zà-ÿ]/i.test(line)) return null;
  let optional = false;
  line = line.replace(/\s*\((?:facultatif|optionnel|selon les gouts?|si besoin)\)\s*|\s*[-–,]?\s*(?:facultatif|optionnel)\s*$/i, () => {
    optional = true;
    return ' ';
  }).trim();

  let quantity: number | null = null;
  let unit: string | null = null;
  let rest = line;

  // « Farine : 200 g » ou « Farine (200 g) »
  const trailing = /^(.+?)\s*[:(]\s*(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|[½¼¾⅓⅔])\s*([a-zà-ÿ. ]*?)\s*\)?$/i.exec(line);
  const leadNumber = /^(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛]|(?:une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze|demie?)(?=\s))\s*(?:(?:à|-|–)\s*\d+(?:[.,]\d+)?\s*)?/i.exec(line);
  if (leadNumber) {
    quantity = parseNumber(leadNumber[1]!.replace(/\s+(?=[½¼¾⅓⅔⅛])/, ''));
    rest = line.slice(leadNumber[0].length);
  } else if (trailing && parseNumber(trailing[2]!) !== null) {
    quantity = parseNumber(trailing[2]!);
    rest = `${trailing[3]} ${trailing[1]}`.trim();
    const u = fold(trailing[3]!.trim());
    for (const [re, name, factor] of UNIT_PATTERNS) {
      if (u && re.test(u)) {
        unit = name;
        quantity = quantity !== null ? round2(quantity * factor) : null;
        rest = trailing[1]!.trim();
        break;
      }
    }
  }

  if (quantity !== null && unit === null) {
    const folded = fold(rest);
    for (const [re, name, factor] of UNIT_PATTERNS) {
      const m = re.exec(folded);
      if (m) {
        unit = name;
        quantity = round2(quantity * factor);
        rest = rest.slice(m[0].length);
        break;
      }
    }
  }
  const name = rest
    .replace(/^\s*(?:de\s+|d['’]\s*|du\s+|des\s+)/i, '')
    .replace(/[\s.;,]+$/, '')
    .trim();
  if (!name) return null;
  const display = name[0]!.toLowerCase() + name.slice(1);
  return {
    ingredientId: matchIngredient(display),
    name: display,
    quantity: quantity !== null ? round2(quantity) : null,
    unit,
    ...(optional ? { optional: true } : {}),
  };
}

/** Une ligne « Sel, poivre » ou « sel et poivre » sans quantité donne deux ingrédients. */
export function parseIngredientLines(lines: string[]): RecipeIngredient[] {
  const out: RecipeIngredient[] = [];
  for (const raw of lines) {
    const parsed = parseIngredientLine(raw);
    if (!parsed) continue;
    if (parsed.quantity === null && /,| et /.test(parsed.name ?? '')) {
      const parts = (parsed.name ?? '').split(/\s*,\s*|\s+et\s+/).map((p) => p.trim()).filter(Boolean);
      const each = parts.map((p) => parseIngredientLine(p));
      if (parts.length > 1 && each.every((p) => p && p.ingredientId)) {
        out.push(...(each as RecipeIngredient[]));
        continue;
      }
    }
    out.push(parsed);
  }
  return out;
}

// ─── Durée, portions, type ───────────────────────────────────────────────────

/** « PT1H15M » → 75 ; « P0DT0H45M » → 45. */
export function parseIsoDuration(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+)S)?)?$/i.exec(v.trim());
  if (!m || v.trim() === 'P' || v.trim() === 'PT') return null;
  const minutes = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Math.round(Number(m[4] ?? 0) / 60);
  return minutes > 0 ? Math.round(minutes) : null;
}

/** « 1 h 15 », « 45 min », « 1h » → minutes. */
export function parseFrenchDuration(s: string): number | null {
  const t = fold(s);
  const h = /(\d+)\s*(?:h|heures?)\s*(\d{1,2})?/.exec(t);
  if (h) return Number(h[1]) * 60 + Number(h[2] ?? 0);
  const m = /(\d+)\s*(?:min|mn|minutes?)/.exec(t);
  return m ? Number(m[1]) : null;
}

/** « 4 personnes », 4, ["4", "4 portions"] → 4. */
export function parseYield(v: unknown): number | null {
  const values = Array.isArray(v) ? v : [v];
  for (const x of values) {
    const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(/\d+/.exec(x)?.[0]) : NaN;
    if (Number.isFinite(n) && n > 0 && n < 100) return Math.round(n);
  }
  return null;
}

const KIND_RULES: [RegExp, RecipeKind][] = [
  [/\b(petit[- ]dejeuner|brunch|porridge|granola|smoothie|pancakes?|muesli)\b/, 'petit-dejeuner'],
  [/\b(gouter|biscuits?|cookies?|madeleines?|muffins?|financiers?|sables?)\b/, 'gouter'],
  [/\b(dessert|gateaux?|cakes? (?:au|aux|a la) (?:chocolat|citron|pommes?|fruits?|yaourt)|tartes? (?:au|aux|a la|tatin) ?(?:pommes?|poires?|citron|chocolat|fraises?|fruits?|abricots?|tatin)|tiramisu|mousse au chocolat|brownies?|crumble|clafoutis|fondant|compote|creme (?:brulee|dessert|anglaise)|panna cotta|flan|riz au lait|charlotte|sorbet|glace|crepes? sucrees?|beignets?)\b/, 'dessert'],
  [/\b(soupes?|veloutes?|potages?|bouillons?|gaspacho|minestrone)\b/, 'soupe'],
  [/\b(salades?|taboule|coleslaw)\b/, 'salade'],
  [/\b(entrees?|aperitifs?|apero|tapas|amuse[- ]bouches?|verrines?|toasts?|tartinades?)\b/, 'entree'],
];

/** Type de plat d'après la catégorie du site, puis le titre et les mots-clés. */
export function guessKind(...texts: (string | null | undefined)[]): RecipeKind {
  for (const t of texts) {
    if (!t) continue;
    const f = fold(t);
    if (/\b(plat principal|plats? principaux|main course|main dish)\b/.test(f)) return 'plat';
    for (const [re, kind] of KIND_RULES) if (re.test(f)) return kind;
  }
  return 'plat';
}

// ─── Pages web : schema.org/Recipe (JSON-LD) ─────────────────────────────────

type Json = Record<string, unknown>;

function isRecipe(o: unknown): o is Json {
  if (!o || typeof o !== 'object') return false;
  const t = (o as Json)['@type'];
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
}

function collectRecipes(node: unknown, out: Json[], depth = 0): void {
  if (!node || typeof node !== 'object' || depth > 6) return;
  if (Array.isArray(node)) {
    for (const n of node) collectRecipes(n, out, depth + 1);
    return;
  }
  if (isRecipe(node)) {
    out.push(node);
    return;
  }
  const o = node as Json;
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    if (o[key]) collectRecipes(o[key], out, depth + 1);
  }
}

/** Toutes les recettes structurées d'une page HTML (balises `application/ld+json`). */
export function findJsonLdRecipes(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = m[1]!.replace(/^\s*<!--|-->\s*$/g, '').replace(/^\s*\/\/<!\[CDATA\[|\/\/\]\]>\s*$/g, '').trim();
    try {
      collectRecipes(JSON.parse(raw), out);
    } catch {
      // Bloc mal formé : on essaie les suivants.
    }
  }
  return out;
}

const asStrings = (v: unknown): string[] =>
  v == null ? [] : Array.isArray(v) ? v.flatMap(asStrings) : typeof v === 'string' ? v.split(/\s*,\s*/) : [];

function firstImage(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return /^https?:\/\//.test(v) ? v : null;
  if (Array.isArray(v)) {
    for (const x of v) {
      const u = firstImage(x);
      if (u) return u;
    }
    return null;
  }
  return firstImage((v as Json).url ?? (v as Json).contentUrl);
}

/** recipeInstructions : texte, liste de textes, HowToStep, HowToSection (aplaties). */
export function instructionSteps(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === 'string') {
    const text = v.replace(/<\/(p|li|div)>|<br\s*\/?>/gi, '\n');
    return text
      .split(/\n+/)
      .map((s) => cleanText(s).replace(/^(?:etape\s*)?\d+\s*[.)-]\s*/i, ''))
      .filter((s) => s.length > 1);
  }
  if (Array.isArray(v)) return v.flatMap(instructionSteps);
  const o = v as Json;
  if (o['@type'] === 'HowToSection' || o.itemListElement) return instructionSteps(o.itemListElement);
  return instructionSteps(o.text ?? o.name);
}

const SITE_TAGS = /^(recettes?|recette facile|cuisine|marmiton|750g|cuisine az|journal des femmes|ricardo)$/;

/** Recette schema.org → recette Gaspalli (à relire dans l'éditeur). */
export function recipeFromJsonLd(o: Json, pageUrl: string | null = null): ImportedRecipe {
  const title = cleanText(String(o.name ?? o.headline ?? 'Recette importée')).slice(0, 120);
  const rawIngredients = o.recipeIngredient ?? o.ingredients;
  const ingredients = parseIngredientLines(Array.isArray(rawIngredients) ? rawIngredients.map(String) : rawIngredients ? [String(rawIngredients)] : []);
  const steps = instructionSteps(o.recipeInstructions);
  const total = parseIsoDuration(o.totalTime);
  const parts = (parseIsoDuration(o.prepTime) ?? 0) + (parseIsoDuration(o.cookTime) ?? 0);
  const categories = asStrings(o.recipeCategory).map(cleanText);
  const keywords = asStrings(o.keywords).map((k) => cleanText(k).toLowerCase());
  const tags = [...new Set([...categories.map((c) => c.toLowerCase()), ...keywords])]
    .filter((t) => t && t.length <= 24 && !SITE_TAGS.test(fold(t)) && fold(t) !== fold(title))
    .slice(0, 6);
  const url = typeof o.url === 'string' && /^https?:\/\//.test(o.url) ? o.url : pageUrl;
  return {
    title,
    minutes: total ?? (parts || DEFAULT_MINUTES),
    servings: parseYield(o.recipeYield) ?? DEFAULT_SERVINGS,
    kind: guessKind(categories.join(' '), title, keywords.join(' ')),
    tags,
    ingredients,
    steps,
    imageUrl: firstImage(o.image),
    sourceUrl: url,
  };
}

/** Fichier JSON : une recette schema.org, une liste, ou un graphe. */
export function recipesFromJson(data: unknown): ImportedRecipe[] {
  const found: Json[] = [];
  collectRecipes(data, found);
  return found.map((r) => recipeFromJsonLd(r));
}

// ─── Texte (photo d'un livre ou d'une fiche, fichier texte) ──────────────────

const INGREDIENTS_HEADER = /^(?:les\s+)?ingredients?\b\s*(?:\(.*\))?\s*:?\s*$/;
const STEPS_HEADER = /^(?:la\s+)?(?:preparation|etapes?|instructions?|deroulement|realisation|methode|recette|marche a suivre|procede)\b\s*:?\s*$/;
const TIME_LINE = /^(?:temps (?:de )?)?(preparation|cuisson|repos|total|temps total)\s*:?\s*(.*\d.*)$/;
const SERVINGS_LINE = /\b(?:pour|recette pour)\s+(\d+)\s*(?:a\s*\d+\s*)?(?:personnes?|pers\.?|parts?|portions?|convives)\b|^(\d+)\s*(?:personnes?|parts?|portions?)$/;
const STEP_START = /^(?:etape\s*)?\d{1,2}\s*[.)-]\s+|^[-•*·▪●]\s+/;
const LOOKS_INGREDIENT = /^[-•*·▪●]?\s*(?:\d|[½¼¾⅓⅔]|une?\s|deux\s|trois\s|quatre\s|demi)/;

/**
 * Lignes lues sur une photo de recette → recette à relire. Repère les titres de section
 * (« Ingrédients », « Préparation »), les durées, le nombre de personnes, et recolle les
 * phrases coupées en fin de ligne.
 */
export function recipeFromText(rawLines: string[]): ImportedRecipe {
  const lines = rawLines.map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l && !/^\d{1,3}$/.test(l));
  let title = '';
  let servings: number | null = null;
  let total: number | null = null;
  let partial = 0;
  const ingredientLines: string[] = [];
  const stepLines: string[] = [];
  let section: 'intro' | 'ingredients' | 'steps' = 'intro';

  for (const line of lines) {
    const f = fold(line);
    const time = TIME_LINE.exec(f);
    if (time) {
      const minutes = parseFrenchDuration(time[2]!);
      if (minutes) {
        if (/total/.test(time[1]!)) total = minutes;
        else partial += minutes;
      }
      continue;
    }
    const serv = SERVINGS_LINE.exec(f);
    if (serv && line.length < 40) {
      servings = Number(serv[1] ?? serv[2]);
      continue;
    }
    if (INGREDIENTS_HEADER.test(f)) {
      section = 'ingredients';
      continue;
    }
    if (STEPS_HEADER.test(f)) {
      section = 'steps';
      continue;
    }
    if (section === 'intro') {
      if (!title && line.length <= 80) {
        title = line;
        continue;
      }
      // Pas de titre de section : une ligne qui commence par une quantité est un ingrédient.
      if (LOOKS_INGREDIENT.test(f)) ingredientLines.push(line);
      else stepLines.push(line);
      continue;
    }
    if (section === 'ingredients') {
      // Ligne coupée : un nom qui continue sur la ligne suivante (commence par une minuscule).
      const prev = ingredientLines[ingredientLines.length - 1];
      if (prev && /^[a-zà-ÿ(]/.test(line) && !LOOKS_INGREDIENT.test(f) && line.length < 30) ingredientLines[ingredientLines.length - 1] = `${prev} ${line}`;
      else ingredientLines.push(line);
      continue;
    }
    stepLines.push(line);
  }

  // Étapes : une nouvelle étape commence par un numéro ou une puce, ou après une phrase terminée.
  const steps: string[] = [];
  for (const line of stepLines) {
    const prev = steps[steps.length - 1];
    if (STEP_START.test(fold(line)) || !prev || /[.!:]$/.test(prev)) steps.push(line.replace(STEP_START, '').replace(/^(?:etape|Étape)\s*\d+\s*[.:)-]?\s*/i, ''));
    else steps[steps.length - 1] = `${prev} ${line}`;
  }

  return {
    title: (title || 'Recette').replace(/[.:]$/, '').slice(0, 120),
    minutes: total ?? (partial || DEFAULT_MINUTES),
    servings: servings ?? DEFAULT_SERVINGS,
    kind: guessKind(title),
    tags: [],
    ingredients: parseIngredientLines(ingredientLines),
    steps: steps.map((s) => s.trim()).filter((s) => s.length > 2),
    imageUrl: null,
    sourceUrl: null,
  };
}
