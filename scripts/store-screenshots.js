/**
 * Captures Play Store (1080×1920) : lancer l'app web (`npm run web`, port 8081) puis
 * node scripts/store-screenshots.js (Playwright + Chromium). Données de démo chargées depuis « Plus ».
 */
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, '..', 'docs', 'store') + '/captures';
const BASE = 'http://localhost:8081';
const TICKET = `CARREFOUR MARKET
YAOURT NAT 4X125G             1,85 A
BLC POULET X2                 6,90 A
CREME FRAICHE EPAISSE 20CL
   2 x 1,20                   2,40 A
BANANES
   0,842 kg x 2,85 EUR/kg     2,40 A
EMMENTAL RAPE 200G            2,35 A
LAIT 1/2 ECR 1L               0,99 A
PDT 2,5KG                     2,99 A
TOTAL                        19,88
24/11/2026 18:42`;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, colorScheme: 'light' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` });
  await p.goto(BASE + '/plus'); await p.waitForTimeout(10000);
  await p.getByText('Passer').click(); await p.waitForTimeout(800);
  await p.getByText('C’est parti').click(); await p.waitForTimeout(2500);
  await p.goto(BASE + '/plus'); await p.waitForTimeout(5000);
  await p.getByText('Charger des produits de démo').click(); await p.waitForTimeout(1500);
  await p.getByText('Planning des repas').click(); await p.waitForTimeout(4000);
  await p.getByText('Planifier ma semaine anti-gaspi').click(); await p.waitForTimeout(2000);
  await shot('4-planning');
  await p.getByText(/^Ajouter \d+ repas au planning$/).click(); await p.waitForTimeout(5000);
  await p.goBack(); await p.waitForTimeout(1500);
  await p.getByText('Accueil').last().click(); await p.waitForTimeout(3500);
  await shot('1-accueil');
  await p.getByText('Inventaire').last().click(); await p.waitForTimeout(3000);
  await shot('2-inventaire');
  await p.goto(BASE + '/recettes/gratin-poulet-epinards'); await p.waitForTimeout(5000);
  await p.mouse.wheel(0, 380); await p.waitForTimeout(800);
  await shot('5-recette');
  await p.goto(BASE + '/statistiques'); await p.waitForTimeout(5000);
  await shot('6-statistiques');
  await p.goto(BASE + '/scan?onglet=ticket'); await p.waitForTimeout(5000);
  await p.getByRole('button', { name: 'Saisir le texte' }).click(); await p.waitForTimeout(1500);
  await p.getByLabel('Texte du ticket').fill(TICKET);
  await p.getByText('Analyser le ticket').click(); await p.waitForTimeout(2000);
  await shot('3-ticket');
  await ctx.close(); await b.close();
})();
