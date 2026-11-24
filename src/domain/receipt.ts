/**
 * Lecture d'un ticket de caisse : reconstitution des lignes à partir de l'OCR, découpage en
 * articles (libellé, nombre, contenance, pesée, prix), remises, lignes non alimentaires.
 * Logique pure : la correspondance avec les produits est dans `receiptMatch.ts`.
 */

/** Ligne OCR avec position (cf. `services/textRecognition`). */
export interface OcrLineLike {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  corners?: number[];
}

// ─── 1. Lignes du ticket ─────────────────────────────────────────────────────

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Regroupe les lignes OCR en lignes de ticket : sur un ticket, le libellé (à gauche) et le prix
 * (à droite) sont reconnus séparément. On redresse d'abord la photo (inclinaison médiane des
 * lignes), puis on réunit les morceaux à la même hauteur, de gauche à droite.
 */
export function groupRows(lines: OcrLineLike[]): string[] {
  const usable = lines.filter((l) => l.text.trim() && l.height > 0);
  if (!usable.length) return [];
  const angles = usable
    .filter((l) => l.corners && l.corners.length >= 4 && l.width > 2 * l.height)
    .map((l) => Math.atan2(l.corners![3]! - l.corners![1]!, l.corners![2]! - l.corners![0]!));
  const angle = median(angles);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const pts = usable
    .map((l) => {
      const cx = l.left + l.width / 2;
      const cy = l.top + l.height / 2;
      return { text: l.text.trim(), x: cx * cos - cy * sin, y: cx * sin + cy * cos, h: l.height };
    })
    .sort((a, b) => a.y - b.y);

  const rows: { y: number; h: number; parts: typeof pts }[] = [];
  for (const p of pts) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(p.y - row.y) <= 0.55 * Math.min(p.h, row.h)) {
      row.parts.push(p);
      row.y = row.parts.reduce((s, x) => s + x.y, 0) / row.parts.length;
    } else {
      rows.push({ y: p.y, h: p.h, parts: [p] });
    }
  }
  return rows.map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.text).join('   '));
}

