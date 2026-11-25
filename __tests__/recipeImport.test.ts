import {
  cleanText,
  findJsonLdRecipes,
  guessKind,
  instructionSteps,
  parseIngredientLine,
  parseIngredientLines,
  parseIsoDuration,
  parseYield,
  recipeFromJsonLd,
  recipeFromText,
  recipesFromJson,
} from '@/domain/recipeImport';

describe('lignes d’ingrédients', () => {
  it.each([
    ['200 g de farine', { ingredientId: 'farine', name: 'farine', quantity: 200, unit: 'g' }],
    ['250g de beurre doux', { ingredientId: 'beurre', name: 'beurre doux', quantity: 250, unit: 'g' }],
    ['20 cl de crème fraîche épaisse', { ingredientId: 'creme', quantity: 20, unit: 'cl' }],
    ['50 ml de lait', { ingredientId: 'lait', quantity: 5, unit: 'cl' }],
    ['1 dl de lait', { ingredientId: 'lait', quantity: 10, unit: 'cl' }],
    ['2 cuillères à soupe d’huile d’olive', { ingredientId: 'huile_olive', quantity: 2, unit: 'c. à s.' }],
    ['1 c. à c. de cannelle', { ingredientId: 'cannelle', quantity: 1, unit: 'c. à c.' }],
    ['3 œufs', { ingredientId: 'oeufs', name: 'œufs', quantity: 3, unit: null }],
    ['1/2 citron', { ingredientId: 'citron', quantity: 0.5, unit: null }],
    ['1 ½ kg de pommes de terre', { ingredientId: 'pomme_de_terre', quantity: 1.5, unit: 'kg' }],
    ['2 gousses d’ail', { ingredientId: 'ail', quantity: 2, unit: 'gousse' }],
    ['1 noix de beurre', { ingredientId: 'beurre', name: 'noix de beurre', quantity: 1, unit: null }],
    ['une pincée de sel', { ingredientId: 'sel', quantity: 1, unit: 'pincée' }],
    ['Farine : 200 g', { ingredientId: 'farine', quantity: 200, unit: 'g' }],
    ['- 4 tomates', { ingredientId: 'tomate', quantity: 4 }],
    ['2 à 3 carottes', { ingredientId: 'carotte', quantity: 2 }],
    ['Persil (facultatif)', { ingredientId: 'persil', quantity: null, optional: true }],
    ['1 verre de vin blanc', { ingredientId: 'vin_blanc', name: 'verre de vin blanc', quantity: 1 }],
  ])('%s', (line, expected) => {
    expect(parseIngredientLine(line)).toMatchObject(expected);
  });

  it('sépare « Sel, poivre » et ignore les lignes vides', () => {
    expect(parseIngredientLines(['Sel, poivre', '', '•'])).toEqual([
      { ingredientId: 'sel', name: 'sel', quantity: null, unit: null },
      { ingredientId: 'poivre', name: 'poivre', quantity: null, unit: null },
    ]);
  });
});

describe('durées, portions, type', () => {
  it('durées ISO', () => {
    expect(parseIsoDuration('PT1H15M')).toBe(75);
    expect(parseIsoDuration('PT45M')).toBe(45);
    expect(parseIsoDuration('P0DT0H20M')).toBe(20);
    expect(parseIsoDuration('PT0M')).toBeNull();
    expect(parseIsoDuration(undefined)).toBeNull();
  });
  it('portions', () => {
    expect(parseYield('6 personnes')).toBe(6);
    expect(parseYield(['4', '4 parts'])).toBe(4);
    expect(parseYield(8)).toBe(8);
    expect(parseYield('quelques')).toBeNull();
  });
  it('type de plat', () => {
    expect(guessKind('Dessert', 'Fondant au chocolat')).toBe('dessert');
    expect(guessKind(null, 'Tarte aux poireaux')).toBe('plat');
    expect(guessKind(null, 'Velouté de potiron')).toBe('soupe');
    expect(guessKind('Plat principal', 'Salade tiède de lentilles')).toBe('plat');
    expect(guessKind(null, 'Tarte aux pommes')).toBe('dessert');
  });
});

