import { expandUpcE, isValidGtin, normalizeBarcode } from '@/domain/barcode';
import { parsePackageDates } from '@/domain/dateOcr';
import { mapCategory, parseOffQuantity, parseOffResponse } from '@/domain/offProduct';

const today = new Date(2026, 10, 13); // 13 novembre 2026

describe('codes-barres', () => {
  it('valide les EAN-13 / EAN-8', () => {
    expect(isValidGtin('3017620422003')).toBe(true); // Nutella
    expect(isValidGtin('3017620422004')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true);
  });
  it('normalise UPC-A en EAN-13', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452');
  });
  it('développe un UPC-E', () => {
    expect(expandUpcE('04252614')).toBe('042100005264');
    expect(normalizeBarcode('04252614')).toBe('0042100005264');
  });
  it('rejette les lectures invalides', () => {
    expect(normalizeBarcode('123')).toBeNull();
    expect(normalizeBarcode('3017620422009')).toBeNull();
    expect(normalizeBarcode(' 3017620422003 ')).toBe('3017620422003');
  });
});

describe('Open Food Facts', () => {
  it('déduit la catégorie', () => {
    expect(mapCategory(['en:dairies', 'en:creams', 'en:fresh-creams'])).toBe('laitier');
    expect(mapCategory(['en:dairies', 'en:cheeses'])).toBe('fromage');
    // Yaourt à boire (Yop) : produit laitier, pas boisson à 9 mois.
    expect(mapCategory(['en:beverages', 'en:dairies', 'en:fermented-foods', 'en:yogurts', 'en:drinkable-yogurts'])).toBe('laitier');
    // Thon en boîte : conserve, pas poisson frais.
    expect(mapCategory(['en:seafood', 'en:fishes', 'en:canned-foods', 'en:canned-fishes'])).toBe('conserves');
    expect(mapCategory(['en:beverages', 'en:fruit-juices'])).toBe('boissons');
    expect(mapCategory(['en:frozen-foods', 'en:fishes'])).toBe('surgeles');
    expect(mapCategory(['en:plant-based-foods', 'en:canned-foods', 'en:vegetables'])).toBe('conserves');
    expect(mapCategory(['en:beverages', 'en:fruit-juices', 'en:fruits'])).toBe('boissons');
    expect(mapCategory(['en:spreads', 'en:sweet-spreads'])).toBe('epicerie_sucree');
    expect(mapCategory(undefined)).toBe('autre');
  });

  it.each([
    ['20 cl', 'laitier', 20, 'cl'],
    ['1,5 L', 'boissons', 1.5, 'L'],
    ['500 ml', 'boissons', 50, 'cl'],
    ['1000 g', 'epicerie_salee', 1, 'kg'],
    ['250g', 'fromage', 250, 'g'],
    ['4 x 125 g', 'laitier', 4, 'pot'],
    ['6 x 1 L', 'boissons', 6, 'pièce'],
    ['6 œufs', 'oeufs', 6, 'pièce'],
    ['', 'autre', 1, 'pièce'],
  ])('quantité « %s »', (text, cat, q, unit) => {
    expect(parseOffQuantity(text, cat as never)).toEqual({ quantity: q, unit });
  });

  it('analyse une réponse v2', () => {
    const p = parseOffResponse('3250391234567', {
      status: 1,
      product: {
        product_name_fr: 'Crème fraîche épaisse',
        product_name: 'Crème épaisse',
        brands: 'Marque Repère,Leclerc',
        quantity: '20 cl',
        categories_tags: ['en:dairies', 'en:creams'],
        image_front_small_url: 'https://images.openfoodfacts.org/x.jpg',
        nutriscore_grade: 'd',
        allergens_tags: ['en:milk'],
      },
    });
    expect(p).toEqual({
      barcode: '3250391234567',
      name: 'Crème fraîche épaisse',
      brand: 'Marque Repère',
      category: 'laitier',
      packQuantity: 20,
      packUnit: 'cl',
      imageUrl: 'https://images.openfoodfacts.org/x.jpg',
      nutriscore: 'D',
      allergens: ['milk'],
    });
  });

  it('renvoie null si introuvable ou sans nom', () => {
    expect(parseOffResponse('1', { status: 0, status_verbose: 'product not found' })).toBeNull();
    expect(parseOffResponse('1', { status: 1, product: { product_name: '  ' } })).toBeNull();
    expect(parseOffResponse('1', null)).toBeNull();
  });
});

describe('lecture de la date (OCR)', () => {
  const first = (text: string) => parsePackageDates(text, today)[0];
  const ymd = (d?: Date) => d && `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  it.each([
    ['A consommer jusqu’au : 20/11/26', '2026-11-20', 'DLC'],
    ['À CONSOMMER JUSQU\'AU 20/11/2026 L1234', '2026-11-20', 'DLC'],
    ['DLC 20.11.26', '2026-11-20', 'DLC'],
    ['A consommer de préférence avant le 03-2027', '2027-3-31', 'DDM'],
    ['A consommer de préférence avant fin : 03/2027', '2027-3-31', 'DDM'],
    ['DDM 15 MARS 2027', '2027-3-15', 'DDM'],
    ['20 11', '2026-11-20', null],
    ['BEST BEFORE 11/27', '2027-11-30', 'DDM'],
    ['NOV 2027', '2027-11-30', null],
    ['à consommer jusqu\'au 2O/11/26', '2026-11-20', 'DLC'],
  ])('« %s » → %s', (text, expected, type) => {
    const c = first(text);
    expect(ymd(c?.date)).toBe(expected);
    expect(c?.dateType).toBe(type);
  });

  it('JJ MM sans année passé → année suivante', () => {
    expect(ymd(first('05 01')?.date)).toBe('2027-1-5');
  });

  it('ignore les prix, poids et heures', () => {
    expect(parsePackageDates('Prix 12.50 € Poids 0,250 kg 10:45', today)).toEqual([]);
  });

  it('préfère la date accompagnée d’une mention', () => {
    const c = parsePackageDates('Fabriqué le 01/11/26 — A consommer jusqu’au 25/11/26', today);
    expect(ymd(c[0]?.date)).toBe('2026-11-25');
    expect(c).toHaveLength(2);
  });

  it('rejette les dates invalides ou invraisemblables', () => {
    expect(parsePackageDates('31/02/26', today)).toEqual([]);
    expect(parsePackageDates('20/11/1999', today)).toEqual([]);
  });
});
