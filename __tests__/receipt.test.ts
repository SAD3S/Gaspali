import { groupRows, isNonFood, parseReceipt, rowsFromText, splitPack } from '@/domain/receipt';
import { aliasKey, expandLabel, matchReceiptLabel, proposeQuantity, type ReceiptAlias } from '@/domain/receiptMatch';
import { buildReview, estimateExpiry, purchaseDate, reviewSummary } from '@/domain/receiptReview';

const now = new Date(2026, 10, 24, 19, 0);

describe('lignes OCR → lignes du ticket', () => {
  it('réunit libellé et prix reconnus séparément, même sur une photo inclinée', () => {
    // Ticket incliné de ~3° : chaque ligne descend de 5 px sur 100 px.
    const tilt = (text: string, left: number, top: number, width: number) => {
      const dy = width * 0.05;
      const y = top + left * 0.05;
      return { text, left, top: y, width, height: 20, corners: [left, y, left + width, y + dy, left + width, y + dy + 20, left, y + 20] };
    };
    const lines = [
      tilt('1,85 A', 600, 100, 90),
      tilt('YAOURT NAT X4', 40, 100, 300),
      tilt('BLC POULET X2', 40, 130, 300),
      tilt('6,90 A', 600, 130, 90),
      tilt('CARREFOUR MARKET', 150, 40, 400),
    ];
    expect(groupRows(lines)).toEqual(['CARREFOUR MARKET', 'YAOURT NAT X4   1,85 A', 'BLC POULET X2   6,90 A']);
  });

  it('texte brut', () => {
    expect(rowsFromText('A\n\n  B  \r\nC')).toEqual(['A', 'B', 'C']);
  });
});

describe('contenance dans le libellé', () => {
  it.each([
    ['YAOURT NAT 4X125G', 'YAOURT NAT', { count: 4, size: { quantity: 125, unit: 'g' } }],
    ['LAIT 1/2 ECR 1L', 'LAIT 1/2 ECR', { count: 1, size: { quantity: 1, unit: 'L' } }],
    ['OEUFS PLEIN AIR X12', 'OEUFS PLEIN AIR', { count: 12, size: null }],
    ['CREME FRAICHE 20CL', 'CREME FRAICHE', { count: 1, size: { quantity: 20, unit: 'cl' } }],
    ['EAU MIN 6X1,5L', 'EAU MIN', { count: 6, size: { quantity: 1.5, unit: 'L' } }],
    ['BLC POULET', 'BLC POULET', null],
  ])('%s', (raw, label, pack) => {
    expect(splitPack(raw)).toEqual({ label, pack });
  });
});