describe('pages web (schema.org/Recipe)', () => {
  // Forme typique des grands sites : Recipe directement, étapes HowToStep, entités HTML.
  const marmitonLike = `<html><head>
    <script type="application/ld+json">{"@context":"http://schema.org","@type":"WebSite","name":"Site"}</script>
    <script type="application/ld+json">{"@context":"http://schema.org","@type":"Recipe","name":"Gratin dauphinois &amp; cr&egrave;me",
      "recipeCategory":"Plat principal","keywords":"gratin, pommes de terre, Recettes",
      "image":["https://img.example.com/gratin.jpg"],"recipeYield":"6 personnes","prepTime":"PT20M","cookTime":"PT1H","totalTime":"PT1H20M",
      "recipeIngredient":["1 kg de pommes de terre","50 cl de lait","20 cl de crème fraîche","2 gousses d'ail","Sel, poivre"],
      "recipeInstructions":[{"@type":"HowToStep","text":"Éplucher les pommes de terre."},{"@type":"HowToStep","text":"Faire chauffer le lait avec l&#039;ail."},{"@type":"HowToStep","text":"Cuire 1 h à 180 °C."}]}</script>
  </head></html>`;

  it('lit la recette, ses durées, ses portions et ses étapes', () => {
    const [r] = findJsonLdRecipes(marmitonLike);
    const rec = recipeFromJsonLd(r!, 'https://www.example.com/gratin');
    expect(rec).toMatchObject({
      title: 'Gratin dauphinois & crème',
      minutes: 80,
      servings: 6,
      kind: 'plat',
      imageUrl: 'https://img.example.com/gratin.jpg',
      sourceUrl: 'https://www.example.com/gratin',
      steps: ['Éplucher les pommes de terre.', "Faire chauffer le lait avec l'ail.", 'Cuire 1 h à 180 °C.'],
    });
    expect(rec.tags).toEqual(['plat principal', 'gratin', 'pommes de terre']);
    expect(rec.ingredients.map((i) => i.ingredientId)).toEqual(['pomme_de_terre', 'lait', 'creme', 'ail', 'sel', 'poivre']);
  });

  // Forme des blogs (WordPress + Yoast / WP Recipe Maker) : @graph, sections d'étapes, @type en liste.
  const blogLike = `<script type='application/ld+json' class='yoast-schema-graph'>{"@context":"https://schema.org","@graph":[
    {"@type":"Article","headline":"Mon fondant"},
    {"@type":["Recipe"],"name":"Fondant au chocolat","recipeCategory":["Dessert"],"recipeYield":["8","8 parts"],"totalTime":"PT45M",
     "image":{"@type":"ImageObject","url":"https://blog.example.com/fondant.jpg"},
     "recipeIngredient":["200 g de chocolat noir","150 g de beurre","4 œufs","100 g de sucre","50 g de farine"],
     "recipeInstructions":[{"@type":"HowToSection","name":"Pâte","itemListElement":[{"@type":"HowToStep","text":"Faire fondre le chocolat et le beurre."},{"@type":"HowToStep","text":"Ajouter les œufs et le sucre."}]},
       {"@type":"HowToSection","name":"Cuisson","itemListElement":[{"@type":"HowToStep","text":"Cuire 25 min à 180 °C."}]}]}]}</script>`;

  it('trouve la recette dans un graphe et aplatit les sections', () => {
    const recipes = findJsonLdRecipes(blogLike);
    expect(recipes).toHaveLength(1);
    const rec = recipeFromJsonLd(recipes[0]!);
    expect(rec).toMatchObject({ title: 'Fondant au chocolat', kind: 'dessert', servings: 8, minutes: 45, imageUrl: 'https://blog.example.com/fondant.jpg' });
    expect(rec.steps).toHaveLength(3);
  });

  it('étapes en texte libre et page sans recette', () => {
    expect(instructionSteps('<p>1. Mélanger.</p><p>2. Cuire.</p>')).toEqual(['Mélanger.', 'Cuire.']);
    expect(findJsonLdRecipes('<html><script type="application/ld+json">{oups</script></html>')).toEqual([]);
  });

  it('fichier JSON avec plusieurs recettes', () => {
    const data = [{ '@type': 'Recipe', name: 'A', recipeIngredient: ['1 œuf'] }, { '@type': 'Recipe', name: 'B', recipeIngredient: [] }];
    expect(recipesFromJson(data).map((r) => r.title)).toEqual(['A', 'B']);
  });

  it('nettoie le HTML', () => {
    expect(cleanText('Cr&egrave;me&nbsp;<b>fra&#238;che</b>')).toBe('Crème fraîche');
  });
});

describe('photo d’une recette (texte lu)', () => {
  it('livre de cuisine : sections, durées, personnes, phrases coupées', () => {
    const lines = [
      'Quiche aux poireaux',
      'Pour 6 personnes',
      'Préparation : 20 min',
      'Cuisson : 40 min',
      'Ingrédients',
      '1 pâte brisée',
      '3 poireaux',
      '3 œufs',
      '20 cl de crème',
      'fraîche',
      '100 g de lardons',
      'Préparation',
      '1. Préchauffez le four à 180 °C. Lavez les poireaux et',
      'émincez-les finement.',
      '2. Faites-les fondre 10 min dans une poêle avec les lardons.',
      '3. Battez les œufs avec la crème, versez sur la pâte garnie',
      'et enfournez.',
      '42',
    ];
    const r = recipeFromText(lines);
    expect(r).toMatchObject({ title: 'Quiche aux poireaux', servings: 6, minutes: 60, kind: 'plat' });
    expect(r.ingredients.map((i) => i.ingredientId)).toEqual(['pate_brisee', 'poireau', 'oeufs', 'creme', 'lardons']);
    expect(r.ingredients[3]).toMatchObject({ name: 'crème fraîche', quantity: 20, unit: 'cl' });
    expect(r.steps).toEqual([
      'Préchauffez le four à 180 °C. Lavez les poireaux et émincez-les finement.',
      'Faites-les fondre 10 min dans une poêle avec les lardons.',
      'Battez les œufs avec la crème, versez sur la pâte garnie et enfournez.',
    ]);
  });

  it('fiche sans titres de section', () => {
    const r = recipeFromText(['Crêpes', '250 g de farine', '4 œufs', '50 cl de lait', 'Mélanger la farine et les œufs.', 'Ajouter le lait petit à petit.']);
    expect(r.title).toBe('Crêpes');
    expect(r.ingredients).toHaveLength(3);
    expect(r.steps).toEqual(['Mélanger la farine et les œufs.', 'Ajouter le lait petit à petit.']);
  });
});