/** Texte brut (OCR sans positions, ou texte collé) → lignes. */
export function rowsFromText(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

// ─── 2. Normalisation ────────────────────────────────────────────────────────

/** Majuscules sans accents, espaces simples. */
export function upperAscii(s: string): string {
  return s
    .replace(/œ/gi, 'OE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const AMOUNT = String.raw`-?\d{1,4}[.,]\d{2}`;
/** Prix en fin de ligne, suivi éventuellement de « € », d'un code TVA (« A », « 1 », « 5,5% »). */
const PRICE_AT_END = new RegExp(String.raw`(?:^|\s)(${AMOUNT})\s*(?:€|EUR|E)?\s*(?:[A-Z*]{1,2}|\d{1,2}(?:[.,]\d{1,2})?\s*%?)?\s*$`);
const toNumber = (s: string) => Number(s.replace(',', '.'));

/** « 2 x 1,85 » (+ total éventuel) */
const MULTIPLIER = new RegExp(String.raw`^(\d{1,3})\s*[X*]\s*(${AMOUNT})\s*(?:€|EUR)?(?:\s*\/?\s*(?:U|UN|UNITE|PCE|PC))?(?:\s+(${AMOUNT})\s*(?:€|EUR)?\s*(?:[A-Z*]{1,2}|\d{1,2})?)?\s*$`);
/** « 0,842 kg x 2,85 €/kg » (+ total éventuel) */
const WEIGHT = new RegExp(String.raw`^(\d{1,3}[.,]\d{1,3})\s*KG\s*(?:[X*@]|A)?\s*(${AMOUNT})\s*(?:€|EUR)?\s*\/\s*KG(?:\s+(${AMOUNT})\s*(?:€|EUR)?\s*(?:[A-Z*]{1,2}|\d{1,2})?)?\s*$`);

/** Fin des articles (« TOTAL », « NET A PAYER », « SUMME / TOTAL »). */
const END_OF_ITEMS = /^(?:\S+\s*\/\s*)?(SOUS[- ]?TOTAL|TOTAL|NET A PAYER|A PAYER|MONTANT (DU|A PAYER)|TOTAL TTC|TOTAL A PAYER)\b/;
const SKIP =
  /\b(TVA|HT|TTC|CB|CARTE|VISA|MASTERCARD|ESPECES|RENDU|MONNAIE|PAIEMENT|REGLEMENT|TICKET|CAISSE|CAISSIER|CAISSIERE|MERCI|SIRET|SIREN|TEL|NB ARTICLES?|ARTICLES?|POINTS|CAGNOTTE|SOLDE|CONTACTLESS|SANS CONTACT|AUTORISATION|DEBIT|TRANSACTION|BIENVENUE|HORAIRES|OUVERT)\b/;
const DISCOUNT = /\b(REMISE|PROMO|REDUC|REDUCTION|RISTOURNE|BON D.?ACHAT|AVANTAGE|COUPON|ECONOMIE|IMMEDIATE|FIDELITE|ANNULATION|ANNUL)\b/;

const NON_FOOD = [
  'SAC', 'SACS', 'CABAS', 'SACHET CAISSE', 'LESSIVE', 'ADOUCISSANT', 'JAVEL', 'NETTOYANT', 'DEGRAISSANT', 'DESINFECTANT',
  'LIQUIDE VAISSELLE', 'LIQ VAISS', 'PASTILLES LV', 'LAVE VAISSELLE', 'TABLETTES LV', 'EPONGE', 'EPONGES', 'ESSUIE', 'ESSUIE TOUT', 'SOPALIN',
  'PAPIER TOILETTE', 'PAP TOIL', 'PQ', 'MOUCHOIR', 'MOUCHOIRS', 'COTON', 'COTONS', 'DENTIFRICE', 'BROSSE A DENTS', 'SHAMPOING', 'SHAMPOOING',
  'APRES SHAMPOING', 'GEL DOUCHE', 'DOUCHE', 'SAVON', 'DEODORANT', 'DEO', 'RASOIR', 'RASOIRS', 'COUCHES', 'LINGETTES', 'PILE', 'PILES',
  'AMPOULE', 'PAPIER ALU', 'ALU', 'FILM ALIMENTAIRE', 'SAC CONGELATION', 'SACS CONGELATION', 'SAC POUBELLE', 'SACS POUBELLE', 'POUBELLE', 'BOUGIE',
  'ALLUMETTES', 'JOURNAL', 'MAGAZINE', 'TIMBRE', 'TIMBRES', 'CONSIGNE', 'LITIERE', 'CROQUETTES', 'PATEE', 'CHAT', 'CHIEN', 'PROTEGE SLIP',
  'SERVIETTES HYG', 'TAMPONS', 'VAISSELLE', 'GOBELETS', 'ASSIETTES CARTON', 'CHARBON',
];
const NON_FOOD_PATTERNS = NON_FOOD.map((w) => new RegExp(String.raw`(^|\s)${w}(\s|$)`));

export function isNonFood(label: string): boolean {
  const u = upperAscii(label);
  return NON_FOOD_PATTERNS.some((re) => re.test(u));
}

// ─── 3. Contenance dans le libellé ───────────────────────────────────────────

export interface Pack {
  /** Nombre d'unités dans le lot (« X4 », « 6X1L »). */
  count: number;
  /** Contenance d'une unité (« 125G », « 1L »), si lue. */
  size: { quantity: number; unit: 'g' | 'kg' | 'cl' | 'L' } | null;
}

function sizeOf(n: string, u: string): Pack['size'] {
  const q = toNumber(n);
  if (!(q > 0)) return null;
  switch (u) {
    case 'G':
    case 'GR':
      return { quantity: q, unit: 'g' };
    case 'KG':
      return { quantity: q, unit: 'kg' };
    case 'CL':
      return { quantity: q, unit: 'cl' };
    case 'ML':
      return { quantity: q / 10, unit: 'cl' };
    case 'L':
    case 'LT':
      return { quantity: q, unit: 'L' };
    default:
      return null;
  }
}

/**
 * Sépare le libellé de sa contenance : « YAOURT NAT 4X125G » → « YAOURT NAT », 4 × 125 g ;
 * « LAIT 1/2 ECR 1L » → 1 × 1 L ; « OEUFS X12 » → 12.
 */
export function splitPack(raw: string): { label: string; pack: Pack | null } {
  let s = ` ${upperAscii(raw)} `;
  let count = 1;
  let size: Pack['size'] = null;
  let found = false;
  const unit = String.raw`(G|GR|KG|CL|ML|L|LT)`;
  const num = String.raw`(\d+(?:[.,]\d+)?)`;

  s = s.replace(new RegExp(String.raw`\s(\d{1,2})\s?[X*]\s?${num}\s?${unit}(?=\s)`), (_, n: string, q: string, u: string) => {
    count = Number(n);
    size = sizeOf(q, u);
    found = true;
    return ' ';
  });
  if (!found) {
    s = s.replace(new RegExp(String.raw`\s${num}\s?${unit}\s?[X*]\s?(\d{1,2})(?=\s)`), (_, q: string, u: string, n: string) => {
      count = Number(n);
      size = sizeOf(q, u);
      found = true;
      return ' ';
    });
  }
  s = s.replace(/\s(?:X\s?(\d{1,2})|(\d{1,2})\s?X)(?=\s)/, (m, a?: string, b?: string) => {
    count = Number(a ?? b);
    found = true;
    return ' ';
  });
  if (!size) {
    s = s.replace(new RegExp(String.raw`\s${num}\s?${unit}(?=\s)`), (_, q: string, u: string) => {
      size = sizeOf(q, u);
      if (size) found = true;
      return size ? ' ' : _;
    });
  }
  // Codes article en tête (« 3017620422003 NUTELLA ») et ponctuation résiduelle.
  const label = s.replace(/^\s*\d{4,}\s+/, ' ').replace(/[*#]+/g, ' ').replace(/\s+/g, ' ').trim();
  return { label, pack: found && count > 0 ? { count, size } : null };
}

// ─── 4. Articles ─────────────────────────────────────────────────────────────

export interface ReceiptItem {
  /** Position dans le ticket (clé stable pour l'écran de revue). */
  index: number;
  /** Ligne lue sur le ticket. */
  raw: string;
  /** Libellé sans prix ni contenance (« YAOURT NAT »). */
  label: string;
  /** Nombre d'exemplaires achetés (« 2 x 1,85 »). */
  count: number;
  pack: Pack | null;
  /** Pesée (fruits et légumes, rayon coupe). */
  weightKg: number | null;
  /** Prix payé pour la ligne, remises déduites. */
  price: number | null;
  /** Remise appliquée (€, positive). */
  discount: number;
  nonFood: boolean;
}

export interface ParsedReceipt {
  store: string | null;
  date: Date | null;
  items: ReceiptItem[];
  total: number | null;
}

const STORES: [RegExp, string][] = [
  [/\bCARREFOUR\b/, 'Carrefour'],
  [/\b(E\.?\s?)?LECLERC\b/, 'E.Leclerc'],
  [/\bAUCHAN\b/, 'Auchan'],
  [/\bINTERMARCHE\b/, 'Intermarché'],
  [/\b(SUPER|HYPER) U\b|\bU EXPRESS\b|\bMAGASINS U\b/, 'Magasins U'],
  [/\bMONOPRIX\b|\bMONOP\b/, 'Monoprix'],
  [/\bFRANPRIX\b/, 'Franprix'],
  [/\bCASINO\b/, 'Casino'],
  [/\bLIDL\b/, 'Lidl'],
  [/\bALDI\b/, 'Aldi'],
  [/\bNETTO\b/, 'Netto'],
  [/\bLEADER PRICE\b/, 'Leader Price'],
  [/\bPICARD\b/, 'Picard'],
  [/\bBIOCOOP\b/, 'Biocoop'],
  [/\bNATURALIA\b/, 'Naturalia'],
  [/\bGRAND FRAIS\b/, 'Grand Frais'],
  [/\bCORA\b/, 'Cora'],
  [/\bSPAR\b/, 'Spar'],
  [/\bG20\b/, 'G20'],
  [/\bLA VIE CLAIRE\b/, 'La Vie Claire'],
  [/\bCOCCINELLE\b/, 'Coccinelle'],
  [/\bVIVAL\b/, 'Vival'],
];

/** Date du ticket (« 24/11/2026 », « 24.11.26 ») : la plus récente plausible, pas dans le futur. */
function findDate(rows: string[], now: Date): Date | null {
  let best: Date | null = null;
  for (const r of rows) {
    for (const m of r.matchAll(/\b(\d{2})[/.-](\d{2})[/.-](\d{4}|\d{2})\b/g)) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      let year = Number(m[3]);
      if (year < 100) year += 2000;
      if (day < 1 || day > 31 || month < 1 || month > 12) continue;
      const d = new Date(year, month - 1, day);
      if (d.getMonth() !== month - 1) continue;
      const ageDays = (now.getTime() - d.getTime()) / 86_400_000;
      if (ageDays < -1 || ageDays > 365) continue;
      if (!best || d > best) best = d;
    }
  }
  return best;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const close = (a: number, b: number) => Math.abs(a - b) < 0.015;
const hasLetters = (s: string) => /[A-Z]{2,}/.test(s);

/** Découpe les lignes d'un ticket en articles. */
export function parseReceipt(rows: string[], now: Date = new Date()): ParsedReceipt {
  const items: ReceiptItem[] = [];
  let store: string | null = null;
  let total: number | null = null;
  let ended = false;
  let pendingLabel: string | null = null;
  let pendingMult: { count: number; unit: number } | null = null;
  let pendingWeight: { kg: number; unit: number } | null = null;

  const push = (raw: string, labelRaw: string, price: number | null, extra: Partial<ReceiptItem> = {}) => {
    const { label, pack } = splitPack(labelRaw);
    if (!hasLetters(label)) return;
    const item: ReceiptItem = {
      index: items.length, raw: raw.replace(/\s+/g, ' ').trim(), label, count: 1, pack, weightKg: null,
      price: price === null ? null : round2(price), discount: 0, nonFood: isNonFood(label), ...extra,
    };
    // Multiplicateur ou pesée lus juste avant, s'ils correspondent au prix.
    if (pendingMult && price !== null && close(pendingMult.count * pendingMult.unit, price)) item.count = pendingMult.count;
    if (pendingWeight && price !== null && close(pendingWeight.kg * pendingWeight.unit, price)) item.weightKg = pendingWeight.kg;
    pendingMult = null;
    pendingWeight = null;
    items.push(item);
  };

  for (const original of rows) {
    const row = upperAscii(original);
    if (!row) continue;
    const storeRow = STORES.find(([re]) => re.test(row));
    if (storeRow && !store) store = storeRow[1];
    if (ended) continue;
    if (storeRow && !PRICE_AT_END.test(row)) {
      pendingLabel = null;
      continue;
    }

    if (END_OF_ITEMS.test(row)) {
      const m = row.match(PRICE_AT_END);
      if (m && items.length && !/SOUS/.test(row)) total = toNumber(m[1]!);
      if (items.length && !/SOUS/.test(row)) ended = true;
      pendingLabel = null;
      continue;
    }

    const mult = row.match(MULTIPLIER);
    if (mult) {
      const count = Number(mult[1]);
      const unit = toNumber(mult[2]!);
      const lineTotal = mult[3] ? toNumber(mult[3]) : round2(count * unit);
      const last = items[items.length - 1];
      // Avec un total, la ligne complète le libellé lu juste avant (« 2 x 1,20   2,40 ») ;
      // sans total, elle annonce l'article suivant (« 2 X 0,95 EUR » puis « PAIN DE MIE 1,90 »).
      if (pendingLabel && mult[3]) {
        push(`${pendingLabel} / ${original}`, pendingLabel, lineTotal, { count });
        pendingLabel = null;
      } else if (last && last.count === 1 && last.price !== null && close(last.price, count * unit)) {
        last.count = count;
      } else {
        pendingMult = { count, unit };
      }
      continue;
    }

    const weight = row.match(WEIGHT);
    if (weight) {
      const kg = toNumber(weight[1]!);
      const unit = toNumber(weight[2]!);
      const lineTotal = weight[3] ? toNumber(weight[3]) : round2(kg * unit);
      const last = items[items.length - 1];
      if (pendingLabel) {
        push(`${pendingLabel} / ${original}`, pendingLabel, lineTotal, { weightKg: kg });
        pendingLabel = null;
      } else if (last && last.weightKg === null && last.price !== null && close(last.price, kg * unit)) {
        last.weightKg = kg;
      } else {
        pendingWeight = { kg, unit };
      }
      continue;
    }

    const priceMatch = row.match(PRICE_AT_END);
    const price = priceMatch ? toNumber(priceMatch[1]!) : null;
    const label = priceMatch ? row.slice(0, priceMatch.index).trim() : row;

    // Remise : on la retire du dernier article (le prix payé alimente les statistiques).
    if (price !== null && (price < 0 || (DISCOUNT.test(label) && items.length))) {
      const last = items[items.length - 1];
      if (last && last.price !== null) {
        const off = Math.min(Math.abs(price), last.price);
        last.price = round2(last.price - off);
        last.discount = round2(last.discount + off);
      }
      pendingLabel = null;
      continue;
    }
    if (SKIP.test(label) || DISCOUNT.test(label)) {
      pendingLabel = null;
      continue;
    }
    if (price === null) {
      // Libellé dont le prix est sur la ligne suivante (« 2 x 1,85   3,70 »).
      pendingLabel = hasLetters(row) ? row : null;
      continue;
    }
    pendingLabel = null;
    push(original, label, price);
  }

  return { store, date: findDate(rows, now), items, total };
}

/** Somme des articles alimentaires retenus. */
export function itemsTotal(items: Pick<ReceiptItem, 'price'>[]): number {
  return round2(items.reduce((s, i) => s + (i.price ?? 0), 0));
}