describe('découpage du ticket', () => {
  it('ticket Carrefour : prix, quantités, remise, pesée, sac, total', () => {
    const rows = rowsFromText(`
      CARREFOUR MARKET
      12 RUE DE LA PAIX 75002 PARIS
      TEL 01 23 45 67 89
      YAOURT NAT X4                 1,85 A
      BLC POULET X2                 6,90 A
      CREME FRAICHE EPAISSE 20CL
         2 x 1,20                   2,40 A
      BANANES
         0,842 kg x 2,85 EUR/kg     2,40 A
      EMMENTAL RAPE 200G            2,35 A
      REMISE IMMEDIATE             -0,50
      SAC CABAS                     0,10 B
      LESSIVE LIQ 2L                8,90 B
      SOUS-TOTAL                   25,40
      TOTAL                        24,90
      CB EMV                       24,90
      TVA 5,5%   1,23
      24/11/2026 18:42  CAISSE 3
      MERCI DE VOTRE VISITE
    `);
    const r = parseReceipt(rows, now);
    expect(r.store).toBe('Carrefour');
    expect(r.total).toBe(24.9);
    expect(r.date).toEqual(new Date(2026, 10, 24));
    const simple = r.items.map((i) => [i.label, i.count, i.weightKg, i.price, i.nonFood]);
    expect(simple).toEqual([
      ['YAOURT NAT', 1, null, 1.85, false],
      ['BLC POULET', 1, null, 6.9, false],
      ['CREME FRAICHE EPAISSE', 2, null, 2.4, false],
      ['BANANES', 1, 0.842, 2.4, false],
      ['EMMENTAL RAPE', 1, null, 1.85, false], // 2,35 − 0,50 de remise
      ['SAC CABAS', 1, null, 0.1, true],
      ['LESSIVE LIQ', 1, null, 8.9, true],
    ]);
    expect(r.items[0]!.pack).toEqual({ count: 4, size: null });
    expect(r.items[4]!.discount).toBe(0.5);
  });

  it('ticket Leclerc : multiplicateur avant le libellé, euros et codes TVA', () => {
    const rows = rowsFromText(`
      E.LECLERC
      2 X 0,95 EUR
      PAIN DE MIE              1,90 € 1
      JB SUP DD X4             3,25 € 1
      PDT 2,5KG                2,99 € 1
      TOTAL A PAYER            8,14 €
    `);
    const r = parseReceipt(rows, now);
    expect(r.store).toBe('E.Leclerc');
    expect(r.items.map((i) => [i.label, i.count, i.price])).toEqual([
      ['PAIN DE MIE', 2, 1.9],
      ['JB SUP DD', 1, 3.25],
      ['PDT', 1, 2.99],
    ]);
    expect(r.items[2]!.pack).toEqual({ count: 1, size: { quantity: 2.5, unit: 'kg' } });
    expect(r.total).toBe(8.14);
  });

  it('ticket Lidl : multiplicateur après la ligne', () => {
    const rows = rowsFromText(`
      LIDL
      Lait demi-écrémé 1L       1,74 A
        2 x 0,87
      Tomates grappe            2,49 A
      Summe / TOTAL             4,23
    `);
    const r = parseReceipt(rows, now);
    expect(r.items.map((i) => [i.label, i.count, i.price])).toEqual([
      ['LAIT DEMI-ECREME', 2, 1.74],
      ['TOMATES GRAPPE', 1, 2.49],
    ]);
  });

  it('ignore une date dans le futur ou trop ancienne', () => {
    expect(parseReceipt(['01/01/2020', 'PAIN 1,00'], now).date).toBeNull();
    expect(parseReceipt(['24.11.26 18:42', 'PAIN 1,00'], now).date).toEqual(new Date(2026, 10, 24));
  });

  it('reconnaît les articles non alimentaires', () => {
    expect(isNonFood('SAC CABAS')).toBe(true);
    expect(isNonFood('PAPIER TOILETTE X6')).toBe(true);
    expect(isNonFood('SACHET SALADE')).toBe(false);
    expect(isNonFood('SAUCISSES')).toBe(false);
  });
});

describe('correspondance des libellés', () => {
  const none = { aliases: new Map<string, ReceiptAlias>(), products: [] };

  it('développe les abréviations', () => {
    expect(expandLabel('BLC POULET')).toBe('blanc poulet');
    expect(expandLabel('LAIT 1/2 ECR')).toBe('lait demi-écrémé');
    expect(expandLabel('CRF YAOURT NAT')).toBe('yaourt nature');
    expect(expandLabel('PDT')).toBe('pommes de terre');
  });

  it.each([
    ['BLC POULET', 'Blanc de poulet', 'viande', 'poulet'],
    ['YAOURT NAT', 'Yaourt nature', 'laitier', 'yaourt'],
    ['CREME FRAICHE EPAISSE', 'Crème fraîche épaisse', 'laitier', 'creme'],
    ['EMMENTAL RAPE', 'Emmental râpé', 'fromage', 'fromage_rape'],
    ['PDT', 'Pommes de terre', 'legumes', 'pomme_de_terre'],
    ['JB SUP DD', 'Jambon supérieur dd', 'viande', 'jambon'],
    ['BANANES', 'Bananes', 'fruits', 'banane'],
  ])('%s → %s', (label, name, category, ingredientId) => {
    expect(matchReceiptLabel(label, none)).toMatchObject({ name, category, ingredientId, source: 'ingredient' });
  });

  it('garde les accents et range les produits frais au bon endroit', () => {
    expect(matchReceiptLabel('LAIT 1/2 ECR', none)).toMatchObject({ name: 'Lait demi-écrémé', ingredientId: 'lait' });
    expect(matchReceiptLabel('PDT', none)).toMatchObject({ location: 'placard' });
    expect(matchReceiptLabel('BLC POULET', none)).toMatchObject({ location: null });
  });

  it('se rabat sur des mots-clés, puis sur « autre »', () => {
    expect(matchReceiptLabel('PIZZA REINE', none)).toMatchObject({ category: 'traiteur', source: 'mot-cle' });
    expect(matchReceiptLabel('NUTELLA', none)).toMatchObject({ category: 'epicerie_sucree', source: 'mot-cle' });
    expect(matchReceiptLabel('ZORGLUB', none)).toMatchObject({ name: 'Zorglub', category: 'autre', source: 'aucun' });
  });

  it('retrouve un produit déjà connu malgré les troncatures', () => {
    const ctx = {
      aliases: new Map<string, ReceiptAlias>(),
      products: [{ name: 'Pesto alla genovese Barilla', category: 'condiments' }, { name: 'Lait de coco', category: 'conserves' }],
    };
    expect(matchReceiptLabel('PESTO GENOV BARILLA', ctx)).toMatchObject({ name: 'Pesto alla genovese Barilla', category: 'condiments', source: 'produit' });
    // « LAIT » seul n'est pas du lait de coco.
    expect(matchReceiptLabel('LAIT 1/2 ECR', ctx)).toMatchObject({ category: 'laitier', ingredientId: 'lait', source: 'ingredient' });
  });

  it('applique en priorité ce que le foyer a appris', () => {
    const alias: ReceiptAlias = { key: aliasKey('CRF YT AROM X8'), name: 'Yaourts aromatisés', category: 'laitier', location: 'frigo', unit: 'pot' };
    const ctx = { aliases: new Map([[alias.key, alias]]), products: [] };
    expect(aliasKey('crf yt arom x8')).toBe(aliasKey('CRF  YT AROM X8'));
    expect(matchReceiptLabel('CRF YT AROM X8', ctx)).toMatchObject({ name: 'Yaourts aromatisés', source: 'alias', unit: 'pot' });
  });
});

describe('quantité proposée', () => {
  const yaourt = { category: 'laitier' as const, ingredientId: 'yaourt', name: 'Yaourt nature', unit: null };
  it('lots, contenance, pesée', () => {
    expect(proposeQuantity({ count: 1, pack: { count: 4, size: { quantity: 125, unit: 'g' } }, weightKg: null }, yaourt)).toEqual({ quantity: 4, unit: 'pot' });
    expect(proposeQuantity({ count: 2, pack: { count: 1, size: { quantity: 20, unit: 'cl' } }, weightKg: null }, yaourt)).toEqual({ quantity: 40, unit: 'cl' });
    expect(proposeQuantity({ count: 1, pack: null, weightKg: 0.842 }, { ...yaourt, category: 'fruits', ingredientId: 'banane', name: 'Bananes' })).toEqual({ quantity: 842, unit: 'g' });
    expect(proposeQuantity({ count: 2, pack: null, weightKg: null }, { category: 'boulangerie', ingredientId: 'pain_mie', name: 'Pain de mie', unit: null })).toEqual({ quantity: 2, unit: 'pièce' });
  });
});

describe('écran de revue', () => {
  const ctx = { aliases: new Map<string, ReceiptAlias>(), products: [] };

  it('propose emplacement, date estimée depuis la date du ticket, quantité et prix', () => {
    const parsed = parseReceipt(rowsFromText(`
      CARREFOUR
      YAOURT NAT 4X125G   1,85
      BLC POULET X2       6,90
      SAC CABAS           0,10
      TOTAL               8,85
      22/11/2026 10:02
    `), now);
    const lines = buildReview(parsed, ctx, 0, now);
    expect(lines.map((l) => [l.name, l.location, l.quantity, l.unit, l.price, l.include])).toEqual([
      ['Yaourt nature', 'frigo', 4, 'pot', 1.85, true],
      ['Blanc de poulet', 'frigo', 2, 'filet', 6.9, true],
      ['Sac cabas', 'frigo', 1, 'pièce', 0.1, false],
    ]);
    // Acheté le 22 : poulet (3 jours) → 25 novembre, yaourt (14 jours) → 6 décembre.
    expect(lines[1]!.expiresAt).toEqual(new Date(2026, 10, 25));
    expect(lines[0]!.expiresAt).toEqual(new Date(2026, 11, 6));
    expect(reviewSummary(lines)).toEqual({ count: 2, amount: 8.75 });
  });

  it('un ticket ancien ne rend pas les produits périmés', () => {
    expect(purchaseDate({ date: new Date(2026, 9, 1) }, now)).toBe(now);
    expect(estimateExpiry('viande', 'frigo', new Date(2026, 10, 15), now)).toEqual(new Date(2026, 10, 24));
  });
});
